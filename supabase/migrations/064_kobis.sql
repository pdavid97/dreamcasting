-- 064 KOBIS(영화진흥위원회 오픈API): 한국 영화 목록, 출연진과 배역명, 일별 박스오피스. 함수: supabase/functions/kobis (비밀값 KOBIS_KEY)
create table if not exists kobis_movie(movie_cd text primary key, nm text, nm_en text, prdt_year int, open_dt date, type_nm text, nation text, genre text, directors text, info_at timestamptz, show_tm int, updated_at timestamptz default now());
create index if not exists kobis_movie_need_info on kobis_movie(open_dt desc) where info_at is null;
create table if not exists kobis_cast(movie_cd text not null references kobis_movie(movie_cd) on delete cascade, ord int not null, name text not null, name_en text, role text, role_en text, primary key(movie_cd, ord));
create index if not exists kobis_cast_name on kobis_cast(name);
create table if not exists kobis_box(day date not null, movie_cd text not null, rank int, nm text, audi_cnt int, audi_acc bigint, sales_acc bigint, scrn_cnt int, primary key(day, movie_cd));
create table if not exists kobis_state(k text primary key, v jsonb, updated_at timestamptz default now());
alter table kobis_movie enable row level security; alter table kobis_cast enable row level security; alter table kobis_box enable row level security; alter table kobis_state enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where tablename='kobis_movie' and policyname='kobis_movie_read') then create policy kobis_movie_read on kobis_movie for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='kobis_cast' and policyname='kobis_cast_read') then create policy kobis_cast_read on kobis_cast for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='kobis_box' and policyname='kobis_box_read') then create policy kobis_box_read on kobis_box for select using (true); end if;
end $$;
