export interface UserProfile {
  id: string
  name: string
  age: number
  height: number        // cm
  weight: number        // kg
  currentVertical: number   // cm (현재 수직점프)
  armLength: number     // cm (팔 길이, 어깨~손끝)
  standingReach: number // cm (제자리에서 손끝 높이)
  createdAt: string
  avatar: string        // emoji or color
}

export interface DunkRequirement {
  rimHeight: number       // 305cm (NBA 기준)
  requiredReach: number   // 림 + 15cm (손가락 끝 여유)
  standingReach: number   // 사용자의 스탠딩 리치
  requiredVertical: number // 필요 수직점프
  currentVertical: number
  gap: number             // 현재 부족한 점프 높이
  estimatedMonths: number // 예상 달성 기간
}

export interface WorkoutSession {
  id: string
  date: string
  type: WorkoutType
  exercises: Exercise[]
  verticalJump?: number   // 당일 측정 점프력
  duration: number        // 분
  note?: string
  mood: 1 | 2 | 3 | 4 | 5
  shared: boolean
}

export type WorkoutType = 'strength' | 'plyometric' | 'stretching' | 'basketball' | 'rest'

export interface Exercise {
  name: string
  sets?: number
  reps?: number
  duration?: number   // seconds
  weight?: number     // kg
  completed: boolean
}

export interface TrainingPhase {
  phase: number
  name: string
  weeks: number
  description: string
  focus: string[]
  weeklyPlan: DayPlan[]
}

export interface DayPlan {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
  workoutType: WorkoutType
  exercises: ExerciseTemplate[]
  isRest: boolean
}

export interface ExerciseTemplate {
  name: string
  nameKo: string
  sets: number
  reps?: string
  duration?: string
  notes?: string
  videoQuery?: string
  animType?: string
  weight?: number
}

export interface DunkType {
  id: string
  name: string
  nameEn: string
  difficulty: 1 | 2 | 3 | 4 | 5
  description: string
  controls: string
  unlockCondition: string
  requiredVertical: number  // 이 덩크를 하려면 필요한 점프력
  unlocked: boolean
  icon: string
  famous: string   // 유명한 선수/덩크 예시
  category: 'basic' | 'power' | 'acrobatic' | 'legendary'
}

export interface CommunityPost {
  id: string
  userId: string
  userName: string
  userAvatar: string
  date: string
  content: string
  workoutSession?: WorkoutSession
  verticalJump?: number
  likes: number
  liked: boolean
  comments: Comment[]
  tags: string[]
  type: 'workout' | 'progress' | 'dunk_achieved' | 'milestone'
}

export interface Comment {
  id: string
  userId: string
  userName: string
  content: string
  date: string
}

export type AppScreen =
  | 'splash'
  | 'setup'
  | 'menu'
  | 'game'
  | 'training'
  | 'progress'
  | 'dunks'
  | 'community'
  | 'profile'

export interface GameState {
  score: number
  combo: number
  unlockedDunks: string[]
  currentDunk: string | null
  isJumping: boolean
  lastDunkAt: number
}

/** Per-dunk attempt result captured during a session. */
export interface DunkAttempt {
  dunkId: string          // matches DunkSpec.id
  dunkName: string        // human-readable Korean name
  tier: 'perfect' | 'good' | 'normal' | 'miss'
  points: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
  distance: number        // launch distance in meters
  at: number              // performance.now() relative to session start (ms)
}

/** Aggregated stats for a single time-attack play. */
export interface GameRunResult {
  /** ISO 8601 timestamp of when the run ENDED. */
  endedAt: string
  score: number
  totalDunks: number
  perfects: number
  maxCombo: number
  /** Per-dunk-id success/failure counters for this run. */
  perDunk: Record<string, { attempts: number; made: number; miss: number; bestTier: 'perfect' | 'good' | 'normal' | 'miss' }>
  /** Full ordered timeline of attempts (used for cue extraction). */
  attempts: DunkAttempt[]
  /** Trailing 3 missed dunk IDs — what the coach should focus on next. */
  recentMisses: string[]
  /** Average launch distance across made dunks (m). */
  avgDistance: number
}

/** Auto-generated workout recommendation derived from recent GameRunResult. */
export interface PrescribedWorkout {
  date: string
  source: 'auto-from-game' | 'manual'
  /** Short human-readable diagnosis ("후미손목 약함 → 핸드 컨트롤 보강") */
  diagnosis: string
  /** 'low' = warmup/skills, 'med' = standard, 'high' = peaking */
  intensity: 'low' | 'med' | 'high'
  exercises: ExerciseTemplate[]
  /** Which dunk IDs this plan is targeting (so user sees the link to gameplay). */
  targetDunks: string[]
}

