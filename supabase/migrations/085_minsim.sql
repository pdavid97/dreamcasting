-- 085 민심 픽: 광장 판의 1:1 대결에서 "광장이 누구를 더 고를지" 안목 포인트를 걸고 예측
-- 정답은 그 판 마감 때의 실제 득표. 정산할 때 예측한 사람 자신의 표는 빼고 셈(득표율 오염 줄이기)
-- 포인트는 충전, 현금, 상품권, 경품 교환이 없음(사행성 방지 원칙)
create table if not exists pm_market(
  id bigserial primary key,
  role_id bigint not null references roles(id) on delete cascade,
  a bigint not null references candidates(id) on delete cascade,
  b bigint not null references candidates(id) on delete cascade,
  topic_id text not null,
  closes_at timestamptz not null,
  status text not null default 'open' check (status in ('open','settled','void')),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique(role_id, a, b), check (a < b));
create table if not exists pm_bet(
  market_id bigint not null references pm_market(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  side text not null check (side in ('a','b')),
  stake int not null check (stake in (10,30,50)),
  odds numeric,
  result text check (result in ('win','lose','void')),
  payout int,
  created_at timestamptz not null default now(),
  primary key(market_id, user_id));
alter table pm_market enable row level security;
alter table pm_bet enable row level security;
create policy pm_market_read on pm_market for select using (true);
create policy pm_bet_own on pm_bet for select using (user_id = auth.uid());

-- 열린 판의 배역마다 대결 한 쌍을 만들어 둠(득표 상위 두 후보, 그다음 쌍). 마감 6시간 전까지만
create or replace function public.pm_ensure() returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; r record;
begin
  for r in select ro.id rid, t.id tid, t.closes_at,
      (select array_agg(c.id order by coalesce(v.n,0) desc, c.id) from candidates c left join (select candidate_id, count(*) n from votes group by 1) v on v.candidate_id = c.id where c.role_id = ro.id and c.in_set) cs
    from roles ro join topics t on t.id = ro.topic_id
    where t.closed_at is null and t.closes_at > now() + interval '6 hours' and coalesce(t.opens_at, now()) <= now() and ro.stage in ('dream','rumor')
  loop
    if r.cs is null or array_length(r.cs,1) < 2 then continue; end if;
    insert into pm_market(role_id, a, b, topic_id, closes_at) values (r.rid, least(r.cs[1],r.cs[2]), greatest(r.cs[1],r.cs[2]), r.tid, r.closes_at) on conflict do nothing;
    get diagnostics n = row_count;
    if array_length(r.cs,1) >= 4 then
      insert into pm_market(role_id, a, b, topic_id, closes_at) values (r.rid, least(r.cs[3],r.cs[4]), greatest(r.cs[3],r.cs[4]), r.tid, r.closes_at) on conflict do nothing;
    end if;
  end loop;
  return n;
end $$;

-- 민심 픽 목록: 내가 아직 예측하지 않은 열린 대결. 예측 비율(걸린 포인트 비율)은 보여 주되 실제 득표는 숨김
create or replace function public.pm_feed(lim int default 12) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); r jsonb;
begin
  perform pm_ensure(); perform pm_settle();
  select coalesce(jsonb_agg(x order by (x->>'closes_at')), '[]'::jsonb) into r from (
    select jsonb_build_object('id', m.id, 'role_id', m.role_id, 'topic_id', m.topic_id, 'title', t.title, 'cat', t.cat, 'ch', ro.ch, 'closes_at', m.closes_at,
      'a', jsonb_build_object('id', ca.id, 'name', ca.name), 'b', jsonb_build_object('id', cb.id, 'name', cb.name),
      'sa', (select coalesce(sum(stake),0) from pm_bet where market_id = m.id and side = 'a'),
      'sb', (select coalesce(sum(stake),0) from pm_bet where market_id = m.id and side = 'b'),
      'n', (select count(*) from pm_bet where market_id = m.id)) x
    from pm_market m join topics t on t.id = m.topic_id join roles ro on ro.id = m.role_id
      join candidates ca on ca.id = m.a join candidates cb on cb.id = m.b
    where m.status = 'open' and m.closes_at > now() and t.closed_at is null
      and (u is null or not exists(select 1 from pm_bet where market_id = m.id and user_id = u))
    order by m.closes_at limit least(greatest(lim,1), 30)) z;
  return r;
end $$;

-- 예측 걸기: 10, 30, 50 포인트. 가진 포인트 안에서만
create or replace function public.pm_bet_place(mid bigint, side text, stake int) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); m pm_market; pts int; sa int; sb int;
begin
  if u is null or not exists(select 1 from profiles where id = u) then raise exception '로그인이 필요해요'; end if;
  if side not in ('a','b') or stake not in (10,30,50) then raise exception '예측 값이 올바르지 않아요'; end if;
  select * into m from pm_market where id = mid;
  if m.id is null or m.status <> 'open' or m.closes_at <= now() then raise exception '이미 마감된 예측이에요'; end if;
  if exists(select 1 from pm_bet where market_id = mid and user_id = u) then raise exception '이 대결은 이미 예측했어요'; end if;
  select points into pts from profiles where id = u;
  if coalesce(pts,0) < stake then raise exception '안목 포인트가 모자라요. 투표와 VS로 포인트를 모아 주세요'; end if;
  insert into pm_bet(market_id, user_id, side, stake) values (mid, u, side, stake);
  perform award(u, -stake, '민심 픽 예측', 'pm:' || mid);
  select coalesce(sum(b.stake) filter (where b.side='a'),0), coalesce(sum(b.stake) filter (where b.side='b'),0) into sa, sb from pm_bet b where b.market_id = mid;
  return jsonb_build_object('sa', sa, 'sb', sb, 'points', pts - stake);
end $$;

-- 정산: 판이 마감된 대결만. 사람마다 자기 표를 뺀 득표로 승패를 정하고, 그 배역 표가 자기 표 빼고 20표 미만이거나 동점이면 무효(돌려줌)
-- 맞히면 걸린 포인트 전체 대비 내 쪽 비율로 배당(1.2배에서 5배 사이)
create or replace function public.pm_settle() returns int language plpgsql security definer set search_path to 'public' as $$
declare m record; b record; va int; vb int; tot int; ma int; mb int; mt int; win text; pool int; side_pool int; o numeric; n int := 0;
begin
  for m in select pm.* from pm_market pm join topics t on t.id = pm.topic_id
           where pm.status = 'open' and (pm.closes_at <= now() or t.closed_at is not null) loop
    select count(*) filter (where candidate_id = m.a), count(*) filter (where candidate_id = m.b), count(*) into va, vb, tot from votes where role_id = m.role_id;
    select coalesce(sum(stake),0) into pool from pm_bet where market_id = m.id;
    for b in select * from pm_bet where market_id = m.id and result is null loop
      select count(*) filter (where candidate_id = m.a), count(*) filter (where candidate_id = m.b), count(*) into ma, mb, mt from votes where role_id = m.role_id and user_id = b.user_id;
      if tot - mt < 20 or (va - ma) = (vb - mb) then
        update pm_bet set result = 'void', payout = b.stake where market_id = m.id and user_id = b.user_id;
        perform award(b.user_id, b.stake, '민심 픽 무효, 돌려받음', 'pmv:' || m.id);
      else
        win := case when (va - ma) > (vb - mb) then 'a' else 'b' end;
        select coalesce(sum(stake),0) into side_pool from pm_bet where market_id = m.id and side = b.side;
        o := least(5, greatest(1.2, pool::numeric / nullif(side_pool,0)));
        if b.side = win then
          update pm_bet set result = 'win', odds = round(o,2), payout = round(b.stake * o) where market_id = m.id and user_id = b.user_id;
          perform award(b.user_id, round(b.stake * o)::int, '민심 픽 적중', 'pmw:' || m.id);
        else
          update pm_bet set result = 'lose', odds = round(o,2), payout = 0 where market_id = m.id and user_id = b.user_id;
        end if;
      end if;
    end loop;
    update pm_market set status = 'settled', settled_at = now() where id = m.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- 내 예측 기록과 적중률
create or replace function public.pm_mine() returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'bets', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', t.title, 'ch', ro.ch, 'pick', case when b.side='a' then ca.name else cb.name end,
       'stake', b.stake, 'result', b.result, 'payout', b.payout, 'closes_at', m.closes_at) order by b.created_at desc)
      from pm_bet b join pm_market m on m.id = b.market_id join topics t on t.id = m.topic_id join roles ro on ro.id = m.role_id
      join candidates ca on ca.id = m.a join candidates cb on cb.id = m.b where b.user_id = auth.uid()), '[]'::jsonb),
    'hit', (select count(*) filter (where result='win') from pm_bet where user_id = auth.uid()),
    'done', (select count(*) filter (where result in ('win','lose')) from pm_bet where user_id = auth.uid()))
$$;
revoke execute on function public.pm_ensure(), public.pm_settle() from public, anon, authenticated;
grant execute on function public.pm_feed(int) to anon, authenticated;
revoke execute on function public.pm_bet_place(bigint,text,int) from public, anon;
grant execute on function public.pm_bet_place(bigint,text,int) to authenticated;
grant execute on function public.pm_mine() to authenticated;
