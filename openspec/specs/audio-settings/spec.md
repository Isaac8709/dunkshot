# Audio & Settings Specification

## Purpose
BGM/효과음 제어. 사용자가 보유한 음원을 쓸 수 있게 하되, 없어도 저작권-프리
신스 BGM으로 동작한다.

## Requirements

### Requirement: 오디오 소스 전략
The system SHALL `public/audio/dunkshot.mp3`가 존재하면 그것을 BGM으로
재생하고, 없으면 Web Audio 신스 BGM으로 폴백한다. BGM은 기본 음소거로
시작한다(사용자 명시 해제 필요 — 자동재생 금지).

#### Scenario: 설정 시트
- **WHEN** 메뉴의 ⚙ 를 탭하면
- **THEN** BGM/SFX 각각의 음소거 토글과 볼륨 슬라이더를 담은 바텀시트가
  올라오고, 변경은 즉시 적용·영속된다 (`audioManager`)

### Requirement: 지연 초기화
The system SHALL AudioContext를 첫 사용자 제스처 이후에만 생성한다
(iOS 자동재생 정책 준수, import 시점 부작용 금지).
