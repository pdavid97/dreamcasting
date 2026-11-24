-- 051 actor_meta: 후보 배우별 검수된 사진, 표기 이름, 얼굴 위치 (적용 2026-11-24, 051/051b/051c)
-- face: [눈 중심 x/w, 눈 중심 y/h, 눈과 입 거리/h, 눈 사이 거리/h, 눈과 턱 거리/h, 눈 기울기(도)]
--   TMDB w500 사진 기준. YuNet 얼굴 위치 검출(인식 아님). 계산은 로컬 스크립트로 하고 결과만 저장
-- disp: 본명이 영어면 "영어명 (한글명)", 한국어면 "한국어 (영어명)", 중국어, 일본어 등은 "원어 (영어명)"
-- ok=false: TMDB에서 끝내 사진을 못 구한 배우. 후보에서 빼서 candidates_hidden에 보관하고, 다시 후보로 못 올리게 막음
-- 검수된 사진 주소는 tmdb_cache의 p:이름 에 updated_at 2099-01-01로 넣어 tmdb 함수가 다시 검색해 덮어쓰지 않게 함
-- (처음엔 candidates를 보기로 바꿔 숨기려 했으나 group by c.id 를 쓰는 함수가 깨져 되돌림)
create table if not exists public.actor_meta(
  name text primary key, tmdb_id bigint, photo text, en text, native text, lang text, disp text, face jsonb,
  ok boolean not null default true, note text, updated_at timestamptz not null default now());
alter table public.actor_meta enable row level security;
drop policy if exists "public read" on public.actor_meta;
create policy "public read" on public.actor_meta for select using (true);
grant select on public.actor_meta to anon, authenticated;

create table if not exists public.candidates_hidden (like public.candidates including defaults);
alter table public.candidates_hidden alter column id drop identity if exists;
alter table public.candidates_hidden add column if not exists hidden_at timestamptz default now(), add column if not exists hidden_why text;
alter table public.candidates_hidden enable row level security;
insert into public.candidates_hidden select c.*, now(), m.note from public.candidates c join public.actor_meta m on m.name=c.name and not m.ok;
delete from public.candidates c using public.actor_meta m where m.name=c.name and not m.ok;

create or replace function public.trg_cand_photo_ok() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.actor_meta m where m.name = new.name and not m.ok) then
    raise exception '사진을 찾을 수 없는 배우라 후보로 올릴 수 없어요';
  end if;
  return new;
end $$;
drop trigger if exists cand_photo_ok on public.candidates;
create trigger cand_photo_ok before insert on public.candidates for each row execute function public.trg_cand_photo_ok();
