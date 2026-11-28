-- 099 예측 v2 (docs: dreamcasting/content-roles-v2.md)
-- vs : VS 한판 민심 대결. 표가 40~60%로 갈리거나 VS 레이팅이 비슷한 조합을 골라 "다음 7일 VS에서 누가 더 뽑힐까"를 예측
--      정산은 그 기간 VS 기록, 예측자 자신의 VS 선택은 빼고, 5표 미만이거나 동점이면 돌려줌. 걸린 조합은 VS 한판에 먼저 나옴
-- pvb: 기준선형. 한 사람의 다음 7일 위키백과 조회수가 지난 7일보다 많을까(짝이 없을 때도 시작 확률이 반반에 가깝게)
-- ev : 사건 예측(예, 아니오). 운영자가 만들고 공개. 뉴스 제목에서 키워드가 잡히면 근거 후보로 표시, 운영자가 확정
--      정산 기한까지 확정된 근거가 없으면 아니오로 정산
-- 지표 대결 박빙 규칙: 위키 조회수 쌍은 차이 15% 이내, 극장 관객 쌍은 25% 이내만
alter table pm_market drop constraint if exists pm_market_status_check;
alter table pm_market add constraint pm_market_status_check check (status in ('draft','open','settled','void'));
alter table pm_market drop constraint if exists pm_market_role_id_a_b_key;
create unique index if not exists pm_market_role_pair on pm_market(role_id, a, b) where kind = 'role';
alter table pm_market add column if not exists hit jsonb;
alter table buzz_ideas drop constraint if exists buzz_ideas_status_check;
alter table buzz_ideas add constraint buzz_ideas_status_check check (status in ('new','used','skip','ev'));

create or replace function public.pm_generate() returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; wk date; r record; d date := (now() at time zone 'Asia/Seoul')::date; i int; nvs int;
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
  -- 2) 위키백과 조회수 대결: 지난 7일 조회수 차이가 15% 이내인 이웃끼리만, 하루 6쌍까지
  i := 0;
  for r in with p as (select p.name, v.qid, v.total, row_number() over (order by v.total desc) rn from pv_person_7d v join people p on p.qid = v.qid and not coalesce(p.blocked,false) where v.total > 3000)
           select a.name na, b.name nb, a.qid qa, b.qid qb from p a join p b on b.rn = a.rn + 1 and a.rn % 2 = 1
           where a.rn <= 40 and b.total >= a.total * 0.85 order by a.rn loop
    exit when i >= 6;
    insert into pm_market(kind, q, la, lb, ref, closes_at, resolve_at)
    values ('pv', '다음 7일 위키백과 조회수, 누가 더 많을까?', r.na, r.nb,
      jsonb_build_object('key', 'pv:' || (d + 1) || ':' || r.qa || ':' || r.qb, 'qa', r.qa, 'qb', r.qb, 'from', d + 1, 'to', d + 7),
      (d + 1)::timestamp at time zone 'Asia/Seoul', (d + 9)::timestamp at time zone 'Asia/Seoul')
    on conflict do nothing;
    if found then n := n + 1; i := i + 1; end if;
  end loop;
  -- 2-1) 기준선형: 조회수 상위 3명, 하루 3개(지난 7일 값을 기준선으로 써서 시작이 반반에 가까움)
  i := 0;
  for r in select p.name, v.qid, v.total from pv_person_7d v join people p on p.qid = v.qid and not coalesce(p.blocked,false)
           where v.total > 5000 order by v.total desc limit 3 loop
    insert into pm_market(kind, q, la, lb, ref, closes_at, resolve_at)
    values ('pvb', format('%s, 다음 7일 위키백과 조회수가 지난 7일보다 많을까?', regexp_replace(r.name, '\s*\(.*\)$', '')), '더 많다', '더 적다',
      jsonb_build_object('key', 'pvb:' || (d + 1) || ':' || r.qid, 'qid', r.qid, 'base', r.total, 'name', r.name, 'from', d + 1, 'to', d + 7),
      (d + 1)::timestamp at time zone 'Asia/Seoul', (d + 9)::timestamp at time zone 'Asia/Seoul')
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  -- 3) 극장 관객 수: 어제 박스오피스 1:2, 3:4 중 관객 차이가 25% 이내인 쌍만
  for r in with b as (select movie_cd, nm, rank, audi_cnt from kobis_box where day = (select max(day) from kobis_box) and rank <= 6)
           select a.movie_cd ca, b.movie_cd cb, a.nm na, b.nm nb from b a join b b on b.rank = a.rank + 1 and a.rank % 2 = 1
           where b.audi_cnt >= a.audi_cnt * 0.75 loop
    insert into pm_market(kind, q, la, lb, ref, closes_at, resolve_at)
    values ('box', format('%s 하루 극장 관객 수, 누가 더 많을까?', to_char(d + 2, 'FMMM"월" FMDD"일"')), r.na, r.nb,
      jsonb_build_object('key', 'box:' || (d + 2) || ':' || r.ca || ':' || r.cb, 'ca', r.ca, 'cb', r.cb, 'day', d + 2),
      (d + 2)::timestamp at time zone 'Asia/Seoul', (d + 4)::timestamp at time zone 'Asia/Seoul')
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  -- 4) VS 민심 대결: 열린 것이 8개 미만일 때만 박빙 조합에서 채움. 기간은 최대 7일, 판 마감 1시간 전까지. 예측 마감은 기간의 40% 지점
  select count(*) into nvs from pm_market where kind = 'vs' and status = 'open';
  if nvs < 8 then
    for r in with ro as (
        select rr.id, t.id tid, coalesce(t.closes_at, now() + interval '30 days') tc from roles rr join topics t on t.id = rr.topic_id
        where t.closed_at is null and t.opens_at <= now() and coalesce(t.closes_at, now() + interval '30 days') > now() + interval '2 days'
          and rr.stage in ('dream','rumor') and rr.slot is not null and coalesce(rr.kind,'actor') = 'actor'),
      c as (select c.id, c.role_id, vr.r elo, coalesce(vr.n,0) vn from candidates c join ro on ro.id = c.role_id
            join actor_meta m on m.name = c.name and m.ok and m.face is not null left join vs_rating vr on vr.cand_id = c.id where c.in_set),
      p as (select a.role_id, least(a.id,b.id) lo, greatest(a.id,b.id) hi, abs(a.elo - b.elo) gap, a.vn + b.vn vn,
              'role:' || a.role_id || ':' || least(a.id,b.id) || ':' || greatest(a.id,b.id) pk from c a join c b on a.role_id = b.role_id and a.id < b.id),
      s as (select p.*, (select count(*) from vs_log l where l.pkey = p.pk and not l.bad and l.win is not null) nn,
              (select count(*) from vs_log l where l.pkey = p.pk and not l.bad and l.win = p.lo) wl from p)
      select s.*, ro.tid, least(now() + interval '7 days', ro.tc - interval '1 hour') te from s join ro on ro.id = s.role_id
      where ((s.nn >= 3 and s.wl::numeric / s.nn between 0.4 and 0.6) or (s.nn < 3 and s.gap is not null and s.gap <= 40 and s.vn >= 4))
        and not exists(select 1 from pm_market m where m.kind = 'vs' and m.status = 'open' and m.role_id = s.role_id)
      order by (s.nn >= 3) desc, abs(0.5 - s.wl::numeric / greatest(s.nn,1)), s.gap nulls last, random()
      limit 8 - nvs loop
      -- 한 배역에 하나만(위 not exists는 같은 실행 안의 중복을 막지 못해 다시 확인)
      continue when exists(select 1 from pm_market m where m.kind = 'vs' and m.status = 'open' and m.role_id = r.role_id);
      insert into pm_market(kind, q, role_id, a, b, topic_id, ref, closes_at, resolve_at)
      values ('vs', '다음 7일 VS 한판, 누가 더 많이 뽑힐까?', r.role_id, r.lo, r.hi, r.tid,
        jsonb_build_object('key', 'vs:' || d || ':' || r.pk, 'pk', r.pk, 'from', now(), 'to', r.te, 'min', 5),
        now() + (r.te - now()) * 0.4, r.te)
      on conflict do nothing;
      if found then n := n + 1; end if;
    end loop;
  end if;
  -- 5) 사건 예측 근거 후보: 만든 뒤 나온 기사 제목에 키워드(kw 모두, any 하나 이상)가 있으면 hit에 기록
  update pm_market m set hit = h.j from (
    select m2.id, (select jsonb_build_object('t', x.title, 'u', x.url, 's', x.source, 'at', x.published) from (
        select title, url, source, published from buzz_ideas union all select title, url, source, published from news_hint) x
      where x.published >= m2.created_at - interval '1 day' and not (coalesce(m2.ref->'dismissed','[]'::jsonb) ? x.url)
        and not exists(select 1 from jsonb_array_elements_text(coalesce(m2.ref->'kw','[]')) k where position(k in x.title) = 0)
        and (jsonb_array_length(coalesce(m2.ref->'any','[]')) = 0 or exists(select 1 from jsonb_array_elements_text(m2.ref->'any') k where position(k in x.title) > 0))
      order by x.published limit 1) j
    from pm_market m2 where m2.kind = 'ev' and m2.status = 'open' and m2.hit is null and jsonb_array_length(coalesce(m2.ref->'kw','[]')) > 0) h
  where m.id = h.id and h.j is not null;
  insert into pm_tick(market_id, pa, n) select m.id, 0.5, 0 from pm_market m where m.status = 'open' and not exists(select 1 from pm_tick t where t.market_id = m.id);
  return n;
end $$;
revoke execute on function public.pm_generate() from public, anon, authenticated;

-- 정산
create or replace function public.pm_settle() returns int language plpgsql security definer set search_path to 'public' as $$
declare m record; b record; xa numeric; xb numeric; tot int; ma int; mb int; mt int; win text; pool int; side_pool int; o numeric; n int := 0; ok boolean; mn int;
begin
  for m in select pm.* from pm_market pm left join topics t on t.id = pm.topic_id
           where pm.status = 'open' and (
             (pm.kind = 'role' and (pm.closes_at <= now() or t.closed_at is not null))
             or (pm.kind = 'ev' and (pm.ref ? 'win' or pm.resolve_at <= now()))
             or (pm.kind not in ('role','ev') and pm.resolve_at <= now())) loop
    select coalesce(sum(stake),0) into pool from pm_bet where market_id = m.id;
    tot := 0; mn := 0;
    if m.kind = 'role' then
      select count(*) filter (where candidate_id = m.a), count(*) filter (where candidate_id = m.b), count(*) into xa, xb, tot from votes where role_id = m.role_id;
      mn := 10;
    elsif m.kind = 'vs' then
      select count(*) filter (where win = m.a), count(*) filter (where win = m.b), count(*) into xa, xb, tot
        from vs_log where pkey = m.ref->>'pk' and not bad and win is not null and at >= (m.ref->>'from')::timestamptz and at < (m.ref->>'to')::timestamptz;
      mn := coalesce((m.ref->>'min')::int, 5);
      update pm_market set va = xa, vb = xb, win = case when xa > xb then 'a' when xb > xa then 'b' end where id = m.id;
    else
      ok := true;
      if m.kind = 'nf_kr' then
        if not exists(select 1 from nf_top10 where scope = 'KR' and week = (m.ref->>'week')::date) then ok := false;
        else
          select coalesce(min(rank) filter (where title = m.ref->>'ta'), 11), coalesce(min(rank) filter (where title = m.ref->>'tb'), 11) into xa, xb
            from nf_top10 where scope = 'KR' and week = (m.ref->>'week')::date and category = m.ref->>'cat';
          xa := -xa; xb := -xb;
        end if;
      elsif m.kind in ('pv','pvb') then
        if (select count(distinct day) from pageviews where day between (m.ref->>'from')::date and (m.ref->>'to')::date) < 7 then ok := false;
        elsif m.kind = 'pv' then select coalesce(sum(views) filter (where qid = m.ref->>'qa'),0), coalesce(sum(views) filter (where qid = m.ref->>'qb'),0) into xa, xb
          from pageviews where day between (m.ref->>'from')::date and (m.ref->>'to')::date;
        else select coalesce(sum(views),0) into xa from pageviews where qid = m.ref->>'qid' and day between (m.ref->>'from')::date and (m.ref->>'to')::date;
          xb := (m.ref->>'base')::numeric; end if;
      elsif m.kind = 'box' then
        if not exists(select 1 from kobis_box where day = (m.ref->>'day')::date) then ok := false;
        else select coalesce(max(audi_cnt) filter (where movie_cd = m.ref->>'ca'),0), coalesce(max(audi_cnt) filter (where movie_cd = m.ref->>'cb'),0) into xa, xb
          from kobis_box where day = (m.ref->>'day')::date; end if;
      elsif m.kind = 'ev' then
        if m.ref ? 'win' then xa := case when m.ref->>'win' = 'a' then 1 else 0 end; xb := 1 - xa;
        elsif m.hit is not null then
          -- 근거 후보가 있는데 아직 확정 전이면 기다림(10일 넘게 확인이 없으면 돌려줌)
          if m.resolve_at < now() - interval '10 days' then xa := 0; xb := 0; else continue; end if;
        else xa := 0; xb := 1; end if;
      end if;
      if not ok then
        if m.resolve_at < now() - interval '10 days' then xa := 0; xb := 0; else continue; end if;
      end if;
      update pm_market set va = xa, vb = xb, win = case when xa > xb then 'a' when xb > xa then 'b' end where id = m.id;
    end if;
    for b in select * from pm_bet where market_id = m.id and result is null loop
      ma := 0; mb := 0; mt := 0;
      if m.kind = 'role' then
        select count(*) filter (where candidate_id = m.a), count(*) filter (where candidate_id = m.b), count(*) into ma, mb, mt from votes where role_id = m.role_id and user_id = b.user_id;
      elsif m.kind = 'vs' then
        select count(*) filter (where win = m.a), count(*) filter (where win = m.b), count(*) into ma, mb, mt
          from vs_log where pkey = m.ref->>'pk' and user_id = b.user_id and not bad and win is not null and at >= (m.ref->>'from')::timestamptz and at < (m.ref->>'to')::timestamptz;
      end if;
      if (mn > 0 and tot - mt < mn) or (xa - ma) = (xb - mb) then
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
revoke execute on function public.pm_settle() from public, anon, authenticated;

-- 내 예측 목록: 데이터 예측과 사건 예측도 나오도록
create or replace function public.pm_mine() returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'bets', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'q', m.q, 'title', t.title, 'ch', ro.ch,
       'pick', case when b.side='a' then coalesce(ca.name, m.la) else coalesce(cb.name, m.lb) end,
       'stake', b.stake, 'result', b.result, 'payout', b.payout, 'closes_at', m.closes_at, 'resolve_at', m.resolve_at) order by b.created_at desc)
      from pm_bet b join pm_market m on m.id = b.market_id left join topics t on t.id = m.topic_id left join roles ro on ro.id = m.role_id
      left join candidates ca on ca.id = m.a left join candidates cb on cb.id = m.b where b.user_id = auth.uid()), '[]'::jsonb),
    'hit', (select count(*) filter (where result='win') from pm_bet where user_id = auth.uid()),
    'done', (select count(*) filter (where result in ('win','lose')) from pm_bet where user_id = auth.uid()))
$$;

-- 걸린 VS 조합 확인(VS 결과 화면에서 "이 대결 예측하기"용)
create or replace function public.pm_vs_open(pk text) returns bigint language sql stable security definer set search_path to 'public' as $$
  select id from pm_market where kind = 'vs' and status = 'open' and closes_at > now() and ref->>'pk' = pk limit 1
$$;
grant execute on function public.pm_vs_open(text) to anon, authenticated;

-- 걸린 조합은 VS 한판에 먼저 나오게(점수 +45)
do $$ declare d text; n text;
begin
  d := pg_get_functiondef('public.vs_pair'::regproc);
  n := replace(d, '+ random() * 25 score',
    '+ random() * 25 + case when exists(select 1 from pm_market pm where pm.kind = ''vs'' and pm.status = ''open'' and pm.ref->>''pk'' = st.pk) then 45 else 0 end score');
  if n = d then raise exception 'vs_pair 패턴을 찾지 못했어요'; end if;
  execute n;
end $$;

-- ===== 운영자용 사건 예측 =====
create or replace function public.pm_ev_create(q text, kw text[], anyw text[], nq text, close_at timestamptz, resolve_at timestamptz, publish boolean default false)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare u uuid := op_check(); id_ bigint;
begin
  if coalesce(length(trim(q)),0) < 8 then raise exception '질문을 적어 주세요'; end if;
  if close_at <= now() or resolve_at < close_at then raise exception '마감과 정산 날짜를 확인해 주세요'; end if;
  insert into pm_market(kind, q, la, lb, ref, status, closes_at, resolve_at)
  values ('ev', trim(q), '예', '아니오',
    jsonb_build_object('key', 'ev:' || md5(trim(q)), 'kw', to_jsonb(coalesce(kw,'{}')), 'any', to_jsonb(coalesce(anyw,'{}')), 'nq', nullif(trim(coalesce(nq,'')),''), 'by', u),
    case when publish then 'open' else 'draft' end, close_at, resolve_at)
  returning id into id_;
  if publish then insert into pm_tick(market_id, pa, n) values (id_, 0.5, 0); end if;
  return id_;
end $$;

create or replace function public.pm_ev_list() returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  perform op_check();
  perform pm_generate();
  return jsonb_build_object(
    'markets', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'q', m.q, 'status', m.status, 'ref', m.ref, 'hit', m.hit, 'win', m.win,
        'closes_at', m.closes_at, 'resolve_at', m.resolve_at, 'n', (select count(*) from pm_bet where market_id = m.id),
        'sa', (select coalesce(sum(stake),0) from pm_bet where market_id = m.id and side = 'a'),
        'sb', (select coalesce(sum(stake),0) from pm_bet where market_id = m.id and side = 'b')) order by m.status = 'settled', m.resolve_at)
      from pm_market m where m.kind = 'ev' and (m.status in ('draft','open') or m.settled_at > now() - interval '14 days')), '[]'::jsonb),
    'ideas', coalesce((select jsonb_agg(jsonb_build_object('t', title, 'u', url, 's', source, 'at', published) order by published desc)
      from (select * from buzz_ideas where published > now() - interval '7 days' and status <> 'ev' order by published desc limit 30) x), '[]'::jsonb));
end $$;

create or replace function public.pm_ev_set(mid bigint, act text) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare m pm_market; b record;
begin
  perform op_check();
  select * into m from pm_market where id = mid and kind = 'ev';
  if m.id is null then raise exception '사건 예측을 찾지 못했어요'; end if;
  if act = 'open' then
    if m.status <> 'draft' then raise exception '초안만 공개할 수 있어요'; end if;
    update pm_market set status = 'open' where id = mid;
    insert into pm_tick(market_id, pa, n) values (mid, 0.5, 0);
  elsif act in ('yes','no') then
    if m.status <> 'open' then raise exception '열린 예측만 확정할 수 있어요'; end if;
    update pm_market set ref = ref || jsonb_build_object('win', case when act = 'yes' then 'a' else 'b' end, 'at', now()) where id = mid;
    perform pm_settle();
  elsif act = 'nohit' then
    update pm_market set hit = null, ref = ref || jsonb_build_object('dismissed', coalesce(ref->'dismissed','[]'::jsonb) || jsonb_build_array(m.hit->>'u')) where id = mid;
  elsif act = 'drop' then
    if m.status = 'settled' then raise exception '이미 정산한 예측이에요'; end if;
    for b in select * from pm_bet where market_id = mid and result is null loop
      update pm_bet set result = 'void', payout = b.stake where market_id = mid and user_id = b.user_id;
      perform award(b.user_id, b.stake, '민심 픽 무효, 돌려받음', 'pmv:' || mid);
    end loop;
    update pm_market set status = 'void', settled_at = now() where id = mid;
  else raise exception '알 수 없는 작업이에요'; end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.pm_ev_create(text,text[],text[],text,timestamptz,timestamptz,boolean) from anon;
revoke execute on function public.pm_ev_list() from anon;
revoke execute on function public.pm_ev_set(bigint,text) from anon;

-- 뉴스 수집(buzz)에서 사건 예측별 검색어를 가져감(서비스 키 전용)
create or replace function public.pm_ev_queries() returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nq', ref->>'nq')), '[]'::jsonb) from pm_market where kind = 'ev' and status in ('draft','open') and ref->>'nq' is not null
$$;
revoke execute on function public.pm_ev_queries() from public, anon, authenticated;

-- 목록: 종류마다 마감이 가까운 순으로 번갈아(사건, VS, 광장, 넷플릭스, 극장, 위키 순), 한 종류가 목록을 독차지하지 않게
create or replace function public.pm_feed(lim int default 12) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); r jsonb;
begin
  perform pm_ensure(); perform pm_generate(); perform pm_settle();
  select coalesce(jsonb_agg(x order by (x->>'ord')::int, (x->>'pri')::int, (x->>'closes_at')), '[]'::jsonb) into r from (
    select jsonb_build_object('id', m.id, 'kind', m.kind, 'q', m.q, 'role_id', m.role_id, 'topic_id', m.topic_id, 'title', t.title, 'cat', t.cat, 'ch', ro.ch, 'closes_at', m.closes_at, 'resolve_at', m.resolve_at,
      'a', jsonb_build_object('id', ca.id, 'name', coalesce(ca.name, m.la), 'img', m.ia), 'b', jsonb_build_object('id', cb.id, 'name', coalesce(cb.name, m.lb), 'img', m.ib),
      'now', m.ref->'now',
      'sa', (select coalesce(sum(stake),0) from pm_bet where market_id = m.id and side = 'a'),
      'sb', (select coalesce(sum(stake),0) from pm_bet where market_id = m.id and side = 'b'),
      'n', (select count(*) from pm_bet where market_id = m.id),
      'hist', (select coalesce(jsonb_agg(jsonb_build_array(extract(epoch from at)::bigint, round(pa,3)) order by at), '[]'::jsonb) from (select * from pm_tick where market_id = m.id order by at desc limit 40) h),
      'ord', m.ord, 'pri', m.pri) x
    from (select pm.*, row_number() over (partition by pm.kind order by pm.closes_at) ord,
            case pm.kind when 'ev' then 1 when 'vs' then 2 when 'role' then 3 when 'nf_kr' then 4 when 'box' then 5 when 'pvb' then 6 else 7 end pri
          from pm_market pm left join topics t0 on t0.id = pm.topic_id
          where pm.status = 'open' and pm.closes_at > now() and (pm.kind <> 'role' or t0.closed_at is null)
            and (u is null or not exists(select 1 from pm_bet where market_id = pm.id and user_id = u))) m
      left join topics t on t.id = m.topic_id left join roles ro on ro.id = m.role_id
      left join candidates ca on ca.id = m.a left join candidates cb on cb.id = m.b
    order by m.ord, m.pri limit least(greatest(lim,1), 40)) z;
  return r;
end $$;
