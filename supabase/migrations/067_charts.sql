-- 067 화제작 신호: 넷플릭스 공식 주간 Top 10(전세계, 한국, 미국, 일본)과 TVmaze 스트리밍 방영 일정(CC BY-SA 4.0, 출처 표시 필요). 함수: supabase/functions/charts
create table if not exists nf_top10(week date not null, scope text not null, category text not null, rank int not null, title text not null, season text, views bigint, hours bigint, weeks int, primary key(week, scope, category, rank));
create index if not exists nf_top10_title on nf_top10(title);
create table if not exists nf_title(title text not null, kind text not null, key text, checked_at timestamptz default now(), primary key(title, kind));
create table if not exists tvm_show(show_id int primary key, name text, channel text, country text, imdb text, tvdb int, key text, checked_at timestamptz);
create table if not exists tvm_web(day date not null, show_id int not null references tvm_show(show_id) on delete cascade, eps int, primary key(day, show_id));
alter table nf_top10 enable row level security; alter table nf_title enable row level security; alter table tvm_show enable row level security; alter table tvm_web enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where tablename='nf_top10' and policyname='nf_top10_read') then create policy nf_top10_read on nf_top10 for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='nf_title' and policyname='nf_title_read') then create policy nf_title_read on nf_title for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='tvm_show' and policyname='tvm_show_read') then create policy tvm_show_read on tvm_show for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='tvm_web' and policyname='tvm_web_read') then create policy tvm_web_read on tvm_web for select using (true); end if;
end $$;
-- 작품별 화제 신호(최근 4주 넷플릭스, 최근 14일 스트리밍 방영)
create or replace view public.work_buzz as
with nf as (
  select t.key, min(n.rank) filter (where n.scope='KR') kr_best, count(*) filter (where n.scope='KR') kr_weeks,
         min(n.rank) filter (where n.scope='global') gl_best, sum(n.views) filter (where n.scope='global') gl_views
  from nf_top10 n join nf_title t on t.title=n.title and t.kind=(case when n.category ilike 'Films%' then 'movie' else 'tv' end)
  where n.week > current_date - 29 and t.key is not null group by t.key),
tv as (select s.key, sum(w.eps) eps, string_agg(distinct s.channel, ', ') channels from tvm_web w join tvm_show s using(show_id) where w.day > current_date - 15 and s.key is not null group by s.key)
select coalesce(nf.key, tv.key) key, nf.kr_best, nf.kr_weeks, nf.gl_best, nf.gl_views, tv.eps stream_eps, tv.channels stream_channels
from nf full join tv on tv.key = nf.key;
