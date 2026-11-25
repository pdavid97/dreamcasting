-- 081 트리비아: 작품과 배우마다 모아 둔 데이터에서 사실만 뽑아 링크와 함께 돌려줌. 배우 나이는 넣지 않음
-- 링크 l: {"a":배우이름} 배우 페이지, {"w":[media,tmdb_id]} 작품 상세, {"tp":판id} 투표 판
create or replace function public.work_trivia(med text, tid bigint) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare w work; k text := med||':'||tid; r jsonb := '[]'::jsonb; x record; kn text;
begin
  select * into w from work where media=med and tmdb_id=tid limit 1;
  kn := case when med='movie' then '영화' else '드라마' end;
  -- 광장 판
  for x in select id, title, cat from topics where work->>'tmdb_id' = tid::text and coalesce(work->>'kind','')=kn and coalesce(opens_at,now())<=now() limit 2 loop
    r := r || jsonb_build_object('i','vote','t','이 작품으로 열린 가상 캐스팅 판이 있어요. 지금 투표하러 가 볼까요','l',jsonb_build_array(jsonb_build_object('tp',x.id,'n',x.title)));
  end loop;
  -- 넷플릭스 순위
  for x in select * from work_buzz b where b.key=k loop
    if x.kr_best is not null then r := r || jsonb_build_object('i','chart','t',format('넷플릭스 한국 Top 10에 %s주 올랐고 최고 %s위까지 갔어요', x.kr_weeks, x.kr_best)); end if;
    if x.gl_best is not null then r := r || jsonb_build_object('i','globe','t',format('넷플릭스 전세계 Top 10 최고 %s위 기록이 있어요', x.gl_best)); end if;
  end loop;
  if w.id is null then return r; end if;
  -- 극장 관객
  for x in select max(b.audi_acc) a from kobis_box b join kobis_movie m on m.movie_cd=b.movie_cd where m.nm=w.title and abs(coalesce(extract(year from m.open_dt)::int,m.prdt_year,w.year)-coalesce(w.year,0))<=1 loop
    if x.a >= 10000 then r := r || jsonb_build_object('i','ticket','t',format('최근 박스오피스 집계 기준 누적 관객 %s명', to_char(x.a,'FM999,999,999'))); end if;
  end loop;
  -- 역대 같은 배역
  for x in select lr.ko, count(*) n, jsonb_agg(jsonb_build_object('a',lc2.name,'n',lc2.name) order by lc2.year) filter (where lc2.work is distinct from w.title) l
           from legacy_cast lc join legacy_role lr on lr.id=lc.role_id join legacy_cast lc2 on lc2.role_id=lc.role_id
           where lc.work=w.title group by lr.ko limit 2 loop
    r := r || jsonb_build_object('i','mask','t',format('%s 역은 지금까지 %s명의 배우가 맡았어요', x.ko, x.n),'l',coalesce((select jsonb_agg(e) from (select e from jsonb_array_elements(x.l) e limit 2) s),'[]'::jsonb));
  end loop;
  -- 주연 둘의 다른 공동 출연
  for x in with lead as (select c.person_id, p.name from credit c join people p on p.id=c.person_id where c.work_id=w.id and coalesce(c.ord,99)<=2 order by c.ord limit 2)
           select (select name from lead limit 1) a, (select name from lead offset 1 limit 1) b, ow.title, ow.media, ow.tmdb_id, ow.year
           from credit c1 join credit c2 on c2.work_id=c1.work_id join work ow on ow.id=c1.work_id
           where c1.person_id=(select person_id from lead limit 1) and c2.person_id=(select person_id from lead offset 1 limit 1) and c1.work_id<>w.id
           order by ow.year desc nulls last limit 1 loop
    r := r || jsonb_build_object('i','pair','t',format('주연 %s, %s 두 사람은 《%s》에서도 함께 나왔어요', x.a, x.b, x.title),'l',jsonb_build_array(jsonb_build_object('w',jsonb_build_array(x.media,x.tmdb_id),'n',x.title),jsonb_build_object('a',x.a,'n',x.a),jsonb_build_object('a',x.b,'n',x.b)));
  end loop;
  -- 출연 배우가 광장 후보
  for x in select p.name, t.id tid, t.title, ro.ch from credit c join people p on p.id=c.person_id join candidates ca on ca.person_id=p.id and ca.in_set
           join roles ro on ro.id=ca.role_id join topics t on t.id=ro.topic_id
           where c.work_id=w.id and coalesce(c.ord,99)<=8 and t.closed_at is null and coalesce(t.opens_at,now())<=now() order by c.ord limit 2 loop
    r := r || jsonb_build_object('i','star','t',format('이 작품의 %s, 지금 《%s》 %s 역 후보예요', x.name, x.title, x.ch),'l',jsonb_build_array(jsonb_build_object('tp',x.tid,'n',x.title),jsonb_build_object('a',x.name,'n',x.name)));
  end loop;
  return r;
end $$;

create or replace function public.person_trivia(pid bigint) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare p people; r jsonb := '[]'::jsonb; x record;
begin
  select * into p from people where id=pid; if p.id is null then return r; end if;
  -- 가장 자주 함께한 배우
  for x in select * from costars(pid, 1) loop
    r := r || jsonb_build_object('i','pair','t',format('가장 자주 함께한 배우는 %s, 주요 배역으로 %s편 함께했어요', x.name, x.n),
      'l',jsonb_build_array(jsonb_build_object('a',x.name,'n',x.name)) || coalesce((select jsonb_agg(jsonb_build_object('w',jsonb_build_array(e->>'m',(e->>'id')::bigint),'n',e->>'t')) from (select e from jsonb_array_elements(x.works) e limit 2) s),'[]'::jsonb));
  end loop;
  -- 첫 주연작은 출연 기록이 불완전해 틀릴 수 있어 넣지 않음
  -- 장르
  for x in select g, count(*) n from credit c join work wk on wk.id=c.work_id, unnest(wk.genres) g where c.person_id=pid and g not in ('TV 영화','드라마') group by g order by 2 desc limit 1 loop
    if x.n >= 3 then r := r || jsonb_build_object('i','genre','t',format('드라마를 빼면 가장 많이 출연한 장르는 %s, %s편이에요', x.g, x.n)); end if;
  end loop;
  -- 넷플릭스
  for x in select wk.title, wk.media, wk.tmdb_id, b.kr_best, b.kr_weeks from credit c join work wk on wk.id=c.work_id join work_buzz b on b.key=wk.media||':'||wk.tmdb_id
           where c.person_id=pid and b.kr_best is not null order by b.kr_best, b.kr_weeks desc limit 1 loop
    r := r || jsonb_build_object('i','chart','t',format('출연작 《%s》는 넷플릭스 한국 Top 10 최고 %s위, %s주 동안 머물렀어요', x.title, x.kr_best, x.kr_weeks),'l',jsonb_build_array(jsonb_build_object('w',jsonb_build_array(x.media,x.tmdb_id),'n',x.title)));
  end loop;
  -- 역대 같은 배역
  for x in select lr.ko, lc.work, (select count(*) from legacy_cast z where z.role_id=lc.role_id) n,
             (select jsonb_agg(jsonb_build_object('a',z.name,'n',z.name)) from (select name from legacy_cast z where z.role_id=lc.role_id and z.tmdb_person<>p.tmdb_id order by year desc limit 2) z) l
           from legacy_cast lc join legacy_role lr on lr.id=lc.role_id where lc.tmdb_person=p.tmdb_id limit 1 loop
    r := r || jsonb_build_object('i','mask','t',format('《%s》에서 %s 역을 맡았어요. 이 배역을 거쳐 간 배우는 %s명', x.work, x.ko, x.n),'l',coalesce(x.l,'[]'::jsonb));
  end loop;
  -- 광장 후보
  for x in select count(distinct ca.role_id) n, (array_agg(t.id order by t.closes_at desc))[1] tid, (array_agg(t.title order by t.closes_at desc))[1] title
           from candidates ca join roles ro on ro.id=ca.role_id join topics t on t.id=ro.topic_id where ca.person_id=pid and ca.in_set and coalesce(t.opens_at,now())<=now() loop
    if x.n > 0 then r := r || jsonb_build_object('i','star','t',format('드림캐스팅 광장에서 %s개 배역 후보에 올랐어요', x.n),'l',jsonb_build_array(jsonb_build_object('tp',x.tid,'n',x.title))); end if;
  end loop;
  return r;
end $$;
grant execute on function public.work_trivia(text,bigint) to anon, authenticated;
grant execute on function public.person_trivia(bigint) to anon, authenticated;

-- 081c: work_trivia의 역대 같은 배역 항목은 작품 제목 대신 이 작품 주연 3명의 배역명이 legacy_role 별칭과 맞는지로 찾음(DB에서 함수 본문 치환)
