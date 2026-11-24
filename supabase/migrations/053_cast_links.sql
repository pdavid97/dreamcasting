-- 053 cast_links(tid): 원작 배우와 후보 배우 사이 연결고리(함께 출연한 작품, 출생 연도). 내 캐스팅 리포트용
-- 원작 배우는 roles.orig 이름으로 people과 맞춤(이름 또는 다른 이름). 동명이인은 원작 작품 출연 기록이 있는 사람을 우선. 소속사 정보는 아직 DB에 없음
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
    'cb', (select extract(year from birth)::int from people where id = cc.cpid),
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
