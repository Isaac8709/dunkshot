# Dunk Dictionary Specification

## Purpose
15가지 덩크 도감. 수집욕(잠금 해제)과 학습(각 덩크의 유래·조작법·필요 점프력)을
결합한 장기 진행 축.

## Requirements

### Requirement: 도감 목록
The system SHALL 15가지 덩크를 카테고리(basic/power/acrobatic/legendary)
필터와 함께 목록으로 보여주고, 각 항목에 난이도 별점·잠금 상태를 표시한다.

#### Scenario: 상세 보기
- **WHEN** 덩크 카드를 탭하면
- **THEN** 설명, 게임 조작법, 잠금 해제 조건, 필요 수직점프, 유명 사례
  (NBA 선수)를 담은 상세 시트를 슬라이드업으로 띄운다

### Requirement: 잠금 해제 진행
The system SHALL 게임 내 반복 성공(예: "양손 덩크 5회")으로 다음 덩크를
해제하고, 해제율을 진행 바로 보여준다. `unlockedDunkIds`는 localStorage에
영속된다.
