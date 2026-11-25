-- 059 원작 배우 나이 비교 보강: 출생일(Wikidata P569) 채움(qid는 다른 행에 이미 있어 그대로), cast_links는 원작 공개 연도를 못 찾으면 작품 연도(topics.work.year)로
update people set birth=v.b::date from (values (6315,'1956-03-07','Q23547'),(6311,'1969-02-11','Q32522'),(6316,'1967-07-25','Q186896'),(6313,'1966-11-02','Q188792'),(6317,'1979-08-27','Q302491'),(6312,'1973-10-01','Q488864')) v(id,b,q) where people.id=v.id and people.birth is null;
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
    'oy', coalesce((select w.year from credit x join work w on w.id = x.work_id where x.person_id = cc.opid and w.title = (select title from tt) and w.year is not null order by w.year limit 1), (select nullif(work->>'year','')::int from topics where id = tid)),
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
