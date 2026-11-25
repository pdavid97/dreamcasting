-- 079 가입 버그: set_consent가 me()를 써서 닉네임이 없는 첫 가입자는 동의 저장에서 막힘. auth.uid()로 바꿈
create or replace function public.set_consent(terms boolean, stats boolean, share boolean, ver text, age_band text default null, gender_self text default null, region_self text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare u uuid := auth.uid(); cur profile_private; ab text; gs text; rs text;
begin
  if u is null then raise exception '로그인이 필요해요'; end if;
  select * into cur from profile_private where user_id = u;
  if not terms and cur.terms_at is null then raise exception '이용약관과 개인정보처리방침에 동의해 주세요'; end if;
  ab := case when stats then nullif(age_band,'') end;
  gs := case when stats then nullif(gender_self,'') end;
  rs := case when stats then upper(nullif(left(region_self,2),'')) end;
  if ab is not null and ab not in ('14-19','20-24','25-29','30-34','35-39','40-49','50+') then raise exception '연령대 값이 올바르지 않아요'; end if;
  if gs is not null and gs not in ('f','m','x') then raise exception '성별 값이 올바르지 않아요'; end if;
  if rs is not null and rs !~ '^[A-Z]{2}$' then raise exception '국가 값이 올바르지 않아요'; end if;
  insert into profile_private(user_id, terms_ver, terms_at, stats_at, share_at, age_band, gender_self, region_self, updated_at)
  values (u, ver, case when terms then now() end, case when stats then now() end, null, ab, gs, rs, now())
  on conflict (user_id) do update set
    terms_ver = case when terms then excluded.terms_ver else profile_private.terms_ver end,
    terms_at = case when terms and profile_private.terms_ver is distinct from excluded.terms_ver then now() else coalesce(profile_private.terms_at, excluded.terms_at) end,
    stats_at = case when stats then coalesce(profile_private.stats_at, now()) else null end,
    share_at = null,
    age_band = ab, gender_self = gs, region_self = rs, updated_at = now();
  if cur.user_id is null or (terms and cur.terms_ver is distinct from ver) then insert into consent_log(user_id,item,agreed,ver) values (u,'terms',true,ver); end if;
  if cur.user_id is null or (cur.stats_at is not null) <> stats then insert into consent_log(user_id,item,agreed,ver) values (u,'stats',stats,ver); end if;
end $function$;
