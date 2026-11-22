-- 023 적재 보조 컬럼과 품질 게이트
alter table public.people add column if not exists credits_at timestamptz;
alter table public.character_map add column if not exists method text not null default 'manual' check (method in ('manual','name','order'));
alter table public.work add column if not exists orig_lang text;
create unique index if not exists story_character_uk on public.story_character(family_work_id, label);
-- dc_qa_gate(): 투표 없는 알고리즘 후보 중 추천 제외, 국적권, 성별, 원작 배우, 원작 출연 기록(credit) 위반을 세트에서 자동 격리
-- 본문은 Supabase에 적용된 023_ingest_support와 동일
-- 정기 작업(UTC): dc-ingest-credits 15분마다, dc-ingest-signals-hourly 매시 17분, dc-ingest-signals-daily 18:29,
--   dc-ingest-remakes-weekly 일 15:33, dc-qa-gate 19:55, dc-qa-gate-weekly 일 17:57
