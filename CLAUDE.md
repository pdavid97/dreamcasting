# 드림캐스팅 광장 작업 규칙

- 공개 주소: https://pdavid97.github.io/dreamcasting/ (GitHub Pages, main 브랜치 루트)
- 배포: `bash tools/deploy.sh "메시지"` 로 커밋, 푸시, 공개 주소 반영까지 확인
- 사이트는 현재 index.html 한 파일. 외부 라이브러리 없이 동작
- 이미지: Supabase 프로젝트 dreamcasting(dnzcvbidppzaogtmwamc)의 Edge Function tmdb가 TMDB를 중계. 키는 비밀값 TMDB_TOKEN에만 있음. 결과는 tmdb_cache 테이블에 30일 캐시. 페이지 하단의 TMDB 출처 문구는 지우지 말 것
- 실존 배우 얼굴을 합성한 이미지는 만들지 않음. 포스터는 실루엣과 크레딧 방식 유지
- 화면 문구와 문서에 em dash와 가운뎃점을 쓰지 않음
