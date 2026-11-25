-- 087 명성과 안목 포인트 분리
-- 명성(fame): 기여로만 쌓이고 줄지 않음. 회원 등급과 권한(두 표, 판 제안, 디렉터스 픽, 후보 한도)은 명성 기준
-- 안목 포인트(points): 기여와 민심 픽 적중으로 쌓이고, 민심 픽 예측, AI 포스터, 심화 분석에 씀. 현금, 상품 교환 없음
alter table profiles add column if not exists fame int not null default 0;
update profiles p set fame = coalesce((select sum(amount) from point_log l where l.user_id = p.id and l.amount > 0 and l.reason not like '민심 픽%'), 0);

create or replace function public.award(u uuid, amt integer, why text, r text) returns integer language plpgsql security definer set search_path to 'public' as $function$
declare n int;
begin
  insert into point_log(user_id, amount, reason, ref) values (u, amt, why, r) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update profiles set points = points + amt,
      fame = fame + case when amt > 0 and why not like '민심 픽%' and why not like '포인트 사용%' and why not like '%돌려받음' then amt else 0 end
    where id = u;
    return amt;
  end if;
  return 0;
end $function$;

-- 등급, 권한 판단을 보유 포인트에서 명성으로
do $$ declare f text; d text; n text;
begin
  foreach f in array array['cast_vote','director_pick','propose_topic','propose_topic2','propose_topic3'] loop
    d := pg_get_functiondef(('public.'||f)::regproc);
    n := replace(replace(d, 'select points from profiles where id = u', 'select fame from profiles where id = u'), 'case when points >= 1000', 'case when fame >= 1000');
    if n <> d then execute n; end if;
  end loop;
  d := pg_get_functiondef('public.undo_vote'::regproc);
  n := regexp_replace(d, 'update profiles set points = points - (coalesce\(\(select sum\(amount\) from d\),0\))', 'update profiles set points = points - \1, fame = greatest(0, fame - \1)');
  if n <> d then execute n; end if;
  d := pg_get_functiondef('public.user_page'::regproc);
  n := replace(d, '''points'', p.points,', '''points'', p.points, ''fame'', p.fame,');
  if n <> d then execute n; end if;
end $$;

create or replace view public.v_leaders as select id, nickname, points, fame from profiles order by fame desc, points desc limit 20;

-- 토론 글에 쓴 사람의 명성(등급 배지용)
create or replace view public.v_thread as
 SELECT t.id, t.topic_id, NULLIF(t.ckey, '00000000000000000000000000000000'::text) AS ckey, t.parent_id, t.body, t.up, t.down, t.hidden, t.created_at, p.nickname,
    (t.user_id = auth.uid()) AS mine, t.role_id, t.cand_id, c.name AS cand_name, r.ch AS role_ch,
    CASE WHEN ((t.up + t.down) = 0) THEN (0)::numeric
      ELSE (((((t.up)::numeric + 1.9208) / ((t.up + t.down))::numeric) - ((1.96 * sqrt(((((t.up)::numeric * (t.down)::numeric) / ((t.up + t.down))::numeric) + 0.9604))) / ((t.up + t.down))::numeric)) / ((1)::numeric + (3.8416 / ((t.up + t.down))::numeric)))
    END AS rank_score, p.fame
   FROM thread_comments t JOIN profiles p ON p.id = t.user_id LEFT JOIN candidates c ON c.id = t.cand_id LEFT JOIN roles r ON r.id = t.role_id
  WHERE NOT t.deleted;

-- 등급별 하루 후보 추가 한도: 관객 10, 덕후 15, 평론가 20, 디렉터 30, 전설 50
create or replace function public.cand_limit(f int) returns int language sql immutable as $$
  select case when f >= 8000 then 50 when f >= 3000 then 30 when f >= 1000 then 20 when f >= 300 then 15 else 10 end $$;
do $$ declare d text := pg_get_functiondef('public.add_candidate(bigint,text,text,bigint)'::regprocedure); n text;
begin
  n := replace(d, $q$if today >= 10 then raise exception '후보는 하루 10명까지 올릴 수 있어요'; end if;$q$,
    $q$if today >= cand_limit((select fame from profiles where id = u)) then raise exception '후보는 하루 %명까지 올릴 수 있어요. 등급이 오르면 더 올릴 수 있어요', cand_limit((select fame from profiles where id = u)); end if;$q$);
  if n = d then raise exception 'add_candidate pattern'; end if;
  execute n;
end $$;

-- 포인트 쓰는 곳 1: AI 포스터 한 장 50포인트(생성 실패 시 돌려줌)
create or replace function public.poster_gen_claim(u uuid, sid bigint) returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare cfg jsonb; mine int; total int; pts int; gid bigint;
begin
  select v into cfg from app_config where k = 'poster_ai';
  if not coalesce((cfg->>'on')::boolean, false) then return jsonb_build_object('ok', false, 'why', 'off'); end if;
  if not exists(select 1 from sheets where id = sid and user_id = u) then return jsonb_build_object('ok', false, 'why', 'owner'); end if;
  select count(*) into mine from poster_gen_log where user_id = u and created_at > now() - interval '1 day';
  select count(*) into total from poster_gen_log where created_at > now() - interval '1 day';
  if mine >= (cfg->>'per_user_day')::int then return jsonb_build_object('ok', false, 'why', 'user_limit'); end if;
  if total >= (cfg->>'global_day')::int then return jsonb_build_object('ok', false, 'why', 'global_limit'); end if;
  select points into pts from profiles where id = u;
  if coalesce(pts,0) < 50 then return jsonb_build_object('ok', false, 'why', 'points'); end if;
  insert into poster_gen_log(user_id, sheet_id) values (u, sid) returning id into gid;
  perform award(u, -50, '포인트 사용: AI 포스터', 'ai:' || gid);
  return jsonb_build_object('ok', true, 'model', cfg->>'model', 'left', (cfg->>'per_user_day')::int - mine - 1, 'gid', gid);
end $function$;
create or replace function public.poster_gen_refund(u uuid, gid bigint) returns void language sql security definer set search_path to 'public' as $$
  select award(u, 50, '포인트 사용 취소: AI 포스터 돌려받음', 'aiback:' || gid) $$;
revoke execute on function public.poster_gen_refund(uuid,bigint) from public, anon, authenticated;

-- 포인트 쓰는 곳 2: 판별 심화 분석(30포인트로 그 판을 영구 열람)
create table if not exists deep_unlock(user_id uuid references profiles(id) on delete cascade, topic_id text, at timestamptz default now(), primary key(user_id, topic_id));
alter table deep_unlock enable row level security;
create policy deep_unlock_own on deep_unlock for select using (user_id = auth.uid());
create or replace function public.deep_unlock_buy(tid text) returns int language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); pts int;
begin
  if u is null or not exists(select 1 from profiles where id = u) then raise exception '로그인이 필요해요'; end if;
  if exists(select 1 from deep_unlock where user_id = u and topic_id = tid) then return 0; end if;
  if not exists(select 1 from topics where id = tid) then raise exception '없는 판이에요'; end if;
  select points into pts from profiles where id = u;
  if coalesce(pts,0) < 30 then raise exception '안목 포인트가 모자라요. 30포인트가 필요해요'; end if;
  insert into deep_unlock(user_id, topic_id) values (u, tid);
  perform award(u, -30, '포인트 사용: 심화 분석', 'deep:' || tid);
  return 30;
end $$;
-- 심화 분석 내용: 배역별 상위 후보의 날짜별 누적 득표, 연령대와 성별 분포(통계 동의자만, 3명 미만 칸은 숨김), 나와 같은 픽을 한 사람들이 다른 판에서 고른 배우
create or replace function public.topic_deep(tid text) returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); r jsonb;
begin
  if u is null or not exists(select 1 from deep_unlock where user_id = u and topic_id = tid) then return jsonb_build_object('locked', true); end if;
  select jsonb_build_object('roles', coalesce(jsonb_agg(x order by x->>'pos'), '[]'::jsonb)) into r from (
    select jsonb_build_object('rid', ro.id, 'ch', ro.ch, 'pos', ro.pos,
      'flow', (select coalesce(jsonb_agg(jsonb_build_object('c', c.name, 'pts', (
            select coalesce(jsonb_agg(jsonb_build_array(dd, n) order by dd), '[]'::jsonb) from (
              select dd, sum(k) over (order by dd) n from (select (v.created_at at time zone 'Asia/Seoul')::date dd, count(*) k
              from votes v where v.candidate_id = c.id group by 1) q0) q))), '[]'::jsonb)
        from (select c.* from candidates c left join (select candidate_id, count(*) n from votes group by 1) vv on vv.candidate_id = c.id where c.role_id = ro.id order by coalesce(vv.n,0) desc limit 3) c),
      'demo', (select coalesce(jsonb_agg(jsonb_build_object('g', g, 'c', cname, 'n', n)), '[]'::jsonb) from (
          select coalesce(pp.age_band, '?') || '|' || coalesce(pp.gender_self, '?') g, c.name cname, count(*) n
          from votes v join candidates c on c.id = v.candidate_id join profile_private pp on pp.user_id = v.user_id and pp.stats_at is not null
          where v.role_id = ro.id group by 1, 2 having count(*) >= 3) dm),
      'twins', (select coalesce(jsonb_agg(jsonb_build_object('name', nm, 'n', n) order by n desc), '[]'::jsonb) from (
          select c2.name nm, count(distinct v2.user_id) n from votes me join votes o on o.candidate_id = me.candidate_id and o.user_id <> u
            join votes v2 on v2.user_id = o.user_id and v2.role_id <> ro.id join candidates c2 on c2.id = v2.candidate_id
          where me.user_id = u and me.role_id = ro.id group by 1 order by 2 desc limit 5) tw)) x
    from roles ro where ro.topic_id = tid) z;
  return r;
end $$;
grant execute on function public.deep_unlock_buy(text), public.topic_deep(text) to authenticated;
