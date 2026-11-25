-- 060 IP 실사화 기초 데이터: 마블, DC, 디즈니 실사, 동화 실사, 뮤지컬 영화, 애니와 만화 실사, 웹툰 실사, 게임 실사 작품과 배역별 배우(TMDB), 무대 작품과 배역(Wikidata)
-- 데이터는 tools/ip_data 스크립트로 수집해 임시 함수 ipload로 적재(11/24, 작품 933, 배역 18,385, 무대 작품 367, 무대 배역 2,932)
create table if not exists ip_work(key text primary key, grp text[] not null default '{}', title text, title_en text, year int, lang text, countries text[], genres text[], pop numeric, poster text, src_qid text, src_title text, updated_at timestamptz default now());
create table if not exists ip_cast(key text references ip_work(key) on delete cascade, tmdb_person int not null, name text, character text not null default '', ord int, gender smallint, profile text, primary key(key, tmdb_person, character));
create index if not exists ip_cast_person_idx on ip_cast(tmdb_person);
create table if not exists stage_work(qid text primary key, title_ko text, title_en text, sitelinks int, films text[] default '{}');
create table if not exists stage_char(qid text references stage_work(qid) on delete cascade, char_qid text not null, name_ko text, name_en text, primary key(qid, char_qid));
alter table ip_work enable row level security; alter table ip_cast enable row level security; alter table stage_work enable row level security; alter table stage_char enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where tablename='ip_work' and policyname='ip_work_read') then create policy ip_work_read on ip_work for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='ip_cast' and policyname='ip_cast_read') then create policy ip_cast_read on ip_cast for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='stage_work' and policyname='stage_work_read') then create policy stage_work_read on stage_work for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='stage_char' and policyname='stage_char_read') then create policy stage_char_read on stage_char for select using (true); end if;
end $$;
