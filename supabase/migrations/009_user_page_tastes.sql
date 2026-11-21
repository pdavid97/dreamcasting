-- 009 유저 페이지 + 취향 등록 + 알림
-- 유저 페이지: 캐스팅 이력, 적중률, 받은 공감, 업적. 남의 페이지에서는 결과가 나온 배역의 표만 공개(진행 중 투표는 본인만)
-- 취향: 분류, 장르, 배우(팬 채널 팔로우와 같음), 감독/작가. 맞는 새 소식이 생기면 notices에 쌓임

alter table public.profiles add column if not exists bio text check (bio is null or char_length(bio) <= 100);
alter table public.profiles add column if not exists tastes jsonb not null default '{}'::jsonb;
alter table public.topics add column if not exists tags text[] not null default '{}';

create table public.notices(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  topic_id text references public.topics(id) on delete cascade,
  person_id bigint references public.people(id) on delete cascade,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notices(user_id, created_at desc);
alter table public.notices enable row level security;
create policy "own read" on public.notices for select using (auth.uid() = user_id);

-- 취향 저장: {"cats":["wn"],"genres":["로맨스"],"makers":["김은숙"]} 항목당 최대 10개, 각 20자
create function public.set_tastes(t jsonb, b text) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := me(); clean jsonb := '{}'; k text; arr text[];
begin
  foreach k in array array['cats','genres','makers'] loop
    select coalesce(array_agg(distinct left(btrim(x), 20)) filter (where char_length(btrim(x)) > 0), '{}') into arr
      from (select jsonb_array_elements_text(case when jsonb_typeof(t->k) = 'array' then t->k else '[]'::jsonb end) x limit 10) z;
    if k = 'cats' then arr := array(select unnest(arr) intersect select unnest(array['wn','k2','us2k','k2us'])); end if;
    clean := clean || jsonb_build_object(k, to_jsonb(arr));
  end loop;
  update profiles set tastes = clean, bio = nullif(left(btrim(coalesce(b,'')), 100), '') where id = u;
end $$;

-- 작품 태그(장르, 감독, 작가): 주제를 연 사람이나 운영자가 붙임. 붙이면 취향이 맞는 사람에게 알림
create function public.set_topic_tags(tid text, tg text[]) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := me(); clean text[]; added text[]; t record;
begin
  select * into t from topics where id = tid;
  if t.id is null then raise exception '작품이 없어요'; end if;
  if t.created_by is distinct from u and not admin_check() then raise exception '주제를 연 사람이나 운영자만 태그를 붙일 수 있어요'; end if;
  select coalesce(array_agg(distinct left(btrim(x), 20)) filter (where char_length(btrim(x)) > 0), '{}') into clean from (select unnest(tg) x limit 8) z;
  added := array(select unnest(clean) except select unnest(t.tags));
  update topics set tags = clean where id = tid;
  if cardinality(added) > 0 then
    insert into notices(user_id, kind, topic_id, body)
    select p.id, 'taste', tid, '취향 소식: ' || t.title || ' (' || array_to_string(added, ', ') || ')'
    from profiles p where p.id <> u and (
      exists(select 1 from jsonb_array_elements_text(coalesce(p.tastes->'genres','[]')) g where g = any(added)) or
      exists(select 1 from jsonb_array_elements_text(coalesce(p.tastes->'makers','[]')) m where m = any(added)));
  end if;
end $$;

create function public.read_notices() returns void language sql security definer set search_path = public as $$
  update notices set read = true where user_id = auth.uid() and not read $$;

-- 알림 트리거
create function public.notify_events() returns trigger language plpgsql security definer set search_path = public as $$
declare tt text; tl text; rc text;
begin
  if tg_table_name = 'candidates' and new.person_id is not null then
    select r.topic_id, t.title, r.ch into tt, tl, rc from roles r join topics t on t.id = r.topic_id where r.id = new.role_id;
    insert into notices(user_id, kind, topic_id, person_id, body)
    select f.user_id, 'fan_race', tt, new.person_id, new.name || ' 님이 ' || tl || ' ' || rc || ' 역 후보에 올랐어요. 1위로 올려 볼까요?'
    from fan_follows f where f.person_id = new.person_id and f.user_id is distinct from new.proposed_by;
  elsif tg_table_name = 'roles' and new.stage is distinct from old.stage and new.stage in ('cast','rumor') then
    select title into tl from topics where id = new.topic_id;
    insert into notices(user_id, kind, topic_id, person_id, body)
    select distinct x.uid, case when new.stage = 'cast' then 'cast' else 'announce' end, new.topic_id, new.person_id,
      case when new.stage = 'cast' then tl || ' ' || new.ch || ' 역 캐스팅 확정: ' || coalesce(new.actor, '') else tl || ' 실사화가 발표됐어요. 캐스팅 레이스가 시작돼요' end
    from (select user_id uid from votes where role_id = new.id
          union select user_id from fan_follows where new.person_id is not null and person_id = new.person_id) x;
  elsif tg_table_name = 'topics' and tg_op = 'INSERT' then
    insert into notices(user_id, kind, topic_id, body)
    select p.id, 'taste', new.id, '새 주제: ' || new.title || '. 첫 후보를 올려 보세요'
    from profiles p where p.id is distinct from new.created_by and coalesce(p.tastes->'cats','[]') ? new.cat;
  end if;
  return new;
end $$;
revoke execute on function public.notify_events() from public, anon, authenticated;
create trigger nt_cands after insert on public.candidates for each row execute function public.notify_events();
create trigger nt_roles after update on public.roles for each row execute function public.notify_events();
create trigger nt_topics after insert on public.topics for each row execute function public.notify_events();

-- 유저 페이지
create function public.user_page(nick text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u uuid; me_ boolean; res jsonb;
begin
  select id into u from profiles where nickname = nick;
  if u is null then return null; end if;
  me_ := (u = auth.uid());
  with vv as (
    select v.role_id, v.candidate_id, v.weight, v.created_at, r.stage, r.ch, r.actor, r.person_id rp, r.final_share, t.id tid, t.title, t.cat,
      c.name cname, c.person_id cp,
      (r.stage in ('cast','airing') and (c.name = r.actor or (c.person_id is not null and c.person_id = r.person_id))) as hit,
      r.stage in ('cast','airing') as decided
    from votes v join roles r on r.id = v.role_id join topics t on t.id = r.topic_id join candidates c on c.id = v.candidate_id
    where v.user_id = u
  ), pr as (
    select c.id, c.name, c.role_id, r.ch, r.stage, r.actor, t.id tid, t.title,
      (r.stage in ('cast','airing') and (c.name = r.actor or (c.person_id is not null and c.person_id = r.person_id))) as hit,
      coalesce((select sum(weight) from votes where candidate_id = c.id), 0)::int votes
    from candidates c join roles r on r.id = c.role_id join topics t on t.id = r.topic_id where c.proposed_by = u
  )
  select jsonb_build_object(
    'me', me_,
    'profile', (select jsonb_build_object('nickname', p.nickname, 'points', p.points, 'bio', p.bio, 'tastes', p.tastes, 'since', p.created_at, 'is_admin', p.is_admin,
       'rank', (select count(*) + 1 from profiles q where q.points > p.points)) from profiles p where p.id = u),
    'stats', jsonb_build_object(
      'votes', (select count(*) from vv), 'decided', (select count(*) from vv where decided), 'hits', (select count(*) from vv where hit),
      'proposals', (select count(*) from pr), 'proposal_hits', (select count(*) from pr where hit),
      'sheets', (select count(*) from sheets where user_id = u),
      'sheet_likes', (select coalesce(sum(likes),0) from sheets where user_id = u),
      'comment_likes', (select coalesce(sum(likes),0) from comments where user_id = u),
      'comments', (select count(*) from comments where user_id = u),
      'fan_likes', (select coalesce(sum(likes),0) from fan_posts where user_id = u and not hidden),
      'duels', (select count(*) from duel_votes where user_id = u),
      'syncs', (select count(*) from sync_votes where user_id = u),
      'topics', (select count(*) from topics where created_by = u),
      'director_picks', (select count(*) from director_picks where user_id = u),
      'earned', (select coalesce(sum(amount),0) from point_log where user_id = u and amount > 0)),
    'votes', coalesce((select jsonb_agg(jsonb_build_object('tid', tid, 'title', title, 'ch', ch, 'name', cname, 'pid', cp, 'stage', stage, 'actor', actor, 'hit', hit, 'at', created_at) order by created_at desc)
       from (select * from vv where me_ or decided order by created_at desc limit 40) z), '[]'),
    'proposals', coalesce((select jsonb_agg(jsonb_build_object('tid', tid, 'title', title, 'ch', ch, 'name', name, 'votes', votes, 'stage', stage, 'hit', hit) order by votes desc) from (select * from pr order by votes desc limit 20) z), '[]'),
    'sheets', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'tid', s.topic_id, 'title', t.title, 'likes', s.likes, 'reason', s.reason, 'poster', case when s.poster_hidden then null else s.poster_url end, 'at', s.updated_at) order by s.likes desc, s.updated_at desc)
       from sheets s join topics t on t.id = s.topic_id where s.user_id = u), '[]'),
    'follows', coalesce((select jsonb_agg(jsonb_build_object('id', pe.id, 'name', pe.name) order by f.created_at) from fan_follows f join people pe on pe.id = f.person_id where f.user_id = u), '[]'),
    'next', case when me_ then coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('tid', t.id, 'title', t.title, 'ch', r.ch, 'role_id', r.id,
          'why', case when exists(select 1 from candidates c join fan_follows f on f.person_id = c.person_id and f.user_id = u where c.role_id = r.id) then 'fan' when coalesce(pp.tastes->'cats','[]') ? t.cat then 'taste' else 'hot' end) x
        from roles r join topics t on t.id = r.topic_id, profiles pp
        where pp.id = u and t.closed_at is null and t.closes_at > now() and r.stage in ('dream','rumor')
          and not exists(select 1 from votes v where v.user_id = u and v.role_id = r.id)
        order by (exists(select 1 from candidates c join fan_follows f on f.person_id = c.person_id and f.user_id = u where c.role_id = r.id)) desc,
          (coalesce(pp.tastes->'cats','[]') ? t.cat) desc,
          (select count(*) from votes v where v.role_id = r.id) desc
        limit 6) q), '[]') else '[]'::jsonb end
  ) into res;
  return res;
end $$;

grant execute on function public.user_page(text) to anon, authenticated;
grant execute on function public.set_tastes(jsonb,text), public.set_topic_tags(text,text[]), public.read_notices() to authenticated;
revoke execute on function public.set_tastes(jsonb,text), public.set_topic_tags(text,text[]), public.read_notices() from anon, public;
