-- 062 위키백과 조회수(Wikimedia Pageviews API): 배우의 한국어, 영어 위키백과 문서 일별 조회수. 화제 점수 보강과 Google 뉴스 대체 후보. 함수: supabase/functions/pageviews
create table if not exists wiki_target(qid text not null, wiki text not null, title text not null, kind text not null default 'person', updated_at timestamptz default now(), primary key(qid, wiki));
create table if not exists pageviews(qid text not null, wiki text not null, day date not null, views int not null, primary key(qid, wiki, day));
create index if not exists pageviews_day_idx on pageviews(day);
alter table wiki_target enable row level security; alter table pageviews enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where tablename='wiki_target' and policyname='wiki_target_read') then create policy wiki_target_read on wiki_target for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='pageviews' and policyname='pageviews_read') then create policy pageviews_read on pageviews for select using (true); end if;
end $$;
create or replace function public.pv_target_qids() returns setof text language sql stable security definer set search_path = public as $$
  select distinct p.qid from people p where p.qid is not null and (
    p.id in (select person_id from candidates where person_id is not null)
    or p.name in (select orig from roles where orig is not null)
    or p.tmdb_id in (select tmdb_person from ip_cast where ord <= 3))
$$;
revoke execute on function public.pv_target_qids() from anon, authenticated;
create or replace view public.pv_person_7d as
  select qid, sum(views) filter (where wiki='ko') ko, sum(views) filter (where wiki='en') en, sum(views) total
  from pageviews where day > current_date - 8 group by qid;
