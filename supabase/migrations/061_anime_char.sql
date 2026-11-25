-- 061 애니와 만화 원작의 캐릭터와 성우(AniList, 비상업 무료, 월 매출 150달러 미만 상업 이용도 무료). ip_work(애니 실사화 작품)와 원작을 연결
-- 데이터: tools/ip_data/anilist.py로 수집(11/24, 원작 133편, 캐릭터 1,685명)
create table if not exists anime_media(id int primary key, type text, format text, romaji text, english text, native text, url text, popularity int);
create table if not exists anime_link(key text references ip_work(key) on delete cascade, media_id int references anime_media(id) on delete cascade, primary key(key, media_id));
create table if not exists anime_char(media_id int references anime_media(id) on delete cascade, char_id int not null, name text, native text, role text, va_ja text, va_ja_native text, va_ko text, va_ko_native text, primary key(media_id, char_id));
alter table anime_media enable row level security; alter table anime_link enable row level security; alter table anime_char enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where tablename='anime_media' and policyname='anime_media_read') then create policy anime_media_read on anime_media for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='anime_link' and policyname='anime_link_read') then create policy anime_link_read on anime_link for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='anime_char' and policyname='anime_char_read') then create policy anime_char_read on anime_char for select using (true); end if;
end $$;
