# Change: 전 화면 UI/UX·모션 전수 감사 및 보완

## Why
`specs/ui-motion/spec.md` 기준으로 8개 화면 + 4개 컴포넌트를 전수 감사한 결과,
모달 하드 컷 등장(4곳), press 피드백 누락(뒤로가기 6곳), stagger 미적용(3화면),
setInterval 기반 콤보 미터, 카운트업 비일관, aria-label 누락, 빈 상태 누락
(성장 그래프) 등 스펙 위반이 발견됐다.

## What Changes
- **modal-motion**: ExerciseModal / TrainingScreen 로깅 시트 / DunkDict 상세
  시트 / Community 작성 시트 / GameScreen 게임오버 모달에 백드롭 페이드 +
  컨텐츠 슬라이드업(or 팝인) 적용. index.css에 `.sheet-up` 유틸리티 추가.
- **press-feedback**: Setup/Training/Progress/DunkDict/Community 뒤로가기
  버튼에 `.press` + `aria-label` 부여. ExerciseModal 닫기 버튼 aria-label +
  44px 타깃.
- **stagger**: ProgressScreen 본문, CommunityScreen 피드, TrainingScreen
  plan 뷰에 `.stagger-children` 적용.
- **combo-meter-raf**: GameScreen 콤보 미터를 setInterval(50ms) →
  requestAnimationFrame으로 교체.
- **count-up**: ProgressScreen 진행률 %와 게임오버 최종 점수에 `useCountUp`
  적용. `useCountUp`이 prefers-reduced-motion을 존중하도록 수정.
- **empty-state**: ProgressScreen 성장 그래프에 데이터 부족 시 빈 상태 추가.
- **modal-affordance**: ExerciseModal·DunkDict 상세 시트에 백드롭 탭 닫기
  (읽기 전용 모달만). 작성 시트(Training 로깅, Community 작성)는 오입력
  보호를 위해 백드롭 닫기 제외 — 스펙의 예외 조항.
- **safe-area**: SetupScreen 이중 safe-bottom 제거.

## Impact
- Affected specs: `ui-motion` (신규 문서화 — 기존 동작의 성문화 + 상기 보완)
- Affected code: `src/index.css`, `src/utils/useCountUp.ts`, 8개 스크린,
  `src/components/ExerciseModal.tsx`
- 도메인 로직/저장 포맷 변경 없음 (순수 프레젠테이션)
