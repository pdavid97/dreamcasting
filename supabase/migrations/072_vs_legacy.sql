-- 072 역대 배역 대결(VS 'legacy')과 배역 연표: 같은 배역을 맡은 실사 배우들끼리 대결. 배역 목록은 직접 고른 목록(legacy_role), 출연 정보는 ip_cast(TMDB)
create table if not exists legacy_role(id serial primary key, ko text not null, aliases text[] not null, on_ok boolean not null default true);
alter table legacy_role enable row level security;
do $$ begin if not exists(select 1 from pg_policies where tablename='legacy_role' and policyname='legacy_role_read') then create policy legacy_role_read on legacy_role for select using (true); end if; end $$;
insert into legacy_role(ko, aliases) select * from (values
 ('배트맨 브루스 웨인', array['bruce wayne','batman']), ('스파이더맨 피터 파커', array['peter parker','spider-man']), ('슈퍼맨 클라크 켄트', array['clark kent','superman','kal-el']),
 ('로이스 레인', array['lois lane']), ('렉스 루터', array['lex luthor']), ('셜록 홈즈', array['sherlock holmes']), ('장발장', array['jean valjean']), ('자베르', array['javert']),
 ('백설공주', array['snow white']), ('오페라의 유령', array['the phantom']), ('신데렐라', array['cinderella']), ('찰스 자비에', array['professor charles xavier','charles xavier']),
 ('매그니토', array['magneto','erik lehnsherr']), ('진 그레이', array['jean grey']), ('라라 크로프트', array['lara croft']), ('덤블도어', array['albus dumbledore']),
 ('아나킨 스카이워커', array['anakin skywalker']), ('집사 알프레드', array['alfred','alfred pennyworth']), ('그웬 스테이시', array['gwen stacy']), ('메이 숙모', array['may parker','aunt may']),
 ('해리 오스본', array['harry osborn']), ('후크 선장', array['captain hook']), ('피터 팬', array['peter pan']), ('조니 케이지', array['johnny cage']), ('소냐 블레이드', array['sonya blade']),
 ('캣우먼 셀리나 카일', array['selina kyle','catwoman']), ('베놈 에디 브록', array['eddie brock']), ('미녀와 야수의 벨', array['belle']), ('백설공주의 여왕', array['evil queen']), ('간달프', array['gandalf'])
) v(ko, aliases) where not exists(select 1 from legacy_role);

create or replace view public.legacy_cast as
select distinct on (lr.id, ic.tmdb_person) lr.id role_id, lr.ko, ic.tmdb_person, ic.name, ic.profile, w.title work, w.year
from legacy_role lr
join ip_cast ic on ic.character <> '' and ic.ord <= 6
  and exists(select 1 from unnest(string_to_array(ic.character, '/')) p where lower(trim(regexp_replace(p, '\s*\(.*\)|["“”]', '', 'g'))) = any(lr.aliases))
join ip_work w on w.key = ic.key and not ('애니메이션' = any(coalesce(w.genres, '{}')))
where lr.on_ok
order by lr.id, ic.tmdb_person, w.year;

alter table vs_log drop constraint if exists vs_log_kind_check;
alter table vs_log add constraint vs_log_kind_check check (kind in ('role','chem','orig','legacy'));

create or replace function public.vs_log_add(k text, tid text, rid bigint, w bigint, l bigint, bad boolean, ms int, s text, pk text, m jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); n int; wk text := coalesce(m->>'w', w::text);
begin
  if u is null and coalesce(length(s), 0) < 8 then raise exception '세션 정보가 없어요'; end if;
  if k not in ('role','chem','orig','legacy') or pk is null or length(pk) > 200 then raise exception '대결 정보가 올바르지 않아요'; end if;
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

-- 역대 배역 대결 문제 하나: 사진 있는 실사 배우 2명과 연표
create or replace function public.vs_legacy(skip text[] default '{}') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r record; a record; b record;
begin
  for r in select role_id, ko from legacy_cast where profile is not null group by role_id, ko having count(*) >= 2 order by random() loop
    for a in select x.tmdb_person ap, x.name an, x.profile apf, x.work aw, x.year ay, y.tmdb_person bp, y.name bn, y.profile bpf, y.work bw, y.year by_
      from legacy_cast x join legacy_cast y on y.role_id = x.role_id and y.tmdb_person > x.tmdb_person
      where x.role_id = r.role_id and x.profile is not null and y.profile is not null
        and not ('legacy:' || r.role_id || ':' || x.tmdb_person || '-' || y.tmdb_person) = any(skip)
      order by random() limit 1 loop
      return jsonb_build_object('kind', 'legacy', 'pk', 'legacy:' || r.role_id || ':' || a.ap || '-' || a.bp, 'tid', null, 'title', '역대 배역 대결', 'cat', null,
        'rid', null, 'ch', r.ko, 'orig', null, 'c', jsonb_build_object('id', null),
        'a', jsonb_build_object('id', a.ap, 'p', a.apf, 'name', a.an, 'work', a.aw, 'year', a.ay),
        'b', jsonb_build_object('id', a.bp, 'p', a.bpf, 'name', a.bn, 'work', a.bw, 'year', a.by_),
        'line', (select jsonb_agg(jsonb_build_object('name', name, 'work', work, 'year', year) order by year) from legacy_cast where role_id = r.role_id));
    end loop;
  end loop;
  return null;
end $$;
grant execute on function public.vs_legacy(text[]) to anon, authenticated;
