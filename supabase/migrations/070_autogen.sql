-- 070 판 자동 생성 대기열과 화제작 카드
-- topics.auto: 자동 생성 초안 정보 {src, key, signal, status: pending|approved|rejected, at}. 초안은 opens_at을 먼 미래로 두어 공개 목록에 나오지 않음
alter table topics add column if not exists auto jsonb;
create index if not exists topics_auto_status on topics((auto->>'status')) where auto is not null;

-- 운영자 확인: profiles.is_admin 또는 운영자 이메일(인증 완료)
create or replace function public.op_check() returns uuid language plpgsql stable security definer set search_path = public, auth as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception '로그인이 필요해요'; end if;
  if not (coalesce((select is_admin from profiles where id = u), false)
     or exists(select 1 from auth.users where id = u and email = 'pdavid97@gmail.com' and email_confirmed_at is not null)) then
    raise exception '운영자만 할 수 있어요';
  end if;
  return u;
end $$;
revoke execute on function public.op_check() from anon;

-- 대기열 목록
create or replace function public.auto_queue() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform op_check();
  return coalesce((select jsonb_agg(x order by x->>'at' desc) from (
    select jsonb_build_object('id', t.id, 'title', t.title, 'info', t.info, 'cat', t.cat, 'poster', t.work->>'poster', 'auto', t.auto, 'at', t.auto->>'at',
      'roles', (select jsonb_agg(jsonb_build_object('rid', r.id, 'ch', r.ch, 'orig', r.orig, 'slot', r.slot,
        'cands', (select jsonb_agg(c.name order by c.id) from candidates c where c.role_id = r.id and coalesce(c.in_set, true))) order by r.pos)
        from roles r where r.topic_id = t.id)) x
    from topics t where t.auto->>'status' = 'pending') s), '[]'::jsonb);
end $$;
revoke execute on function public.auto_queue() from anon;

-- 승인: 지금 공개하고 days일 뒤 마감
create or replace function public.auto_approve(tid text, days int default 7) returns void language plpgsql security definer set search_path = public as $$
begin
  perform op_check();
  update topics set opens_at = now(), closes_at = now() + make_interval(days => greatest(1, least(days, 30))),
    auto = auto || jsonb_build_object('status', 'approved', 'decided_at', now())
  where id = tid and auto->>'status' = 'pending';
  if not found then raise exception '대기 중인 판이 아니에요'; end if;
end $$;
revoke execute on function public.auto_approve(text, int) from anon;

-- 반려: 공개하지 않고 닫아 둠(다시 생성되지 않음)
create or replace function public.auto_reject(tid text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform op_check();
  update topics set closed_at = now(), auto = auto || jsonb_build_object('status', 'rejected', 'decided_at', now())
  where id = tid and auto->>'status' = 'pending';
  if not found then raise exception '대기 중인 판이 아니에요'; end if;
end $$;
revoke execute on function public.auto_reject(text) from anon;

-- 화제작 카드(B1): 넷플릭스 한국 순위, 전세계 순위, Trakt 급상승, 스트리밍 방영을 합친 점수 상위 작품과 열려 있는 판
create or replace function public.buzz_cards(n int default 12) returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select b.*, w.title, w.year, w.poster,
      (coalesce(11 - b.kr_best, 0) * 3 + coalesce(b.kr_weeks, 0) + coalesce(11 - b.gl_best, 0) * 1.5
        + greatest(0, 31 - coalesce(b.trakt_trend, 31)) * 0.3 + least(coalesce(b.stream_eps, 0), 5) * 0.4) score
    from work_buzz b join ip_work w on w.key = b.key
    where coalesce(b.kr_best, 99) <= 10 or coalesce(b.gl_best, 99) <= 5 or coalesce(b.trakt_trend, 99) <= 20
    order by score desc limit greatest(1, least(n, 30)))
  select coalesce(jsonb_agg(jsonb_build_object('key', s.key, 'title', s.title, 'year', s.year, 'poster', s.poster,
      'kr', s.kr_best, 'krw', s.kr_weeks, 'gl', s.gl_best, 'tt', s.trakt_trend, 'ch', s.stream_channels,
      'tid', (select t.id from topics t where t.closed_at is null and t.opens_at <= now()
               and (t.auto->>'key' = s.key or (t.work->>'tmdb_id') = split_part(s.key, ':', 2)) limit 1)) order by s.score desc), '[]'::jsonb)
  from s
$$;
