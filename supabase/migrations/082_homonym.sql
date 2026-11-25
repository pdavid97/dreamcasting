-- 082 동명이인: 이름으로 사람을 찾을 때 TMDB 출연 기록이 있는 사람을 먼저 고름(위키데이터에서만 온 같은 이름의 다른 사람이 인기 수치 단위 차이로 먼저 잡히던 문제)
-- 1) 이름으로 people을 찾는 함수들의 정렬 앞에 (tmdb_id is not null)을 끼움
do $$ declare f text; d text; n text;
begin
  foreach f in array array['add_candidate','my_insights','my_cast_graph','cast_links','my_style'] loop
    d := pg_get_functiondef(('public.'||f)::regproc);
    if d ~ 'tmdb_id is not null\) desc, ' then continue; end if;
    n := regexp_replace(d, '(\m[a-z_]+\.)?pop desc nulls last', '(\1tmdb_id is not null) desc, \1pop desc nulls last', 'g');
    if n <> d then execute n; end if;
  end loop;
end $$;

create or replace function public.resolve_person(nm text) returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare tid bigint; pid bigint; n text := btrim(nm);
begin
  select id into pid from people where name = n or n = any(aliases) order by (tmdb_id is not null) desc, (name = n) desc, pop desc nulls last limit 1;
  if pid is not null then return pid; end if;
  select nullif(url,'')::bigint into tid from tmdb_cache where k = 'pid:' || n;
  if tid is null then return null; end if;
  insert into people(tmdb_id, name) values (tid, n) on conflict (tmdb_id) do update set aliases = case when people.name = n or n = any(people.aliases) then people.aliases else people.aliases || n end
    returning id into pid;
  return pid;
end $function$;

create or replace function public.people_search(q text) returns table(id bigint, name text, fans integer, cands integer)
language sql stable security definer set search_path to 'public' as $function$
  select p.id, p.name, p.fans, (select count(*)::int from candidates c where c.person_id = p.id)
  from people p where char_length(btrim(q)) >= 1 and (p.name ilike '%' || btrim(q) || '%' or exists(select 1 from unnest(p.aliases) a where a ilike '%' || btrim(q) || '%'))
  order by (p.name = btrim(q)) desc, (p.tmdb_id is not null) desc, 4 desc, 3 desc, p.pop desc nulls last limit 20 $function$;

-- 2) 원작 배우는 이름이 아니라 그 작품 출연 기록으로 고정(roles.orig_pid)
alter table roles add column if not exists orig_pid bigint references people(id) on delete set null;
create or replace function public.orig_pid_of(rid bigint) returns bigint language sql stable security definer set search_path to 'public' as $$
  select p.id from roles r join topics t on t.id = r.topic_id join people p on (p.name = r.orig or r.orig = any(p.aliases))
  where r.id = rid
  order by exists(select 1 from credit x join work w on w.id = x.work_id where x.person_id = p.id
                  and (w.tmdb_id::text = t.work->>'tmdb_id' or w.title = t.title)) desc,
           (p.tmdb_id is not null) desc, (select count(*) from credit x where x.person_id = p.id) desc, p.pop desc nulls last
  limit 1 $$;
create or replace function public.roles_orig_pid() returns trigger language plpgsql as $$
begin
  if new.orig is null then new.orig_pid := null;
  elsif tg_op = 'INSERT' or new.orig is distinct from old.orig or new.orig_pid is null then
    new.orig_pid := (select p.id from topics t join people p on (p.name = new.orig or new.orig = any(p.aliases)) where t.id = new.topic_id
      order by exists(select 1 from credit x join work w on w.id = x.work_id where x.person_id = p.id and (w.tmdb_id::text = t.work->>'tmdb_id' or w.title = t.title)) desc,
               (p.tmdb_id is not null) desc, (select count(*) from credit x where x.person_id = p.id) desc, p.pop desc nulls last limit 1);
  end if;
  return new;
end $$;
drop trigger if exists roles_orig_pid on roles;
create trigger roles_orig_pid before insert or update of orig, orig_pid on roles for each row execute function roles_orig_pid();
update roles set orig_pid = orig_pid_of(id) where orig is not null;
