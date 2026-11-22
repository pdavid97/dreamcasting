-- 020 데이터 기반 1단계: 출처와 라이선스, 원본 보관, 정본 인물과 작품, 출연, 리메이크, 운영자 수정, 신호, 작업 기록, 품질 검사, 판매 대비 골격
-- 원칙
--  1) 모든 데이터는 출처(data_source)를 갖고, 출처의 라이선스 등급이 파생 데이터까지 따라간다
--  2) 지금은 비상업 운영. commercial_ok=false 출처는 나중에 계약하면 플래그만 바꾸면 된다(스키마 변경 없음)
--  3) 외부로 나가는 판매용 데이터는 mart 스키마의 집계 뷰만. 개인 단위 행은 나가지 않는다
--  4) 쓰기는 서버(service role)와 RPC만. 새 테이블은 RLS 켜고 공개 정책 없음(people, work, credit, adaptation 읽기만 공개)

-- 1. 출처와 라이선스
create table public.data_source(
  code text primary key,
  name text not null,
  lic text not null check (lic in ('first_party','open','restricted','ttl')),
  commercial_ok boolean not null default false,   -- 상업 이용 가능 여부(계약 후 true로)
  resale_ok boolean not null default false,       -- 제3자 판매에 포함 가능 여부
  retention_days int,                             -- 보관 기한(null이면 제한 없음)
  attribution text,
  note text
);
alter table public.data_source enable row level security;
create policy "public read" on public.data_source for select using (true);
insert into public.data_source(code,name,lic,commercial_ok,resale_ok,retention_days,attribution,note) values
 ('first_party','드림캐스팅 자체 데이터(투표, 클릭, 제안, 행동)','first_party',true,true,null,null,'동의 범위 안에서 집계만 외부 제공'),
 ('tmdb','TMDB API','restricted',false,false,null,'This product uses the TMDB API but is not endorsed or certified by TMDB.','상업 이용은 TMDB 상업 계약 필요'),
 ('wikidata','Wikidata','open',true,true,null,'Wikidata (CC0)',null),
 ('wikipedia_pv','Wikipedia 조회수','open',true,true,null,'Wikimedia pageviews',null),
 ('google_news','Google News RSS','restricted',false,false,null,null,'제목과 링크만 보관, 원문 재배포 금지, 건수 같은 파생 지표 위주'),
 ('google_trends','Google Trends RSS','restricted',false,false,null,null,null),
 ('naver','NAVER API HUB 검색','ttl',false,false,21,null,'서버 보관 최대 21일, 재판매와 AI 학습 제한'),
 ('youtube','YouTube Data API','restricted',false,false,30,null,'API 약관 보관 기한 확인 필요(보수적으로 30일)'),
 ('kobis','영화진흥위원회 KOBIS 오픈API','restricted',false,false,null,'영화진흥위원회','상업 이용 조건 확인 필요'),
 ('manual','운영자 입력','first_party',true,true,null,null,'근거 링크 필수');

-- 2. 원본 보관소
create table public.raw_fetch(
  id bigint generated always as identity primary key,
  source text not null references public.data_source(code),
  key text not null,
  fetched_at timestamptz not null default now(),
  status int,
  payload jsonb,
  hash text,
  expires_at timestamptz
);
create index on public.raw_fetch(source, key, fetched_at desc);
create index on public.raw_fetch(expires_at) where expires_at is not null;
create function public.raw_fetch_ttl() returns trigger language plpgsql set search_path = public as $$
declare d int;
begin
  select retention_days into d from data_source where code = new.source;
  if d is not null then new.expires_at := new.fetched_at + make_interval(days => d); end if;
  return new;
end $$;
create trigger raw_fetch_ttl before insert on public.raw_fetch for each row execute function public.raw_fetch_ttl();
alter table public.raw_fetch enable row level security;

-- 3. 정본 인물: 기존 people을 정본으로 확장(후보, 팬 기능이 이미 people.id를 씀)
alter table public.people
  add column if not exists qid text unique,
  add column if not exists name_en text,
  add column if not exists kinds text[] not null default '{}',     -- actor, singer, idol, comedian, musical, stage, youtuber, influencer (여러 개 가능)
  add column if not exists region text,                            -- kr, intl
  add column if not exists nationality text,                       -- ISO 국가 코드(확인된 경우만)
  add column if not exists pob text,
  add column if not exists birth date,
  add column if not exists gender smallint,                        -- 1 여, 2 남, 0 미상
  add column if not exists pop numeric,
  add column if not exists acted boolean,
  add column if not exists blocked boolean not null default false, -- 추천 제외(운영자 수정으로만 켬)
  add column if not exists srcs text[] not null default '{}',      -- 이 행을 만든 출처 코드들
  add column if not exists updated_at timestamptz not null default now();
alter table public.cast_pool add column if not exists person_id bigint references public.people(id) on delete set null;
create index if not exists cast_pool_person on public.cast_pool(person_id);

-- 4. 작품과 출연
create table public.work(
  id bigint generated always as identity primary key,
  tmdb_id int,
  media text check (media in ('movie','tv','webtoon','novel','stage','other')),
  title text not null,
  title_en text,
  year int,
  country text,
  genres text[] not null default '{}',
  qid text unique,
  srcs text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (media, tmdb_id)
);
alter table public.work enable row level security;
create policy "public read" on public.work for select using (true);

create table public.credit(
  person_id bigint not null references public.people(id) on delete cascade,
  work_id bigint not null references public.work(id) on delete cascade,
  character text,
  ord int,
  anthology boolean not null default false,  -- 단막극, 시상식, 콘서트처럼 같은 작품 출연으로 치지 않는 기록
  src text not null references public.data_source(code),
  primary key (person_id, work_id, src)
);
create index on public.credit(work_id);
alter table public.credit enable row level security;
create policy "public read" on public.credit for select using (true);

-- 5. 리메이크와 배역 연결
create table public.adaptation(
  id bigint generated always as identity primary key,
  src_work_id bigint not null references public.work(id) on delete cascade,
  dst_work_id bigint not null references public.work(id) on delete cascade,
  relation text not null default 'remake' check (relation in ('remake','adaptation','reboot','sequel_remake')),
  direction text,                -- kr2us, us2kr, kr2jp 같은 시장 방향
  status text not null default 'released' check (status in ('rumor','announced','filming','released','cancelled')),
  announced_at date,
  released_at date,
  topic_id text references public.topics(id) on delete set null,  -- 이 리메이크를 다루는 투표 주제(있으면)
  evidence_url text,
  src text not null references public.data_source(code),
  unique (src_work_id, dst_work_id)
);
alter table public.adaptation enable row level security;
create policy "public read" on public.adaptation for select using (true);

create table public.story_character(
  id bigint generated always as identity primary key,
  family_work_id bigint not null references public.work(id) on delete cascade,  -- 원작 기준
  label text not null                                                            -- 예: 벤(원작) = 기호(한국판)
);
create table public.character_map(
  character_id bigint not null references public.story_character(id) on delete cascade,
  work_id bigint not null references public.work(id) on delete cascade,
  role_name text not null,
  person_id bigint references public.people(id) on delete set null,
  role_id bigint references public.roles(id) on delete set null,   -- 투표 배역과 연결(있으면)
  primary key (character_id, work_id)
);
alter table public.story_character enable row level security;
alter table public.character_map enable row level security;
create policy "public read" on public.story_character for select using (true);
create policy "public read" on public.character_map for select using (true);

-- 실제 캐스팅이 발표된 시점의 특징(정답 데이터)
create table public.casting_outcome(
  character_id bigint not null references public.story_character(id) on delete cascade,
  work_id bigint not null references public.work(id) on delete cascade,
  person_id bigint not null references public.people(id) on delete cascade,
  announced_at date,
  age_at int,
  pop_at numeric,
  buzz_at numeric,
  orig_age_gap int,
  src text not null references public.data_source(code),
  primary key (character_id, work_id, person_id)
);
alter table public.casting_outcome enable row level security;

create table public.work_perf(
  work_id bigint not null references public.work(id) on delete cascade,
  source text not null references public.data_source(code),
  metric text not null,     -- audience, revenue, rating, votes
  value numeric not null,
  at date not null,
  primary key (work_id, source, metric, at)
);
alter table public.work_perf enable row level security;

-- 6. 운영자 수정표: 분류 정정, 추천 제외 등을 코드가 아닌 데이터로
create table public.override(
  id bigint generated always as identity primary key,
  person_id bigint not null references public.people(id) on delete cascade,
  field text not null,      -- kinds, region, gender, blocked, nationality ...
  value jsonb not null,
  reason text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  active boolean not null default true
);
create index on public.override(person_id) where active;
alter table public.override enable row level security;

-- 7. 시계열 신호(매시간, 매일)
create table public.signal(
  person_id bigint not null references public.people(id) on delete cascade,
  source text not null references public.data_source(code),
  metric text not null,       -- news_mentions, pageviews, tmdb_pop, trend_hit, search_volume ...
  at timestamptz not null,
  value numeric not null,
  primary key (person_id, source, metric, at)
);
create index on public.signal(source, metric, at desc);
alter table public.signal enable row level security;

-- 8. 자체 행동 데이터: 기존 events를 그대로 쓰되 세션과 동의 상태를 남김
alter table public.events add column if not exists sid text;
alter table public.profiles
  add column if not exists consent_stats_at timestamptz,   -- 통계 작성 동의 시각
  add column if not exists consent_share_at timestamptz,   -- 집계 데이터 제3자 제공 동의 시각
  add column if not exists age_band text,                  -- 선택 입력: 10s, 20s, 30s ...
  add column if not exists gender_self text,               -- 선택 입력
  add column if not exists region_self text;               -- 선택 입력

-- 9. 작업 기록과 품질 검사
create table public.job_run(
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','failed','blocked')),
  counts jsonb,
  error text
);
create index on public.job_run(job, started_at desc);
alter table public.job_run enable row level security;

create table public.qa_result(
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  check_name text not null,
  n int not null,
  sample jsonb
);
create index on public.qa_result(at desc);
alter table public.qa_result enable row level security;

-- 10. 판매 대비 골격(지금은 비활성). 외부 업체용 API 키와 사용량
create table public.data_client(
  id bigint generated always as identity primary key,
  name text not null,
  plan text not null default 'free',
  scopes text[] not null default '{}',   -- 접근 가능한 mart 상품 이름
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.data_client_key(
  key_hash text primary key,              -- 원문 키는 저장하지 않음
  client_id bigint not null references public.data_client(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  rate_per_min int not null default 60
);
create table public.data_api_usage(
  id bigint generated always as identity primary key,
  client_id bigint not null references public.data_client(id) on delete cascade,
  at timestamptz not null default now(),
  product text not null,
  rows int not null default 0
);
alter table public.data_client enable row level security;
alter table public.data_client_key enable row level security;
alter table public.data_api_usage enable row level security;

create schema if not exists mart;
revoke all on schema mart from public, anon, authenticated;
comment on schema mart is '외부 제공용 집계 데이터 상품. 자체 데이터(first_party)와 공개 라이선스(open)만 사용, 최소 집단 크기 적용';

-- 기존 cast_pool을 정본 people로 병합(적용 시 1회 실행: TMDB 행은 tmdb_id로, 위키데이터 전용 행은 이름과 생일이 같으면 병합, 아니면 신규)
-- 분쟁 인물 4명은 people.blocked=true와 override 기록으로 이관
