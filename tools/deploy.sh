#!/usr/bin/env bash
# 드림캐스팅 광장 배포: main에 커밋, 푸시 -> GitHub Pages 공개 주소 반영 확인
# 사용: bash tools/deploy.sh "커밋 메시지"
# 필요: 이 작업(세션)에 pdavid97/dreamcasting 저장소가 붙어 있어야 함
set -euo pipefail
cd "$(dirname "$0")/.."
MSG="${1:-업데이트}"
git add -A
if git diff --cached --quiet; then echo "바뀐 파일 없음"; exit 0; fi
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -q -m "$MSG"
git -c push.negotiate=true push -q origin HEAD:main 2>&1 | grep -v "negotiation" || true
echo "푸시 완료: $(git log --oneline -1)"
WANT=$(sha1sum index.html | cut -d' ' -f1)
for i in $(seq 1 24); do sleep 10
  GOT=$(curl -s "https://pdavid97.github.io/dreamcasting/?t=$RANDOM" | sha1sum | cut -d' ' -f1)
  if [ "$GOT" = "$WANT" ]; then echo "공개 주소 반영 확인"; exit 0; fi
done
echo "푸시는 됐지만 4분 안에 공개 주소에 반영되지 않음 (Pages 빌드 대기 중일 수 있음)"
