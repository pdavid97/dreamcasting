-- 049 VS 한판 개편: 상세 기록(vs_log), 비로그인 참여, 후보 VS 레이팅, 케미 대결, 원작 대 새 얼굴

create table if not exists public.vs_log(
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid,
  sid text,
  kind text not null check (kind in ('role','chem','orig')),
  topic_id text,
  role_id bigint,
  win bigint,
  lose bigint,
  bad boolean not null default false,
  ms int,
  pkey text not null,
  meta jsonb not null default '{}'::jsonb
);
create unique index if not exists vs_log_once on public.vs_log(coalesce(user_id::text, sid), pkey);
create index if not exists vs_log_role on public.vs_log(role_id) where kind = 'role';
create index if not exists vs_log_pkey on public.vs_log(pkey);
alter table public.vs_log enable row level security;

-- 기존 1:1 기록을 옮겨 둠
insert into public.vs_log(at, user_id, kind, topic_id, role_id, win, lose, pkey, meta)
select d.created_at, d.user_id, 'role', r.topic_id, d.role_id, d.winner, case when d.winner = d.a then d.b else d.a end,
       'role:' || d.role_id || ':' || d.a || ':' || d.b, jsonb_build_object('w', d.winner::text, 'src', 'duel_votes')
from public.duel_votes d join public.roles r on r.id = d.role_id
on conflict do nothing;

-- 기록 한 건 추가. 로그인 없이도 sid로 남김. 같은 사람, 같은 대결은 한 번만
create or replace function public.vs_log_add(k text, tid text, rid bigint, w bigint, l bigint, bad boolean, ms int, s text, pk text, m jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); n int; wk text := coalesce(m->>'w', w::text);
begin
  if u is null and coalesce(length(s), 0) < 8 then raise exception '세션 정보가 없어요'; end if;
  if k not in ('role','chem','orig') or pk is null or length(pk) > 200 then raise exception '대결 정보가 올바르지 않아요'; end if;
  if k = 'role' and not bad and (select count(*) from candidates where role_id = rid and id in (w, l)) <> 2 then raise exception '후보가 없어요'; end if;
  insert into vs_log(user_id, sid, kind, topic_id, role_id, win, lose, bad, ms, pkey, meta)
  values (u, case when u is null then left(s, 64) end, k, tid, rid, case when bad then null else w end, case when bad then null else l end,
          coalesce(bad, false), least(greatest(ms, 0), 600000), pk, coalesce(m, '{}'::jsonb) || jsonb_build_object('w', case when bad then null else wk end))
  on conflict do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('ins', n > 0,
    'same', (select count(*) from vs_log v where v.pkey = pk and not v.bad and v.meta->>'w' = wk),
    'tot', (select count(*) from vs_log v where v.pkey = pk and not v.bad),
    'bad', (select count(*) from vs_log v where v.pkey = pk and v.bad));
end $$;
revoke all on function public.vs_log_add(text,text,bigint,bigint,bigint,boolean,int,text,text,jsonb) from public;
grant execute on function public.vs_log_add(text,text,bigint,bigint,bigint,boolean,int,text,text,jsonb) to anon, authenticated;

-- 후보별 VS 레이팅(Elo). 매일 다시 계산
create table if not exists public.vs_rating(
  cand_id bigint primary key,
  role_id bigint not null,
  r real not null default 1500,
  n int not null default 0,
  w int not null default 0,
  at timestamptz not null default now()
);
create index if not exists vs_rating_role on public.vs_rating(role_id);
alter table public.vs_rating enable row level security;

create or replace function public.dc_vs_rate() returns int language plpgsql security definer set search_path = public as $$
declare x record; ra real; rb real; ea real; k real := 24; c int := 0;
begin
  create temp table if not exists _el(cid bigint primary key, rid bigint, r real, n int, w int) on commit drop;
  truncate _el;
  for x in select role_id, win, lose from vs_log where kind = 'role' and not bad and win is not null and lose is not null order by at, id loop
    insert into _el values (x.win, x.role_id, 1500, 0, 0) on conflict do nothing;
    insert into _el values (x.lose, x.role_id, 1500, 0, 0) on conflict do nothing;
    select r into ra from _el where cid = x.win; select r into rb from _el where cid = x.lose;
    ea := 1 / (1 + power(10, (rb - ra) / 400));
    update _el set r = r + k * (1 - ea), n = n + 1, w = w + 1 where cid = x.win;
    update _el set r = r - k * (1 - ea), n = n + 1 where cid = x.lose;
    c := c + 1;
  end loop;
  delete from vs_rating where true;
  insert into vs_rating(cand_id, role_id, r, n, w, at) select cid, rid, r, n, w, now() from _el;
  return c;
end $$;
revoke all on function public.dc_vs_rate() from public, anon, authenticated;

-- 작품의 후보별 VS 레이팅과 배역 안 순위
create or replace function public.vs_ratings(tid text) returns table(role_id bigint, cand_id bigint, r real, n int, w int, rk int)
language sql stable security definer set search_path = public as $$
  select v.role_id, v.cand_id, v.r, v.n, v.w, (rank() over (partition by v.role_id order by v.r desc))::int
  from vs_rating v join roles ro on ro.id = v.role_id where ro.topic_id = tid and v.n >= 2 $$;
grant execute on function public.vs_ratings(text) to anon, authenticated;

-- 케미 대결, 원작 대 새 얼굴 문제 하나 고르기
create or replace function public.vs_special(k text, prefer text default null, skip text[] default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare t record; rm record; rf record; a record; o record; nc record;
begin
  if k = 'chem' then
    for t in
      select tp.id, tp.title, tp.cat from topics tp
      where tp.closed_at is null and tp.opens_at <= now()
        and exists(select 1 from roles r where r.topic_id = tp.id and r.slot = 'male_lead' and (select count(*) from candidates c where c.role_id = r.id and c.in_set) >= 2)
        and exists(select 1 from roles r where r.topic_id = tp.id and r.slot = 'female_lead' and (select count(*) from candidates c where c.role_id = r.id and c.in_set) >= 2)
      order by (tp.id = prefer) desc nulls last, random()
    loop
      select r.id, r.ch into rm from roles r where r.topic_id = t.id and r.slot = 'male_lead' order by r.pos limit 1;
      select r.id, r.ch into rf from roles r where r.topic_id = t.id and r.slot = 'female_lead' order by r.pos limit 1;
      for a in
        with m as (select c.id, c.name from candidates c where c.role_id = rm.id and c.in_set order by (select count(*) from votes v where v.candidate_id = c.id) desc, c.id limit 4),
             f as (select c.id, c.name from candidates c where c.role_id = rf.id and c.in_set order by (select count(*) from votes v where v.candidate_id = c.id) desc, c.id limit 4),
             combos as (select m.id mi, m.name mn, f.id fi, f.name fn from m cross join f)
        select x.mi am, x.mn amn, x.fi af, x.fn afn, y.mi bm, y.mn bmn, y.fi bf, y.fn bfn
        from combos x join combos y on x.mi < y.mi and x.fi <> y.fi
        where not ('chem:' || t.id || ':' || x.mi || '-' || x.fi || ':' || y.mi || '-' || y.fi) = any(skip)
        order by random() limit 1
      loop
        return jsonb_build_object('kind', 'chem', 'pk', 'chem:' || t.id || ':' || a.am || '-' || a.af || ':' || a.bm || '-' || a.bf, 'tid', t.id, 'title', t.title, 'cat', t.cat,
          'rm', jsonb_build_object('id', rm.id, 'ch', rm.ch), 'rf', jsonb_build_object('id', rf.id, 'ch', rf.ch),
          'a', jsonb_build_object('m', jsonb_build_object('id', a.am, 'name', a.amn), 'f', jsonb_build_object('id', a.af, 'name', a.afn)),
          'b', jsonb_build_object('m', jsonb_build_object('id', a.bm, 'name', a.bmn), 'f', jsonb_build_object('id', a.bf, 'name', a.bfn)));
      end loop;
    end loop;
    return null;
  elsif k = 'orig' then
    for o in
      select r.id, r.ch, r.orig, tp.id tid, tp.title, tp.cat from roles r join topics tp on tp.id = r.topic_id
      where tp.closed_at is null and tp.opens_at <= now() and r.orig is not null and r.stage in ('dream','rumor')
        and coalesce(r.kind, 'actor') = 'actor' and r.slot is not null
      order by (tp.id = prefer) desc nulls last, random()
    loop
      select c.id, c.name into nc from candidates c
      where c.role_id = o.id and c.in_set and c.name <> o.orig and not ('orig:' || o.id || ':' || c.id) = any(skip)
      order by (select count(*) from votes v where v.candidate_id = c.id) desc, random() limit 1;
      if found then
        return jsonb_build_object('kind', 'orig', 'pk', 'orig:' || o.id || ':' || nc.id, 'tid', o.tid, 'title', o.title, 'cat', o.cat, 'rid', o.id, 'ch', o.ch, 'orig', o.orig,
          'c', jsonb_build_object('id', nc.id, 'name', nc.name));
      end if;
    end loop;
    return null;
  end if;
  return null;
end $$;
grant execute on function public.vs_special(text,text,text[]) to anon, authenticated;

select public.dc_vs_rate();
select cron.schedule('dc-vs-rate', '20 15 * * *', $$select public.dc_vs_rate()$$);
