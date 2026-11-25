-- 058 cast_links(tid): aff(원작 배우와 후보가 같은 소속사, 레이블, 그룹에 있었던 기록, Wikidata) 추가
-- 원작 배우는 roles.orig 이름으로 people과 맞춤(이름 또는 다른 이름). 동명이인은 원작 작품 출연 기록이 있는 사람을 우선. 소속은 person_affil(057)
create or replace function public.cast_links(tid text)
returns jsonb language sql stable security definer set search_path = public as $$
  with tt as (select title from topics where id = tid),
  ro as (
    select r.id rid, r.orig,
      (select p.id from people p where p.name = r.orig or r.orig = any(p.aliases)
        order by exists(select 1 from credit x join work w on w.id = x.work_id where x.person_id = p.id and w.title = (select title from tt)) desc, p.pop desc nulls last limit 1) opid
    from roles r where r.topic_id = tid and r.orig is not null
  ), cc as (
    select ro.rid, ro.opid, c.id cid, c.name,
      coalesce(c.person_id, (select p.id from people p where p.name = c.name order by p.pop desc nulls last limit 1)) cpid
    from ro join candidates c on c.role_id = ro.rid
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'rid', cc.rid, 'cid', cc.cid,
    'ob', (select extract(year from birth)::int from people where id = cc.opid),
    'oy', (select w.year from credit x join work w on w.id = x.work_id where x.person_id = cc.opid and w.title = (select title from tt) and w.year is not null order by w.year limit 1),
    'cb', (select extract(year from birth)::int from people where id = cc.cpid),
    'aff', (select coalesce(jsonb_agg(distinct jsonb_build_object('k', a.kind, 'n', a.name)), '[]'::jsonb) from person_affil a join person_affil b on b.qid = a.qid and b.person_id = cc.cpid where a.person_id = cc.opid and cc.opid <> cc.cpid),
    'works', (select coalesce(jsonb_agg(x order by x->>'y' desc), '[]'::jsonb) from (
        select jsonb_build_object('t', w.title, 'y', w.year) x
        from credit a join credit b on b.work_id = a.work_id and b.person_id = cc.cpid
        join work w on w.id = a.work_id
        where a.person_id = cc.opid and cc.opid <> cc.cpid
        group by w.id, w.title, w.year order by w.year desc nulls last limit 3) z)
  )), '[]'::jsonb)
  from cc;
$$;
grant execute on function public.cast_links(text) to anon, authenticated;
