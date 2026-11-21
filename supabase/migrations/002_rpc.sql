-- 쓰기 전용 함수(RPC). 모두 security definer, 로그인 사용자만 호출 가능.
-- 등급 기준(포인트): 관객 0, 캐스팅 덕후 300, 캐스팅 평론가 1000, 캐스팅 디렉터 3000, 전설의 안목 8000
-- 투표 규칙: 배역마다 1인 1회(변경 불가). 작품이 마감되면(closes_at 경과 또는 운영자 마감) 투표, 후보 등록, VS 종료

create function public.me() returns uuid language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception '로그인이 필요해요'; end if;
  if not exists(select 1 from profiles where id = u) then raise exception '닉네임을 먼저 정해 주세요'; end if;
  return u;
end $$;

create function public.topic_open(tid text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select closed_at is null and now() < closes_at from topics where id = tid), false) $$;

create function public.role_open(rid bigint) returns boolean language sql stable security definer set search_path = public as $$
  select topic_open((select topic_id from roles where id = rid)) $$;

create function public.award(u uuid, amt int, why text, r text) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into point_log(user_id, amount, reason, ref) values (u, amt, why, r) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update profiles set points = points + amt where id = u; return amt; end if;
  return 0;
end $$;

create function public.post_feed(k text, b text) returns void language sql security definer set search_path = public as $$
  insert into feed(kind, body) values (k, left(b, 200)) $$;

create function public.snap_tally(rid bigint) returns void language sql security definer set search_path = public as $$
  insert into tally_daily(role_id, day, candidate_id, votes)
  select c.role_id, current_date, c.id, coalesce(sum(v.weight),0) from candidates c left join votes v on v.candidate_id = c.id
  where c.role_id = rid group by c.id
  on conflict (role_id, day, candidate_id) do update set votes = excluded.votes $$;

create function public.snap_sync(rid bigint) returns void language sql security definer set search_path = public as $$
  insert into sync_daily(role_id, day, avg, n)
  select rid, current_date, coalesce(avg(score),0), count(*) from sync_votes where role_id = rid
  on conflict (role_id, day) do update set avg = excluded.avg, n = excluded.n $$;

-- 시트에 직접 적힌(후보 목록에 없는) 배우 이름 집계
create function public.topic_sheet_names(tid text) returns table(role_id bigint, name text, cnt int)
language sql stable security definer set search_path = public as $$
  select (e.key)::bigint, e.value->>'n', count(*)::int
  from sheets s, jsonb_each(s.picks) e
  where s.topic_id = tid and e.value ? 'n'
  group by 1, 2 order by 3 desc $$;

create function public.set_nickname(nick text) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); n text := btrim(nick);
begin
  if u is null then raise exception '로그인이 필요해요'; end if;
  if char_length(n) < 2 or char_length(n) > 16 then raise exception '닉네임은 2~16자로 정해 주세요'; end if;
  if exists(select 1 from profiles where nickname = n and id <> u) then raise exception '이미 쓰는 닉네임이에요'; end if;
  insert into profiles(id, nickname) values (u, n) on conflict (id) do update set nickname = n;
end $$;

-- 배역 투표: 1인 1회, 변경 불가. 평론가(1000P) 이상은 2표로 집계
create function public.cast_vote(rid bigint, cid bigint) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := me(); w int; st text;
begin
  select stage into st from roles where id = rid;
  if st is null or st not in ('dream','rumor') then raise exception '지금은 투표할 수 없는 배역이에요'; end if;
  if not role_open(rid) then raise exception '투표가 마감됐어요'; end if;
  if not exists(select 1 from candidates where id = cid and role_id = rid) then raise exception '후보가 없어요'; end if;
  if exists(select 1 from votes where user_id = u and role_id = rid) then raise exception '이 배역에는 이미 투표했어요. 투표는 한 번만 할 수 있어요'; end if;
  select case when points >= 1000 then 2 else 1 end into w from profiles where id = u;
  insert into votes(user_id, role_id, candidate_id, weight) values (u, rid, cid, w);
  perform award(u, 5, '배역 투표', 'vote:' || rid);
  perform snap_tally(rid);
end $$;

-- 후보 올리기: 아직 이 배역에 투표하지 않았다면 올린 후보에 첫 표가 자동으로 들어감
create function public.add_candidate(rid bigint, nm text) returns bigint language plpgsql security definer set search_path = public as $$
declare u uuid := me(); n text := btrim(nm); cid bigint; st text; today int;
begin
  select stage into st from roles where id = rid;
  if st is null or st not in ('dream','rumor') then raise exception '지금은 후보를 올릴 수 없는 배역이에요'; end if;
  if not role_open(rid) then raise exception '투표가 마감돼 후보를 올릴 수 없어요'; end if;
  if char_length(n) < 1 or char_length(n) > 20 then raise exception '배우 이름은 1~20자로 적어 주세요'; end if;
  if exists(select 1 from candidates where role_id = rid and name = n) then raise exception '이미 후보에 있어요'; end if;
  select count(*) into today from candidates where proposed_by = u and created_at > now() - interval '1 day';
  if today >= 10 then raise exception '후보는 하루 10명까지 올릴 수 있어요'; end if;
  insert into candidates(role_id, name, proposed_by) values (rid, n, u) returning id into cid;
  if not exists(select 1 from votes where user_id = u and role_id = rid) then
    insert into votes(user_id, role_id, candidate_id, weight) values (u, rid, cid, 1);
    perform award(u, 5, '배역 투표', 'vote:' || rid);
  end if;
  perform award(u, 20, '후보 제안', 'cand:' || cid);
  perform snap_tally(rid);
  return cid;
end $$;

-- VS 한판: 같은 대결은 1인 1회. 결과로 이 대결의 누적 선택 수를 돌려줌
create function public.duel_vote(rid bigint, x bigint, y bigint, win bigint) returns table(a bigint, a_votes int, b bigint, b_votes int, already boolean) language plpgsql security definer set search_path = public as $$
declare u uuid := me(); lo bigint := least(x, y); hi bigint := greatest(x, y); n int;
begin
  if x = y or win not in (x, y) then raise exception '대결 정보가 올바르지 않아요'; end if;
  if not role_open(rid) then raise exception '투표가 마감됐어요'; end if;
  if (select count(*) from candidates where role_id = rid and id in (x, y)) <> 2 then raise exception '후보가 없어요'; end if;
  insert into duel_votes(user_id, role_id, a, b, winner) values (u, rid, lo, hi, win) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then perform award(u, 2, 'VS 한판', 'duel:' || rid || ':' || lo || ':' || hi); end if;
  return query select lo, (select count(*)::int from duel_votes d where d.role_id = rid and d.a = lo and d.b = hi and d.winner = lo),
                      hi, (select count(*)::int from duel_votes d where d.role_id = rid and d.a = lo and d.b = hi and d.winner = hi), n = 0;
end $$;

-- 싱크로율 투표: 확정, 공개 배역. 1인 1회, 변경 불가
create function public.sync_vote(rid bigint, sc int) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := me(); st text;
begin
  select stage into st from roles where id = rid;
  if st is null or st not in ('cast','airing') then raise exception '캐스팅이 확정된 배역만 싱크로율 투표를 할 수 있어요'; end if;
  if not role_open(rid) then raise exception '투표가 마감됐어요'; end if;
  if sc < 1 or sc > 10 then raise exception '1~10점으로 투표해 주세요'; end if;
  if exists(select 1 from sync_votes where user_id = u and role_id = rid) then raise exception '이 배역에는 이미 싱크로율 투표를 했어요'; end if;
  insert into sync_votes(user_id, role_id, score) values (u, rid, sc);
  perform award(u, 5, '싱크로율 투표', 'sync:' || rid);
  perform snap_sync(rid);
end $$;

-- 토론 글: 하루 30개까지, 포인트는 하루 5개까지. 마감 후에도 토론은 가능
create function public.post_comment(rid bigint, pk bigint, txt text) returns bigint language plpgsql security definer set search_path = public as $$
declare u uuid := me(); t text := btrim(txt); id_ bigint; today int;
begin
  if char_length(t) < 1 or char_length(t) > 280 then raise exception '의견은 1~280자로 적어 주세요'; end if;
  if not exists(select 1 from roles where id = rid) then raise exception '배역이 없어요'; end if;
  if pk is not null and not exists(select 1 from candidates where id = pk and role_id = rid) then pk := null; end if;
  select count(*) into today from comments where user_id = u and created_at > now() - interval '1 day';
  if today >= 30 then raise exception '토론 글은 하루 30개까지 쓸 수 있어요'; end if;
  insert into comments(role_id, user_id, pick, body) values (rid, u, pk, t) returning id into id_;
  if today < 5 then perform award(u, 10, '토론 참여', 'cmt:' || id_); end if;
  return id_;
end $$;

create function public.like_comment(cid bigint) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := me(); author uuid; n int;
begin
  select user_id into author from comments where id = cid;
  if author is null then raise exception '글이 없어요'; end if;
  if author = u then raise exception '내 글에는 공감할 수 없어요'; end if;
  insert into comment_likes(user_id, comment_id) values (u, cid) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update comments set likes = likes + 1 where id = cid; perform award(author, 3, '받은 공감', 'clike:' || cid || ':' || u); end if;
end $$;

-- 캐스팅 시트: 배역마다 후보를 고르거나({"c":후보id}) 마음에 드는 후보가 없으면 배우 이름을 직접 적음({"n":"이름"})
-- 투표와 별개라 투표하지 않아도, 마감 후에도 만들 수 있고 언제든 고칠 수 있음
create function public.post_sheet(tid text, p jsonb) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := me(); r record; e jsonb; clean jsonb := '{}'; nm text; first boolean;
begin
  if not exists(select 1 from topics where id = tid) then raise exception '작품이 없어요'; end if;
  for r in select id from roles where topic_id = tid order by pos loop
    e := p -> (r.id::text);
    if e is null then raise exception '모든 배역을 채워 주세요'; end if;
    if e ? 'c' then
      if not exists(select 1 from candidates where id = (e->>'c')::bigint and role_id = r.id) then raise exception '후보 정보가 올바르지 않아요'; end if;
      clean := clean || jsonb_build_object(r.id::text, jsonb_build_object('c', (e->>'c')::bigint));
    elsif e ? 'n' then
      nm := btrim(e->>'n');
      if char_length(nm) < 1 or char_length(nm) > 20 then raise exception '배우 이름은 1~20자로 적어 주세요'; end if;
      clean := clean || jsonb_build_object(r.id::text, jsonb_build_object('n', nm));
    else raise exception '모든 배역을 채워 주세요'; end if;
  end loop;
  if clean = '{}' then raise exception '배역이 없어요'; end if;
  first := not exists(select 1 from sheets where topic_id = tid and user_id = u);
  insert into sheets(topic_id, user_id, picks) values (tid, u, clean) on conflict (topic_id, user_id) do update set picks = clean, updated_at = now();
  if first and award(u, 30, '캐스팅 시트 게시', 'sheet:' || tid) > 0 then
    perform post_feed('me', (select nickname from profiles where id = u) || ' 님이 ' || (select title from topics where id = tid) || ' 캐스팅 시트를 게시했어요');
  end if;
end $$;

create function public.like_sheet(sid bigint) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := me(); author uuid; n int;
begin
  select user_id into author from sheets where id = sid;
  if author is null then raise exception '시트가 없어요'; end if;
  if author = u then raise exception '내 시트에는 공감할 수 없어요'; end if;
  insert into sheet_likes(user_id, sheet_id) values (u, sid) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update sheets set likes = likes + 1 where id = sid; perform award(author, 3, '받은 공감', 'slike:' || sid || ':' || u); end if;
end $$;

-- 디렉터스 픽(캐스팅 디렉터 3000P 이상). 같은 후보를 다시 고르면 해제
create function public.director_pick(rid bigint, cid bigint) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := me();
begin
  if (select points from profiles where id = u) < 3000 then raise exception '디렉터스 픽은 캐스팅 디렉터(3,000P)부터 쓸 수 있어요'; end if;
  if not exists(select 1 from candidates where id = cid and role_id = rid) then raise exception '후보가 없어요'; end if;
  if exists(select 1 from director_picks where user_id = u and role_id = rid and candidate_id = cid) then
    delete from director_picks where user_id = u and role_id = rid;
  else
    insert into director_picks(user_id, role_id, candidate_id) values (u, rid, cid) on conflict (user_id, role_id) do update set candidate_id = cid;
    perform post_feed('hot', '캐스팅 디렉터 ' || (select nickname from profiles where id = u) || ' 님이 ' || (select t.title || ' ' || r.ch from roles r join topics t on t.id = r.topic_id where r.id = rid) || ' 역 디렉터스 픽으로 ' || (select name from candidates where id = cid) || '를 지정했어요');
  end if;
end $$;

-- 새 주제 제안(캐스팅 덕후 300P 이상). 투표 기간 30일
create function public.propose_topic(ttl text, ct text, inf text, r1 text, o1 text, r2 text, o2 text) returns text language plpgsql security definer set search_path = public as $$
declare u uuid := me(); tid text; t text := btrim(ttl);
begin
  if (select points from profiles where id = u) < 300 then raise exception '새 주제는 캐스팅 덕후(300P)부터 열 수 있어요'; end if;
  if ct not in ('wn','k2','us2k','k2us') then raise exception '분류를 골라 주세요'; end if;
  if char_length(t) < 1 or char_length(t) > 30 or char_length(btrim(coalesce(r1,''))) < 1 then raise exception '작품명과 배역 1은 꼭 적어 주세요'; end if;
  if (select count(*) from topics where created_by = u and created_at > now() - interval '1 day') >= 3 then raise exception '주제는 하루 3개까지 열 수 있어요'; end if;
  tid := 'u' || substr(md5(random()::text), 1, 10);
  insert into topics(id, cat, title, info, user_made, created_by, sort) values (tid, ct, t, left(coalesce(nullif(btrim(inf),''),'유저 제안'), 40), true, u, 1000);
  insert into roles(topic_id, pos, ch, orig) values (tid, 0, left(btrim(r1),20), nullif(left(btrim(coalesce(o1,'')),20),''));
  if char_length(btrim(coalesce(r2,''))) > 0 then insert into roles(topic_id, pos, ch, orig) values (tid, 1, left(btrim(r2),20), nullif(left(btrim(coalesce(o2,'')),20),'')); end if;
  perform award(u, 50, '주제 발굴', 'topic:' || tid);
  perform post_feed('hot', '새 주제: ' || t || ' (' || (select nickname from profiles where id = u) || ' 님 제안). 첫 후보를 올려 주세요');
  return tid;
end $$;

-- ===== 운영자 전용 =====
create function public.admin_check() returns uuid language plpgsql stable security definer set search_path = public as $$
declare u uuid := me();
begin
  if not (select is_admin from profiles where id = u) then raise exception '운영자만 할 수 있어요'; end if;
  return u;
end $$;

-- 투표 마감(결과 확정)
create function public.admin_close(tid text) returns void language plpgsql security definer set search_path = public as $$
declare msg text;
begin
  perform admin_check();
  update topics set closed_at = now() where id = tid and closed_at is null;
  select string_agg(x.ch || ' ' || x.name || ' ' || x.pct || '%', ', ') into msg from (
    select distinct on (r.id) r.pos, r.ch, c.name, round(100.0 * t.v / nullif(sum(t.v) over (partition by r.id), 0)) as pct
    from roles r join lateral (select c2.id, coalesce(sum(v.weight),0) v from candidates c2 left join votes v on v.candidate_id = c2.id where c2.role_id = r.id group by c2.id) t on true
    join candidates c on c.id = t.id where r.topic_id = tid and r.stage in ('dream','rumor') order by r.id, t.v desc) x;
  perform post_feed('hot', (select title from topics where id = tid) || ' 투표 마감! 최종 결과: ' || coalesce(msg, '투표 없음'));
end $$;

-- 투표 다시 열기(기간 연장)
create function public.admin_reopen(tid text, days int) returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_check();
  update topics set closed_at = null, closes_at = now() + make_interval(days => greatest(1, least(days, 365))) where id = tid;
end $$;

-- 실사화 발표: 물망 단계로 바꾸고 실제 캐스팅 예측 투표를 60일 열어 둠(이미 투표한 사람의 표는 그대로 유지)
create function public.admin_announce(tid text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_check();
  update roles set stage = 'rumor' where topic_id = tid and stage = 'dream';
  update topics set closed_at = null, closes_at = greatest(closes_at, now() + interval '60 days') where id = tid;
  perform post_feed('hot', '실사화 공식 발표! ' || (select title from topics where id = tid) || ', 이제 실제 캐스팅 발표를 기다립니다');
end $$;

-- 캐스팅 확정: 제안자 500P, 그 배우에게 투표한 사람 200P, 민심이 낮았던 의외의 캐스팅일수록 최대 3배
create function public.admin_confirm(rid bigint, cid bigint) returns void language plpgsql security definer set search_path = public as $$
declare tot numeric; mine numeric; sh numeric; mult numeric; prop uuid; nm text; ttl text; ch_ text; hits int;
begin
  perform admin_check();
  if (select stage from roles where id = rid) <> 'rumor' then raise exception '실사화 발표 단계의 배역만 확정할 수 있어요'; end if;
  select name, proposed_by into nm, prop from candidates where id = cid and role_id = rid;
  if nm is null then raise exception '후보가 없어요'; end if;
  select coalesce(sum(weight),0) into tot from votes where role_id = rid;
  select coalesce(sum(weight),0) into mine from votes where role_id = rid and candidate_id = cid;
  sh := case when tot > 0 then mine / tot else 0 end;
  mult := least(3, greatest(1, 0.5 / greatest(sh, 0.01)));
  if prop is not null then perform award(prop, round(500 * mult)::int, '캐스팅 적중 (첫 제안자)', 'hit-p:' || rid); end if;
  perform award(v.user_id, round(200 * mult)::int, '캐스팅 적중 (투표)', 'hit-v:' || rid) from votes v where v.role_id = rid and v.candidate_id = cid;
  select count(*) into hits from votes where role_id = rid and candidate_id = cid;
  update roles set stage = 'cast', actor = nm, final_share = sh, credit = prop,
    events = events || jsonb_build_array(jsonb_build_object('d', to_char(current_date,'YYYY-MM-DD'), 't', '캐스팅 공식 발표'))
    where id = rid;
  select t.title, r.ch into ttl, ch_ from roles r join topics t on t.id = r.topic_id where r.id = rid;
  perform post_feed('hot', '캐스팅 확정: ' || ttl || ' ' || ch_ || ' 역 ' || nm || '. 광장 민심 ' || round(sh*100) || '%, 적중자 ' || hits || '명');
end $$;

create function public.admin_air(tid text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_check();
  update roles set stage = 'airing', events = events || jsonb_build_array(jsonb_build_object('d', to_char(current_date,'YYYY-MM-DD'), 't', '작품 공개 시작'))
    where topic_id = tid and stage = 'cast';
  perform post_feed('hot', (select title from topics where id = tid) || ' 공개 시작! 싱크로율이 어떻게 바뀔까요');
end $$;

-- 권한: 내부 도우미는 직접 호출 금지, 읽기용 집계는 누구나, 쓰기용은 로그인 사용자만
revoke execute on function public.award(uuid,int,text,text), public.post_feed(text,text), public.snap_tally(bigint), public.snap_sync(bigint), public.me(), public.admin_check() from public, anon, authenticated;
grant execute on function public.topic_tally(text), public.topic_sync(text), public.topic_sheet_names(text), public.topic_open(text), public.role_open(bigint) to anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['set_nickname(text)','cast_vote(bigint,bigint)','add_candidate(bigint,text)','duel_vote(bigint,bigint,bigint,bigint)','sync_vote(bigint,int)','post_comment(bigint,bigint,text)','like_comment(bigint)','post_sheet(text,jsonb)','like_sheet(bigint)','director_pick(bigint,bigint)','propose_topic(text,text,text,text,text,text,text)','admin_close(text)','admin_reopen(text,int)','admin_announce(text)','admin_confirm(bigint,bigint)','admin_air(text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
