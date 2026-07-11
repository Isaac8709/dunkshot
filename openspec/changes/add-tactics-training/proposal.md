# Change: 픽앤롤 전술 훈련 모드 (2 대 2) 추가

## Why
덩크 랩은 개인 기술·동기부여 축이지만, 농구는 팀 스포츠다. 사용자 요청:
픽앤롤 같은 전술을 훈련할 수 있는 모드 — 동료/상대 AI와 패스 기능 포함.
"게임은 미끼, 훈련이 본체" 사상에 맞게, 판정을 화려함이 아닌 **의사결정
타이밍**(수비 간격 읽기)에 두어 실제 전술 이해를 훈련시킨다.

## What Changes
- **NEW `src/game3d/TacticsWorld.tsx`** — 2v2 시뮬레이션: 스크리너/수비 2명
  AI(스크린 충돌 슬로우, 헤지-복귀, 확률 스위치), 로브 패스, 롤러 앨리웁
  피니시, 셀프 덩크/풀업, 등급 판정. 기존 Player3D 리그 4인 재사용.
- **NEW `src/game3d/Tactics3D.tsx`** — 캔버스/입력 셸 (방향키+P+SPACE,
  모바일 D-패드 + 패스/마무리 버튼).
- **NEW `src/screens/TacticsScreen.tsx`** — 5회 반복 세션, 실시간 코칭 힌트,
  등급 피드백, 세션 리포트(카운트업), 인트로 오버레이.
- `AppScreen`에 `'tactics'` 추가, App 라우팅, 메인 메뉴 '전술' 카드,
  훈련 화면 진입 버튼.
- openspec: `specs/tactics-training/spec.md` 신설.

## Impact
- Affected specs: `tactics-training` (신설)
- Affected code: game3d 2파일 신설 + screens 1파일 신설 + 라우팅 3파일 수정
- 저장 포맷/기존 게임 로직 변경 없음
