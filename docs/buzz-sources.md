# 화제성(buzz) 신호 후보 조사 (2026-11-21 기준)

현재 점수: Google News RSS 7일 기사 수 + TMDB 주간 트렌딩 + 앱 내 활동. 아래는 Supabase Edge Function(Deno, 일 1회 pg_cron)에서 쓸 수 있는지 기준으로 정리한 결과입니다.

## 1. Google Trends

| 항목 | 내용 |
|---|---|
| 측정 | 한국 실시간 급상승 검색어(상위 약 10개)와 대략 검색량(`ht:approx_traffic`, 예: 20000+), 관련 기사 |
| 호출 | `GET https://trends.google.com/trending/rss?geo=KR` (2026-11-21 직접 호출 시 200, item 10개 확인) |
| 인증/한도 | 없음. 공식 문서와 한도 공지 없음 |
| 주의 | 문서화된 API가 아니라 형식 변경 가능. 상위 10개만 나오므로 개별 작품 검색 추이는 알 수 없음 |
| interest over time | 공식 [Google Trends API(alpha)](https://developers.google.com/search/apis/trends)는 여전히 신청자 선별 알파. 5년 롤링, 일/주/월 단위, 0~100 정규화가 아닌 일관 스케일 제공([발표 블로그](https://developers.google.com/search/blog/2025/07/trends-api)). 그 외 경로(pytrends 등)는 비공식 스크래핑([DEV 글](https://dev.to/esteban_ortega/pytrends-is-dead-heres-how-to-get-google-trends-data-in-2026-1a18)) |

**권고:** RSS는 지금 채택(작품명이 급상승어나 관련 기사 제목에 걸리면 보너스). Trends API alpha는 신청만 해 두고, 비공식 스크래핑은 회피.

## 2. 네이버 데이터랩 검색어 트렌드

| 항목 | 내용 |
|---|---|
| 측정 | 네이버 통합검색 검색량의 상대 비율(요청 안 최대값 = 100), 2016-01-01부터 |
| 호출 | `POST https://naverapihub.apigw.ntruss.com/search-trend/v1/search` 본문 `{startDate, endDate, timeUnit: "date"\|"week"\|"month", keywordGroups:[{groupName, keywords:[...]}], device?, gender?, ages?}` ([명세](https://api.ncloud-docs.com/docs/naver-api-hub-search-trend)) |
| 제한 | keywordGroups 최대 5개, 그룹당 키워드 최대 20개 |
| 인증 | NAVER API HUB(네이버클라우드) 키: `X-NCP-APIGW-API-KEY-ID`, `X-NCP-APIGW-API-KEY`. 구 경로 `openapi.naver.com/v1/datalab/search`(`X-Naver-Client-Id/Secret`)도 있으나 신규는 HUB로 안내되며 두 키는 호환 안 됨([정리 글](https://www.digitalmarketer.co.kr/insights/naver-datalab-api-data-for-non-developers)) |
| 한도/비용 | 검색어 트렌드 월 50,000회, 키당 50 RPS, 초과 시 429. **현재 한시 무료, 사전 공지 후 종량제 유료 전환 예정**, 무료 기간엔 한도 상향 불가([HUB 개요](https://guide.ncloud-docs.com/docs/apihub-overview.md)) |
| 약관 | 개요 문서에 비상업 이용 조건은 명시 없음. 가입 시 약관과 과금수단 등록 여부 확인 필요 |
| 주의 | 값이 요청 단위 상대값이므로 요청마다 고정 기준어(anchor)를 넣어 환산해야 함 |

**실시간 검색어:** 네이버는 2021년 2월 실검 폐지([인사이트](https://www.insight.co.kr/news/355431)), 이후 복귀 보도 확인 못 함. 대신 **다음(AXZ)이 2026-03-03 베타로 "실시간 트렌드"를 부활**시켰으나 API나 피드는 언급 없음([뉴시스](https://www.newsis.com/view/NISX20260304_0003534588)).

**권고:** 키 발급 후 채택(한국 시청자 관심을 가장 직접 반영). 다음 실시간 트렌드는 공식 피드 없으므로 회피.

## 3. Wikimedia Pageviews

| 항목 | 내용 |
|---|---|
| 측정 | 문서별 일별 조회수(ko, en 위키백과), 보통 하루 지연 |
| 호출 | `GET https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{ko.wikipedia\|en.wikipedia}/all-access/user/{URL인코딩 문서명}/daily/{YYYYMMDD}/{YYYYMMDD}` |
| 인증 | 없음. 단 User-Agent 필수, 형식 `클라이언트명/버전 (연락처) 라이브러리/버전`, 없으면 예고 없이 차단([접근 정책](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html)) |
| 한도 | 고정 수치 없음, 서비스에 부담 주면 차단. 요청은 직렬로 보낼 것을 권고. 이번 조사 중 공유 클라우드 IP에서 호출 시 429를 받음([2024 정책 변경](https://meta.wikimedia.org/wiki/API_Policy_Update_2024)) |
| 주의 | 작품마다 위키 문서명 매핑 필요, 신작이나 웹소설은 문서가 없는 경우 많음 |

**권고:** 지금 채택(키 불필요). UA 연락처는 공개 사이트 주소 사용, 직렬 호출과 429 재시도 처리.

## 4. YouTube Data API v3

| 항목 | 내용 |
|---|---|
| 측정 | 예고편 영상의 viewCount, likeCount, commentCount (일별 증가분으로 활용) |
| 호출 | `GET https://www.googleapis.com/youtube/v3/videos?part=statistics&id={최대 50개 ID}&key=...` |
| 한도 | 2026-11-12 갱신 문서 기준 videos.list 1유닛, 기본 1일 10,000유닛. **search.list는 별도 버킷으로 하루 100회**(호출당 1)([쿼터표](https://developers.google.com/youtube/v3/determine_quota_cost)). 태평양시간 자정 리셋 |
| 인증 | Google Cloud 프로젝트의 API 키 |
| 약관 | [감사 및 준수 가이드](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits) 준수, 통계 저장 기간 규정 확인 필요 |

**권고:** 키 발급 후 채택. 예고편 ID는 작품 등록 시 1회 search.list(또는 관리자가 직접 입력)로 확정하고, 매일은 videos.list 묶음 호출만 사용.

## 5. 기타 후보

| 소스 | API/피드 | 인증, 비용 | 약관, 신뢰도 | 권고 |
|---|---|---|---|---|
| Netflix Top 10 | 이미 사용 | | | 유지 |
| FlixPatrol | 유료 API: Start $9.99/월, Premium $49/월 모두 월 1,000회([요금](https://flixpatrol.com/about/premium)) | 키 | 사이트는 Cloudflare 챌린지로 스크래핑 차단 | 회피(비용) |
| 굿데이터 펀덱스 | API 없음, 주 1회 결과가 기사로 공개([머니투데이 예](https://www.mt.co.kr/entertainment/2026/02/19/2026021911467277565)) | | 측정 방식 비공개 | 회피(필요시 Google News 기사로 간접 반영) |
| 닐슨코리아 시청률 | 공개 API 없음. robots.txt가 `/api/` 금지 | | 방영작만 해당 | 회피 |
| 네이버 웹툰, 시리즈, 카카오페이지 랭킹 | 공식 API 없음. 웹툰은 `/search`, `/webtoon/detail` 등 robots 금지, 시리즈는 `/search`, 카테고리 목록 금지 | | 스크래핑은 약관 위반 소지, 구조 변경 잦음 | 회피 |
| 키노라이츠 | 공개 API 확인 못 함([보도 예](https://www.wikitree.co.kr/articles/1017748)) | | | 회피 |
| Reddit r/KDRAMA | OAuth 앱 등록과 승인 필요, 무료는 비상업 100 QPM, 비인증 접근은 사실상 차단([2026 정리](https://www.activepieces.com/blog/reddit-api-access-in-2026-how-to-get-started)). 조사 중 비인증 요청 차단 확인 | 앱 키 | 해외 팬 반응만 반영 | 승인 받으면 선택적 |
| Bluesky | `app.bsky.feed.searchPosts` 공개 엔드포인트. 조사 중 403, 부하 제한 차단 보고([이슈](https://github.com/bluesky-social/bsky-docs/issues/332)) | 없음 | 한국 이용자 적음 | 회피 |
| Threads | `GET graph.threads.com/v1.0/keyword_search?q=` , `threads_keyword_search` 앱 심사 통과 전엔 본인 글만 검색, 사용자당 24시간 2,200회([문서](https://developers.facebook.com/documentation/threads/keyword-search)) | Meta 앱, 심사 | 결과에 좋아요/조회수 필드 미기재 | 보류(심사 부담 대비 효용 낮음) |

## 6. 제안 점수식

작품 w, 소스 s의 원값 x_s(w)에 대해 그날 전체 작품 분포로 정규화합니다.

```
n_s(w) = min(1, log1p(x_s(w)) / log1p(P95_s))      // P95_s: 당일 전 작품 x_s의 95번째 백분위
momentum_s(w) = log1p(x_s 최근7일) - log1p(x_s 직전7일)   // 상승세, -1..1로 클립
```

| 소스 s | 원값 x_s | 가중치 |
|---|---|---|
| news | Google News 7일 기사 수 | 0.20 |
| naver | 데이터랩 7일 평균 비율 / 같은 요청의 anchor 비율 (요청당 작품 4개 + 고정 기준어 1개) | 0.20 |
| app | 앱 내 투표, 댓글, go 클릭 7일 합 | 0.20 |
| wiki | ko + en 7일 조회수 합 | 0.10 |
| yt | 예고편 조회수 7일 증가분 합 | 0.10 |
| tmdb | TMDB 주간 트렌딩 순위 점수(1위=1, 20위 밖 0) | 0.10 |
| nflx | Netflix Top 10 진입 점수 | 0.10 |

```
base(w)  = Σ_s 가중치_s * n_s(w) / Σ_{값이 있는 s} 가중치_s   // 데이터 없는 소스는 분모에서 제외
bonus(w) = 0.05 * [작품명이 Google Trends KR RSS 제목 또는 관련 기사에 등장]
buzz(w)  = 100 * min(1, base(w) * (1 + 0.15 * 평균 momentum(w)) + bonus(w))
```

호출량 예시(작품 200개): 데이터랩 하루 50회(월 약 1,500회), Wikipedia 최대 400회 직렬, YouTube videos.list 4회(4유닛), Trends RSS 1회. 모두 무료 한도 안입니다.

## 7. David가 직접 등록할 비밀값

채팅으로 키를 받지 않으며, Supabase 대시보드 Edge Functions Secrets에 직접 입력합니다.

1. **NAVER API HUB**(네이버클라우드 콘솔): `NAVER_HUB_KEY_ID`, `NAVER_HUB_KEY`. 유료 전환 공지 메일 수신 설정 권장
2. **YouTube Data API v3**(Google Cloud 콘솔, API 키를 YouTube Data API로 제한): `YOUTUBE_API_KEY`
3. 선택: Google Trends API alpha 신청서 제출(키 발급 시 `GTRENDS_KEY` 추가 검토)

키 불필요: Google Trends RSS, Wikimedia Pageviews(User-Agent만), Google News RSS.
