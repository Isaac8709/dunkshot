# Tasks — add-tactics-training

## 1. Simulation core
- [x] 1.1 TacticsWorld: 4인 액터(유저/스크리너/수비2) + seek 스티어링 + 포즈 헬퍼
- [x] 1.2 스크리너 AI: 스크린 스팟 이동 → 셋(와이드 스탠스) → 유저 통과 시 롤
- [x] 1.3 온볼 수비 AI: 유저-림 사이 포지셔닝 + 스크린 충돌 슬로우(0.9s)
- [x] 1.4 롤 수비 AI: 헤지(0.5~0.95s) → 롤러 복귀, 25% 확률 스위치
- [x] 1.5 로브 패스: 리드 계산 + 아크, 오픈/거리 기반 판정 5등급
- [x] 1.6 롤러 앨리웁 피니시 (점프 → 캐치 → 슬램 → 네트 임펄스)
- [x] 1.7 셀프 마무리: 드라이브 덩크 / 풀업 점퍼 (수비 간격 판정, 미스 시 클랭)

## 2. Shell & screen
- [x] 2.1 Tactics3D: 키보드(방향키/P/SPACE) + 모바일 D-패드 + 패스/마무리 버튼
- [x] 2.2 TacticsScreen: 5회 반복 세션, 힌트/등급 피드백, 인트로, 세션 리포트(카운트업)
- [x] 2.3 SFX 연결 (swish/combo/rim/fanfare)

## 3. Wiring
- [x] 3.1 AppScreen 'tactics' + App 라우팅
- [x] 3.2 메인 메뉴 '전술 PLAYBOOK' 카드, 훈련 화면 진입 버튼
- [x] 3.3 openspec: specs/tactics-training/spec.md

## 4. Verification
- [x] 4.1 tsc --noEmit + vite build 통과
- [x] 4.2 Playwright 스모크: 메뉴→전술 진입→드리블→패스→판정 표시, 런타임 에러 0
