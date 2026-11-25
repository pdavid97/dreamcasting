-- 065 IGDB(게임): 게임 원작 실사화 작품과 원작 게임 연결, 게임 캐릭터. 함수: supabase/functions/igdb (비밀값 TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)
-- 캐릭터 그림(mug_shot)은 식별자만 저장하고 화면에는 쓰지 않음(원작 그림 미사용 원칙)
create table if not exists game(id int primary key, name text not null, slug text, year int, rating_count int, url text, franchise text, updated_at timestamptz default now());
create table if not exists game_link(work_key text not null, game_id int not null references game(id) on delete cascade, score real, primary key(work_key, game_id));
create table if not exists game_char(id int primary key, game_id int references game(id) on delete cascade, name text not null, gender text, slug text, url text, mug text, updated_at timestamptz default now());
create index if not exists game_char_game on game_char(game_id);
alter table game enable row level security; alter table game_link enable row level security; alter table game_char enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where tablename='game' and policyname='game_read') then create policy game_read on game for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='game_link' and policyname='game_link_read') then create policy game_link_read on game_link for select using (true); end if;
 if not exists(select 1 from pg_policies where tablename='game_char' and policyname='game_char_read') then create policy game_char_read on game_char for select using (true); end if;
end $$;
