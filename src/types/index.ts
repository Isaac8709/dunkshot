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
