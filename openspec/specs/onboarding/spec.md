# Onboarding Specification

## Purpose
첫 실행에서 사용자를 아레나로 초대하고(스플래시), 신체 정보를 받아 "덩크까지 남은
갭"을 계산해 보여준다(셋업). 온보딩의 목표는 데이터 수집이 아니라 **동기 점화**다.

## Requirements

### Requirement: Splash 시퀀스
The system SHALL 앱 시작 시 코트→공→타이틀→인용구→입장 프롬프트로 이어지는
5단계 시네마틱 스플래시를 재생한다. 이승환 '덩크슛' 헌정 문구를 포함한다.

#### Scenario: 재방문 사용자
- **WHEN** 저장된 프로필이 있는 상태에서 스플래시를 탭하면
- **THEN** 셋업을 건너뛰고 메인 메뉴로 즉시 이동한다

#### Scenario: 신규 사용자
- **WHEN** 프로필이 없는 상태에서 스플래시를 탭하면
- **THEN** 셋업 화면으로 이동한다

### Requirement: 3단계 프로필 셋업
The system SHALL 아바타/이름/나이 → 키/몸무게/팔길이 → 현재 수직점프의 3단계로
프로필을 수집하고, 각 단계는 뒤로 갈 수 있어야 한다.

#### Scenario: 덩크 분석 미리보기
- **WHEN** 3단계에서 수직점프를 입력하면
- **THEN** 스탠딩 리치, 필요 도달 높이, 진행률 %, 남은 갭(cm)을 계산해 즉시
  분석 카드로 보여준다 (`calculateDunkRequirement`)

#### Scenario: 완료
- **WHEN** 완료 버튼을 누르면
- **THEN** 프로필이 localStorage에 저장되고 메인 메뉴로 이동한다
