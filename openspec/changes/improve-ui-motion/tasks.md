# Tasks — improve-ui-motion

## 1. Motion primitives
- [x] 1.1 index.css: `.sheet-up` 시트 등장 키프레임 추가
- [x] 1.2 index.css: `.stagger-children` 9번째 이후 자식 tail delay 추가
- [x] 1.3 useCountUp: prefers-reduced-motion 시 즉시 최종값

## 2. Modal/sheet motion + affordance
- [x] 2.1 ExerciseModal: 백드롭 페이드 + sheet-up + 백드롭 탭 닫기 + 닫기 aria/44px
- [x] 2.2 TrainingScreen 로깅 시트: 페이드 + sheet-up (+백드롭 닫기는 오입력 보호로 제외)
- [x] 2.3 DunkDictScreen 상세 시트: 페이드 + sheet-up
- [x] 2.4 CommunityScreen 작성 시트: 페이드 + sheet-up (+백드롭 닫기 제외)
- [x] 2.5 GameScreen 게임오버 모달: 페이드 + pop-in

## 3. Tap feedback + a11y
- [x] 3.1 뒤로가기 버튼 5곳(.press + aria-label + 44px): Setup/Training/Progress/DunkDict/Community
- [x] 3.2 시트 닫기 버튼 aria-label + 44px: Training/Community/ExerciseModal
- [x] 3.3 SetupScreen 아바타 버튼 press + aria-label

## 4. Entrance stagger
- [x] 4.1 ProgressScreen 본문 stagger-children
- [x] 4.2 CommunityScreen 피드 stagger-children (필터 변경 시 재생: key={filterType})
- [x] 4.3 TrainingScreen today/plan 뷰 stagger-children
- [x] 4.4 DunkDictScreen 목록 stagger-children (필터 변경 시 재생)

## 5. Numbers & performance
- [x] 5.1 GameScreen 콤보 미터 setInterval(50ms) → requestAnimationFrame
- [x] 5.2 ProgressScreen 진행률 %·현재 점프력 카운트업
- [x] 5.3 GameScreen 게임오버 최종 점수 카운트업 (1.2s ticker)

## 6. Layout & consistency
- [x] 6.1 SetupScreen 이중 safe-bottom 제거
- [x] 6.2 GameScreen 하단 덩크/키보드 버튼 iOS 홈 인디케이터 회피
- [x] 6.3 게임오버 보조 버튼 btn-ghost로 위계 통일
- [x] 6.4 ProgressScreen 성장 그래프 빈 상태 추가

## 7. Verification
- [x] 7.1 tsc --noEmit 통과
- [x] 7.2 vite build 통과
