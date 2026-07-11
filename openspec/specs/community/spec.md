# Community Specification

## Purpose
Strava 스타일 훈련 인증 피드. 아빠와 아들, 그리고 같은 꿈을 가진 사람들의 기록이
서로의 동기가 된다. (현재 로컬 전용 — 서버 동기화는 미래 범위)

## Requirements

### Requirement: 피드
The system SHALL 포스트(훈련 인증/성장/덩크 달성/마일스톤)를 타입 필터와 함께
시간순 피드로 보여주고, 포스트가 없으면 빈 상태를 안내한다.

#### Scenario: 상호작용
- **WHEN** 좋아요/댓글을 남기면
- **THEN** 즉시 UI에 반영되고 localStorage에 영속된다

### Requirement: 작성
The system SHALL 타입 선택 + 본문 + (선택) 측정값을 담은 작성 시트를 제공한다.
훈련 세션 저장·덩크 달성 시 자동 포스트도 생성될 수 있다.
