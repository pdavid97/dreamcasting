-- 데이터 축적 구조: 이벤트 로그 + 배우 표준 인물 + 통계 함수 + 예측시장 골격
-- 1) events: 모든 사용자 행동을 트리거로 한 줄씩 남김(추가만, 수정 없음). 분석과 향후 예측시장 정산 검증의 원본
create table public.events(
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null,
  user_id uuid,
  topic_id text,
  role_id bigint,
  candidate_id bigint,
  person_id bigint,
  value numeric,
  meta jsonb not null default '{}'
);
create index on public.events(kind, at);
create index on public.events(topic_id, at);
create index on public.events(user_id, at);
alter table public.events enable row level security;  -- 정책 없음: 공개 읽기 불가. 운영자 함수와 서버만 읽음

-- 2) people: 배우를 이름이 아닌 TMDB id로 묶는 표준 인물 목록(표기 차이, 동명이인 정리용)
create table public.people(
  id bigint generated always as identity primary key,
  tmdb_id bigint unique,
  name text not null,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.people enable row level security;
create policy "public read" on public.people for select using (true);
alter table public.candidates add column person_id bigint references public.people(id) on delete set null;
alter table public.roles add column person_id bigint references public.people(id) on delete set null;
create index on public.candidates(person_id);

-- 이름으로 인물 찾기/만들기(TMDB 검색 캐시 'pid:이름'을 이용)
create function public.resolve_person(nm text) returns bigint language plpgsql security definer set search_path = public as $$
declare tid bigint; pid bigint; n text := btrim(nm);
begin
  select id into pid from people where name = n or n = any(aliases) limit 1;
  if pid is not null then return pid; end if;
  select nullif(url,'')::bigint into tid from tmdb_cache where k = 'pid:' || n;
  if tid is null then return null; end if;
  insert into people(tmdb_id, name) values (tid, n) on conflict (tmdb_id) do update set aliases = case when people.name = n or n = any(people.aliases) then people.aliases else people.aliases || n end
    returning id into pid;
  return pid;
end $$;

-- 3) 이벤트 기록 트리거
create function public.log_event() returns trigger language plpgsql security definer set search_path = public as $$
declare t text; r bigint; k text := tg_argv[0];
begin
  if tg_table_name = 'votes' then
    select topic_id into t from roles where id = new.role_id;
    insert into events(kind,user_id,topic_id,role_id,candidate_id,person_id,value) values ('vote',new.user_id,t,new.role_id,new.candidate_id,(select person_id from candidates where id=new.candidate_id),new.weight);
  elsif tg_table_name = 'candidates' then
    select topic_id into t from roles where id = new.role_id;
    insert into events(kind,user_id,topic_id,role_id,candidate_id,person_id,meta) values ('candidate_add',new.proposed_by,t,new.role_id,new.id,new.person_id,jsonb_build_object('name',new.name));
  elsif tg_table_name = 'duel_votes' then
    select topic_id into t from roles where id = new.role_id;
    insert into events(kind,user_id,topic_id,role_id,candidate_id,meta) values ('duel',new.user_id,t,new.role_id,new.winner,jsonb_build_object('a',new.a,'b',new.b));
  elsif tg_table_name = 'sync_votes' then
    select topic_id into t from roles where id = new.role_id;
    insert into events(kind,user_id,topic_id,role_id,value) values ('sync_vote',new.user_id,t,new.role_id,new.score);
  elsif tg_table_name = 'sheets' then
    insert into events(kind,user_id,topic_id,meta) values (case when tg_op='INSERT' then 'sheet' else 'sheet_edit' end,new.user_id,new.topic_id,jsonb_build_object('picks',new.picks,'reason',new.reason));
  elsif tg_table_name = 'comments' then
    select topic_id into t from roles where id = new.role_id;
    insert into events(kind,user_id,topic_id,role_id,candidate_id,meta) values ('comment',new.user_id,t,new.role_id,new.pick,jsonb_build_object('comment_id',new.id,'len',char_length(new.body)));
  elsif tg_table_name = 'comment_likes' then
    insert into events(kind,user_id,meta) values ('comment_like',new.user_id,jsonb_build_object('comment_id',new.comment_id));
  elsif tg_table_name = 'sheet_likes' then
    insert into events(kind,user_id,topic_id,meta) values ('sheet_like',new.user_id,(select topic_id from sheets where id=new.sheet_id),jsonb_build_object('sheet_id',new.sheet_id));
  elsif tg_table_name = 'director_picks' then
    select topic_id into t from roles where id = new.role_id;
    insert into events(kind,user_id,topic_id,role_id,candidate_id) values ('director_pick',new.user_id,t,new.role_id,new.candidate_id);
  elsif tg_table_name = 'chem_notes' then
    insert into events(kind,user_id,meta) values ('chem_note',new.user_id,jsonb_build_object('a',new.a,'b',new.b,'url',new.url));
  elsif tg_table_name = 'topics' then
    if tg_op = 'INSERT' then insert into events(kind,user_id,topic_id,meta) values ('topic_create',new.created_by,new.id,jsonb_build_object('cat',new.cat,'user_made',new.user_made));
    elsif new.closed_at is distinct from old.closed_at or new.closes_at is distinct from old.closes_at then
      insert into events(kind,topic_id,meta) values (case when new.closed_at is not null then 'topic_close' else 'topic_reopen' end,new.id,jsonb_build_object('closes_at',new.closes_at,'closed_at',new.closed_at));
    end if;
  elsif tg_table_name = 'roles' then
    if new.stage is distinct from old.stage then
      insert into events(kind,topic_id,role_id,meta) values ('stage_change',new.topic_id,new.id,jsonb_build_object('from',old.stage,'to',new.stage,'actor',new.actor,'final_share',new.final_share));
    end if;
  end if;
  return new;
end $$;
create trigger ev_votes after insert on public.votes for each row execute function public.log_event();
create trigger ev_cands after insert on public.candidates for each row execute function public.log_event();
create trigger ev_duels after insert on public.duel_votes for each row execute function public.log_event();
create trigger ev_sync after insert on public.sync_votes for each row execute function public.log_event();
create trigger ev_sheets after insert or update on public.sheets for each row execute function public.log_event();
create trigger ev_comments after insert on public.comments for each row execute function public.log_event();
create trigger ev_clikes after insert on public.comment_likes for each row execute function public.log_event();
create trigger ev_slikes after insert on public.sheet_likes for each row execute function public.log_event();
create trigger ev_dpicks after insert or update on public.director_picks for each row execute function public.log_event();
create trigger ev_chem after insert on public.chem_notes for each row execute function public.log_event();
create trigger ev_topics after insert or update on public.topics for each row execute function public.log_event();
create trigger ev_roles after update on public.roles for each row execute function public.log_event();

-- 새 후보는 TMDB 캐시가 있으면 자동으로 인물과 연결
create function public.link_candidate_person() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.person_id is null then new.person_id := resolve_person(new.name); end if;
  return new;
end $$;
create trigger link_cand before insert on public.candidates for each row execute function public.link_candidate_person();

-- 기존 후보, 확정 배우를 인물과 연결(캐시에 있는 만큼)
update public.candidates c set person_id = public.resolve_person(c.name) where person_id is null;
update public.roles r set person_id = public.resolve_person(r.actor) where actor is not null and person_id is null;

-- 4) 통계 함수(집계만 공개)
-- 광장 전체 현황
create function public.stats_overview() returns table(members int, votes int, sheets int, comments int, duels int, chem_notes int, topics int)
language sql stable security definer set search_path = public as $$
  select (select count(*) from profiles)::int, (select count(*) from votes)::int, (select count(*) from sheets)::int,
         (select count(*) from comments)::int, (select count(*) from duel_votes)::int, (select count(*) from chem_notes)::int, (select count(*) from topics)::int $$;

-- 배우 인기 보드: 여러 작품에 걸친 득표, 후보 등록 배역 수, 1위 배역 수, 시트 언급 수
create function public.stats_actor_board(lim int default 20) returns table(name text, person_id bigint, roles int, topics int, votes int, leads int, sheet_mentions int)
language sql stable security definer set search_path = public as $$
  with c as (
    select coalesce(p.name, c.name) as nm, c.person_id, c.id, c.role_id, r.topic_id, coalesce(sum(v.weight),0) as v
    from candidates c join roles r on r.id = c.role_id left join people p on p.id = c.person_id left join votes v on v.candidate_id = c.id
    group by c.id, p.name, r.topic_id),
  lead as (select distinct on (role_id) role_id, id from c where v > 0 order by role_id, v desc),
  sm as (select coalesce(e.value->>'n', cc.name) as nm, count(*) as n from sheets s, jsonb_each(s.picks) e left join candidates cc on cc.id = (e.value->>'c')::bigint group by 1)
  select c.nm, max(c.person_id), count(distinct c.role_id)::int, count(distinct c.topic_id)::int, sum(c.v)::int,
         count(lead.id)::int, coalesce(max(sm.n),0)::int
  from c left join lead on lead.id = c.id left join sm on sm.nm = c.nm
  group by c.nm order by sum(c.v) desc, count(distinct c.role_id) desc limit greatest(1, least(lim, 100)) $$;

-- 함께 뽑힌 조합: 한 작품의 시트들에서 두 배우가 같이 들어간 횟수(광장이 원하는 케미)
create function public.stats_copicks(tid text) returns table(a text, b text, sheets int)
language sql stable security definer set search_path = public as $$
  with x as (
    select s.id, coalesce(e.value->>'n', c.name) as nm from sheets s, jsonb_each(s.picks) e left join candidates c on c.id = (e.value->>'c')::bigint
    where s.topic_id = tid)
  select least(x1.nm, x2.nm), greatest(x1.nm, x2.nm), count(*)::int
  from x x1 join x x2 on x1.id = x2.id and x1.nm < x2.nm
  group by 1, 2 order by 3 desc limit 10 $$;

-- 운영자 전용: 일별 참여 퍼널(방문은 아직 미수집, 행동 기준)
create function public.admin_stats_daily(days int default 30) returns table(day date, kind text, users int, actions int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_check();
  return query select (e.at at time zone 'Asia/Seoul')::date, e.kind, count(distinct e.user_id)::int, count(*)::int
    from events e where e.at > now() - make_interval(days => days) group by 1, 2 order by 1 desc, 4 desc;
end $$;

-- 5) 예측시장 골격(아직 거래 기능 없음). 통화는 충전과 환전이 없는 안목 포인트만 전제
-- 시장 유형 예: cast_who(누가 캐스팅될까, 다지선), sync_threshold(공개 후 싱크로율이 기준 이상일까, 예/아니오), announce(기한 내 실사화 발표, 예/아니오)
create table public.markets(
  id bigint generated always as identity primary key,
  topic_id text references public.topics(id) on delete cascade,
  role_id bigint references public.roles(id) on delete cascade,
  kind text not null check (kind in ('cast_who','sync_threshold','announce','custom')),
  question text not null,
  outcome_type text not null default 'multi' check (outcome_type in ('multi','binary')),
  status text not null default 'draft' check (status in ('draft','open','closed','resolved','void')),
  resolution_rule text not null default '',
  opens_at timestamptz, closes_at timestamptz, resolved_at timestamptz,
  resolved_outcome bigint,
  liquidity_b numeric not null default 100,
  created_at timestamptz not null default now()
);
create table public.market_outcomes(
  id bigint generated always as identity primary key,
  market_id bigint not null references public.markets(id) on delete cascade,
  label text not null,
  candidate_id bigint references public.candidates(id) on delete set null,
  person_id bigint references public.people(id) on delete set null,
  shares_outstanding numeric not null default 0,
  payout numeric
);
create table public.positions(
  user_id uuid not null references public.profiles(id) on delete cascade,
  outcome_id bigint not null references public.market_outcomes(id) on delete cascade,
  shares numeric not null default 0,
  cost numeric not null default 0,
  primary key(user_id, outcome_id)
);
create table public.trades(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  outcome_id bigint not null references public.market_outcomes(id) on delete cascade,
  shares numeric not null,
  cost numeric not null,
  price_after numeric,
  created_at timestamptz not null default now()
);
alter table public.markets enable row level security;
alter table public.market_outcomes enable row level security;
alter table public.positions enable row level security;
alter table public.trades enable row level security;
create policy "public read" on public.markets for select using (true);
create policy "public read" on public.market_outcomes for select using (true);
create policy "own read" on public.positions for select using (user_id = (select auth.uid()));
create policy "own read" on public.trades for select using (user_id = (select auth.uid()));

-- 실사화 발표 단계 배역은 바로 "누가 캐스팅될까" 시장 후보가 됨(시장을 켤 때 쓸 원본)
create function public.market_candidates() returns table(role_id bigint, topic_id text, title text, ch text, candidate_id bigint, name text, person_id bigint, votes int)
language sql stable security definer set search_path = public as $$
  select r.id, r.topic_id, t.title, r.ch, c.id, c.name, c.person_id, coalesce(sum(v.weight),0)::int
  from roles r join topics t on t.id = r.topic_id join candidates c on c.role_id = r.id left join votes v on v.candidate_id = c.id
  where r.stage = 'rumor' group by r.id, t.title, c.id order by r.id, 8 desc $$;

revoke execute on function public.log_event(), public.link_candidate_person(), public.resolve_person(text) from public, anon, authenticated;
grant execute on function public.stats_overview(), public.stats_actor_board(int), public.stats_copicks(text) to anon, authenticated;
revoke execute on function public.admin_stats_daily(int), public.market_candidates() from public, anon;
grant execute on function public.admin_stats_daily(int), public.market_candidates() to authenticated;
