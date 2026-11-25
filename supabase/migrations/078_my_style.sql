-- 078 유저 분석: 나와 광장 비교(C2), 내 캐스팅 성향(C3)
create or replace function public.my_style() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare me uuid:=auth.uid(); r jsonb;
begin
 if me is null then return null; end if;
 with rv as (select role_id, candidate_id, count(*) n from votes group by 1,2),
 rt as (select role_id, sum(n) tot, max(n) top from rv group by 1),
 allv as (select v.user_id, rv.n, rt.tot, rt.top from votes v join rv using(role_id,candidate_id) join rt using(role_id)),
 mine as (
  select t.cat, ro.slot, rv.n, rt.tot, rt.top, t.work->'genres' g,
    coalesce(t.work->'networks'->>0, t.work->'watch'->0->>'name') net, t.work->>'kind' kind,
    pp.gender pg, pp.region preg,
    coalesce(('{"k2us":"intl","k2cn":"cn","k2tw":"tw","k2hk":"hk"}'::jsonb)->>t.cat, t.work->>'region','kr') ereg
  from votes v join candidates c on c.id=v.candidate_id join roles ro on ro.id=v.role_id join topics t on t.id=ro.topic_id
  join rv on rv.role_id=v.role_id and rv.candidate_id=v.candidate_id join rt on rt.role_id=v.role_id
  left join lateral (select gender, region from people p where p.id=c.person_id or (c.person_id is null and p.name=c.name) order by pop desc nulls last limit 1) pp on true
  where v.user_id=me)
 select jsonb_build_object(
  'votes', coalesce((select jsonb_agg(jsonb_build_object('cat',cat,'slot',slot,'n',n,'tot',tot,'top',n>=top,'g',g,'net',net,'kind',kind,'pg',pg,'preg',preg,'ereg',ereg)) from mine),'[]'),
  'all', (select jsonb_build_object('top', round(100.0*count(*) filter (where n>=top)/nullif(count(*),0)),
     'minor', round(100.0*count(*) filter (where tot>=5 and n::numeric/tot<0.2)/nullif(count(*) filter (where tot>=5),0)),
     'solo', round(100.0*count(*) filter (where n=1 and tot>=3)/nullif(count(*) filter (where tot>=3),0))) from allv)) into r;
 return r;
end $$;
grant execute on function public.my_style() to authenticated;
