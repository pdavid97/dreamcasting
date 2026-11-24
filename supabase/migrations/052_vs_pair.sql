-- 052 vs_pair: VS 한판 다음 대결 고르기(11/24 확정 규칙). 예전 왕좌 지키기(duel_next) 대신 씀
-- 1) 한 배역은 연달아 2~3판까지: 클라이언트가 avoid로 넘긴 배역은 건너뜀
-- 2) 정보가 필요한 조합 먼저: VS 레이팅이 비슷할수록, 대결 기록이 적을수록 점수 높음
-- 3) 수집 완료: 30판 이상에서 한쪽이 70% 이상이면 더 내보내지 않음
-- 4) 같은 사람(로그인 사용자 또는 비로그인 세션)에게 같은 조합 다시 묻지 않음
-- 사진과 얼굴 위치가 있는 후보(actor_meta.ok, face)만 짝지음
create index if not exists vs_log_pkey_idx on public.vs_log(pkey);
create or replace function public.vs_pair(s text default '', prefer text default null, avoid bigint[] default '{}')
returns jsonb language sql security definer set search_path = public as $$
  with r as (
    select r.id, r.ch, r.orig, t.id tid, t.title, t.cat
    from roles r join topics t on t.id = r.topic_id
    where t.closed_at is null and t.opens_at <= now() and r.stage in ('dream','rumor') and r.slot is not null
      and coalesce(r.kind,'actor') = 'actor' and not (r.id = any(avoid))
  ), c as (
    select c.id, c.role_id, c.name, coalesce(vr.r, 1500) elo
    from candidates c join actor_meta m on m.name = c.name and m.ok and m.face is not null
    left join vs_rating vr on vr.cand_id = c.id
    where c.in_set and c.role_id in (select id from r)
  ), p as (
    select a.role_id, least(a.id,b.id) lo, greatest(a.id,b.id) hi, abs(a.elo - b.elo) gap,
      'role:'||a.role_id||':'||least(a.id,b.id)||':'||greatest(a.id,b.id) pk
    from c a join c b on a.role_id = b.role_id and a.id < b.id
  ), st as (
    select p.*,
      (select count(*) from vs_log l where l.pkey = p.pk and not l.bad and l.win is not null) n,
      (select count(*) from vs_log l where l.pkey = p.pk and not l.bad and l.win = p.lo) wl,
      exists(select 1 from vs_log l where l.pkey = p.pk and ((auth.uid() is not null and l.user_id = auth.uid()) or (s <> '' and l.sid = s))) seen
    from p
  ), sc as (
    select st.*, r.ch, r.orig, r.tid, r.title, r.cat,
      (case when prefer is not null and r.tid = prefer then 60 else 0 end)
      + 40.0 / (1 + n) + 30 * exp(-gap / 100.0) + random() * 25 score
    from st join r on r.id = st.role_id
    where not seen and not (n >= 30 and greatest(wl, n - wl)::real / n >= 0.7)
  ), best as (select sc.*, random() < .5 flip from sc order by score desc limit 1)
  select jsonb_build_object('rid', b.role_id, 'ch', b.ch, 'orig', b.orig, 'tid', b.tid, 'title', b.title, 'cat', b.cat, 'pk', b.pk, 'n', b.n,
    'a', (select jsonb_build_object('candidate_id', x.id, 'name', x.name) from candidates x where x.id = case when b.flip then b.hi else b.lo end),
    'b', (select jsonb_build_object('candidate_id', x.id, 'name', x.name) from candidates x where x.id = case when b.flip then b.lo else b.hi end))
  from best b;
$$;
grant execute on function public.vs_pair(text,text,bigint[]) to anon, authenticated;
