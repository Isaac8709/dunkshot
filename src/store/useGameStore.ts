import { create } from 'zustand'
import type { AppScreen, UserProfile, WorkoutSession, CommunityPost, DunkType } from '@/types'
import { storage } from '@/utils/storage'
import { ALL_DUNKS } from '@/utils/dunkData'

interface GameStore {
  screen: AppScreen
  profile: UserProfile | null
  sessions: WorkoutSession[]
  unlockedDunkIds: string[]
  communityPosts: CommunityPost[]
  gameScore: number
  gameCombo: number

  setScreen: (screen: AppScreen) => void
  setProfile: (profile: UserProfile) => void
  addSession: (session: WorkoutSession) => void
  updateSession: (id: string, updates: Partial<WorkoutSession>) => void
  unlockDunk: (id: string) => void
  addCommunityPost: (post: CommunityPost) => void
  toggleLike: (postId: string) => void
  addComment: (postId: string, comment: import('@/types').Comment) => void
  setGameScore: (score: number) => void
  setGameCombo: (combo: number) => void
  loadFromStorage: () => void
  getDunks: () => DunkType[]
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'splash',
  profile: null,
  sessions: [],
  unlockedDunkIds: ['basic_two'],
  communityPosts: [],
  gameScore: 0,
  gameCombo: 0,

  setScreen: (screen) => set({ screen }),

  setProfile: (profile) => {
    storage.saveProfile(profile)
    set({ profile })
  },

  addSession: (session) => {
    storage.addSession(session)
    set(state => ({ sessions: [session, ...state.sessions] }))
  },

  updateSession: (id, updates) => {
    set(state => {
      const sessions = state.sessions.map(s => s.id === id ? { ...s, ...updates } : s)
      storage.saveSessions(sessions)
      return { sessions }
    })
  },

  unlockDunk: (id) => {
    set(state => {
      const ids = state.unlockedDunkIds.includes(id)
        ? state.unlockedDunkIds
        : [...state.unlockedDunkIds, id]
      storage.saveUnlockedDunks(ids)
      return { unlockedDunkIds: ids }
    })
  },

  addCommunityPost: (post) => {
    storage.addCommunityPost(post)
    set(state => ({ communityPosts: [post, ...state.communityPosts] }))
  },

  toggleLike: (postId) => {
    set(state => {
      const posts = state.communityPosts.map(p => {
        if (p.id !== postId) return p
        return { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
      })
      storage.saveCommunityPosts(posts)
      return { communityPosts: posts }
    })
  },

  addComment: (postId, comment) => {
    set(state => {
      const posts = state.communityPosts.map(p =>
        p.id === postId ? { ...p, comments: [...p.comments, comment] } : p
      )
      storage.saveCommunityPosts(posts)
      return { communityPosts: posts }
    })
  },

  setGameScore: (gameScore) => set({ gameScore }),
  setGameCombo: (gameCombo) => set({ gameCombo }),

  loadFromStorage: () => {
    const profile = storage.loadProfile()
    const sessions = storage.loadSessions()
    const unlockedDunkIds = storage.loadUnlockedDunks()
    const communityPosts = storage.loadCommunityPosts()
    set({
      profile,
      sessions,
      unlockedDunkIds,
      communityPosts,
      screen: profile ? 'menu' : 'splash',
    })
  },

  getDunks: () => {
    const { unlockedDunkIds } = get()
    return ALL_DUNKS.map(d => ({ ...d, unlocked: unlockedDunkIds.includes(d.id) }))
  },
}))
