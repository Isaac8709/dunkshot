import type { DunkSpec } from './types'

/**
 * Each dunk is mechanically distinct in:
 *   - approach distance allowed
 *   - air time (hangtime)
 *   - body spin during flight
 *   - arm windup arc
 *   - which side of rim it scores on
 *   - difficulty (affects scoring window + miss probability)
 */
export const DUNK_CATALOG: DunkSpec[] = [
  { id: 'basic_two',      name: '양손 덩크',        keys: ['SPACE'],            maxDistance: 2.6, airTime: 0.85, spin: 0,    armWindup: 0.30, twoHand: true,  rimSide: 1,  color: '#FFFFFF', cue: '양발 동시 점프, 코어 잠금',                    difficulty: 1 },
  { id: 'basic_one',      name: '원핸드 덩크',      keys: ['A','SPACE'],        maxDistance: 2.6, airTime: 0.90, spin: 0,    armWindup: 0.50, twoHand: false, rimSide: 1,  color: '#5BC0EB', cue: '마지막 스텝 길게, 손목 컨트롤',                  difficulty: 1 },
  { id: 'reverse',        name: '리버스 덩크',      keys: ['S','SPACE'],        maxDistance: 2.2, airTime: 1.00, spin: 0.5,  armWindup: 0.40, twoHand: true,  rimSide: -1, color: '#FF4D1F', cue: '림 통과 후 등 돌려 백사이드 마감',                difficulty: 3 },
  { id: 'windmill',       name: '윈드밀 덩크',      keys: ['D','SPACE'],        maxDistance: 2.4, airTime: 1.10, spin: 0,    armWindup: 1.00, twoHand: false, rimSide: 1,  color: '#C58FE0', cue: '팔 전체 원, 어깨 가동성 끝까지',                  difficulty: 4 },
  { id: 'tomahawk',       name: '토마호크 덩크',    keys: ['W','SPACE'],        maxDistance: 2.5, airTime: 1.00, spin: 0,    armWindup: 0.80, twoHand: false, rimSide: 1,  color: '#FF6B2C', cue: '공을 머리 뒤까지 장전 후 도끼처럼',               difficulty: 3 },
  { id: 'three_sixty',    name: '360° 덩크',        keys: ['A','D','SPACE'],    maxDistance: 2.0, airTime: 1.25, spin: 1.0,  armWindup: 0.50, twoHand: true,  rimSide: 1,  color: '#8B5CF6', cue: '점프 직후 시선 먼저, 한 바퀴 풀회전',             difficulty: 5 },
  { id: 'between_legs',   name: '다리 사이 덩크',   keys: ['W','S','SPACE'],    maxDistance: 1.8, airTime: 1.20, spin: 0,    armWindup: 0.70, twoHand: false, rimSide: 1,  color: '#FFB627', cue: '무릎 가슴까지, 공은 다리 사이로 통과',            difficulty: 5 },
  { id: 'alleyoop',       name: '앨리웁 덩크',      keys: ['Q','SPACE'],        maxDistance: 2.4, airTime: 1.05, spin: 0,    armWindup: 0.20, twoHand: false, rimSide: 1,  color: '#00FF88', cue: '공중에서 캐치, 손목만 접어 마감',                difficulty: 3 },
  { id: 'cradle',         name: '크래들 덩크',      keys: ['E','SPACE'],        maxDistance: 2.3, airTime: 1.00, spin: 0,    armWindup: 0.60, twoHand: false, rimSide: 1,  color: '#F472B6', cue: '공을 몸 안쪽으로 품고 부드러운 아크',            difficulty: 3 },
  { id: 'putback',        name: '풋백 덩크',        keys: ['R','SPACE'],        maxDistance: 1.6, airTime: 0.75, spin: 0,    armWindup: 0.20, twoHand: true,  rimSide: 1,  color: '#22C55E', cue: '첫 착지 후 0.2초 안 재점프',                     difficulty: 3 },
  { id: 'tip_dunk',       name: '팁 덩크',          keys: ['T','SPACE'],        maxDistance: 1.5, airTime: 0.70, spin: 0,    armWindup: 0.10, twoHand: false, rimSide: 1,  color: '#A7F3D0', cue: '손끝으로 림 위에서 짧게 눌러 넣기',              difficulty: 2 },
  { id: 'chaser',         name: '체이서 덩크',      keys: ['C','SPACE'],        maxDistance: 2.6, airTime: 0.95, spin: 0,    armWindup: 0.40, twoHand: false, rimSide: 0,  color: '#38BDF8', cue: '베이스라인 측면 가속, 짧은 두 스텝',             difficulty: 3 },
  { id: 'double_pump',    name: '더블 펌프 덩크',   keys: ['X','SPACE'],        maxDistance: 2.2, airTime: 1.15, spin: 0,    armWindup: 0.90, twoHand: false, rimSide: 1,  color: '#F97316', cue: '체공 중 페이크 1회 후 진짜 덩크',                 difficulty: 4 },
  { id: 'freethrow_line', name: '자유투 라인 덩크', keys: ['B','SPACE'],        maxDistance: 4.6, airTime: 1.40, spin: 0,    armWindup: 0.70, twoHand: true,  rimSide: 1,  color: '#FFE093', cue: '자유투 라인에서 도약, 수평 비행',                difficulty: 5 },
  { id: 'eastbay',        name: '이스트베이 덩크',  keys: ['Z','SPACE'],        maxDistance: 1.8, airTime: 1.25, spin: 0,    armWindup: 0.90, twoHand: false, rimSide: 1,  color: '#FDE68A', cue: '다리 사이 패스 후 바깥 손으로 마감',              difficulty: 5 },
]

export function getDunkById(id: string): DunkSpec | undefined {
  return DUNK_CATALOG.find(d => d.id === id)
}

/** Decide which dunk to perform from currently held modifier keys. */
export function pickDunkFromKeys(heldModifiers: Set<string>, unlocked: Set<string>): DunkSpec {
  // Match most-specific (longest non-SPACE key combo) first.
  const candidates = DUNK_CATALOG
    .filter(d => unlocked.has(d.id))
    .map(d => ({
      d,
      mods: d.keys.filter(k => k !== 'SPACE'),
    }))
    .filter(({ mods }) => mods.every(m => heldModifiers.has(m)))
    .sort((a, b) => b.mods.length - a.mods.length)
  return candidates[0]?.d ?? DUNK_CATALOG[0]
}

export function gradeApproach(distance: number, maxDistance: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  const ratio = distance / maxDistance
  if (ratio <= 0.35) return 'S'
  if (ratio <= 0.55) return 'A'
  if (ratio <= 0.75) return 'B'
  if (ratio <= 1.00) return 'C'
  return 'D'
}

/**
 * Stochastic shot resolution. Distance + difficulty + timing window decide tier.
 * Returns tier + points + grade. Miss probability is real (no auto-success).
 */
export function resolveShot(args: {
  distance: number
  spec: DunkSpec
  /** how close release was to the apex of the jump, 0=perfect, 1=worst */
  timingError: number
}): { tier: 'perfect'|'good'|'normal'|'miss'; points: number; grade: 'S'|'A'|'B'|'C'|'D' } {
  const { distance, spec, timingError } = args
  const grade = gradeApproach(distance, spec.maxDistance)
  // Beyond max distance → almost always miss
  if (distance > spec.maxDistance) {
    if (Math.random() < 0.85) return { tier: 'miss', points: 0, grade }
  }
  // Difficulty raises miss probability
  const baseMiss = 0.04 + spec.difficulty * 0.025
  // Timing error widens miss
  const missProb = Math.min(0.55, baseMiss + timingError * 0.35)
  if (Math.random() < missProb) return { tier: 'miss', points: 0, grade }

  // Tier from grade + timing
  const gradeRank: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 }
  const gr = gradeRank[grade]
  if (gr <= 0 && timingError < 0.15) return { tier: 'perfect', points: 100 + spec.difficulty * 30, grade }
  if (gr <= 1 && timingError < 0.30) return { tier: 'good',    points: 60 + spec.difficulty * 20, grade }
  return { tier: 'normal', points: 30 + spec.difficulty * 10, grade }
}
