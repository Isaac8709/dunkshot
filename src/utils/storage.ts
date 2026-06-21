import type { UserProfile, WorkoutSession, CommunityPost, GameRunResult } from '@/types'

const KEYS = {
  PROFILE: 'dunkshot_profile',
  SESSIONS: 'dunkshot_sessions',
  UNLOCKED_DUNKS: 'dunkshot_unlocked_dunks',
  COMMUNITY: 'dunkshot_community',
  SETTINGS: 'dunkshot_settings',
  HIGHSCORE: 'dunkshot_highscore',
  GAME_RUNS: 'dunkshot_game_runs',     // last N play results
}

const MAX_RUNS_STORED = 20

export const storage = {
  saveProfile(profile: UserProfile) {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile))
  },
  loadProfile(): UserProfile | null {
    const raw = localStorage.getItem(KEYS.PROFILE)
    return raw ? JSON.parse(raw) : null
  },

  saveSessions(sessions: WorkoutSession[]) {
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions))
  },
  loadSessions(): WorkoutSession[] {
    const raw = localStorage.getItem(KEYS.SESSIONS)
    return raw ? JSON.parse(raw) : []
  },
  addSession(session: WorkoutSession) {
    const sessions = this.loadSessions()
    sessions.unshift(session)
    this.saveSessions(sessions)
  },

  saveUnlockedDunks(ids: string[]) {
    localStorage.setItem(KEYS.UNLOCKED_DUNKS, JSON.stringify(ids))
  },
  loadUnlockedDunks(): string[] {
    const raw = localStorage.getItem(KEYS.UNLOCKED_DUNKS)
    return raw ? JSON.parse(raw) : ['basic_two']
  },

  saveCommunityPosts(posts: CommunityPost[]) {
    localStorage.setItem(KEYS.COMMUNITY, JSON.stringify(posts))
  },
  loadCommunityPosts(): CommunityPost[] {
    const raw = localStorage.getItem(KEYS.COMMUNITY)
    return raw ? JSON.parse(raw) : getDefaultCommunityPosts()
  },
  addCommunityPost(post: CommunityPost) {
    const posts = this.loadCommunityPosts()
    posts.unshift(post)
    this.saveCommunityPosts(posts.slice(0, 200))
  },

  clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k))
  },

  saveHighScore(score: number) {
    localStorage.setItem(KEYS.HIGHSCORE, String(score))
  },
  loadHighScore(): number {
    const raw = localStorage.getItem(KEYS.HIGHSCORE)
    return raw ? parseInt(raw) || 0 : 0
  },

  // ---- Game run history ----
  saveGameRun(run: GameRunResult) {
    const runs = this.loadGameRuns()
    runs.unshift(run)
    localStorage.setItem(KEYS.GAME_RUNS, JSON.stringify(runs.slice(0, MAX_RUNS_STORED)))
  },
  loadGameRuns(): GameRunResult[] {
    const raw = localStorage.getItem(KEYS.GAME_RUNS)
    if (!raw) return []
    try { return JSON.parse(raw) } catch { return [] }
  },
  /** The single most recent run (used by the training prescription engine). */
  loadLastGameRun(): GameRunResult | null {
    return this.loadGameRuns()[0] || null
  },
}

function getDefaultCommunityPosts(): CommunityPost[] {
  return [
    {
      id: 'demo_1',
      userId: 'demo_user_1',
      userName: '점프왕준혁',
      userAvatar: '🔥',
      date: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      content: '드디어 수직 점프 65cm 찍었다!! 6개월 전에 시작할 때 48cm였는데... 림이 손가락에 닿는 느낌이 점점 명확해지고 있어요. 다음 달엔 반드시!!! 🏀',
      verticalJump: 65,
      likes: 47,
      liked: false,
      comments: [
        { id: 'c1', userId: 'u2', userName: '덩크드리머', content: '대박!! 17cm 올린 거 진짜 엄청난 거예요!', date: new Date(Date.now() - 1000 * 60 * 20).toISOString() },
        { id: 'c2', userId: 'u3', userName: '하늘을향해', content: '비법 알려주세요!!', date: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
      ],
      tags: ['점프훈련', '수직점프', '6개월성과'],
      type: 'progress'
    },
    {
      id: 'demo_2',
      userId: 'demo_user_2',
      userName: '덩크드리머',
      userAvatar: '⚡',
      date: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      content: '오늘 스쿼트 130kg 3세트 완료 ✅\n뎁스 점프 60cm 박스 4×5 ✅\n단 10분이라도 코트 나가서 림 터치 연습 ✅\n\n아들한테 덩크 보여주는 그 날만 생각하면 힘든 게 없음. 화이팅 모두!!',
      likes: 83,
      liked: false,
      comments: [
        { id: 'c3', userId: 'u1', userName: '점프왕준혁', content: '130kg 대단합니다!! 저도 오늘 못 쉬고 뛰어야겠다 ㅋㅋ', date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
      ],
      tags: ['스쿼트', '뎁스점프', '아들', '덩크드림'],
      type: 'workout'
    },
    {
      id: 'demo_3',
      userId: 'demo_user_3',
      userName: '175cm의기적',
      userAvatar: '🌟',
      date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      content: '🎉🎉🎉 해냈습니다!!! 175cm 키로 덩크슛 성공!!!\n\n18개월 걸렸어요. 처음엔 다들 안 된다고 했는데... 수직 점프 42cm → 78cm. 36cm를 올렸습니다. 울었어요 진짜로. 이 게임 시작할 때 반신반의했는데... 덩크슛 덕분에 훈련을 멈추지 않았습니다. 여러분도 반드시 됩니다!!!',
      likes: 312,
      liked: false,
      comments: [
        { id: 'c4', userId: 'u1', userName: '점프왕준혁', content: '진짜 전설이다... 저도 언젠가 이런 글 쓸게요!!', date: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString() },
        { id: 'c5', userId: 'u2', userName: '덩크드리머', content: '제 눈물 왜 나는 거죠... 축하합니다 진심으로 🔥', date: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
        { id: 'c6', userId: 'u4', userName: '하늘을향해', content: '175cm 덩크!!! 저도 176cm인데 희망이 생겼어요!!!', date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
      ],
      tags: ['덩크달성', '175cm', '18개월', '기적'],
      type: 'dunk_achieved'
    },
    {
      id: 'demo_4',
      userId: 'demo_user_4',
      userName: '하늘을향해',
      userAvatar: '🏃',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      content: '훈련 시작 3주차입니다. 아직 변화가 느껴지지 않지만... 매일 하고 있어요.\n\n오늘 메뉴:\n- 점프 스쿼트 4×8\n- 박스 점프 (50cm) 4×5  \n- 줄넘기 5분×3세트\n- 스트레칭 20분\n\n포기하지 않겠습니다. 💪',
      likes: 56,
      liked: false,
      comments: [
        { id: 'c7', userId: 'u3', userName: '175cm의기적', content: '3주면 아직 적응 단계예요! 6주차부터 달라집니다. 믿고 가세요!!', date: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString() },
      ],
      tags: ['3주차', '꾸준히', '점프훈련'],
      type: 'workout'
    },
  ]
}
