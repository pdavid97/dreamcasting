-- 드림캐스팅 광장 핵심 스키마
-- 원칙: 공개 정보는 누구나 읽고, 개인 기록(투표, 포인트 원장)은 본인만 읽음. 쓰기는 오직 RPC(security definer 함수)로만.
-- 규칙: 배역마다 1인 1회 투표(변경 불가), 작품별 마감 시각이 지나거나 운영자가 마감하면 투표 종료
create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique check (char_length(nickname) between 2 and 16),
  points int not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.topics(
  id text primary key,
  cat text not null check (cat in ('wn','k2','us2k','k2us')),
  title text not null,
  info text not null default '',
  fact text not null default '',
  user_made boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  sort int not null default 100,
  closes_at timestamptz not null default (now() + interval '30 days'),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.roles(
  id bigint generated always as identity primary key,
  topic_id text not null references public.topics(id) on delete cascade,
  pos int not null,
  ch text not null,
  orig text,
  descr text not null default '',
  stage text not null default 'dream' check (stage in ('dream','rumor','cast','airing')),
  actor text,
  final_share real,
  credit uuid references public.profiles(id) on delete set null,
  events jsonb not null default '[]',
  unique(topic_id,pos)
);
create table public.candidates(
  id bigint generated always as identity primary key,
  role_id bigint not null references public.roles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  proposed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(role_id,name)
);
create table public.votes(
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id bigint not null references public.roles(id) on delete cascade,
  candidate_id bigint not null references public.candidates(id) on delete cascade,
  weight int not null default 1,
  created_at timestamptz not null default now(),
  primary key(user_id,role_id)
);
create table public.duel_votes(
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id bigint not null references public.roles(id) on delete cascade,
  a bigint not null references public.candidates(id) on delete cascade,
  b bigint not null references public.candidates(id) on delete cascade,
  winner bigint not null references public.candidates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,role_id,a,b),
  check (a < b)
);
create table public.sync_votes(
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id bigint not null references public.roles(id) on delete cascade,
  score int not null check (score between 1 and 10),
  created_at timestamptz not null default now(),
  primary key(user_id,role_id)
);
create table public.tally_daily(role_id bigint not null references public.roles(id) on delete cascade, day date not null, candidate_id bigint not null references public.candidates(id) on delete cascade, votes int not null, primary key(role_id,day,candidate_id));
create table public.sync_daily(role_id bigint not null references public.roles(id) on delete cascade, day date not null, avg real not null, n int not null, primary key(role_id,day));
create table public.comments(
  id bigint generated always as identity primary key,
  role_id bigint not null references public.roles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pick bigint references public.candidates(id) on delete set null,
  body text not null check (char_length(body) between 1 and 280),
  likes int not null default 0,
  created_at timestamptz not null default now()
);
create table public.comment_likes(user_id uuid not null references public.profiles(id) on delete cascade, comment_id bigint not null references public.comments(id) on delete cascade, primary key(user_id,comment_id));
-- 캐스팅 시트: 배역마다 후보(c) 또는 직접 적은 배우 이름(n). 예: {"12":{"c":34},"13":{"n":"박보검"}}
create table public.sheets(
  id bigint generated always as identity primary key,
  topic_id text not null references public.topics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  picks jsonb not null,
  likes int not null default 0,
  updated_at timestamptz not null default now(),
  unique(topic_id,user_id)
);
create table public.sheet_likes(user_id uuid not null references public.profiles(id) on delete cascade, sheet_id bigint not null references public.sheets(id) on delete cascade, primary key(user_id,sheet_id));
create table public.director_picks(user_id uuid not null references public.profiles(id) on delete cascade, role_id bigint not null references public.roles(id) on delete cascade, candidate_id bigint not null references public.candidates(id) on delete cascade, primary key(user_id,role_id));
create table public.point_log(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,
  reason text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  unique(user_id,ref)
);
create table public.feed(id bigint generated always as identity primary key, kind text not null default 'info', body text not null, created_at timestamptz not null default now());
create index on public.candidates(role_id);
create index on public.votes(role_id);
create index on public.comments(role_id,created_at desc);
create index on public.feed(created_at desc);
create index on public.roles(topic_id);
create index on public.sheets(topic_id);
-- RLS: 공개 테이블은 누구나 읽기, 개인 기록은 본인만 읽기. 쓰기 정책은 없음(RPC 전용)
do $$ declare t text; begin
  foreach t in array array['profiles','topics','roles','candidates','tally_daily','sync_daily','comments','comment_likes','sheets','sheet_likes','director_picks','feed'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
  end loop;
  foreach t in array array['votes','duel_votes','sync_votes','point_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own read" on public.%I for select using (user_id = (select auth.uid()))', t);
  end loop;
end $$;
-- 집계(투표 원본은 비공개라 집계만 공개)
create function public.topic_tally(tid text) returns table(candidate_id bigint, role_id bigint, name text, proposer text, votes int)
language sql stable security definer set search_path = public as $$
  select c.id, c.role_id, c.name, p.nickname, coalesce(sum(v.weight),0)::int
  from candidates c join roles r on r.id = c.role_id
  left join votes v on v.candidate_id = c.id
  left join profiles p on p.id = c.proposed_by
  where r.topic_id = tid
  group by c.id, p.nickname order by c.id $$;
create function public.topic_sync(tid text) returns table(role_id bigint, avg real, n int)
language sql stable security definer set search_path = public as $$
  select r.id, coalesce(avg(s.score),0)::real, count(s.user_id)::int
  from roles r left join sync_votes s on s.role_id = r.id
  where r.topic_id = tid group by r.id $$;
create view public.v_comments with (security_invoker = true) as
  select c.id, c.role_id, c.pick, c.body, c.likes, c.created_at, p.nickname, c.user_id
  from public.comments c join public.profiles p on p.id = c.user_id;
create view public.v_sheets with (security_invoker = true) as
  select s.id, s.topic_id, s.picks, s.likes, s.updated_at, p.nickname, s.user_id
  from public.sheets s join public.profiles p on p.id = s.user_id;
create view public.v_dpicks with (security_invoker = true) as
  select d.role_id, d.candidate_id, p.nickname, d.user_id from public.director_picks d join public.profiles p on p.id = d.user_id;
create view public.v_leaders with (security_invoker = true) as
  select id, nickname, points from public.profiles order by points desc limit 20;
