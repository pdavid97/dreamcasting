-- 013 연기 점수(배역별) + 연간 배우 메타 지수
-- 방영 중이거나 종영된 작품의 배역마다 유저가 연기력 점수(0~100)와 한줄평을 남김. 1인 1배역 1점수(고칠 수 있음)
-- 연간 메타 지수 = 연기 점수(평가 수로 보정한 평균) 70% + 화제성(평가 수, 팬 유입, 팬 글, 후보 득표) 30%
-- 작품 정보는 배우 페이지의 TMDB 필모에서 넘어오며, 운영자가 잘못된 항목을 숨길 수 있음

create table public.performances(
  id bigint generated always as identity primary key,
  person_id bigint not null references public.people(id) on delete cascade,
  media text not null check (media in ('tv','movie')),
  tmdb_id int not null,
  title text not null check (char_length(title) between 1 and 80),
  year int check (year between 1950 and 2100),
  ch text check (char_length(ch) <= 40),
  topic_id text references public.topics(id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique(person_id, media, tmdb_id)
);
alter table public.performances enable row level security;
create policy "public read" on public.performances for select using (not hidden);

create table public.perf_scores(
  user_id uuid not null references public.profiles(id) on delete cascade,
  perf_id bigint not null references public.performances(id) on delete cascade,
  score int not null check (score between 0 and 100),
  review text check (char_length(review) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, perf_id)
);
create index on public.perf_scores(perf_id);
alter table public.perf_scores enable row level security;
create policy "own read" on public.perf_scores for select using (auth.uid() = user_id);

-- 공개 평균과 한줄평(닉네임 포함)
create function public.perf_board(pid bigint) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'media', p.media, 'tmdb_id', p.tmdb_id, 'title', p.title, 'year', p.year, 'ch', p.ch,
    'n', (select count(*) from perf_scores s where s.perf_id = p.id), 'avg', (select round(avg(score),1) from perf_scores s where s.perf_id = p.id),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('nick', pr.nickname, 'score', s.score, 'review', s.review) order by s.updated_at desc) from (select * from perf_scores s where s.perf_id = p.id and s.review is not null order by updated_at desc limit 5) s join profiles pr on pr.id = s.user_id), '[]'))
    order by p.year desc nulls last), '[]')
  from performances p where p.person_id = pid and not p.hidden $$;

create function public.rate_perf(pid bigint, med text, tid int, ttl text, yr int, chr text, sc int, rv text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := me(); perf bigint; first boolean; n int; a numeric; tp text;
begin
  if sc < 0 or sc > 100 then raise exception '점수는 0~100점이에요'; end if;
  if yr is not null and yr > extract(year from now())::int then raise exception '아직 공개되지 않은 작품은 평가할 수 없어요'; end if;
  if not exists(select 1 from people where id = pid) then raise exception '배우를 찾을 수 없어요'; end if;
  select id into tp from topics where work->>'tmdb_id' = tid::text limit 1;
  insert into performances(person_id, media, tmdb_id, title, year, ch, topic_id) values (pid, med, tid, left(btrim(ttl), 80), yr, nullif(left(btrim(coalesce(chr,'')), 40), ''), tp)
    on conflict (person_id, media, tmdb_id) do update set ch = coalesce(performances.ch, excluded.ch) returning id into perf;
  if (select hidden from performances where id = perf) then raise exception '평가할 수 없는 항목이에요'; end if;
  first := not exists(select 1 from perf_scores where user_id = u and perf_id = perf);
  insert into perf_scores(user_id, perf_id, score, review) values (u, perf, sc, nullif(left(btrim(coalesce(rv,'')), 200), ''))
    on conflict (user_id, perf_id) do update set score = excluded.score, review = excluded.review, updated_at = now();
  if first then perform award(u, 5, '연기 평가', 'perf:' || perf); end if;
  insert into events(kind, user_id, person_id, value, meta) values ('perf_score', u, pid, sc, jsonb_build_object('perf', perf, 'tmdb', tid, 'media', med, 'year', yr));
  select count(*), round(avg(score),1) into n, a from perf_scores where perf_id = perf;
  return jsonb_build_object('perf', perf, 'n', n, 'avg', a);
end $$;

-- 연간 배우 메타 지수
-- 연기: 베이지안 평균 (평균 * n + 60 * 5) / (n + 5), 작품 연도 기준
-- 화제성: 그해 평가 수, 팬 유입, 팬 글, 가상 캐스팅 득표를 각각 그해 최고값 대비 비율로 바꿔 평균(0~100)
create function public.actor_year_index(yr int, lim int default 30) returns table(person_id bigint, name text, acting numeric, ratings bigint, perfs bigint, buzz numeric, meta numeric)
language sql stable security definer set search_path = public as $$
  with sc as (
    select p.person_id, count(s.*) n, count(distinct p.id) perfs, avg(s.score) av
    from performances p join perf_scores s on s.perf_id = p.id where p.year = yr and not p.hidden group by p.person_id
  ), bz as (
    select pe.id person_id,
      coalesce(sc.n, 0) r,
      (select count(*) from fan_follows f where f.person_id = pe.id and extract(year from f.created_at) = yr) fo,
      (select count(*) from fan_posts f where f.person_id = pe.id and not f.hidden and extract(year from f.created_at) = yr) po,
      (select coalesce(sum(v.weight),0) from votes v join candidates c on c.id = v.candidate_id where c.person_id = pe.id and extract(year from v.created_at) = yr) vo
    from people pe left join sc on sc.person_id = pe.id
  ), mx as (select greatest(max(r),1) r, greatest(max(fo),1) fo, greatest(max(po),1) po, greatest(max(vo),1) vo from bz)
  select pe.id, pe.name, round((sc.av * sc.n + 60 * 5) / (sc.n + 5), 1), sc.n, sc.perfs,
    round(100 * (bz.r::numeric / mx.r + bz.fo::numeric / mx.fo + bz.po::numeric / mx.po + bz.vo::numeric / mx.vo) / 4, 1),
    round(0.7 * ((sc.av * sc.n + 60 * 5) / (sc.n + 5)) + 0.3 * (100 * (bz.r::numeric / mx.r + bz.fo::numeric / mx.fo + bz.po::numeric / mx.po + bz.vo::numeric / mx.vo) / 4), 1)
  from sc join people pe on pe.id = sc.person_id join bz on bz.person_id = sc.person_id, mx
  order by 7 desc, 4 desc limit lim $$;

create function public.admin_hide_perf(perf bigint, h boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not admin_check() then raise exception '운영자만 할 수 있어요'; end if;
  update performances set hidden = h where id = perf;
end $$;

grant execute on function public.perf_board(bigint), public.actor_year_index(int,int) to anon, authenticated;
grant execute on function public.rate_perf(bigint,text,int,text,int,text,int,text), public.admin_hide_perf(bigint,boolean) to authenticated;
revoke execute on function public.rate_perf(bigint,text,int,text,int,text,int,text), public.admin_hide_perf(bigint,boolean) from anon, public;
