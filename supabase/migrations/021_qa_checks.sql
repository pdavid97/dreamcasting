-- 021 품질 검사 함수와 보관 기한 정리
-- dc_qa(): 국적권 불일치, 원작 출연자, 차단 인물, 성별 불일치, 소개글 없음, 근거 없는 문장, 세트 6명 미만, 기한 지난 원본
-- 매일 19:51 UTC(dc-qa-daily) 실행, 결과는 qa_result에 누적. 매일 20:03 UTC dc-purge-daily가 기한 지난 원본 삭제
-- 본문은 Supabase에 적용된 버전과 동일(MCP apply_migration 021_qa_checks)

update candidates c set person_id = cp.person_id from cast_pool cp where c.person_id is null and c.pool_id = cp.id and cp.person_id is not null;

create or replace function public.dc_qa(save boolean default true)
returns table(check_name text, n int, sample jsonb)
language plpgsql security definer set search_path = public as $$
begin
  create temp table if not exists _qa(check_name text, n int, sample jsonb) on commit drop;
  truncate _qa;
  create temp table if not exists _cs on commit drop as
    select c.id, c.name, c.pick, c.blurb, c.blurb_at, c.pick_why, r.slot, r.orig, t.id tid, t.cat, t.work,
           p.id pid, p.region, p.gender, p.blocked, p.tmdb_id
    from candidates c join roles r on r.id = c.role_id join topics t on t.id = r.topic_id
    left join cast_pool cp on cp.id = c.pool_id
    left join people p on p.id = coalesce(c.person_id, cp.person_id)
    where c.in_set and t.closed_at is null;
  insert into _qa select 'region_mismatch', count(*), jsonb_agg(name||' @'||tid)
    from _cs where pick in ('classic','buzz','chem','wild') and region is not null
      and ((cat = 'k2us' and region <> 'intl') or (cat <> 'k2us' and region = 'intl'));
  insert into _qa select 'orig_cast_in_set', count(*), jsonb_agg(name||' @'||tid)
    from _cs s where pick in ('classic','buzz','chem','wild') and (
      exists (select 1 from roles r2 where r2.topic_id = s.tid and r2.orig = s.name)
      or exists (select 1 from jsonb_array_elements(coalesce(s.work->'cast','[]'::jsonb)) x where x->>'name' = s.name));
  insert into _qa select 'blocked_in_set', count(*), jsonb_agg(name||' @'||tid) from _cs where blocked;
  insert into _qa select 'gender_mismatch', count(*), jsonb_agg(name||' @'||tid)
    from _cs where pick in ('classic','buzz','chem','wild') and gender is not null
      and ((slot like 'male%' and gender <> 2) or (slot like 'female%' and gender <> 1));
  insert into _qa select 'no_blurb', count(*), jsonb_agg(name||' @'||tid) from _cs where blurb_at is null;
  insert into _qa select 'unsupported_text', count(*), jsonb_agg(name||' @'||tid)
    from _cs where coalesce(blurb::text,'') || coalesce(pick_why,'') ~ '홈그라운드|출연작만|비주얼 결|"k": ?"genre"';
  insert into _qa select 'set_size_short', count(*), jsonb_agg(x.rid)
    from (select r.id rid from roles r join topics t on t.id = r.topic_id
          where t.closed_at is null and r.slot is not null and r.stage in ('dream','rumor')
            and (select count(*) from candidates c where c.role_id = r.id and c.in_set and c.pick in ('classic','buzz','chem','wild')) < 6) x;
  insert into _qa select 'raw_expired', count(*), null from raw_fetch where expires_at < now();
  update _qa set sample = (select jsonb_agg(v) from (select v from jsonb_array_elements(_qa.sample) v limit 10) s) where _qa.sample is not null;
  if save then insert into qa_result(check_name, n, sample) select q.check_name, q.n, q.sample from _qa q; end if;
  return query select q.check_name, q.n, q.sample from _qa q;
end $$;
revoke all on function public.dc_qa(boolean) from public, anon, authenticated;

create or replace function public.dc_purge_expired() returns int language sql security definer set search_path = public as $$
  with d as (delete from raw_fetch where expires_at < now() returning 1) select count(*)::int from d;
$$;
revoke all on function public.dc_purge_expired() from public, anon, authenticated;

-- select cron.schedule('dc-qa-daily', '51 19 * * *', $$select public.dc_qa(true)$$);
-- select cron.schedule('dc-purge-daily', '3 20 * * *', $$select public.dc_purge_expired()$$);
