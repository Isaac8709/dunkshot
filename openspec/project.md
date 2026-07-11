# Project Context — 덩크슛 (Dunk Shot)

## Purpose

**아들에게 실제 덩크슛을 보여주고 싶은 아빠의 꿈**을 현실로 만드는 온·오프라인 통합 훈련 PWA.
이승환의 노래 '덩크슛'(1993)이 모토다: *"덩크슛 한 번 할 수 있다면"*.

이 앱의 진짜 엔딩은 게임 클리어가 아니라 **현실에서의 덩크 성공**이다. 3D 덩크
게임은 동기부여 장치이자 보상 루프이고, 훈련 계획·기록·진행률 추적이 실제 목표
달성을 견인한다.

## Core Philosophy

1. **게임은 미끼, 훈련이 본체** — 게임에서 덩크를 "미리 체험"하게 해 오프라인
   훈련(점프력 향상)을 지속하게 만든다. 게임 실력과 무관하게 현실 기록
   (`currentVertical`)이 앱의 유일한 진짜 점수다.
2. **개인화된 물리 계산** — 키/팔길이/체중으로 스탠딩 리치와 "덩크에 필요한
   수직점프"를 계산하고, 그 갭을 기준으로 3단계 훈련 계획을 생성한다. 뜬구름
   목표가 아니라 "네게 필요한 건 앞으로 Ncm"라는 구체적 숫자를 준다.
3. **NBA 아레나 프리미엄 감성** — 다크 미드나잇 배경 + 오렌지/골드 네온.
   레트로 스코어보드(Press Start 2P)와 프리미엄 카드 UI가 공존한다. 촌스러운
   "운동 앱"이 아니라 갖고 싶은 "아레나"여야 한다.
4. **아빠와 아들이 함께** — 커뮤니티 피드는 Strava처럼 훈련 인증과 달성을
   공유하는 공간. 기록은 자랑이 되고 자랑은 다시 동기가 된다.
5. **모든 인터랙션은 촉감이 있어야 한다** — 탭에는 press 피드백, 화면 전환에는
   enter 애니메이션, 숫자에는 카운트업, 모달에는 슬라이드업. 하드 컷 금지.
   (컨벤션: `specs/ui-motion/spec.md`)

## Tech Stack

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS + `src/index.css` 커스텀 유틸리티 (NBA 프리미엄 팔레트)
- Zustand (`src/store/useGameStore.ts`) + localStorage persistence (`src/utils/storage.ts`)
- 3D 덩크 게임: @react-three/fiber (r3f) — `src/game3d/`
- 운동 가이드 애니메이션: Phaser 3 — `src/game/` (레거시 2D 코트 씬 포함)
- PWA: vite-plugin-pwa (iPhone 홈 화면 설치 대상)

## Project Conventions

- 화면 = `src/screens/<Name>Screen.tsx`, 라우팅은 zustand `screen` 상태 하나로
  (`AppScreen` union). react-router 없음.
- 재사용 UI = `src/components/`, 도메인 계산 = `src/utils/`.
- 텍스트는 한국어가 1급 시민. 영문은 eyebrow/장식 라벨에만.
- 모바일 우선(430px 프레임), 데스크톱은 폰 프레임 미리보기(`.app-stage`).
- iOS safe-area: 화면 래퍼에 `.safe-top .safe-bottom` 한 번만 (중첩 금지).
- 커밋 메시지: conventional commits (feat/fix/chore).

## Domain Glossary

| 용어 | 의미 |
|---|---|
| Vertical (수직점프) | 제자리 점프 최고 도달 상승 높이(cm). 앱의 핵심 지표 |
| Standing Reach | 제자리 손끝 높이. `estimateStandingReach(height, armLength)` |
| Gap | 덩크에 필요한 수직점프 − 현재 수직점프. 0이 되면 현실 덩크 가능 |
| Dunk Dictionary | 15가지 덩크 도감. 게임 내 반복 성공으로 잠금 해제 |
| Session | 오프라인 훈련 1회 기록 (종류/시간/점프측정/메모) |
| Prescription | 게임 런 결과로부터 생성되는 맞춤 훈련 처방 (`prescription.ts`) |
