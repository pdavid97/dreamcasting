-- 025 중화권(중국 cn, 대만 tw, 홍콩 hk) 지역과 중국판 분류(k2cn, 예비 k2tw, k2hk)
alter table public.cast_pool drop constraint if exists cast_pool_region_check;
alter table public.cast_pool add constraint cast_pool_region_check check (region in ('kr','intl','cn','tw','hk'));
alter table public.topics drop constraint if exists topics_cat_check;
alter table public.topics add constraint topics_cat_check check (cat in ('wn','k2','us2k','k2us','k2cn','k2tw','k2hk','ip2live','live2x'));
create or replace function public.dc_cat_region(cat text) returns text language sql immutable as $$
  select case cat when 'k2us' then 'intl' when 'k2cn' then 'cn' when 'k2tw' then 'tw' when 'k2hk' then 'hk' else 'kr' end
$$;
-- dc_qa, dc_qa_gate: 국적권 검사를 dc_cat_region(cat)으로 일반화 (본문은 Supabase 적용본과 동일)
-- 중국판 시드 주제: cn_reply88(응답하라 1988), cn_itaewon(이태원 클라쓰), cn_mylove(별에서 온 그대)
