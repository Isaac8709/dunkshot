#!/bin/bash
# Dunk Shot — local dev server launcher
cd "$(dirname "$0")"
echo "▶ 덩크슛 dev 서버를 시작합니다..."
echo "  (종료하려면 이 창에서 Ctrl+C)"
echo ""
npm run dev -- --open --port 5173
