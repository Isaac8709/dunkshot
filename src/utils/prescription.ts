/**
 * Prescription engine — converts a GameRunResult into a recommended workout
 * for the next session. Pure functions, no I/O.
 *
 * The rules below are intentionally simple and explainable. Each rule maps
 * an observed weakness (low score on a specific dunk family, frequent misses
 * on a category, low max-combo, etc.) to concrete corrective exercises.
 *
 * The intent is real, prescribable training advice that a player can take
 * outside the game — not pure gamification fluff.
 */
import type {
  GameRunResult,
  PrescribedWorkout,
  ExerciseTemplate,
} from '@/types'

/** Family classification of each dunk, used by the engine to group failures. */
type DunkFamily = 'power' | 'wrist' | 'spin' | 'leg' | 'coordination' | 'distance'

const DUNK_FAMILY: Record<string, DunkFamily> = {
  basic_two:      'power',
  basic_one:      'power',
  putback:        'coordination',
  alleyoop:       'coordination',
  tomahawk:       'power',
  reverse:        'spin',
  tip_dunk:       'coordination',
  windmill:       'wrist',
  cradle:         'wrist',
  three_sixty:    'spin',
  chaser:         'distance',
  double_pump:    'coordination',
  between_legs:   'leg',
  eastbay:        'leg',
  freethrow_line: 'distance',
}

/** Family → exercise pool. Each item is a complete prescription block. */
const FAMILY_RX: Record<DunkFamily, ExerciseTemplate[]> = {
  power: [
    { name: 'Back Squat', nameKo: '백 스쿼트', sets: 4, reps: '5', weight: 0, notes: '체중 1.2배 목표, 무릎이 발끝을 넘지 않게.', videoQuery: 'back squat form' },
    { name: 'Depth Jump', nameKo: '뎁스 점프', sets: 4, reps: '5', notes: '60cm 박스, 착지 즉시 폭발적 점프.', videoQuery: 'depth jump plyometric' },
    { name: 'Trap Bar Deadlift', nameKo: '트랩바 데드리프트', sets: 3, reps: '5', notes: '폭발적인 컨센트릭 — 위로 던지는 느낌.' },
  ],
  wrist: [
    { name: 'Wrist Curl', nameKo: '리스트 컬', sets: 3, reps: '12', weight: 5, notes: '윈드밀/크래들에서 공 컨트롤이 안되면 손목 약함.', videoQuery: 'wrist curl exercise' },
    { name: 'One-Hand Ball Slams', nameKo: '한 손 메디신볼 슬램', sets: 3, reps: '8', notes: '6kg 메디신볼, 한 손으로 머리 위에서 바닥에 슬램.' },
    { name: 'Pull-Up + Hold', nameKo: '풀업 + 5초 홀드', sets: 3, reps: '6', notes: '윗부분에서 공 그립 강화.' },
  ],
  spin: [
    { name: 'Rotational Med Ball Throw', nameKo: '회전 메디신볼 던지기', sets: 4, reps: '6/side', notes: '벽에 옆으로 서서 6kg 공을 회전력으로 던짐 — 360 회전의 토크 코어.', videoQuery: 'rotational med ball throw' },
    { name: 'Single-Leg Box Jump w/ 180', nameKo: '한발 박스점프 + 180°', sets: 4, reps: '4/side', notes: '한발로 박스 점프 후 공중에서 180도 회전. 착지 균형 중요.' },
    { name: 'Pallof Press', nameKo: '팔로프 프레스', sets: 3, reps: '12/side', notes: '회전 안티 — 360 도중 몸이 흔들리지 않게.' },
  ],
  leg: [
    { name: 'Bulgarian Split Squat', nameKo: '불가리안 스플릿 스쿼트', sets: 4, reps: '8/side', weight: 20, notes: 'between-legs는 비대칭 다리 힘이 핵심.', videoQuery: 'bulgarian split squat' },
    { name: 'Pistol Squat Progression', nameKo: '피스톨 스쿼트', sets: 3, reps: '5/side', notes: '의자 보조부터 시작.' },
    { name: 'Hip Mobility Flow', nameKo: '고관절 모빌리티', sets: 3, reps: '60s', notes: '90/90 + 비둘기 자세. between-legs의 다리 벌리기 가동범위 확보.' },
  ],
  coordination: [
    { name: 'Ladder Drill — In/Out', nameKo: '래더 드릴 인아웃', sets: 4, reps: '3 lengths', notes: 'putback/alley-oop은 발 위치 정확도.' },
    { name: 'Two-Ball Dribble', nameKo: '듀얼 드리블', sets: 3, reps: '60s', notes: '두 공 동시 드리블 — 손-눈 협응.' },
    { name: 'Tennis Ball React Catch', nameKo: '테니스볼 반응 캐치', sets: 3, reps: '20', notes: '파트너가 무작위로 공 던짐, 한 손으로 캐치.' },
  ],
  distance: [
    { name: 'Bounding (One-Step)', nameKo: '바운딩', sets: 4, reps: '8 steps/side', notes: '프리스로 라인 덩크는 한 스텝의 추진력.', videoQuery: 'sprint bounding drill' },
    { name: 'Single-Leg Long Jump', nameKo: '한발 멀리뛰기', sets: 4, reps: '4/side', notes: '한발 출발 거리 측정 — 매주 +5cm 목표.' },
    { name: 'Hill Sprint', nameKo: '오르막 스프린트', sets: 6, reps: '20m', notes: '경사 10-15도, 전력 스프린트.' },
  ],
}

/** Universal warmup (always prepended). */
const WARMUP: ExerciseTemplate[] = [
  { name: 'Dynamic Warmup', nameKo: '동적 워밍업', sets: 1, duration: '5분', notes: '레그스윙, 캐리오카, 점프잭.' },
  { name: 'Ankle Bounces', nameKo: '발목 바운스', sets: 3, reps: '20', notes: '발목 탄성 활성화.' },
]

/** Universal cooldown. */
const COOLDOWN: ExerciseTemplate[] = [
  { name: 'Static Stretch', nameKo: '정적 스트레칭', sets: 1, duration: '8분', notes: '햄스트링, 종아리, 고관절.' },
]

/**
 * Main entry — derive a prescription from a single recent run.
 *
 * Algorithm:
 *   1. If no run exists, return a generic plyo+strength baseline.
 *   2. Otherwise:
 *      a. Count miss-rate by family.
 *      b. Pick top-2 weakest families (highest miss-rate or 0-attempt).
 *      c. Combine: warmup + 1 block from each weak family + cooldown.
 *      d. Intensity: high if perfects≥3, med if dunks≥5, low otherwise
 *         (we ramp DOWN on poor performance — recovery over volume).
 *      e. Diagnosis string = the specific weakness in Korean.
 */
export function prescribeFromRun(run: GameRunResult | null): PrescribedWorkout {
  const today = new Date().toISOString()

  if (!run || run.attempts.length === 0) {
    return {
      date: today,
      source: 'auto-from-game',
      diagnosis: '아직 게임 데이터가 없습니다 — 기본 점프 & 근력 베이스라인부터.',
      intensity: 'med',
      exercises: [...WARMUP, ...FAMILY_RX.power.slice(0, 2), ...FAMILY_RX.coordination.slice(0, 1), ...COOLDOWN],
      targetDunks: ['basic_two', 'basic_one'],
    }
  }

  // ---- Per-family miss-rate ----
  const familyStats: Record<DunkFamily, { attempts: number; miss: number }> = {
    power: { attempts: 0, miss: 0 },
    wrist: { attempts: 0, miss: 0 },
    spin: { attempts: 0, miss: 0 },
    leg: { attempts: 0, miss: 0 },
    coordination: { attempts: 0, miss: 0 },
    distance: { attempts: 0, miss: 0 },
  }
  for (const a of run.attempts) {
    const fam = DUNK_FAMILY[a.dunkId] ?? 'power'
    familyStats[fam].attempts += 1
    if (a.tier === 'miss') familyStats[fam].miss += 1
  }

  // Sort families by miss-rate (desc); families with 0 attempts get rate 0
  // (we won't recommend something they never tried — focus on actual weak spots).
  const ranked = (Object.entries(familyStats) as Array<[DunkFamily, { attempts: number; miss: number }]>)
    .filter(([, s]) => s.attempts > 0)
    .map(([f, s]) => ({ family: f, missRate: s.miss / s.attempts, attempts: s.attempts }))
    .sort((a, b) => b.missRate - a.missRate || b.attempts - a.attempts)

  // Top-2 weakest families. If only 1 family used, double-up its exercises.
  const top: DunkFamily[] = ranked.length >= 2
    ? [ranked[0].family, ranked[1].family]
    : ranked.length === 1
      ? [ranked[0].family, ranked[0].family]
      : ['power', 'coordination']

  // ---- Build diagnosis ----
  const familyKo: Record<DunkFamily, string> = {
    power: '폭발력',
    wrist: '손목/그립',
    spin: '회전 토크',
    leg: '하체 비대칭 + 고관절',
    coordination: '협응 + 타이밍',
    distance: '거리 & 한발 추진력',
  }

  let diagnosis: string
  if (ranked.length === 0) {
    diagnosis = '베이직 덩크부터 다지세요 — 폭발력 + 협응'
  } else {
    const top1 = ranked[0]
    if (top1.missRate >= 0.5) {
      diagnosis = `${familyKo[top1.family]} 약점 (${Math.round(top1.missRate * 100)}% 실패) — 오늘 처방의 핵심`
    } else if (run.perfects === 0 && run.totalDunks >= 3) {
      diagnosis = `정확도 부족 — PERFECT 0회. ${familyKo[top1.family]} 보강으로 타이밍 안정화`
    } else {
      diagnosis = `${familyKo[top1.family]} 발전 영역 — 가장 자주 실패한 카테고리`
    }
  }

  // ---- Intensity ----
  let intensity: 'low' | 'med' | 'high'
  if (run.perfects >= 3 && run.maxCombo >= 5) intensity = 'high'
  else if (run.totalDunks >= 5) intensity = 'med'
  else intensity = 'low'

  // ---- Exercise picking ----
  // High intensity = full block from each family (3 exercises × 2 = 6)
  // Med = 2 exercises per family (4 total)
  // Low = 1 exercise per family + extra mobility (2 + extras)
  const perFamily = intensity === 'high' ? 3 : intensity === 'med' ? 2 : 1
  const blockA = FAMILY_RX[top[0]].slice(0, perFamily)
  const blockB = top[1] === top[0]
    ? FAMILY_RX[top[0]].slice(perFamily, perFamily * 2)
    : FAMILY_RX[top[1]].slice(0, perFamily)

  // ---- targetDunks: which dunks in this run from the chosen families failed? ----
  const targetDunks = run.attempts
    .filter(a => a.tier === 'miss')
    .filter(a => top.includes(DUNK_FAMILY[a.dunkId] ?? 'power'))
    .map(a => a.dunkId)
  const uniqueTargets = Array.from(new Set(targetDunks)).slice(0, 4)

  return {
    date: today,
    source: 'auto-from-game',
    diagnosis,
    intensity,
    exercises: [...WARMUP, ...blockA, ...blockB, ...COOLDOWN],
    targetDunks: uniqueTargets.length > 0 ? uniqueTargets : Array.from(new Set(run.attempts.map(a => a.dunkId))).slice(0, 3),
  }
}

/**
 * Helper: aggregate a list of DunkAttempts into a GameRunResult skeleton.
 * Called by GameScreen on game-over.
 */
export function buildGameRunResult(args: {
  score: number
  totalDunks: number
  perfects: number
  maxCombo: number
  attempts: import('@/types').DunkAttempt[]
}): GameRunResult {
  const perDunk: GameRunResult['perDunk'] = {}
  const distances: number[] = []
  for (const a of args.attempts) {
    if (!perDunk[a.dunkId]) {
      perDunk[a.dunkId] = { attempts: 0, made: 0, miss: 0, bestTier: 'miss' }
    }
    const slot = perDunk[a.dunkId]
    slot.attempts += 1
    if (a.tier === 'miss') {
      slot.miss += 1
    } else {
      slot.made += 1
      distances.push(a.distance)
      // Promote best tier
      const order: Array<'miss' | 'normal' | 'good' | 'perfect'> = ['miss', 'normal', 'good', 'perfect']
      if (order.indexOf(a.tier) > order.indexOf(slot.bestTier)) {
        slot.bestTier = a.tier
      }
    }
  }
  const recentMisses = args.attempts
    .filter(a => a.tier === 'miss')
    .slice(-3)
    .map(a => a.dunkId)
  const avgDistance = distances.length > 0
    ? distances.reduce((a, b) => a + b, 0) / distances.length
    : 0

  return {
    endedAt: new Date().toISOString(),
    score: args.score,
    totalDunks: args.totalDunks,
    perfects: args.perfects,
    maxCombo: args.maxCombo,
    perDunk,
    attempts: args.attempts,
    recentMisses,
    avgDistance,
  }
}
