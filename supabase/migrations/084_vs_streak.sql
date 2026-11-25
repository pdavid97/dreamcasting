-- 084 VS 연속 보상: 오늘(한국 시간) VS 기록이 5, 10, 20판에 닿으면 안목 포인트 보너스. 하루에 단계마다 한 번만
create or replace function public.vs_streak_claim(n int) returns int
language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); d date := (now() at time zone 'Asia/Seoul')::date; c int; pts int;
begin
  if u is null or not exists(select 1 from profiles where id = u) then return 0; end if;
  pts := case n when 5 then 10 when 10 then 20 when 20 then 50 else 0 end;
  if pts = 0 then return 0; end if;
  select count(*) into c from vs_log where user_id = u and not coalesce(bad,false) and (at at time zone 'Asia/Seoul')::date = d;
  if c < n then return 0; end if;
  return award(u, pts, 'VS 연속 ' || n || '판', 'vsstreak:' || d || ':' || n);
end $$;
revoke execute on function public.vs_streak_claim(int) from public, anon;
grant execute on function public.vs_streak_claim(int) to authenticated;
