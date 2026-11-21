-- 011 감상하러 가기 링크 + 트래픽 측정 (나중에 광고 상품으로 팔기 위한 기반)
-- 지금: 공식 사이트, 유튜브 예고편, 국내 스트리밍 시청처(TMDB, JustWatch 제공)를 무료로 노출
-- 측정: 모든 바깥 링크는 Edge Function go를 거쳐 클릭을 기록하고 UTM을 붙여 보냄. 노출은 하루 단위로 집계
-- 나중: partners(스트리밍, 제작사), placements(작품별 유료 노출 자리)로 스폰서 링크를 걸고, 기간과 단가를 관리. 화면에는 "광고" 표시

create table public.partners(
  id text primary key check (id ~ '^[a-z0-9_-]{2,30}$'),
  name text not null,
  kind text not null check (kind in ('streaming','youtube','studio','official','info')),
  domains text[] not null default '{}',
  utm boolean not null default true,
  active boolean not null default true,
  contact text,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;
create policy "public read" on public.partners for select using (active);

insert into public.partners(id, name, kind, domains, utm) values
  ('youtube','YouTube','youtube','{youtube.com,www.youtube.com,youtu.be,m.youtube.com}',true),
  ('netflix','넷플릭스','streaming','{www.netflix.com,netflix.com}',true),
  ('tving','티빙','streaming','{www.tving.com,tving.com}',true),
  ('wavve','웨이브','streaming','{www.wavve.com,wavve.com}',true),
  ('coupangplay','쿠팡플레이','streaming','{www.coupangplay.com,coupangplay.com}',true),
  ('disney','디즈니+','streaming','{www.disneyplus.com,disneyplus.com}',true),
  ('watcha','왓챠','streaming','{watcha.com,www.watcha.com}',true),
  ('appletv','Apple TV','streaming','{tv.apple.com}',true),
  ('prime','프라임 비디오','streaming','{www.primevideo.com,primevideo.com}',true),
  ('justwatch','JustWatch','info','{www.justwatch.com,justwatch.com}',false),
  ('tmdb','TMDB','info','{www.themoviedb.org,themoviedb.org}',false),
  ('imdb','IMDb','info','{www.imdb.com,imdb.com}',false),
  ('official','공식 사이트','official','{}',true);

-- 작품별 노출 자리: 무료 직링크(sponsored=false) 또는 유료 스폰서(sponsored=true). 운영자만 관리
create table public.placements(
  id bigint generated always as identity primary key,
  topic_id text references public.topics(id) on delete cascade,   -- null이면 전체 작품 공통 자리
  partner_id text not null references public.partners(id),
  label text not null check (char_length(label) between 1 and 30),
  url text not null check (url ~ '^https://[^\s<>"]+$'),
  sponsored boolean not null default false,
  slot text not null default 'watch' check (slot in ('watch','hero','side')),
  priority int not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  price_note text,          -- 계약 메모(예: CPC 단가). 공개 안 함
  created_at timestamptz not null default now()
);
create index on public.placements(topic_id);
alter table public.placements enable row level security;
create function public.active_placements(tid text) returns table(id bigint, partner_id text, label text, url text, sponsored boolean, slot text, priority int)
language sql stable security definer set search_path = public as $$
  select id, partner_id, label, url, sponsored, slot, priority from placements
  where (topic_id = tid or topic_id is null) and starts_at <= now() and (ends_at is null or ends_at > now())
  order by sponsored desc, priority desc, id $$;
grant execute on function public.active_placements(text) to anon, authenticated;

-- 클릭 로그(Edge Function go가 서비스 키로 기록)
create table public.out_clicks(
  id bigint generated always as identity primary key,
  topic_id text,
  partner_id text,
  placement_id bigint,
  kind text,
  url text not null,
  sid text,                 -- 브라우저별 무작위 id(로그인 정보 아님), 중복 클릭 걸러내기용
  page text,
  sponsored boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.out_clicks(created_at);
create index on public.out_clicks(topic_id, partner_id);
alter table public.out_clicks enable row level security;

-- 노출 집계: 링크 영역이 화면에 보였을 때 하루 단위로 +1
create table public.impressions_daily(
  day date not null default current_date,
  topic_id text not null,
  partner_id text not null,
  sponsored boolean not null default false,
  n int not null default 0,
  primary key(day, topic_id, partner_id, sponsored)
);
alter table public.impressions_daily enable row level security;

create function public.log_impressions(tid text, ps text[], sp boolean[] default null) returns void
language plpgsql security definer set search_path = public as $$
declare i int;
begin
  if tid is null or ps is null or cardinality(ps) > 12 or not exists(select 1 from topics where id = tid) then return; end if;
  for i in 1..cardinality(ps) loop
    if exists(select 1 from partners where id = ps[i]) then
      insert into impressions_daily(topic_id, partner_id, sponsored, n) values (tid, ps[i], coalesce(sp[i], false), 1)
      on conflict (day, topic_id, partner_id, sponsored) do update set n = impressions_daily.n + 1;
    end if;
  end loop;
end $$;
grant execute on function public.log_impressions(text,text[],boolean[]) to anon, authenticated;

-- 운영자 리포트: 기간별 작품 x 파트너 노출, 클릭, 순클릭(같은 브라우저 하루 1회), CTR
create function public.admin_traffic(days int default 30) returns table(topic_id text, title text, partner_id text, sponsored boolean, impressions bigint, clicks bigint, uniq bigint, ctr numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not admin_check() then raise exception '운영자만 볼 수 있어요'; end if;
  return query
  with im as (select i.topic_id, i.partner_id, i.sponsored, sum(i.n)::bigint n from impressions_daily i where i.day > current_date - days group by 1,2,3),
  ck as (select c.topic_id, c.partner_id, c.sponsored, count(*)::bigint n, count(distinct (c.sid, c.created_at::date))::bigint u from out_clicks c where c.created_at > now() - make_interval(days => days) group by 1,2,3)
  select coalesce(im.topic_id, ck.topic_id), t.title, coalesce(im.partner_id, ck.partner_id), coalesce(im.sponsored, ck.sponsored),
    coalesce(im.n,0), coalesce(ck.n,0), coalesce(ck.u,0), case when coalesce(im.n,0) > 0 then round(coalesce(ck.u,0)::numeric / im.n * 100, 2) else null end
  from im full join ck on ck.topic_id = im.topic_id and ck.partner_id = im.partner_id and ck.sponsored = im.sponsored
  left join topics t on t.id = coalesce(im.topic_id, ck.topic_id)
  order by 6 desc, 5 desc;
end $$;
grant execute on function public.admin_traffic(int) to authenticated;
revoke execute on function public.admin_traffic(int) from anon, public;

-- 운영자: 노출 자리 추가/종료
create function public.admin_placement(tid text, pid text, lbl text, link text, spons boolean, days int) returns bigint
language plpgsql security definer set search_path = public as $$
declare nid bigint;
begin
  if not admin_check() then raise exception '운영자만 할 수 있어요'; end if;
  insert into placements(topic_id, partner_id, label, url, sponsored, ends_at) values (tid, pid, lbl, link, spons, case when days > 0 then now() + make_interval(days => days) end) returning id into nid;
  return nid;
end $$;
create function public.admin_placement_end(plid bigint) returns void language plpgsql security definer set search_path = public as $$
begin
  if not admin_check() then raise exception '운영자만 할 수 있어요'; end if;
  update placements set ends_at = now() where id = plid;
end $$;
grant execute on function public.admin_placement(text,text,text,text,boolean,int), public.admin_placement_end(bigint) to authenticated;
revoke execute on function public.admin_placement(text,text,text,text,boolean,int), public.admin_placement_end(bigint) from anon, public;

-- 작품 정보 다시 받기(예고편 영상 필드 추가)
update public.topics set work_at = null;
