-- 056 vote_deck 응답에 oart(원작 대표 이미지: url, kind group|poster, w, h, faces) 추가
-- 적용 방식: 현재 함수 정의에서 'vposter' 항목 뒤에 'oart' 를 덧붙여 다시 만든다
do $$ declare d text; begin
 d := pg_get_functiondef('public.vote_deck(int)'::regprocedure);
 if position('''oart''' in d) = 0 then
   d := replace(d, '''vposter'', t.work->>''poster'',', '''vposter'', t.work->>''poster'', ''oart'', t.work->''oart'',');
   execute d;
 end if; end $$;
