import type { UserProfile, DunkRequirement, TrainingPhase } from '@/types'

const RIM_HEIGHT = 305  // NBA 기준 305cm
const DUNK_CLEARANCE = 15  // 림 위로 손가락 끝이 넘어야 하는 여유

export function calculateDunkRequirement(profile: UserProfile): DunkRequirement {
  const requiredReach = RIM_HEIGHT + DUNK_CLEARANCE
  const requiredVertical = Math.max(0, requiredReach - profile.standingReach)
  const gap = Math.max(0, requiredVertical - profile.currentVertical)

  // 평균적으로 수직 점프 1cm 향상에 약 2-3주 꾸준한 훈련 필요
  const estimatedMonths = gap <= 0 ? 0 : Math.ceil((gap * 2.5) / 4.3)

  return {
    rimHeight: RIM_HEIGHT,
    requiredReach,
    standingReach: profile.standingReach,
    requiredVertical,
    currentVertical: profile.currentVertical,
    gap,
    estimatedMonths: Math.max(1, estimatedMonths)
  }
}

export function estimateStandingReach(height: number, armLength: number): number {
  // 스탠딩 리치 = 키 × 1.33 (일반적 추정치)
  // 팔 길이를 알면 더 정확하게: 키 + 팔 길이 + 어깨 너비/2 정도
  if (armLength > 0) {
    return Math.round(height + armLength * 0.9)
  }
  return Math.round(height * 1.33)
}

export function getProgressPercent(req: DunkRequirement): number {
  if (req.gap <= 0) return 100
  const totalNeeded = req.requiredVertical - 0  // 0에서 시작
  const achieved = req.currentVertical
  return Math.min(100, Math.round((achieved / req.requiredVertical) * 100))
}

export function generateTrainingPlan(profile: UserProfile, req: DunkRequirement): TrainingPhase[] {
  const phases: TrainingPhase[] = []

  // Phase 1: 기초 체력 (4-6주)
  phases.push({
    phase: 1,
    name: '기초 다지기',
    weeks: 6,
    description: '관절 강화, 유연성 향상, 기본 체력 구축. 부상 없이 오랫동안 훈련하기 위한 토대.',
    focus: ['발목 강화', '무릎 안정성', '고관절 유연성', '코어 강화'],
    weeklyPlan: [
      {
        day: 'mon',
        workoutType: 'strength',
        isRest: false,
        exercises: [
          { name: 'Bodyweight Squat', nameKo: '맨몸 스쿼트', sets: 4, reps: '15', notes: '무릎이 발끝 방향으로 향하도록', videoQuery: '맨몸 스쿼트 올바른 자세 수직점프 향상', animType: 'squat' },
          { name: 'Calf Raise', nameKo: '카프 레이즈', sets: 4, reps: '20', notes: '계단 끝에 발 앞꿈치만 걸치고', videoQuery: '카프 레이즈 제대로 하는 법 종아리 강화', animType: 'calf_raise' },
          { name: 'Glute Bridge', nameKo: '글루트 브릿지', sets: 3, reps: '15', videoQuery: '글루트 브릿지 힙업 엉덩이 운동 올바른 자세', animType: 'bridge' },
          { name: 'Ankle Circles', nameKo: '발목 원운동', sets: 2, reps: '20 each', notes: '시계/반시계 방향', videoQuery: '발목 가동성 향상 스트레칭 운동 방법', animType: 'ankle' },
        ]
      },
      {
        day: 'tue',
        workoutType: 'stretching',
        isRest: false,
        exercises: [
          { name: 'Hip Flexor Stretch', nameKo: '고관절 굴근 스트레칭', sets: 3, duration: '30초', notes: '런지 자세에서 30초 유지', videoQuery: '고관절 굴근 스트레칭 런지 자세 점프력', animType: 'hip_flexor' },
          { name: 'Hamstring Stretch', nameKo: '햄스트링 스트레칭', sets: 3, duration: '30초', videoQuery: '햄스트링 스트레칭 올바른 방법 유연성', animType: 'hamstring' },
          { name: 'Achilles Stretch', nameKo: '아킬레스 스트레칭', sets: 3, duration: '30초', videoQuery: '아킬레스건 스트레칭 방법 부상 예방 종아리', animType: 'achilles' },
          { name: 'Pigeon Pose', nameKo: '비둘기 자세', sets: 2, duration: '45초', videoQuery: '비둘기 자세 pigeon pose 고관절 스트레칭', animType: 'pigeon' },
        ]
      },
      {
        day: 'wed',
        workoutType: 'plyometric',
        isRest: false,
        exercises: [
          { name: 'Jump Rope', nameKo: '줄넘기', sets: 5, duration: '1분', notes: '발목 힘 기르기', videoQuery: '줄넘기 올바른 방법 발목 강화 점프력 향상', animType: 'jump_rope' },
          { name: 'Standing Broad Jump', nameKo: '제자리 멀리뛰기', sets: 4, reps: '5', notes: '착지 시 무릎 쿠션 활용', videoQuery: '제자리 멀리뛰기 플라이오메트릭 훈련법', animType: 'broad_jump' },
          { name: 'Tuck Jump', nameKo: '무릎 당기며 점프', sets: 3, reps: '8', videoQuery: 'tuck jump 무릎 당기며 점프 수직점프 훈련', animType: 'tuck_jump' },
        ]
      },
      { day: 'thu', workoutType: 'rest', isRest: true, exercises: [] },
      {
        day: 'fri',
        workoutType: 'strength',
        isRest: false,
        exercises: [
          { name: 'Split Squat', nameKo: '스플릿 스쿼트', sets: 3, reps: '12 each', notes: '뒷발을 의자에 올리면 불가리안 스플릿', videoQuery: '불가리안 스플릿 스쿼트 올바른 자세 하체 운동', animType: 'split_squat' },
          { name: 'Single Leg Calf Raise', nameKo: '한 발 카프 레이즈', sets: 3, reps: '15 each', videoQuery: '한발 카프 레이즈 종아리 강화 운동', animType: 'calf_raise' },
          { name: 'Core Plank', nameKo: '플랭크', sets: 3, duration: '45초', videoQuery: '플랭크 올바른 자세 코어 운동 방법', animType: 'plank' },
          { name: 'Hip Hinge', nameKo: '힙 힌지', sets: 3, reps: '12', videoQuery: '힙 힌지 운동 방법 고관절 데드리프트 자세', animType: 'hip_hinge' },
        ]
      },
      {
        day: 'sat',
        workoutType: 'basketball',
        isRest: false,
        exercises: [
          { name: 'Ball Handling Drills', nameKo: '볼 핸들링', sets: 1, duration: '15분', videoQuery: '농구 볼핸들링 드릴 기초 훈련 방법', animType: 'ball_handle' },
          { name: 'Layup Practice', nameKo: '레이업 연습', sets: 1, reps: '20 each side', videoQuery: '농구 레이업 올바른 자세 기초 훈련', animType: 'layup' },
          { name: 'Reach for Rim', nameKo: '림 터치 시도', sets: 5, reps: '3 jumps', notes: '현재 높이에서 최대한 높이', videoQuery: '농구 림 터치 수직점프 연습 점프력', animType: 'rim_reach' },
        ]
      },
      { day: 'sun', workoutType: 'rest', isRest: true, exercises: [] },
    ]
  })

  // Phase 2: 폭발력 개발 (6-8주)
  phases.push({
    phase: 2,
    name: '폭발력 키우기',
    weeks: 8,
    description: '플라이오메트릭 훈련으로 순간 폭발력과 수직 점프력을 집중적으로 향상.',
    focus: ['수직 점프 향상', '반응 속도', '탄성 근력', '점프 타이밍'],
    weeklyPlan: [
      {
        day: 'mon',
        workoutType: 'strength',
        isRest: false,
        exercises: [
          { name: 'Barbell Squat', nameKo: '바벨 스쿼트', sets: 4, reps: '6', notes: '무게: 체중의 70-80%', weight: Math.round(profile.weight * 0.75), videoQuery: '바벨 스쿼트 올바른 자세 하체 훈련 점프력', animType: 'barbell_squat' },
          { name: 'Romanian Deadlift', nameKo: '루마니안 데드리프트', sets: 3, reps: '8', weight: Math.round(profile.weight * 0.7), videoQuery: '루마니안 데드리프트 RDL 올바른 자세 햄스트링', animType: 'rdl' },
          { name: 'Leg Press', nameKo: '레그 프레스', sets: 3, reps: '10', videoQuery: '레그 프레스 올바른 자세 하체 운동 방법', animType: 'leg_press' },
          { name: 'Standing Calf Raise (Weighted)', nameKo: '웨이티드 카프 레이즈', sets: 4, reps: '15', videoQuery: '머신 카프 레이즈 종아리 근육 강화 방법', animType: 'calf_raise' },
        ]
      },
      {
        day: 'tue',
        workoutType: 'plyometric',
        isRest: false,
        exercises: [
          { name: 'Depth Jump', nameKo: '뎁스 점프', sets: 4, reps: '5', notes: '50cm 박스에서 내려서 즉시 최대 점프', videoQuery: 'depth jump 뎁스 점프 플라이오메트릭 수직점프 향상', animType: 'depth_jump' },
          { name: 'Box Jump', nameKo: '박스 점프', sets: 4, reps: '5', notes: '60cm 박스 목표', videoQuery: 'box jump 박스 점프 폭발력 훈련법 자세', animType: 'box_jump' },
          { name: 'Squat Jump', nameKo: '스쿼트 점프', sets: 3, reps: '8', notes: '스쿼트 내려가자마자 폭발적으로 점프', videoQuery: 'squat jump 스쿼트 점프 수직점프 향상 방법', animType: 'squat_jump' },
        ]
      },
      {
        day: 'wed',
        workoutType: 'stretching',
        isRest: false,
        exercises: [
          { name: 'Foam Rolling', nameKo: '폼 롤링', sets: 1, duration: '15분', notes: '허벅지, 종아리, IT밴드', videoQuery: '폼롤러 마사지 올바른 방법 근육 회복 하체', animType: 'foam_roll' },
          { name: 'Dynamic Warm-up', nameKo: '동적 스트레칭', sets: 1, duration: '15분', videoQuery: '동적 스트레칭 워밍업 운동 전 루틴 방법', animType: 'dynamic' },
          { name: 'Yoga Flow', nameKo: '요가 플로우', sets: 1, duration: '20분', videoQuery: '운동선수 요가 회복 스트레칭 루틴', animType: 'yoga' },
        ]
      },
      { day: 'thu', workoutType: 'rest', isRest: true, exercises: [] },
      {
        day: 'fri',
        workoutType: 'plyometric',
        isRest: false,
        exercises: [
          { name: 'Single Leg Hop', nameKo: '한 발 연속 점프', sets: 3, reps: '10 each', notes: '앞으로 이동하며 한 발로 연속 점프', videoQuery: 'single leg hop 한발 점프 플라이오메트릭 훈련법', animType: 'single_hop' },
          { name: 'Lateral Bound', nameKo: '측면 바운드', sets: 3, reps: '10 each', videoQuery: 'lateral bound 측면 바운드 폭발력 훈련법', animType: 'lateral_bound' },
          { name: 'Hurdle Jump', nameKo: '허들 점프', sets: 3, reps: '8', notes: '60cm 허들 5개 연속', videoQuery: '허들 점프 연속 플라이오메트릭 훈련', animType: 'hurdle' },
          { name: 'Ankle Bounce', nameKo: '발목 바운스', sets: 4, reps: '20', notes: '무릎 거의 안 굽히고 발목만으로 점프', videoQuery: '발목 bounce 탄성 점프 훈련 수직점프 향상', animType: 'ankle_bounce' },
        ]
      },
      {
        day: 'sat',
        workoutType: 'basketball',
        isRest: false,
        exercises: [
          { name: 'Running Start Layup → Dunk Attempt', nameKo: '달리면서 림 터치', sets: 1, reps: '20', notes: '레이업 폼으로 최대한 높이', videoQuery: '덩크슛 도움닫기 타이밍 연습 림 터치', animType: 'approach_jump' },
          { name: 'Approach Jump Practice', nameKo: '어프로치 점프 연습', sets: 5, reps: '5', notes: '3-4걸음 도움닫기 후 최대 점프', videoQuery: '농구 점프 폼 교정 어프로치 도움닫기', animType: 'approach_jump' },
          { name: 'Vertical Jump Measurement', nameKo: '수직 점프 측정', sets: 1, reps: '5', notes: '벽에 최대한 높이 손바닥 터치 → 높이 기록', videoQuery: '수직 점프력 측정 방법 vertical jump test', animType: 'vert_test' },
        ]
      },
      { day: 'sun', workoutType: 'rest', isRest: true, exercises: [] },
    ]
  })

  // Phase 3: 덩크 완성 (목표 도달 시까지)
  phases.push({
    phase: 3,
    name: '덩크슛 완성',
    weeks: 0,  // 목표 달성 시까지
    description: '실제 덩크슛 시도와 함께 고강도 훈련 유지. 한 번 해냈으면 안정적으로 반복.',
    focus: ['실전 덩크 시도', '타이밍 완성', '멘탈 훈련', '다양한 덩크 연습'],
    weeklyPlan: [
      {
        day: 'mon',
        workoutType: 'strength',
        isRest: false,
        exercises: [
          { name: 'Power Clean', nameKo: '파워 클린', sets: 4, reps: '4', notes: '전신 폭발력 훈련의 정점', videoQuery: 'power clean 파워 클린 올림픽 역도 폭발력 자세', animType: 'power_clean' },
          { name: 'Jump Squat (Heavy)', nameKo: '점프 스쿼트', sets: 4, reps: '5', notes: '체중의 30% 무게 들고 점프', videoQuery: 'weighted jump squat 웨이티드 점프 스쿼트 고급', animType: 'squat_jump' },
          { name: 'Plyometric Push-up', nameKo: '플라이오메트릭 푸시업', sets: 3, reps: '8', videoQuery: '플라이오메트릭 푸시업 clap push up 폭발력 자세', animType: 'plyo_pushup' },
        ]
      },
      {
        day: 'tue',
        workoutType: 'basketball',
        isRest: false,
        exercises: [
          { name: 'Dunk Attempt', nameKo: '실제 덩크 시도', sets: 1, reps: '최대한', notes: '10번 시도 후 성공/실패 기록', videoQuery: '덩크슛 처음 성공하는 방법 점프 타이밍 팁', animType: 'dunk_attempt' },
          { name: 'Approach Angle Practice', nameKo: '도움닫기 각도 연습', sets: 3, reps: '10', videoQuery: '덩크슛 도움닫기 각도 점프 타이밍 폼', animType: 'approach_jump' },
          { name: 'One-Hand Tip Practice', nameKo: '원핸드 팁 연습', sets: 3, reps: '10', videoQuery: '원핸드 덩크 팁인 연습법 농구 점프', animType: 'tip_dunk' },
        ]
      },
      {
        day: 'wed',
        workoutType: 'plyometric',
        isRest: false,
        exercises: [
          { name: 'Depth Jump (High Box)', nameKo: '고박스 뎁스 점프', sets: 4, reps: '5', notes: '75cm 박스', videoQuery: '고박스 뎁스 점프 75cm 수직점프 향상', animType: 'depth_jump' },
          { name: 'Reactive Box Jump', nameKo: '리액티브 박스 점프', sets: 4, reps: '5', videoQuery: 'reactive box jump 반응 속도 폭발력 훈련', animType: 'box_jump' },
          { name: 'Continuous Vertical Jump', nameKo: '연속 수직 점프', sets: 3, reps: '10', videoQuery: '연속 수직 점프 최대 점프력 훈련', animType: 'vert_test' },
        ]
      },
      { day: 'thu', workoutType: 'rest', isRest: true, exercises: [] },
      {
        day: 'fri',
        workoutType: 'basketball',
        isRest: false,
        exercises: [
          { name: 'Dunk Attempt', nameKo: '덩크 시도', sets: 1, reps: '최대한', videoQuery: '덩크슛 실전 연습 팁 NBA 점프', animType: 'dunk_attempt' },
          { name: 'Game Speed Moves', nameKo: '게임 속도 동작', sets: 3, reps: '10', videoQuery: '농구 게임 스피드 드릴 레이업 훈련', animType: 'layup' },
        ]
      },
      {
        day: 'sat',
        workoutType: 'strength',
        isRest: false,
        exercises: [
          { name: 'Squat', nameKo: '스쿼트', sets: 5, reps: '5', notes: '최대 무게 도전', videoQuery: '바벨 스쿼트 최대 중량 5x5 파워리프팅 자세', animType: 'barbell_squat' },
          { name: 'Calf Raise Complex', nameKo: '카프 레이즈 복합세트', sets: 4, reps: '25', videoQuery: '카프 레이즈 고반복 종아리 근지구력 훈련', animType: 'calf_raise' },
        ]
      },
      { day: 'sun', workoutType: 'rest', isRest: true, exercises: [] },
    ]
  })

  return phases
}

export function getMotivationalMessage(gap: number): string {
  if (gap <= 0) return '🏀 당신은 이미 덩크슛을 할 수 있습니다! 지금 당장 코트로 가세요!'
  if (gap <= 10) return '🔥 불과 10cm! 한 달의 집중 훈련으로 충분합니다!'
  if (gap <= 20) return '💪 20cm 차이. 3개월이면 됩니다. 시작이 반입니다!'
  if (gap <= 30) return '⚡ 30cm 차이. 6개월간 꾸준히 하면 반드시 해냅니다!'
  if (gap <= 50) return '🎯 1년의 여정이 시작됩니다. 이 게임이 끝날 때 당신은 달라집니다!'
  return '🌟 긴 여정이지만, 아들 앞에서 덩크슛 하는 그 순간을 상상하세요. 반드시 됩니다!'
}
