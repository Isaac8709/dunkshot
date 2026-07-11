# Progress Specification

## Purpose
"덩크까지 얼마나 왔나"를 한눈에. 수직점프 성장 그래프, 훈련 캘린더, 마일스톤으로
장기 동기를 유지시킨다.

## Requirements

### Requirement: 진행률 대시보드
The system SHALL 덩크 목표 대비 진행률 링(SVG), 현재/목표 수직점프,
누적 향상치(+Ncm)를 보여준다.

#### Scenario: 성장 그래프
- **WHEN** 수직점프 측정값이 2회 이상 기록되어 있으면
- **THEN** 시간순 막대 그래프로 성장을 보여주고 최신 값을 강조한다
- **WHEN** 측정값이 1회 이하면
- **THEN** 빈 상태 안내("측정 기록이 쌓이면 그래프가 나타나요")를 보여준다

### Requirement: 훈련 캘린더
The system SHALL 월 단위 캘린더에 훈련한 날을 하이라이트하고 총 세션 수/총
시간/연속 스트릭을 집계한다.

### Requirement: 마일스톤
The system SHALL 갭 구간별 마일스톤 체크리스트(림 터치, 백보드 터치 등)를
제공해 최종 목표(덩크)까지의 중간 성취를 만든다.
