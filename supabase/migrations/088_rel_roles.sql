-- 결과 화면 "이어서 고르기": 내 픽 배우와 연결된 다른 판의 배역
-- own: 내 픽 배우가 원작에서 직접 연기한 배역 / co: 내 픽 배우와 같은 작품에 함께 출연한 배우의 원작 배역
create or replace function public.rel_roles(tid text, lim int default 4)
returns table(topic_id text, title text, rid bigint, ch text, kind text, pick text, orig text, via text)
language sql stable security definer set search_path to 'public' as $$
  with me as (select auth.uid() u),
  pk as (
    select distinct on (pid) coalesce(c.person_id, (select p.id from people p where p.name = c.name order by (p.tmdb_id is null), p.pop desc nulls last limit 1)) pid, c.name
    from votes v join roles r on r.id = v.role_id join candidates c on c.id = v.candidate_id, me
    where r.topic_id = tid and v.user_id = me.u),
  op as (select r.id, r.topic_id, r.ch, r.orig, r.orig_pid, t.title from roles r join topics t on t.id = r.topic_id
    where r.topic_id <> tid and r.orig_pid is not null and (t.closes_at is null or t.closes_at > now()) and t.closed_at is null
      and (t.opens_at is null or t.opens_at <= now())
      and not exists (select 1 from votes v, me where v.role_id = r.id and v.user_id = me.u)),
  own as (select op.topic_id, op.title, op.id rid, op.ch, 'own'::text kind, pk.name pick, op.orig, null::text via, 0 pri
    from op join pk on pk.pid = op.orig_pid),
  co as (select distinct on (op.id) op.topic_id, op.title, op.id rid, op.ch, 'co'::text kind, pk.name pick, op.orig, w.title via, 1 pri
    from pk join credit a on a.person_id = pk.pid and coalesce(a.ord,99) <= 8 and not coalesce(a.anthology,false)
      join credit b on b.work_id = a.work_id and b.person_id <> pk.pid and coalesce(b.ord,99) <= 8 and not coalesce(b.anthology,false)
      join op on op.orig_pid = b.person_id join work w on w.id = a.work_id
    order by op.id, w.year desc nulls last)
  select topic_id, title, rid, ch, kind, pick, orig, via from (
    select distinct on (topic_id) * from (select * from own union all select * from co) z order by topic_id, pri) q
  order by pri, random() limit least(greatest(lim,1),6)
$$;
grant execute on function public.rel_roles(text,int) to anon, authenticated;
