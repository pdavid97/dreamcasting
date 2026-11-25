-- 077 배우 페이지: 같은 작품에 자주 함께 출연한 배우(주요 배역 8번째까지, 옴니버스 제외)
create or replace function public.costars(pid bigint, lim int default 12)
returns table(id bigint, name text, n int, photo text, works jsonb)
language sql stable security definer set search_path=public as $$
  with w as (select work_id from credit where person_id=pid and not coalesce(anthology,false) and coalesce(ord,99)<=12),
  c as (select c.person_id, c.work_id from credit c join w using(work_id)
        where c.person_id<>pid and coalesce(c.ord,99)<=8 and not coalesce(c.anthology,false)),
  g as (select person_id, count(distinct work_id)::int n from c group by person_id having count(distinct work_id)>=2)
  select p.id, p.name, g.n, p.profile->>'photo',
    (select jsonb_agg(x order by x->>'y' desc) from (select distinct jsonb_build_object('t',wk.title,'y',wk.year) x
       from c join work wk on wk.id=c.work_id where c.person_id=p.id) s)
  from g join people p on p.id=g.person_id
  where not coalesce(p.blocked,false)
  order by g.n desc, p.pop desc nulls last limit least(greatest(lim,1),20)
$$;
grant execute on function public.costars(bigint,int) to anon, authenticated;
