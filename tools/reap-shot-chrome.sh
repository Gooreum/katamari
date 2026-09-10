#!/usr/bin/env bash
# 스크린샷용 헤드리스 크롬만 죽인다.
#
# **`pkill -f "Google Chrome"` 을 쓰면 안 된다** — 사용자가 쓰고 있는 브라우저까지
# 통째로 죽는다. 실제로 그렇게 죽였다. 이 도구가 띄운 크롬은 프로필 경로가
# `/tmp/cdp-shot-profile` 로 고정이므로 그 인자를 가진 프로세스만 고른다.
#
# **9333 포트도 본다.** 다른 경로로 뜬 크롬이 9333 을 물고 있으면 `shot.mjs` 가
# 「CDP 엔드포인트를 못 찾았다」로 죽는다. 그렇다고 포트를 문 놈을 다 죽이면
# 사용자가 원격 디버깅으로 띄운 브라우저가 죽는다. 그래서 촬영용 크롬이면 죽이고,
# 아니면 **죽이지 않고 알린 뒤 exit 2 로 멈춘다.**
set -u
PROFILE=/tmp/cdp-shot-profile
PORT=9333

PIDS=$(pgrep -f -- "--user-data-dir=$PROFILE" || true)
if [ -n "$PIDS" ]; then
  # shellcheck disable=SC2086
  kill -9 $PIDS 2>/dev/null || true
  sleep 0.5
fi

for pid in $(lsof -ti ":$PORT" -sTCP:LISTEN 2>/dev/null); do
  if ps -o command= -p "$pid" 2>/dev/null | grep -q -- "--user-data-dir=$PROFILE"; then
    kill -9 "$pid" 2>/dev/null || true
  else
    echo "$PORT 포트를 다른 프로세스가 쓰고 있습니다: pid $pid ($(ps -o comm= -p "$pid" 2>/dev/null)). 죽이지 않았습니다." >&2
    exit 2
  fi
done

rm -rf "$PROFILE"
