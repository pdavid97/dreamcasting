-- 007 주제 제안 시 배역 여러 개(최대 6)와 원작 배우를 한 번에 받음
-- 화면에서 작품명을 넣으면 TMDB 원작 출연진을 불러와 배역과 원작 배우를 기본값으로 채움
create function public.propose_topic2(ttl text, ct text, inf text, rs jsonb) returns text
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
      insert into roles(topic_id, pos, ch, orig) values (tid, i, ch, nullif(left(btrim(coalesce(r->>'orig','')),20),''));
      i := i + 1;
    end if;
  end loop;
  if i = 0 then raise exception '배역 이름을 하나 이상 적어 주세요'; end if;
  perform award(u, 50, '주제 발굴', 'topic:' || tid);
  perform post_feed('hot', '새 주제: ' || t || ' (' || (select nickname from profiles where id = u) || ' 님 제안). 첫 후보를 올려 주세요');
  return tid;
end $$;
revoke execute on function public.propose_topic2(text,text,text,jsonb) from public, anon;
grant execute on function public.propose_topic2(text,text,text,jsonb) to authenticated;
