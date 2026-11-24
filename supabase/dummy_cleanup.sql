-- 더미 유저 테스트 데이터 정리 (2026-11-24 생성분)
-- 더미 유저: public.dummy_users 목록, 이메일 @dummy.dreamcasting.test, 비로그인 VS 세션 sid 'dummyg%'
begin;
update people p set fans = greatest(0, p.fans - x.n)
  from (select person_id, count(*) n from fan_follows where user_id in (select id from dummy_users) group by person_id) x where x.person_id = p.id;
delete from events where user_id in (select id from dummy_users);
delete from ux_events where user_id in (select id from dummy_users);
delete from vs_log where user_id in (select id from dummy_users) or sid like 'dummyg%' or sid in ('1hutbavhextmwuzfx5i','mfkacp7rzrmwv63mp9','sym3nvwbp2smwv62sx3');  -- 마지막 3개는 화면 점검 중 생긴 기록
delete from auth.users where id in (select id from dummy_users);  -- profiles, votes, sheets, 토론, 좋아요, 포인트, 알림은 연쇄 삭제
delete from tally_daily where true; insert into tally_daily select * from dummy_bak_tally;
delete from sync_daily where true; insert into sync_daily select * from dummy_bak_sync;
select snap_tally(id) from roles;
select dc_vs_rate();
drop function if exists public._dummy_vs(uuid,text,int,int);
drop table dummy_bak_tally; drop table dummy_bak_sync; drop table dummy_users;
commit;
