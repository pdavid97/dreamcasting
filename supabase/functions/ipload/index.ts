// IP 실사화 기초 데이터 적재용 임시 함수. 적재가 끝나 모든 요청을 거절함(2026-11-24)
// 다시 쓸 때는 정해진 4개 테이블(ip_work, ip_cast, stage_work, stage_char)에만 upsert하고, 일회용 토큰은 저장소에 두지 않음
Deno.serve(() => new Response("disabled", { status: 410 }));
