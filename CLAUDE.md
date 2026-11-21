# 드림캐스팅 광장 작업 규칙

- 공개 주소: https://pdavid97.github.io/dreamcasting/ (GitHub Pages, main 브랜치 루트)
- 배포: `bash tools/deploy.sh "메시지"` 로 커밋, 푸시, 공개 주소 반영까지 확인
- 사이트는 index.html 한 파일(supabase-js만 CDN으로 로드). 원본 조각은 src/(live_body.html, live_ext.js, live_extra.css, live_ext.css)이고 index.html은 이 조각을 합쳐 만든 결과물
- 백엔드: Supabase 테이블과 RPC는 supabase/migrations, Edge Function은 supabase/functions(tmdb, chem, meta, poster, go, metrics). 쓰기는 모두 RPC로만
- 바깥 링크는 반드시 Edge Function go를 거쳐 클릭을 기록(광고 상품 근거 데이터)
- 비밀값: TMDB_TOKEN(필수), FAL_KEY(AI 포스터, 선택). 키를 채팅에 받지 않음
- 이미지: Supabase 프로젝트 dreamcasting(dnzcvbidppzaogtmwamc)의 Edge Function tmdb가 TMDB를 중계. 키는 비밀값 TMDB_TOKEN에만 있음. 결과는 tmdb_cache 테이블에 30일 캐시. 페이지 하단의 TMDB 출처 문구는 지우지 말 것
- 실존 배우 얼굴을 합성한 이미지는 만들지 않음. 포스터는 실루엣과 크레딧 방식 유지
- 화면 문구와 문서에 em dash와 가운뎃점을 쓰지 않음
