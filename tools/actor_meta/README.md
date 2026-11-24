# 후보 배우 사진, 표기 이름, 얼굴 위치 일괄 계산

1. cands.json: 후보 이름과 people 정보(SQL로 뽑음)
2. res.py: tmdb 함수(pids, who 모드)로 TMDB 인물 정보 수집 → tm.json
3. dec.py: 후보와 TMDB 인물 짝짓기 → dec.json
4. build.py: 사진, 표기 이름(disp), 언어 결정 → rows.json (orig.json은 중국어 원어 이름)
5. batch.py + face.py: w500 사진 내려받아 YuNet으로 얼굴 위치 계산 → rows2.json
6. 결과를 actor_meta에 upsert, tmdb_cache p:이름 갱신 (migrations/051 참고)

새 후보가 쌓이면 actor_meta에 없는 이름만 골라 같은 순서로 돌리면 됨.
YuNet 모델: huggingface opencv/face_detection_yunet (face_detection_yunet_2023mar.onnx)
