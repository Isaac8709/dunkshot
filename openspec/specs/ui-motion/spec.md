# UI & Motion Specification

## Purpose
"모든 인터랙션은 촉감이 있어야 한다"는 사상의 구체 규칙. 모든 화면·컴포넌트는
이 스펙을 따라야 하며, UI/UX 감사는 이 문서를 기준으로 한다.

## Design Language

- 팔레트: 미드나잇 다크(`--bg-deep`~`--bg-card`) 위에 오렌지(`#FF6B2C`)/
  골드(`#FFB627`) 액센트. 정의는 `src/index.css` `:root` + tailwind config.
- 타이포: 본문 Noto Sans KR, 디스플레이 Bebas Neue/Oswald, 스코어보드
  Press Start 2P.
- 표면 위계: 화면 배경 `.arena-bg` → 카드 `.card-dark`(기본) /
  `.card-premium`(강조 1개 이내) → 칩 `.chip-*`.
- 버튼 위계: 주 액션 `.btn-neon|.btn-primary` → 보조 `.btn-ghost` →
  아이콘 버튼(뒤로/닫기)은 44px 터치 타깃 + `.press`.

## Requirements

### Requirement: 화면 진입 모션
The system SHALL 모든 화면 전환에 `.screen-enter`(fade+slide+scale)를
적용하고, 수직 스크롤 콘텐츠 목록에는 `.stagger-children`으로 순차 등장을
적용한다.

#### Scenario: 화면 이동
- **WHEN** zustand `screen`이 바뀌면
- **THEN** `ScreenTransition`이 key 교체로 enter 애니메이션을 재생한다

### Requirement: 모달/시트 모션
The system SHALL 모든 모달·바텀시트에 백드롭 페이드인(`.screen-fade-in`)과
컨텐츠 슬라이드업/팝인 애니메이션을 적용한다. 하드 컷 등장 금지.

#### Scenario: 닫기 어포던스
- **WHEN** 모달이 떠 있으면
- **THEN** 백드롭 탭으로 닫을 수 있고(파괴적이지 않은 모달에 한함), 명시적
  닫기 버튼(✕)은 aria-label을 가진다. 작성 중 데이터가 있는 시트는 백드롭
  탭 닫기를 생략할 수 있다(오입력 보호).

### Requirement: 탭 피드백
The system SHALL 모든 탭 가능한 요소에 press 피드백(`.press`, `.btn-*`의
active scale, 또는 `.tap-ripple`)을 제공한다. 아이콘 전용 버튼(뒤로/닫기/설정)
은 aria-label을 가진다.

### Requirement: 숫자 연출
The system SHALL 대시보드성 지표(스탯 타일, 진행률 %, 게임오버 최종 점수)에
카운트업(`useCountUp`)을 적용한다. 실시간으로 빠르게 변하는 인게임 점수는
펄스 강조로 대신한다.

### Requirement: 성능 원칙
The system SHALL 연속 애니메이션에 transform/opacity(GPU 합성 속성)만 쓰고,
JS 구동 애니메이션은 `setInterval`이 아닌 `requestAnimationFrame`을 쓴다.

### Requirement: 접근성 & 모션 감소
The system SHALL `prefers-reduced-motion: reduce`에서 CSS 애니메이션/전환을
비활성화하고(전역 media query), rAF 기반 연출(카운트업)도 이를 존중해 즉시
최종값을 보여준다. 터치 타깃은 최소 44×44px.

### Requirement: 레이아웃 규칙
The system SHALL iOS safe-area 패딩을 화면 래퍼에서 한 번만 적용하고(모달
시트는 자체 `.safe-bottom` 허용 — 래퍼 밖 fixed이므로 중첩 아님), 목록이
비어있을 수 있는 모든 영역에 빈 상태(empty state) 안내를 제공한다.
