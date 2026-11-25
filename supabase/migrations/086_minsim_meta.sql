-- 086 민심 픽 확장: 배역 대결 말고도 수집 데이터로 결과가 나오는 예측(넷플릭스 한국 순위, 위키백과 조회수, 극장 관객 수)
-- 확률(예측 포인트 비율) 변화를 시간별로 기록해 그래프로 보여 줌. 정산 기준 20표를 10표로 낮춤
alter table pm_market alter column a drop not null, alter column b drop not null, alter column role_id drop not null, alter column topic_id drop not null;
alter table pm_market drop constraint if exists pm_market_check;
alter table pm_market add column if not exists kind text not null default 'role',
  add column if not exists q text, add column if not exists la text, add column if not exists lb text,
  add column if not exists ia text, add column if not exists ib text, add column if not exists ref jsonb,
  add column if not exists resolve_at timestamptz, add column if not exists va numeric, add column if not exists vb numeric, add column if not exists win text;
create unique index if not exists pm_market_key on pm_market((ref->>'key')) where ref ? 'key';
create table if not exists pm_tick(market_id bigint references pm_market(id) on delete cascade, at timestamptz not null default now(), pa numeric not null, n int not null default 0);
create index if not exists pm_tick_m on pm_tick(market_id, at);
alter table pm_tick enable row level security;
create policy pm_tick_read on pm_tick for select using (true);

-- 데이터 예측 만들기(매시간 돌지만 같은 키는 한 번만)
create or replace function public.pm_generate() returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; wk date; r record; d date := (now() at time zone 'Asia/Seoul')::date; i int;
begin
  -- 1) 넷플릭스 한국 주간 순위: 최신 주 1~6위를 1:2, 3:4, 5:6으로 묶어 "다음 주 누가 더 높을까"
  select max(week) into wk from nf_top10 where scope = 'KR';
  if wk is not null then
    for r in with t as (select t.category, t.rank, t.title, coalesce(w.title, t.title) kt, w.poster, row_number() over (partition by t.category order by t.rank) rn
               from nf_top10 t left join nf_title nt on nt.title = t.title left join ip_work w on w.key = nt.key
               where t.scope = 'KR' and t.week = wk and t.rank <= 6)
             select a.category, a.kt ka, b.kt kb, a.title ta, b.title tb, a.poster pa, b.poster pb, a.rank ra, b.rank rb from t a join t b on a.category = b.category and b.rn = a.rn + 1 and a.rn % 2 = 1 loop
      insert into pm_market(kind, q, la, lb, ia, ib, ref, closes_at, resolve_at)
      values ('nf_kr', format('다음 주 넷플릭스 한국 %s 순위, 누가 더 높을까?', case when r.category = 'TV' then '시리즈' else '영화' end),
        r.ka, r.kb, case when r.pa is not null then 'https://image.tmdb.org/t/p/w342' || r.pa end, case when r.pb is not null then 'https://image.tmdb.org/t/p/w342' || r.pb end,
        jsonb_build_object('key', 'nf:' || wk || ':' || r.ta || ':' || r.tb, 'week', wk + 7, 'ta', r.ta, 'tb', r.tb, 'cat', r.category, 'now', jsonb_build_array(r.ra, r.rb)),
        (wk + 5)::timestamp at time zone 'Asia/Seoul', (wk + 10)::timestamp at time zone 'Asia/Seoul')
      on conflict do nothing;
      if found then n := n + 1; end if;
    end loop;
  end if;
  -- 2) 위키백과 조회수: 지난 7일 조회수가 비슷한 배우끼리 "다음 7일 누가 더 많이 볼까"
  i := 0;
  for r in with p as (select p.name, v.qid, v.total, row_number() over (order by v.total desc) rn from pv_person_7d v join people p on p.qid = v.qid and not coalesce(p.blocked,false) where v.total > 3000)
           select a.name na, b.name nb, a.qid qa, b.qid qb from p a join p b on b.rn = a.rn + 1 and a.rn % 2 = 1 where a.rn <= 12 loop
    insert into pm_market(kind, q, la, lb, ref, closes_at, resolve_at)
    values ('pv', '다음 7일 위키백과 조회수, 누가 더 많을까?', r.na, r.nb,
      jsonb_build_object('key', 'pv:' || (d + 1) || ':' || r.qa || ':' || r.qb, 'qa', r.qa, 'qb', r.qb, 'from', d + 1, 'to', d + 7),
      (d + 1)::timestamp at time zone 'Asia/Seoul', (d + 9)::timestamp at time zone 'Asia/Seoul')
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  -- 3) 극장 관객 수: 어제 박스오피스 1, 2위와 3, 4위의 "모레 하루 관객 수, 누가 더 많을까"
  for r in with b as (select movie_cd, nm, rank from kobis_box where day = (select max(day) from kobis_box) and rank <= 4)
           select a.movie_cd ca, b.movie_cd cb, a.nm na, b.nm nb from b a join b b on b.rank = a.rank + 1 and a.rank % 2 = 1 loop
    insert into pm_market(kind, q, la, lb, ref, closes_at, resolve_at)
    values ('box', format('%s 하루 극장 관객 수, 누가 더 많을까?', to_char(d + 2, 'FMMM"월" FMDD"일"')), r.na, r.nb,
      jsonb_build_object('key', 'box:' || (d + 2) || ':' || r.ca || ':' || r.cb, 'ca', r.ca, 'cb', r.cb, 'day', d + 2),
      (d + 2)::timestamp at time zone 'Asia/Seoul', (d + 4)::timestamp at time zone 'Asia/Seoul')
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  insert into pm_tick(market_id, pa, n) select m.id, 0.5, 0 from pm_market m where not exists(select 1 from pm_tick t where t.market_id = m.id);
  return n;
end $$;

-- 정산: 배역 대결은 사람마다 자기 표 빼고 10표 기준, 데이터 예측은 수집 데이터로 한 번에 판정
create or replace function public.pm_settle() returns int language plpgsql security definer set search_path to 'public' as $$
declare m record; b record; xa numeric; xb numeric; tot int; ma int; mb int; mt int; win text; pool int; side_pool int; o numeric; n int := 0; ok boolean;
begin
  for m in select pm.* from pm_market pm left join topics t on t.id = pm.topic_id
           where pm.status = 'open' and ((pm.kind = 'role' and (pm.closes_at <= now() or t.closed_at is not null)) or (pm.kind <> 'role' and pm.resolve_at <= now())) loop
    select coalesce(sum(stake),0) into pool from pm_bet where market_id = m.id;
    if m.kind = 'role' then
      select count(*) filter (where candidate_id = m.a), count(*) filter (where candidate_id = m.b), count(*) into xa, xb, tot from votes where role_id = m.role_id;
    else
      ok := true;
      if m.kind = 'nf_kr' then
        if not exists(select 1 from nf_top10 where scope = 'KR' and week = (m.ref->>'week')::date) then ok := false;
        else
          select coalesce(min(rank) filter (where title = m.ref->>'ta'), 11), coalesce(min(rank) filter (where title = m.ref->>'tb'), 11) into xa, xb
            from nf_top10 where scope = 'KR' and week = (m.ref->>'week')::date and category = m.ref->>'cat';
          xa := -xa; xb := -xb;
        end if;
      elsif m.kind = 'pv' then
        if (select count(distinct day) from pageviews where day between (m.ref->>'from')::date and (m.ref->>'to')::date) < 7 then ok := false;
        else select coalesce(sum(views) filter (where qid = m.ref->>'qa'),0), coalesce(sum(views) filter (where qid = m.ref->>'qb'),0) into xa, xb
          from pageviews where day between (m.ref->>'from')::date and (m.ref->>'to')::date; end if;
      elsif m.kind = 'box' then
        if not exists(select 1 from kobis_box where day = (m.ref->>'day')::date) then ok := false;
        else select coalesce(max(audi_cnt) filter (where movie_cd = m.ref->>'ca'),0), coalesce(max(audi_cnt) filter (where movie_cd = m.ref->>'cb'),0) into xa, xb
          from kobis_box where day = (m.ref->>'day')::date; end if;
      end if;
      if not ok then
        if m.resolve_at < now() - interval '10 days' then xa := 0; xb := 0; else continue; end if;
      end if;
      update pm_market set va = xa, vb = xb, win = case when xa > xb then 'a' when xb > xa then 'b' end where id = m.id;
    end if;
    for b in select * from pm_bet where market_id = m.id and result is null loop
      if m.kind = 'role' then
        select count(*) filter (where candidate_id = m.a), count(*) filter (where candidate_id = m.b), count(*) into ma, mb, mt from votes where role_id = m.role_id and user_id = b.user_id;
      else ma := 0; mb := 0; mt := 0; end if;
      if (m.kind = 'role' and tot - mt < 10) or (xa - ma) = (xb - mb) then
        update pm_bet set result = 'void', payout = b.stake where market_id = m.id and user_id = b.user_id;
        perform award(b.user_id, b.stake, '민심 픽 무효, 돌려받음', 'pmv:' || m.id);
      else
        win := case when (xa - ma) > (xb - mb) then 'a' else 'b' end;
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

-- 예측할 때마다 확률(포인트 비율) 기록
create or replace function public.pm_tick_add() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into pm_tick(market_id, pa, n) select new.market_id, coalesce(sum(stake) filter (where side='a'),0)::numeric / nullif(sum(stake),0), count(*) from pm_bet where market_id = new.market_id;
  return new;
end $$;
drop trigger if exists pm_tick_add on pm_bet;
create trigger pm_tick_add after insert on pm_bet for each row execute function pm_tick_add();

-- 목록: 배역 대결과 데이터 예측을 섞어서. 확률 변화(최근 40개) 포함
create or replace function public.pm_feed(lim int default 12) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); r jsonb;
begin
  perform pm_ensure(); perform pm_generate(); perform pm_settle();
  select coalesce(jsonb_agg(x order by (x->>'ord')::int, (x->>'closes_at')), '[]'::jsonb) into r from (
    select jsonb_build_object('id', m.id, 'kind', m.kind, 'q', m.q, 'role_id', m.role_id, 'topic_id', m.topic_id, 'title', t.title, 'cat', t.cat, 'ch', ro.ch, 'closes_at', m.closes_at, 'resolve_at', m.resolve_at,
      'a', jsonb_build_object('id', ca.id, 'name', coalesce(ca.name, m.la), 'img', m.ia), 'b', jsonb_build_object('id', cb.id, 'name', coalesce(cb.name, m.lb), 'img', m.ib),
      'now', m.ref->'now',
      'sa', (select coalesce(sum(stake),0) from pm_bet where market_id = m.id and side = 'a'),
      'sb', (select coalesce(sum(stake),0) from pm_bet where market_id = m.id and side = 'b'),
      'n', (select count(*) from pm_bet where market_id = m.id),
      'hist', (select coalesce(jsonb_agg(jsonb_build_array(extract(epoch from at)::bigint, round(pa,3)) order by at), '[]'::jsonb) from (select * from pm_tick where market_id = m.id order by at desc limit 40) h),
      'ord', (row_number() over (partition by m.kind order by m.closes_at))::int) x
    from pm_market m left join topics t on t.id = m.topic_id left join roles ro on ro.id = m.role_id
      left join candidates ca on ca.id = m.a left join candidates cb on cb.id = m.b
    where m.status = 'open' and m.closes_at > now() and (m.kind <> 'role' or t.closed_at is null)
      and (u is null or not exists(select 1 from pm_bet where market_id = m.id and user_id = u))
    order by m.closes_at limit least(greatest(lim,1), 40)) z;
  return r;
end $$;
revoke execute on function public.pm_generate() from public, anon, authenticated;

-- 매시간 정산과 새 예측 만들기(외부 호출 없음)
select cron.schedule('dc-pm-hourly', '23 * * * *', $c$select public.pm_generate(); select public.pm_settle();$c$);
