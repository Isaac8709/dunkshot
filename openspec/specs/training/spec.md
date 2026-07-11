# Training Specification

## Purpose
앱의 본체. 개인화된 3단계 훈련 계획을 제공하고 오프라인 훈련을 기록하게 한다.
게임은 이 루프를 돌리기 위한 보상 장치다.

## Requirements

### Requirement: 개인화 훈련 계획
The system SHALL 프로필과 덩크 갭으로부터 3단계 훈련 페이즈(주차 구성, 운동
목록 포함)를 생성한다 (`generateTrainingPlan`).

#### Scenario: 운동 가이드
- **WHEN** 운동 항목의 ▶ 를 탭하면
- **THEN** Phaser 스틱피겨 애니메이션 + 핵심 포인트(팁) + 세트/렙 +
  유튜브 검색 링크를 담은 운동 모달을 띄운다

### Requirement: 훈련 세션 기록
The system SHALL 훈련 종류/시간/컨디션/수직점프 측정값/메모를 기록하는 로깅
모달을 제공하고, 저장 시 세션 목록과 진행률 통계에 즉시 반영한다.

#### Scenario: 커뮤니티 자동 공유
- **WHEN** 세션 저장 시 공유 옵션이 켜져 있으면
- **THEN** 커뮤니티 피드에 훈련 인증 포스트를 생성한다

### Requirement: 게임 결과 기반 처방
The system SHALL 게임 런 결과(시도한 덩크, 실패 패턴)로부터 맞춤 훈련 처방을
생성한다 (`prescribeFromRun`).
