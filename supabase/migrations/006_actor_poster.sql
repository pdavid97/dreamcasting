-- 006 배우 팬 채널 + 캐스팅 시트 포스터
-- 1) 배우 페이지: people.profile에 TMDB 필모와 Wikidata 수상 캐시, 팬 팔로우, 팬 게시판, 물망 작품 집계
-- 2) 포스터: 시트별 이미지(직접 업로드 또는 AI 배경), Storage 버킷 posters, 신고 3건이면 자동 숨김
-- 원칙: 투표는 배역당 1인 1표 그대로. 팬 화력은 "투표하러 오게 만드는 것"이지 표를 늘리는 장치가 아님

-- 배우 프로필 캐시(Edge Function person이 서비스 키로 채움)
alter table public.people add column if not exists profile jsonb;
alter table public.people add column if not exists profile_at timestamptz;
alter table public.people add column if not exists fans int not null default 0;

create table public.fan_follows(
  user_id uuid not null references public.profiles(id) on delete cascade,
  person_id bigint not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, person_id)
);
alter table public.fan_follows enable row level security;
create policy "own read" on public.fan_follows for select using (auth.uid() = user_id);

create table public.fan_posts(
  id bigint generated always as identity primary key,
  person_id bigint not null references public.people(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  likes int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.fan_posts(person_id, created_at desc);
alter table public.fan_posts enable row level security;
create policy "public read" on public.fan_posts for select using (not hidden);

create table public.fan_post_likes(
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id bigint not null references public.fan_posts(id) on delete cascade,
  primary key(user_id, post_id)
);
alter table public.fan_post_likes enable row level security;
create policy "own read" on public.fan_post_likes for select using (auth.uid() = user_id);

create view public.v_fan_posts with (security_invoker = true) as
  select f.id, f.person_id, f.body, f.likes, f.created_at, p.nickname,
    exists(select 1 from fan_follows ff where ff.user_id = f.user_id and ff.person_id = f.person_id) as is_fan
  from public.fan_posts f join public.profiles p on p.id = f.user_id where not f.hidden;

-- 포스터
alter table public.sheets add column if not exists poster_url text check (poster_url is null or poster_url ~ '^https://dnzcvbidppzaogtmwamc\.supabase\.co/storage/v1/object/public/posters/');
alter table public.sheets add column if not exists poster_kind text check (poster_kind in ('upload','ai'));
alter table public.sheets add column if not exists poster_hidden boolean not null default false;

create table public.poster_reports(
  user_id uuid not null references public.profiles(id) on delete cascade,
  sheet_id bigint not null references public.sheets(id) on delete cascade,
  why text check (char_length(why) <= 100),
  created_at timestamptz not null default now(),
  primary key(user_id, sheet_id)
);
alter table public.poster_reports enable row level security;
create policy "own read" on public.poster_reports for select using (auth.uid() = user_id);

create table public.app_config(k text primary key, v jsonb not null);
alter table public.app_config enable row level security;
create policy "public read" on public.app_config for select using (true);
insert into public.app_config values
  ('poster_ai', '{"on": false, "per_user_day": 3, "global_day": 200, "model": "fal-ai/flux/schnell"}');

create table public.poster_gen_log(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sheet_id bigint references public.sheets(id) on delete set null,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.poster_gen_log enable row level security;

-- v_sheets에 포스터 컬럼 추가(숨김 처리된 포스터는 주소를 내보내지 않음)
create or replace view public.v_sheets with (security_invoker = true) as
  select s.id, s.topic_id, s.picks, s.likes, s.updated_at, p.nickname, s.user_id, s.reason,
    case when s.poster_hidden then null else s.poster_url end as poster_url, s.poster_kind
  from public.sheets s join public.profiles p on p.id = s.user_id;

-- Storage 버킷: 공개 읽기, 2MB, 이미지 형식만. 쓰기는 본인 폴더(uid/...)만
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', true, 2097152, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;
create policy "poster own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "poster own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text);

-- RPC: 팬 채널
create function public.follow_person(pid bigint) returns boolean language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); on_ boolean;
begin
  if u is null or not exists(select 1 from profiles where id = u and nickname is not null) then raise exception '로그인 후 닉네임을 정해 주세요'; end if;
  if not exists(select 1 from people where id = pid) then raise exception '배우를 찾을 수 없어요'; end if;
  if exists(select 1 from fan_follows where user_id = u and person_id = pid) then
    delete from fan_follows where user_id = u and person_id = pid; update people set fans = greatest(fans - 1, 0) where id = pid; on_ := false;
  else
    insert into fan_follows(user_id, person_id) values (u, pid); update people set fans = fans + 1 where id = pid; on_ := true;
    perform award(u, 2, '팬 채널 입장', 'follow:' || pid);
  end if;
  return on_;
end $$;

create function public.post_fan(pid bigint, txt text) returns bigint language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); n int; nid bigint; nm text;
begin
  if u is null or not exists(select 1 from profiles where id = u and nickname is not null) then raise exception '로그인 후 닉네임을 정해 주세요'; end if;
  txt := btrim(coalesce(txt, ''));
  if char_length(txt) not between 1 and 280 then raise exception '1~280자로 적어 주세요'; end if;
  select count(*) into n from fan_posts where user_id = u and created_at > now() - interval '1 day';
  if n >= 30 then raise exception '오늘은 글을 충분히 썼어요. 내일 다시 와 주세요'; end if;
  select name into nm from people where id = pid;
  if nm is null then raise exception '배우를 찾을 수 없어요'; end if;
  insert into fan_posts(person_id, user_id, body) values (pid, u, txt) returning id into nid;
  if n < 3 then perform award(u, 5, nm || ' 팬 채널 글', 'fanpost:' || nid); end if;
  return nid;
end $$;

create function public.like_fan_post(fid bigint) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); au uuid;
begin
  if u is null then raise exception '로그인이 필요해요'; end if;
  select user_id into au from fan_posts where id = fid and not hidden;
  if au is null then raise exception '글을 찾을 수 없어요'; end if;
  if au = u then raise exception '내 글에는 공감할 수 없어요'; end if;
  insert into fan_post_likes values (u, fid) on conflict do nothing;
  if found then update fan_posts set likes = likes + 1 where id = fid; perform award(au, 2, '팬 글 공감', 'fanlike:' || fid || ':' || u); end if;
end $$;

-- 배우 검색(이름 또는 별칭)
create function public.people_search(q text) returns table(id bigint, name text, fans int, cands int)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.fans, (select count(*)::int from candidates c where c.person_id = p.id)
  from people p where char_length(btrim(q)) >= 1 and (p.name ilike '%' || btrim(q) || '%' or exists(select 1 from unnest(p.aliases) a where a ilike '%' || btrim(q) || '%'))
  order by 4 desc, 3 desc limit 20 $$;

-- 배우 페이지 한 번에: 인물, 물망 작품(순위와 1위까지 표 차이), 확정 배역, 시트 언급 수
create function public.person_page(pid bigint) returns jsonb language sql stable security definer set search_path = public as $$
  with cand as (
    select c.id cid, c.role_id, r.topic_id, t.title, t.cat, r.ch, r.stage, r.actor,
      coalesce((select sum(v.weight) from votes v where v.candidate_id = c.id), 0)::int as votes,
      (t.closed_at is null and t.closes_at > now() and r.stage in ('dream','rumor')) as open, t.closes_at
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
    'races', coalesce((select jsonb_agg(jsonb_build_object('cid', cid, 'role_id', role_id, 'topic_id', topic_id, 'title', title, 'cat', cat, 'ch', ch, 'stage', stage, 'votes', votes, 'top', coalesce(top_votes,0), 'rank', rank, 'field', field, 'total', coalesce(role_total,0), 'open', open, 'closes_at', closes_at, 'gap', greatest(coalesce(top_votes,0) - votes, 0)) order by open desc, rank, votes desc) from board), '[]'::jsonb),
    'cast', coalesce((select jsonb_agg(jsonb_build_object('topic_id', r.topic_id, 'title', t.title, 'ch', r.ch, 'stage', r.stage)) from roles r join topics t on t.id = r.topic_id where r.person_id = pid and r.stage in ('cast','airing')), '[]'::jsonb),
    'sheet_mentions', (select count(*)::int from sheets s, jsonb_each(s.picks) e
        where (e.value ? 'c' and (e.value->>'c')::bigint in (select id from candidates where person_id = pid))
           or (e.value ? 'n' and e.value->>'n' in (select name from people where id = pid union select unnest(aliases) from people where id = pid))),
    'posts', (select count(*)::int from fan_posts where person_id = pid and not hidden)
  ) $$;

-- 팬 화력 랭킹: 팬 수 + 물망 작품 득표
create function public.fan_board(lim int default 20) returns table(id bigint, name text, fans int, races int, leads int, votes int)
language sql stable security definer set search_path = public as $$
  with cv as (select c.person_id, c.role_id, coalesce(sum(v.weight),0)::int votes from candidates c left join votes v on v.candidate_id = c.id where c.person_id is not null group by c.person_id, c.id, c.role_id),
  mx as (select role_id, max(votes) m from (select c.role_id, coalesce(sum(v.weight),0) votes from candidates c left join votes v on v.candidate_id = c.id group by c.id, c.role_id) z group by role_id)
  select p.id, p.name, p.fans, count(cv.role_id)::int, count(*) filter (where cv.votes > 0 and cv.votes = mx.m)::int, coalesce(sum(cv.votes),0)::int
  from people p join cv on cv.person_id = p.id join mx on mx.role_id = cv.role_id
  group by p.id order by p.fans * 5 + coalesce(sum(cv.votes),0) desc, p.name limit lim $$;

-- RPC: 포스터
create function public.set_sheet_poster(sid bigint, url text, kind text) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception '로그인이 필요해요'; end if;
  if kind <> 'upload' then raise exception '잘못된 요청'; end if;
  if url !~ ('^https://dnzcvbidppzaogtmwamc\.supabase\.co/storage/v1/object/public/posters/' || u::text || '/') then raise exception '내 폴더에 올린 이미지만 쓸 수 있어요'; end if;
  update sheets set poster_url = url, poster_kind = kind, poster_hidden = false where id = sid and user_id = u;
  if not found then raise exception '내 시트에만 포스터를 붙일 수 있어요'; end if;
  delete from poster_reports where sheet_id = sid;
  perform award(u, 10, '시트 포스터', 'poster:' || sid);
end $$;

create function public.clear_sheet_poster(sid bigint) returns void language plpgsql security definer set search_path = public as $$
begin
  update sheets set poster_url = null, poster_kind = null, poster_hidden = false where id = sid and (user_id = auth.uid() or admin_check());
  if not found then raise exception '권한이 없어요'; end if;
end $$;

create function public.report_poster(sid bigint, why text) returns int language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); n int;
begin
  if u is null then raise exception '로그인이 필요해요'; end if;
  if exists(select 1 from sheets where id = sid and user_id = u) then raise exception '내 포스터는 신고할 수 없어요'; end if;
  insert into poster_reports(user_id, sheet_id, why) values (u, sid, left(coalesce(why, ''), 100)) on conflict do nothing;
  select count(*) into n from poster_reports where sheet_id = sid;
  if n >= 3 then update sheets set poster_hidden = true where id = sid; end if;
  return n;
end $$;

-- AI 생성 한도 확인과 기록(Edge Function poster만 호출, 서비스 키 전용)
create function public.poster_gen_claim(u uuid, sid bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare cfg jsonb; mine int; total int;
begin
  select v into cfg from app_config where k = 'poster_ai';
  if not coalesce((cfg->>'on')::boolean, false) then return jsonb_build_object('ok', false, 'why', 'off'); end if;
  if not exists(select 1 from sheets where id = sid and user_id = u) then return jsonb_build_object('ok', false, 'why', 'owner'); end if;
  select count(*) into mine from poster_gen_log where user_id = u and created_at > now() - interval '1 day';
  select count(*) into total from poster_gen_log where created_at > now() - interval '1 day';
  if mine >= (cfg->>'per_user_day')::int then return jsonb_build_object('ok', false, 'why', 'user_limit'); end if;
  if total >= (cfg->>'global_day')::int then return jsonb_build_object('ok', false, 'why', 'global_limit'); end if;
  insert into poster_gen_log(user_id, sheet_id) values (u, sid);
  return jsonb_build_object('ok', true, 'model', cfg->>'model', 'left', (cfg->>'per_user_day')::int - mine - 1);
end $$;

create function public.poster_gen_done(u uuid, sid bigint, url text) returns void language plpgsql security definer set search_path = public as $$
begin
  update sheets set poster_url = url, poster_kind = 'ai', poster_hidden = false where id = sid and user_id = u;
  update poster_gen_log set ok = true where id = (select max(id) from poster_gen_log where user_id = u and sheet_id = sid);
  delete from poster_reports where sheet_id = sid;
end $$;

-- 이벤트 로그 연결: 팬 채널 활동도 events에 쌓음
create or replace function public.log_event_fan() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'fan_follows' then
    insert into events(kind,user_id,person_id) values ('fan_follow',new.user_id,new.person_id);
  elsif tg_table_name = 'fan_posts' then
    insert into events(kind,user_id,person_id,meta) values ('fan_post',new.user_id,new.person_id,jsonb_build_object('post_id',new.id,'len',char_length(new.body)));
  end if;
  return new;
end $$;
revoke execute on function public.log_event_fan() from public, anon, authenticated;
create trigger ev_fan_follows after insert on public.fan_follows for each row execute function public.log_event_fan();
create trigger ev_fan_posts after insert on public.fan_posts for each row execute function public.log_event_fan();

grant execute on function public.follow_person(bigint), public.post_fan(bigint,text), public.like_fan_post(bigint),
  public.set_sheet_poster(bigint,text,text), public.clear_sheet_poster(bigint), public.report_poster(bigint,text) to authenticated;
revoke execute on function public.follow_person(bigint), public.post_fan(bigint,text), public.like_fan_post(bigint),
  public.set_sheet_poster(bigint,text,text), public.clear_sheet_poster(bigint), public.report_poster(bigint,text) from anon, public;
revoke execute on function public.poster_gen_claim(uuid,bigint), public.poster_gen_done(uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.person_page(bigint), public.people_search(text), public.fan_board(int) to anon, authenticated;
