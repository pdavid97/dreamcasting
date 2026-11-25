# IP 실사화 기초 데이터 수집

1. q.py: Wikidata에서 MCU, DC, 디즈니 실사, 뮤지컬 원작, 애니와 만화 원작 실사 작품의 배역(P161, P453) 조회(raw.json). 쿼리 서비스가 분당 1회로 제한될 수 있어 쿼리 사이 대기
2. disc.py: tmdb 함수 disc 모드로 TMDB 키워드별 작품 수집(disc.json). 키워드: MCU 180547, DCEU 229266, DCU 312528, 실사 리메이크 245230, 동화 원작 179411, 연극과 뮤지컬 원작 10181, 만화 13141, 애니 222243, 애니 실사 359095, 웹툰 288474, 만화(한국) 323477, 게임 원작 41645
3. cast.py, cast2.py: 작품 목록을 합치고 tmdb 함수 cast 모드로 출연진과 배역 수집(cast.json)
4. 무대 작품과 배역: Wikidata 무대 작품(Q58483083, 위키 문서 15개 이상)과 배역(P674), 영화화 작품(P144 역참조)
5. 적재: ip_work, ip_cast, stage_work, stage_char. 적재 함수는 일회용 토큰으로만 열고 끝나면 닫음

## 2026-11-24 추가
- KOBIS(영화진흥위원회): 함수 kobis, 비밀값 KOBIS_KEY. 한국 영화 목록(1995년부터), 상세 출연진과 배역명(kobis_cast), 일별 박스오피스(kobis_box). 하루 3000회 한도라 한 번 실행에 약 315회, 하루 최대 8회
- IGDB(게임): 함수 igdb, 비밀값 TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET. game_live 작품의 원작 게임 연결(game_link), 인기 게임 300편과 연결 게임의 캐릭터(game_char). 캐릭터 그림은 식별자만 저장
- 해외 인기작(TMDB): 함수 ipsync. 묶음 us_film(미국 영화), us_tv(미국 드라마), netflix_tv, netflix_film(넷플릭스 제작과 국내 넷플릭스 제공 영화), ott_tv(HBO, Apple TV+, Disney+, Prime Video, Hulu)를 ip_work, ip_cast에 적재
- 정기 실행: 066_collect_cron.sql (KOBIS 매일, ipsync 매월 3일, IGDB 매월 4일, 한국 시간)
