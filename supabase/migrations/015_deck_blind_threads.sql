-- 015 카드 덱 + 블라인드 결과 + 캐스팅 조합 토론방
-- 1) roles.slot: 남주, 여주, 남자 서브, 여자 서브(또는 주연, 조연). 카드 덱은 slot이 있는 배역만 묻는다
-- 2) 화제성: topics.buzz(최근 7일 뉴스 기사 수, TMDB 인기, 광장 활동)를 Edge Function buzz가 매일 갱신
-- 3) 블라인드: 득표와 남의 시트는 그 작품에 한 표라도 던진 사람(또는 마감 작품, 운영자)에게만 공개
-- 4) 내 표가 쌓이면 내 캐스팅 시트가 자동으로 만들어짐(배역별 표를 picks에 합침)
-- 5) 같은 조합을 고른 사람 수로 캐스팅 조합 순위, 조합마다 토론방(댓글, 대댓글, 추천/비추천, 자동 접기)

alter table public.roles add column if not exists slot text check (slot in ('male_lead','female_lead','male_sub','female_sub','lead','support'));
alter table public.topics add column if not exists buzz numeric not null default 0;
alter table public.topics add column if not exists buzz_at timestamptz;
alter table public.topics add column if not exists buzz_meta jsonb;

update public.roles r set slot = v.s from (values
 (1,'male_lead'),(2,'female_lead'),(3,'male_sub'),(4,'female_sub'),
 (5,'male_lead'),(6,'female_lead'),(7,'lead'),(8,'lead'),(9,'male_lead'),(10,'female_lead'),(11,'lead'),
 (12,'male_lead'),(13,'female_lead'),(14,'male_sub'),(15,'male_lead'),(16,'female_lead'),(17,'male_sub'),
 (18,'female_lead'),(19,'male_lead'),(20,'female_lead'),(21,'male_lead'),(22,'lead'),(23,'support'),
 (24,'female_lead'),(25,'male_lead'),(26,'male_sub'),(27,'male_lead'),(28,'female_lead'),
 (29,'male_lead'),(30,'male_sub'),(31,'female_lead'),(32,'lead'),(33,'support'),(34,'female_lead'),(35,'male_lead')
) v(id,s) where r.id = v.id and r.slot is null;

-- 공개 여부: 이 작품에 투표했거나, 마감됐거나, 운영자
create function public.can_see(tid text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    exists(select 1 from votes v join roles r on r.id = v.role_id where r.topic_id = tid and v.user_id = auth.uid())
    or not topic_open(tid)
    or exists(select 1 from profiles where id = auth.uid() and is_admin), false) $$;
grant execute on function public.can_see(text) to anon, authenticated;

create or replace function public.topic_tally(tid text)
 returns table(candidate_id bigint, role_id bigint, name text, proposer text, votes integer)
 language sql stable security definer set search_path = public as $$
  select c.id, c.role_id, c.name, p.nickname,
    case when can_see(tid) or r.stage in ('cast','airing') then coalesce(sum(v.weight),0)::int end
  from candidates c join roles r on r.id = c.role_id
  left join votes v on v.candidate_id = c.id
  left join profiles p on p.id = c.proposed_by
  where r.topic_id = tid
  group by c.id, p.nickname, r.stage order by c.id $$;

alter policy "public read" on public.tally_daily using (exists(select 1 from roles r where r.id = tally_daily.role_id and (can_see(r.topic_id) or r.stage in ('cast','airing'))));
alter policy "public read" on public.sheets using (user_id = auth.uid() or can_see(topic_id));

-- 투표하면 내 캐스팅 시트에 그 배역이 채워짐
create function public.vote_to_sheet() returns trigger language plpgsql security definer set search_path = public as $$
declare tid text;
begin
  select topic_id into tid from roles where id = new.role_id;
  insert into sheets(topic_id, user_id, picks) values (tid, new.user_id, jsonb_build_object(new.role_id::text, jsonb_build_object('c', new.candidate_id)))
  on conflict (topic_id, user_id) do update set picks = sheets.picks || excluded.picks, updated_at = now();
  return new;
end $$;
revoke execute on function public.vote_to_sheet() from public, anon, authenticated;
create trigger vt_sheet after insert on public.votes for each row execute function public.vote_to_sheet();
insert into public.sheets(topic_id, user_id, picks)
select r.topic_id, v.user_id, jsonb_object_agg(v.role_id::text, jsonb_build_object('c', v.candidate_id))
from votes v join roles r on r.id = v.role_id group by r.topic_id, v.user_id
on conflict (topic_id, user_id) do update set picks = excluded.picks || sheets.picks;

-- 토론방
create table public.thread_comments(
  id bigint generated always as identity primary key,
  topic_id text not null references public.topics(id) on delete cascade,
  ckey text not null check (ckey ~ '^[0-9a-f]{32}$'),
  parent_id bigint references public.thread_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  up int not null default 0,
  down int not null default 0,
  hidden boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.thread_comments(topic_id, ckey, created_at);
alter table public.thread_comments enable row level security;
create policy "members read" on public.thread_comments for select using (auth.uid() is not null and not deleted);

create table public.thread_votes(
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id bigint not null references public.thread_comments(id) on delete cascade,
  v smallint not null check (v in (-1, 1)),
  primary key(user_id, comment_id)
);
alter table public.thread_votes enable row level security;
create policy "own read" on public.thread_votes for select using (auth.uid() = user_id);

create view public.v_thread with (security_invoker = true) as
  select t.id, t.topic_id, t.ckey, t.parent_id, t.body, t.up, t.down, t.hidden, t.created_at, p.nickname, t.user_id = auth.uid() as mine,
    -- 윌슨 하한(95%): 추천 비율이 높고 표가 많을수록 위로
    case when t.up + t.down = 0 then 0 else
      ((t.up + 1.9208) / (t.up + t.down) - 1.96 * sqrt((t.up::numeric * t.down) / (t.up + t.down) + 0.9604) / (t.up + t.down)) / (1 + 3.8416 / (t.up + t.down)) end as rank_score
  from public.thread_comments t join public.profiles p on p.id = t.user_id where not t.deleted;

-- 캐스팅 조합 순위: 투표 대상 배역(slot)을 모두 채운 시트를 조합별로 묶음
create function public.topic_combos(tid text) returns table(ckey text, picks jsonb, users int, nicks text[], comments int, mine boolean)
language sql stable security definer set search_path = public as $$
  with rs as (select id from roles where topic_id = tid and slot is not null and stage in ('dream','rumor')),
  sh as (
    select s.user_id, (select jsonb_object_agg(r.id::text, coalesce((select name from candidates c where c.id = (s.picks->r.id::text->>'c')::bigint), s.picks->r.id::text->>'n') || coalesce(' (' || (s.picks->r.id::text->>'y') || ')', '')) from rs r) as p
    from sheets s where s.topic_id = tid and not exists(select 1 from rs r where not (s.picks ? r.id::text))
  ), g as (select md5(p::text) k, p, count(*)::int n, array_agg(pr.nickname order by pr.nickname) filter (where pr.nickname is not null) nk, bool_or(sh.user_id = auth.uid()) me
    from sh join profiles pr on pr.id = sh.user_id where p is not null group by p)
  select g.k, g.p, g.n, g.nk[1:5], (select count(*)::int from thread_comments t where t.topic_id = tid and t.ckey = g.k and not t.deleted), coalesce(g.me,false)
  from g where can_see(tid) order by g.n desc, g.k $$;

-- 욕설 거르기(명백한 비속어만. 근거 없는 비방은 비추천으로 접힘)
create function public.is_abusive(txt text) returns boolean language sql immutable as $$
  select regexp_replace(lower(coalesce(txt,'')), '[\s\.\-_*0-9]', '', 'g') ~ '(씨발|시발|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|븅신|좆|존나|졸라|개새|개색|새끼|미친년|미친놈|썅|닥쳐|꺼져|애미|애비|느금|니미|창녀|걸레|fuck|shit|bitch)' $$;

create function public.post_thread(tid text, ck text, parent bigint, txt text) returns bigint
language plpgsql security definer set search_path = public as $$
declare u uuid := me(); n int; root bigint; nid bigint; b text := btrim(coalesce(txt,''));
begin
  if char_length(b) < 1 or char_length(b) > 500 then raise exception '1~500자로 적어 주세요'; end if;
  if is_abusive(b) then raise exception '욕설이나 비속어가 들어간 글은 올릴 수 없어요'; end if;
  if ck !~ '^[0-9a-f]{32}$' then raise exception '토론방을 찾을 수 없어요'; end if;
  select count(*) into n from thread_comments where user_id = u and created_at > now() - interval '1 day';
  if n >= 40 then raise exception '오늘은 글을 충분히 썼어요. 내일 다시 와 주세요'; end if;
  if parent is not null then
    select coalesce(parent_id, id) into root from thread_comments where id = parent and topic_id = tid and ckey = ck and not deleted;
    if root is null then raise exception '답글을 달 글을 찾을 수 없어요'; end if;
  end if;
  insert into thread_comments(topic_id, ckey, parent_id, user_id, body) values (tid, ck, root, u, b) returning id into nid;
  if n < 5 then perform award(u, 3, '캐스팅 토론', 'thread:' || nid); end if;
  insert into events(kind, user_id, topic_id, meta) values ('thread_post', u, tid, jsonb_build_object('id', nid, 'reply', root is not null));
  return nid;
end $$;

-- 추천 1, 비추천 -1, 같은 값을 다시 누르면 취소. 비추천 5개 이상이면서 추천의 2배를 넘으면 접힘(숨김), 회복하면 다시 펼침
create function public.vote_thread(cid bigint, val int) returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := me(); old smallint; au uuid; r record;
begin
  if val not in (-1, 1) then raise exception '잘못된 요청'; end if;
  select user_id into au from thread_comments where id = cid and not deleted;
  if au is null then raise exception '글을 찾을 수 없어요'; end if;
  if au = u then raise exception '내 글에는 누를 수 없어요'; end if;
  select v into old from thread_votes where user_id = u and comment_id = cid;
  if old is null then
    insert into thread_votes values (u, cid, val);
    update thread_comments set up = up + (val = 1)::int, down = down + (val = -1)::int where id = cid;
    if val = 1 then perform award(au, 1, '토론 추천', 'tup:' || cid || ':' || u); end if;
  elsif old = val then
    delete from thread_votes where user_id = u and comment_id = cid;
    update thread_comments set up = up - (val = 1)::int, down = down - (val = -1)::int where id = cid;
  else
    update thread_votes set v = val where user_id = u and comment_id = cid;
    update thread_comments set up = up + (val = 1)::int - (val = -1)::int, down = down + (val = -1)::int - (val = 1)::int where id = cid;
  end if;
  update thread_comments set hidden = (down >= 5 and down > up * 2) where id = cid returning up, down, hidden into r;
  return jsonb_build_object('up', r.up, 'down', r.down, 'hidden', r.hidden);
end $$;

create function public.delete_thread(cid bigint) returns void language plpgsql security definer set search_path = public as $$
begin
  update thread_comments set deleted = true where id = cid and (user_id = auth.uid() or admin_check());
  if not found then raise exception '내 글이나 운영자만 지울 수 있어요'; end if;
end $$;

-- 카드 덱: 화제성 순으로, 투표가 열린 작품의 slot 배역과 후보(득표는 공개 조건일 때만)
create function public.vote_deck(lim int default 12) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'buzz')::numeric desc), '[]') from (
    select jsonb_build_object('id', t.id, 'title', t.title, 'cat', t.cat, 'info', t.info, 'buzz', t.buzz, 'news', t.buzz_meta->'news',
      'poster', coalesce(t.work->>'backdrop', t.work->>'poster'), 'closes_at', t.closes_at, 'seen', can_see(t.id),
      'roles', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'ch', r.ch, 'slot', r.slot, 'orig', r.orig, 'age', r.age_hint,
          'mine', (select candidate_id from votes v where v.role_id = r.id and v.user_id = auth.uid()),
          'cands', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'votes', case when can_see(t.id) then (select coalesce(sum(weight),0) from votes v where v.candidate_id = c.id) end) order by c.id), '[]') from candidates c where c.role_id = r.id)
        ) order by array_position(array['male_lead','female_lead','lead','male_sub','female_sub','support'], r.slot), r.pos), '[]')
        from roles r where r.topic_id = t.id and r.slot is not null and r.stage in ('dream','rumor'))) x
    from topics t where t.closed_at is null and t.closes_at > now()
      and exists(select 1 from roles r where r.topic_id = t.id and r.slot is not null and r.stage in ('dream','rumor'))
    order by t.buzz desc, t.sort limit lim) z $$;

-- 관리자: 슬롯 지정과 배역 추가
create function public.admin_set_slot(rid bigint, s text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not admin_check() then raise exception '운영자만 할 수 있어요'; end if;
  update roles set slot = nullif(s,'') where id = rid;
end $$;

-- 화제성 아이디어(뉴스에서 찾은 실사화/드라마화 소식, 운영자 검토용)
create table public.buzz_ideas(
  id bigint generated always as identity primary key,
  title text not null, url text not null unique, source text, published timestamptz, status text not null default 'new' check (status in ('new','used','skip')),
  created_at timestamptz not null default now()
);
alter table public.buzz_ideas enable row level security;
create policy "admin read" on public.buzz_ideas for select using (exists(select 1 from profiles where id = auth.uid() and is_admin));

grant execute on function public.topic_combos(text), public.vote_deck(int) to anon, authenticated;
grant execute on function public.post_thread(text,text,bigint,text), public.vote_thread(bigint,int), public.delete_thread(bigint), public.admin_set_slot(bigint,text) to authenticated;
revoke execute on function public.post_thread(text,text,bigint,text), public.vote_thread(bigint,int), public.delete_thread(bigint), public.admin_set_slot(bigint,text) from anon, public;

-- person_page: 득표는 공개 조건일 때만
create or replace function public.person_page(pid bigint) returns jsonb language sql stable security definer set search_path = public as $$
  with cand as (
    select c.id cid, c.role_id, r.topic_id, t.title, t.cat, r.ch, r.stage, r.actor,
      coalesce((select sum(v.weight) from votes v where v.candidate_id = c.id), 0)::int as votes,
      (t.closed_at is null and t.closes_at > now() and r.stage in ('dream','rumor')) as open, t.closes_at, can_see(t.id) seen
    from candidates c join roles r on r.id = c.role_id join topics t on t.id = r.topic_id where c.person_id = pid
  ), board as (
    select cd.*,
      (select v2.votes from (select c2.id, coalesce(sum(v.weight),0)::int votes from candidates c2 left join votes v on v.candidate_id = c2.id where c2.role_id = cd.role_id group by c2.id) v2 order by v2.votes desc limit 1) as top_votes,
      1 + (select count(*) from (select c2.id, coalesce(sum(v.weight),0)::int votes from candidates c2 left join votes v on v.candidate_id = c2.id where c2.role_id = cd.role_id group by c2.id) v3 where v3.votes > cd.votes)::int as rank,
      (select count(*) from candidates c4 where c4.role_id = cd.role_id)::int as field,
      (select sum(v.weight) from votes v where v.role_id = cd.role_id)::int as role_total
    from cand cd
  )
  select jsonb_build_object(
    'person', (select jsonb_build_object('id', p.id, 'name', p.name, 'tmdb_id', p.tmdb_id, 'aliases', p.aliases, 'fans', p.fans, 'profile', p.profile, 'profile_at', p.profile_at) from people p where p.id = pid),
    'races', coalesce((select jsonb_agg(jsonb_build_object('cid', cid, 'role_id', role_id, 'topic_id', topic_id, 'title', title, 'cat', cat, 'ch', ch, 'stage', stage, 'seen', seen,
       'votes', case when seen then votes end, 'top', case when seen then coalesce(top_votes,0) end, 'rank', case when seen then rank end, 'field', field,
       'total', case when seen then coalesce(role_total,0) end, 'open', open, 'closes_at', closes_at, 'gap', case when seen then greatest(coalesce(top_votes,0) - votes, 0) end) order by open desc, rank, votes desc) from board), '[]'::jsonb),
    'cast', coalesce((select jsonb_agg(jsonb_build_object('topic_id', r.topic_id, 'title', t.title, 'ch', r.ch, 'stage', r.stage)) from roles r join topics t on t.id = r.topic_id where r.person_id = pid and r.stage in ('cast','airing')), '[]'::jsonb),
    'sheet_mentions', (select count(*)::int from sheets s, jsonb_each(s.picks) e
        where (e.value ? 'c' and (e.value->>'c')::bigint in (select id from candidates where person_id = pid))
           or (e.value ? 'n' and e.value->>'n' in (select name from people where id = pid union select unnest(aliases) from people where id = pid))),
    'posts', (select count(*)::int from fan_posts where person_id = pid and not hidden)
  ) $$;
