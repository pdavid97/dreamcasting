-- 008 시간여행 캐스팅: 시트에서 배우를 "특정 연도의 그 배우"로 고를 수 있게 함
-- picks 예: {"12":{"c":34,"y":2008},"13":{"n":"고현정","y":1995}}  y가 없으면 지금의 배우
-- roles.age_hint: 배역 나이대(예: "20대 후반"). 화면에서 배우 나이와 비교해 보여줌
alter table public.roles add column if not exists age_hint text check (age_hint is null or char_length(age_hint) <= 20);

create or replace function public.post_sheet(tid text, p jsonb, why text)
returns void language plpgsql security definer set search_path = public as $$
declare u uuid := me(); r record; e jsonb; clean jsonb := '{}'; one jsonb; nm text; first boolean; rs text := btrim(coalesce(why,'')); y int;
begin
  if not exists(select 1 from topics where id = tid) then raise exception '작품이 없어요'; end if;
  if char_length(rs) > 300 then raise exception '캐스팅 이유는 300자까지 쓸 수 있어요'; end if;
  for r in select id from roles where topic_id = tid and stage in ('dream','rumor') order by pos loop
    e := p -> (r.id::text);
    if e is null then raise exception '모든 배역을 채워 주세요'; end if;
    if e ? 'c' then
      if not exists(select 1 from candidates where id = (e->>'c')::bigint and role_id = r.id) then raise exception '후보 정보가 올바르지 않아요'; end if;
      one := jsonb_build_object('c', (e->>'c')::bigint);
    elsif e ? 'n' then
      nm := btrim(e->>'n');
      if char_length(nm) < 1 or char_length(nm) > 20 then raise exception '배우 이름은 1~20자로 적어 주세요'; end if;
      one := jsonb_build_object('n', nm);
    else raise exception '모든 배역을 채워 주세요'; end if;
    if e ? 'y' and jsonb_typeof(e->'y') = 'number' then
      y := (e->>'y')::int;
      if y < 1950 or y > extract(year from now())::int then raise exception '연도는 1950년부터 올해까지 고를 수 있어요'; end if;
      if y < extract(year from now())::int then one := one || jsonb_build_object('y', y); end if;
    end if;
    clean := clean || jsonb_build_object(r.id::text, one);
  end loop;
  if clean = '{}' then raise exception '시트를 만들 배역이 없어요'; end if;
  first := not exists(select 1 from sheets where topic_id = tid and user_id = u);
  insert into sheets(topic_id, user_id, picks, reason) values (tid, u, clean, rs)
    on conflict (topic_id, user_id) do update set picks = clean, reason = rs, updated_at = now();
  if first and award(u, 30, '캐스팅 시트 게시', 'sheet:' || tid) > 0 then
    perform post_feed('me', (select nickname from profiles where id = u) || ' 님이 ' || (select title from topics where id = tid) || ' 캐스팅 시트를 게시했어요');
  end if;
end $$;

-- propose_topic2: 배역 나이대(age)도 받음
create or replace function public.propose_topic2(ttl text, ct text, inf text, rs jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare u uuid := me(); tid text; t text := btrim(ttl); r jsonb; i int := 0; ch text;
begin
  if (select points from profiles where id = u) < 300 then raise exception '새 주제는 캐스팅 덕후(300P)부터 열 수 있어요'; end if;
  if ct not in ('wn','k2','us2k','k2us') then raise exception '분류를 골라 주세요'; end if;
  if jsonb_typeof(rs) <> 'array' or jsonb_array_length(rs) < 1 or jsonb_array_length(rs) > 6 then raise exception '배역은 1~6개로 적어 주세요'; end if;
  if char_length(t) < 1 or char_length(t) > 30 then raise exception '작품명을 적어 주세요'; end if;
  if (select count(*) from topics where created_by = u and created_at > now() - interval '1 day') >= 3 then raise exception '주제는 하루 3개까지 열 수 있어요'; end if;
  tid := 'u' || substr(md5(random()::text), 1, 10);
  insert into topics(id, cat, title, info, user_made, created_by, sort) values (tid, ct, t, left(coalesce(nullif(btrim(inf),''),'유저 제안'), 40), true, u, 1000);
  for r in select * from jsonb_array_elements(rs) loop
    ch := left(btrim(coalesce(r->>'ch','')), 20);
    if char_length(ch) > 0 and not exists(select 1 from roles where topic_id = tid and roles.ch = ch) then
      insert into roles(topic_id, pos, ch, orig, age_hint) values (tid, i, ch, nullif(left(btrim(coalesce(r->>'orig','')),20),''), nullif(left(btrim(coalesce(r->>'age','')),20),''));
      i := i + 1;
    end if;
  end loop;
  if i = 0 then raise exception '배역 이름을 하나 이상 적어 주세요'; end if;
  perform award(u, 50, '주제 발굴', 'topic:' || tid);
  perform post_feed('hot', '새 주제: ' || t || ' (' || (select nickname from profiles where id = u) || ' 님 제안). 첫 후보를 올려 주세요');
  return tid;
end $$;
