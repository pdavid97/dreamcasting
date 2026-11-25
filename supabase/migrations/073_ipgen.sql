-- 073 게임, 애니 실사화 판 초안과 뉴스 감지
-- anime_char.gender: AniList 캐릭터 성별(Male, Female). news_hint: 뉴스 제목에서 찾은 (작품, 캐릭터, 배우) 단서
alter table anime_char add column if not exists gender text;
create table if not exists news_hint(id bigserial primary key, url text unique not null, title text not null, source text, published timestamptz,
  kind text not null, ref text not null, ref_title text, chars text[] default '{}', actors text[] default '{}', topic_id text, created_at timestamptz default now());
alter table news_hint enable row level security;
alter table anime_char add column if not exists fav int;
-- (적용 대기: David 확인 후) 뉴스에서 만든 초안은 기사 주소를 topics.links에 넣어 go 함수로만 이동하게 함
create or replace function public.topics_auto_links() returns trigger language plpgsql as $$
begin
  if new.links is null and new.auto ? 'news' and new.auto->'news'->>'u' is not null then
    new.links := jsonb_build_array(jsonb_build_object('url', new.auto->'news'->>'u', 't', new.auto->'news'->>'t', 's', new.auto->'news'->>'s'));
  end if;
  return new;
end $$;
drop trigger if exists topics_auto_links on topics;
create trigger topics_auto_links before insert or update of auto on topics for each row execute function topics_auto_links();
update topics set auto = auto where auto ? 'news' and links is null;
