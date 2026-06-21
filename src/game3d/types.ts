export type DunkFeedback = {
  dunkId: string
  name: string
  tier: 'perfect' | 'good' | 'normal' | 'miss'
  points: number
  approachGrade: string
  trainingCue: string
  risk: string
  style: string
  color: string
}

export interface Game3DProps {
  unlockedDunkIds: string[]
  onScoreUpdate: (score: number, combo: number) => void
  onDunkPerformed: (dunkId: string) => void
  onDunkFeedback?: (feedback: DunkFeedback) => void
  onKeysChange?: (keys: string[]) => void
  onTimerUpdate?: (secondsLeft: number) => void
  onGameOver?: (score: number, stats: { dunks: number; maxCombo: number; perfects: number }) => void
  timeAttack?: boolean
}

export type DunkId =
  | 'basic_two' | 'basic_one' | 'reverse' | 'windmill' | 'tomahawk'
  | 'three_sixty' | 'between_legs' | 'alleyoop' | 'cradle' | 'putback'
  | 'tip_dunk' | 'chaser' | 'double_pump' | 'freethrow_line' | 'eastbay'
  | 'jumpshot' // out-of-dunk-range fallback — not in the dunk catalog

export interface DunkSpec {
  id: DunkId
  name: string
  keys: string[]      // e.g. ['A','SPACE']  — held modifiers + trigger
  maxDistance: number // meters from rim
  airTime: number     // seconds
  spin: number        // total body rotations during air
  armWindup: number   // 0..1 how big the arm pre-swing is
  twoHand: boolean
  rimSide: 1 | -1 | 0 // 1 = front, -1 = reverse, 0 = side
  color: string
  cue: string
  difficulty: number  // 1..5
}

export interface ShotResult {
  tier: 'perfect' | 'good' | 'normal' | 'miss'
  points: number
  approachGrade: 'S' | 'A' | 'B' | 'C' | 'D'
}
