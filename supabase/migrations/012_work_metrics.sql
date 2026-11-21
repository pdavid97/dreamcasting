-- 012 작품 성과 지표 축적: 인기도, 평점, 넷플릭스 시청 수, 시청률, 수상
-- 자동 수집(Edge Function metrics, 매일 1회 pg_cron): TMDB 인기도/평점/평가 수, Netflix Top 10 공개 데이터(주간 시청 수, 시청 시간), Wikidata 작품 수상
-- 사람 제보(출처 링크 필수, 운영자 승인 후 반영): 닐슨 등 TV 시청률처럼 공개 API가 없는 지표
-- 쓰임: 작품 화면 표시, 가상 캐스팅 레퍼런스(배우의 흥행 작품), 이후 예측 시장 확률 설계의 기초 변수
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.work_metrics(
  topic_id text not null references public.topics(id) on delete cascade,
  day date not null,
  source text not null check (source in ('tmdb','netflix','nielsen','tnms','user','other')),
  metric text not null check (metric ~ '^[a-z0-9_]{2,40}$'),   -- popularity, rating, votes, weekly_views, weekly_hours, weekly_rank, household_rating
  value numeric not null,
  meta jsonb,
  src_url text,
  created_at timestamptz not null default now(),
  primary key(topic_id, day, source, metric)
);
alter table public.work_metrics enable row level security;
create policy "public read" on public.work_metrics for select using (true);

create table public.work_awards(
  topic_id text not null references public.topics(id) on delete cascade,
  name text not null,
  year text not null default '',
  src text not null default '',
  primary key(topic_id, name, year)
);
alter table public.work_awards enable row level security;
create policy "public read" on public.work_awards for select using (true);

-- 유저 제보: 시청률 등. 승인되면 work_metrics(source=nielsen 등)로 들어감
create table public.metric_reports(
  id bigint generated always as identity primary key,
  topic_id text not null references public.topics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  source text not null check (source in ('nielsen','tnms','other')),
  metric text not null check (metric in ('household_rating','metro_rating','viewers','episode_rating')),
  value numeric not null check (value >= 0 and value < 1e10),
  note text check (char_length(note) <= 100),
  src_url text not null check (src_url ~ '^https?://\S{4,}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.metric_reports enable row level security;
create policy "public read" on public.metric_reports for select using (status <> 'rejected');

create function public.report_metric(tid text, d date, src text, m text, v numeric, nt text, link text) returns bigint
language plpgsql security definer set search_path = public as $$
declare u uuid := me(); nid bigint;
begin
  if (select count(*) from metric_reports where user_id = u and created_at > now() - interval '1 day') >= 20 then raise exception '오늘은 제보를 충분히 했어요'; end if;
  if d > current_date or d < date '1960-01-01' then raise exception '날짜를 확인해 주세요'; end if;
  insert into metric_reports(topic_id, user_id, day, source, metric, value, note, src_url) values (tid, u, d, src, m, v, nullif(btrim(nt),''), link) returning id into nid;
  return nid;
end $$;

create function public.admin_review_metric(rid bigint, ok boolean) returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not admin_check() then raise exception '운영자만 할 수 있어요'; end if;
  select * into r from metric_reports where id = rid;
  if r.id is null then raise exception '제보가 없어요'; end if;
  update metric_reports set status = case when ok then 'approved' else 'rejected' end where id = rid;
  if ok then
    insert into work_metrics(topic_id, day, source, metric, value, meta, src_url) values (r.topic_id, r.day, r.source, r.metric, r.value, jsonb_build_object('report', r.id, 'note', r.note), r.src_url)
    on conflict (topic_id, day, source, metric) do update set value = excluded.value, meta = excluded.meta, src_url = excluded.src_url;
    perform award(r.user_id, 20, '시청률 제보 채택', 'metric:' || r.id);
  end if;
end $$;

-- 작품 지표 한 번에: 지표별 최신값과 최근 90일 추이, 수상
create function public.work_stats(tid text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'latest', coalesce((select jsonb_object_agg(source || ':' || metric, jsonb_build_object('v', value, 'day', day, 'url', src_url, 'meta', meta))
       from (select distinct on (source, metric) * from work_metrics where topic_id = tid order by source, metric, day desc) z), '{}'),
    'series', coalesce((select jsonb_object_agg(k, pts) from (select source || ':' || metric k, jsonb_agg(jsonb_build_array(day, value) order by day) pts
       from work_metrics where topic_id = tid and day > current_date - 90 group by 1) z), '{}'),
    'awards', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'year', year) order by year desc) from work_awards where topic_id = tid), '[]'),
    'pending', (select count(*) from metric_reports where topic_id = tid and status = 'pending')
  ) $$;

grant execute on function public.work_stats(text) to anon, authenticated;
grant execute on function public.report_metric(text,date,text,text,numeric,text,text), public.admin_review_metric(bigint,boolean) to authenticated;
revoke execute on function public.report_metric(text,date,text,text,numeric,text,text), public.admin_review_metric(bigint,boolean) from anon, public;

insert into public.app_config values ('metrics_run', '{"last": null}') on conflict do nothing;
