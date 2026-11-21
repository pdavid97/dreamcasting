-- 014 크로스 미디어(원 소스 멀티 유즈)
-- ip2live: 웹툰, 웹소설, 소설, 만화, 게임 원작을 드라마나 영화로 실사화한다면 (배우 캐스팅)
-- live2x : 드라마, 영화를 게임, 애니메이션, 웹툰으로 만든다면 (장르, 개발사/스튜디오, 플랫폼 같은 선택지 + 성우 같은 인물)
-- roles.kind: actor(배우, 성우 등 인물) / option(장르, 개발사 같은 선택지). option 배역은 배우 사진, 나이, 케미 분석을 하지 않음
-- 수요 측정: topic_wants(보고 싶어요), media_matrix()로 원작 매체 x 목표 매체별 주제 수, 표, 보고 싶어요 집계

alter table public.topics drop constraint topics_cat_check;
alter table public.topics add constraint topics_cat_check check (cat in ('wn','k2','us2k','k2us','ip2live','live2x'));
alter table public.topics add column if not exists src_medium text check (src_medium in ('웹소설','웹툰','소설','만화','게임','드라마','영화','애니메이션'));
alter table public.topics add column if not exists dst_medium text check (dst_medium in ('드라마','영화','게임','애니메이션','웹툰'));
alter table public.roles add column if not exists kind text not null default 'actor' check (kind in ('actor','option'));
update public.topics set src_medium = '웹소설', dst_medium = '드라마' where cat = 'wn' and src_medium is null;
update public.topics set src_medium = '드라마', dst_medium = '드라마' where cat in ('k2','k2us') and src_medium is null;

create table public.topic_wants(
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id text not null references public.topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, topic_id)
);
alter table public.topic_wants enable row level security;
create policy "own read" on public.topic_wants for select using (auth.uid() = user_id);
alter table public.topics add column if not exists wants int not null default 0;

create function public.want_topic(tid text) returns boolean language plpgsql security definer set search_path = public as $$
declare u uuid := me(); on_ boolean;
begin
  if not exists(select 1 from topics where id = tid) then raise exception '작품이 없어요'; end if;
  if exists(select 1 from topic_wants where user_id = u and topic_id = tid) then
    delete from topic_wants where user_id = u and topic_id = tid; update topics set wants = greatest(wants - 1, 0) where id = tid; on_ := false;
  else
    insert into topic_wants(user_id, topic_id) values (u, tid); update topics set wants = wants + 1 where id = tid; on_ := true;
    perform award(u, 1, '보고 싶어요', 'want:' || tid);
    insert into events(kind, user_id, topic_id) values ('want', u, tid);
  end if;
  return on_;
end $$;

create function public.media_matrix() returns table(src text, dst text, topics bigint, votes bigint, wants bigint, sheets bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(t.src_medium,'기타'), coalesce(t.dst_medium,'기타'), count(distinct t.id),
    coalesce(sum((select count(*) from votes v join roles r on r.id = v.role_id where r.topic_id = t.id)),0)::bigint,
    coalesce(sum(t.wants),0)::bigint,
    coalesce(sum((select count(*) from sheets s where s.topic_id = t.id)),0)::bigint
  from topics t group by 1,2 order by 5 desc, 4 desc $$;

-- 제안: 매체와 배역 종류까지 받음
create function public.propose_topic3(ttl text, ct text, inf text, rs jsonb, src text, dst text) returns text
language plpgsql security definer set search_path = public as $$
declare u uuid := me(); tid text; t text := btrim(ttl); r jsonb; i int := 0; ch text; k text;
begin
  if (select points from profiles where id = u) < 300 then raise exception '새 주제는 캐스팅 덕후(300P)부터 열 수 있어요'; end if;
  if ct not in ('wn','k2','us2k','k2us','ip2live','live2x') then raise exception '분류를 골라 주세요'; end if;
  if jsonb_typeof(rs) <> 'array' or jsonb_array_length(rs) < 1 or jsonb_array_length(rs) > 6 then raise exception '배역은 1~6개로 적어 주세요'; end if;
  if char_length(t) < 1 or char_length(t) > 30 then raise exception '작품명을 적어 주세요'; end if;
  if (select count(*) from topics where created_by = u and created_at > now() - interval '1 day') >= 3 then raise exception '주제는 하루 3개까지 열 수 있어요'; end if;
  tid := 'u' || substr(md5(random()::text), 1, 10);
  insert into topics(id, cat, title, info, user_made, created_by, sort, src_medium, dst_medium)
    values (tid, ct, t, left(coalesce(nullif(btrim(inf),''),'유저 제안'), 40), true, u, 1000, nullif(src,''), nullif(dst,''));
  for r in select * from jsonb_array_elements(rs) loop
    ch := left(btrim(coalesce(r->>'ch','')), 20);
    k := case when r->>'kind' = 'option' then 'option' else 'actor' end;
    if char_length(ch) > 0 and not exists(select 1 from roles where topic_id = tid and roles.ch = ch) then
      insert into roles(topic_id, pos, ch, orig, age_hint, kind) values (tid, i, ch, nullif(left(btrim(coalesce(r->>'orig','')),20),''), nullif(left(btrim(coalesce(r->>'age','')),20),''), k);
      i := i + 1;
    end if;
  end loop;
  if i = 0 then raise exception '배역 이름을 하나 이상 적어 주세요'; end if;
  perform award(u, 50, '주제 발굴', 'topic:' || tid);
  perform post_feed('hot', '새 주제: ' || t || coalesce(' (' || src || ' > ' || dst || ')', '') || ', ' || (select nickname from profiles where id = u) || ' 님 제안. 첫 후보를 올려 주세요');
  return tid;
end $$;

-- 취향 분류 목록 확장
create or replace function public.set_tastes(t jsonb, b text) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := me(); clean jsonb := '{}'; k text; arr text[];
begin
  foreach k in array array['cats','genres','makers'] loop
    select coalesce(array_agg(distinct left(btrim(x), 20)) filter (where char_length(btrim(x)) > 0), '{}') into arr
      from (select jsonb_array_elements_text(case when jsonb_typeof(t->k) = 'array' then t->k else '[]'::jsonb end) x limit 10) z;
    if k = 'cats' then arr := array(select unnest(arr) intersect select unnest(array['wn','k2','us2k','k2us','ip2live','live2x'])); end if;
    clean := clean || jsonb_build_object(k, to_jsonb(arr));
  end loop;
  update profiles set tastes = clean, bio = nullif(left(btrim(coalesce(b,'')), 100), '') where id = u;
end $$;

grant execute on function public.media_matrix() to anon, authenticated;
grant execute on function public.want_topic(text), public.propose_topic3(text,text,text,jsonb,text,text) to authenticated;
revoke execute on function public.want_topic(text), public.propose_topic3(text,text,text,jsonb,text,text) from anon, public;
