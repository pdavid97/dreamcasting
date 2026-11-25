-- 069 Trakt 공개 급상승과 주간 시청 순위(영화, 드라마). 함수 charts { trakt: true }. 화면에 쓰면 Trakt 출처 표시
create table if not exists trakt_trend(day date not null, kind text not null, list text not null, rank int not null, key text not null, title text, year int, watchers int, primary key(day, kind, list, rank));
create index if not exists trakt_trend_key on trakt_trend(key);
alter table trakt_trend enable row level security;
do $$ begin if not exists(select 1 from pg_policies where tablename='trakt_trend' and policyname='trakt_trend_read') then create policy trakt_trend_read on trakt_trend for select using (true); end if; end $$;
drop view if exists public.work_buzz;
create view public.work_buzz as
with nf as (
  select t.key, min(n.rank) filter (where n.scope='KR') kr_best, count(*) filter (where n.scope='KR') kr_weeks,
         min(n.rank) filter (where n.scope='global') gl_best, sum(n.views) filter (where n.scope='global') gl_views
  from nf_top10 n join nf_title t on t.title=n.title and t.kind=(case when n.category ilike 'Films%' then 'movie' else 'tv' end)
  where n.week > current_date - 29 and t.key is not null group by t.key),
tv as (select s.key, sum(w.eps) eps, string_agg(distinct s.channel, ', ') channels from tvm_web w join tvm_show s using(show_id) where w.day > current_date - 15 and s.key is not null group by s.key),
tk as (select key, min(rank) filter (where list='trending') trakt_trend, min(rank) filter (where list='watched') trakt_watched from trakt_trend where day > current_date - 8 group by key)
select coalesce(nf.key, tv.key, tk.key) key, nf.kr_best, nf.kr_weeks, nf.gl_best, nf.gl_views, tv.eps stream_eps, tv.channels stream_channels, tk.trakt_trend, tk.trakt_watched
from nf full join tv on tv.key = nf.key full join tk on tk.key = coalesce(nf.key, tv.key);
