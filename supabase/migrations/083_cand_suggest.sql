-- 083 후보 추가는 배우 DB에 있는 사람만. 철자가 틀리면 비슷한 이름을 제안(한글은 자모로 풀어 편집 거리 비교)
create extension if not exists fuzzystrmatch with schema extensions;

create or replace function public.ko_jamo(s text) returns text language plpgsql immutable parallel safe as $$
declare cho text[] := array['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
 jung text[] := array['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
 jong text[] := array['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
 o text := ''; c int; i int; ch text;
begin
  if s is null then return null; end if;
  for i in 1..char_length(s) loop
    ch := substr(s, i, 1); c := ascii(ch);
    if c between 44032 and 55203 then c := c - 44032; o := o || cho[c/588+1] || jung[(c%588)/28+1] || jong[c%28+1];
    elsif ch !~ '\s' then o := o || lower(ch); end if;
  end loop;
  return o;
end $$;
alter table people add column if not exists name_j text generated always as (public.ko_jamo(name)) stored;

-- 비슷한 이름 찾기: 정확히 같은 이름, 별칭 > 앞부분 일치 > 자모 편집 거리(한글) 또는 영문 편집 거리 순
create or replace function public.people_suggest(q text, lim int default 6)
returns table(id bigint, name text, name_en text, tmdb_id bigint, hint text, exact boolean, dist int)
language sql stable security definer set search_path to 'public', 'extensions' as $$
  with k as (select btrim(q) q, public.ko_jamo(btrim(q)) j, lower(btrim(q)) l),
  c as (
    select p.*, (p.name = k.q or k.q = any(p.aliases) or lower(coalesce(p.name_en,'')) = k.l) ex,
      least(extensions.levenshtein(left(p.name_j,60), left(k.j,60)),
            case when p.name_en is not null then extensions.levenshtein(left(lower(p.name_en),60), left(k.l,60)) else 99 end) d,
      (p.name like k.q||'%' or lower(coalesce(p.name_en,'')) like k.l||'%') pre
    from people p, k
    where char_length(k.q) >= 1 and not coalesce(p.blocked,false) and (p.acted or 'actor' = any(p.kinds) or p.tmdb_id is not null))
  select c.id, c.name, c.name_en, c.tmdb_id,
    (select w.title from credit x join work w on w.id = x.work_id where x.person_id = c.id and w.year is not null order by w.year desc limit 1),
    c.ex, c.d
  from c, k
  where c.ex or c.pre or c.d <= greatest(1, char_length(k.j)/3)
  order by c.ex desc, c.pre desc, c.d, (c.tmdb_id is not null) desc, c.pop desc nulls last
  limit least(greatest(lim,1),10) $$;
grant execute on function public.people_suggest(text,int) to anon, authenticated;

-- 후보 추가: 고른 사람(pid)이나 DB에 정확히 있는 이름만 받음
drop function if exists public.add_candidate(bigint, text, text);
create or replace function public.add_candidate(rid bigint, nm text, pitch text default null, pid bigint default null)
returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare u uuid := me(); n text := btrim(nm); pt text := nullif(left(btrim(coalesce(pitch,'')), 80), ''); cid bigint; st text; today int; p_id bigint := pid; bl boolean;
begin
  select stage into st from roles where id = rid;
  if st is null or st not in ('dream','rumor') then raise exception '지금은 후보를 올릴 수 없는 배역이에요'; end if;
  if not role_open(rid) then raise exception '투표가 마감돼 후보를 올릴 수 없어요'; end if;
  if p_id is not null then
    select name, coalesce(blocked,false) into n, bl from people where id = p_id;
    if n is null then raise exception '배우 목록에서 골라 주세요'; end if;
  else
    if char_length(n) < 1 or char_length(n) > 20 then raise exception '이름은 1~20자로 적어 주세요'; end if;
    select id, coalesce(blocked,false) into p_id, bl from people where name = n or n = any(aliases)
      order by (tmdb_id is not null) desc, (name = n) desc, pop desc nulls last limit 1;
    if p_id is null and not exists(select 1 from candidates where role_id = rid and name = n) then
      raise exception '배우 목록에 없는 이름이에요. 비슷한 이름 중에서 골라 주세요'; end if;
    if p_id is not null then select name into n from people where id = p_id; end if;
  end if;
  if bl then raise exception '이 후보는 올릴 수 없어요'; end if;
  select id into cid from candidates where role_id = rid and (person_id = p_id or name = n) order by (person_id = p_id) desc nulls last limit 1;
  if cid is not null then
    update candidates set in_set = true where id = cid;
  else
    select count(*) into today from candidates where proposed_by = u and created_at > now() - interval '1 day';
    if today >= 10 then raise exception '후보는 하루 10명까지 올릴 수 있어요'; end if;
    insert into candidates(role_id, name, proposed_by, pick, in_set, pitch, person_id) values (rid, n, u, 'user', true, pt, p_id) returning id into cid;
    perform award(u, 20, '후보 제안', 'cand:' || cid);
  end if;
  if u is not null and not exists(select 1 from votes where user_id = u and role_id = rid) then
    insert into votes(user_id, role_id, candidate_id, weight) values (u, rid, cid, 1);
    perform award(u, 5, '배역 투표', 'vote:' || rid);
  end if;
  insert into events(kind, user_id, topic_id, role_id, candidate_id, person_id, meta)
    values ('cand_add', u, (select topic_id from roles where id = rid), rid, cid, p_id, jsonb_build_object('name', n, 'pitch', pt is not null));
  perform snap_tally(rid);
  return cid;
end $function$;
revoke execute on function public.add_candidate(bigint,text,text,bigint) from public, anon;
grant execute on function public.add_candidate(bigint,text,text,bigint) to authenticated, service_role;
