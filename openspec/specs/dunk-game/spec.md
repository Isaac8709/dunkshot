# Dunk Game Specification (3D)

## Purpose
60초 타임어택 3D 덩크 시뮬레이터. 현실에서 아직 못 하는 덩크를 미리 체험시켜
훈련 동기를 만들고, 게임 결과는 훈련 처방(`prescription.ts`)과 도감 잠금 해제로
되먹임된다.

## Requirements

### Requirement: 조작 체계
The system SHALL 방향키(또는 모바일 D-패드)로 이동, SPACE(또는 덩크 버튼)로
슛을 트리거하며, 보조키 조합(A/S/D/W/Q/E/…)+SPACE로 15가지 덩크를 선택한다.

#### Scenario: 덩크 사거리 밖 슈팅
- **WHEN** 선택된 덩크의 `maxDistance` 밖에서 슛을 트리거하면
- **THEN** 덩크 대신 점프슛으로 전환되고, 3점 라인 밖이면 3점슛으로 판정한다

### Requirement: 프리스타일 급 덩크 연출
The system SHALL 각 덩크를 고유 키프레임 안무(`dunkChoreography.ts`)로
렌더하고, 다음 연출 요소를 포함한다: 도움닫기 질주 + 어택 드리블, 개더 스텝
팔 와인드업, 그랩 순간 슬로우모션, 성공 시 카메라 셰이크 + FOV 펀치,
Perfect/고난도 성공 시 림 행잉, 미스 시 앞 림 클랭.

#### Scenario: 판정과 점수
- **WHEN** 슛이 해결되면 (`resolveShot`: 거리 + 난이도 + 타이밍)
- **THEN** perfect/good/normal/miss 티어와 S~D 등급, 점수를 산출하고 HUD에
  코칭 피드백(훈련 큐 포함)을 보여준다

#### Scenario: 콤보
- **WHEN** 4초 안에 연속 성공하면
- **THEN** 콤보가 누적되고 점수 보너스(최대 +50%)가 붙으며, 콤보 미터가
  잔여 시간을 시각화한다

### Requirement: 카메라
The system SHALL 플레이어와 림이 항상 함께 프레임에 들어오도록 추적한다 —
사이드/후방 이동 시 자동 달리 아웃, 덩크 중에는 슬램을 잡는 스웁 앵글.

### Requirement: 도감 잠금 해제 피드백
The system SHALL 덩크 반복 성공으로 해제 조건이 충족되면 즉시 게임 화면 위에
잠금 해제 토스트를 띄운다.

#### Scenario: 게임 종료
- **WHEN** 60초가 끝나면
- **THEN** 점수/덩크 수/최대 콤보/퍼펙트 수를 담은 게임오버 모달을 띄우고
  재시작 또는 훈련 화면으로 유도한다 (게임→훈련 되먹임)
