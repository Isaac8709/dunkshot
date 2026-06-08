import { useState } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { CommunityPost, Comment } from '@/types'

const POST_TYPE_LABELS = {
  workout: '💪 훈련',
  progress: '📈 성장',
  dunk_achieved: '🎉 덩크 달성!!',
  milestone: '🏆 마일스톤',
}

const POST_TYPE_COLORS = {
  workout: 'bg-blue-500/20 text-blue-400',
  progress: 'bg-green-500/20 text-green-400',
  dunk_achieved: 'bg-yellow-500/20 text-yellow-500',
  milestone: 'bg-purple-500/20 text-purple-400',
}

function PostCard({ post, onLike, onComment }: {
  post: CommunityPost
  onLike: (id: string) => void
  onComment: (id: string, text: string) => void
}) {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const timeAgo = formatDistanceToNow(parseISO(post.date), { locale: ko, addSuffix: true })

  return (
    <div className={`card-dark p-4 ${
      post.type === 'dunk_achieved'
        ? 'ring-2 ring-yellow-500/50 shadow-lg shadow-yellow-500/10'
        : ''
    }`}>
      {/* Type badge */}
      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${POST_TYPE_COLORS[post.type]}`}>
        {POST_TYPE_LABELS[post.type]}
      </span>

      {/* User */}
      <div className="flex items-center gap-3 mt-3">
        <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center text-xl border border-orange-500/20">
          {post.userAvatar}
        </div>
        <div>
          <p className="text-white font-bold text-sm">{post.userName}</p>
          <p className="text-gray-600 text-xs">{timeAgo}</p>
        </div>
        {post.verticalJump && (
          <div className="ml-auto bg-green-500/15 px-3 py-1 rounded-full">
            <p className="text-green-400 text-xs font-bold">📏 {post.verticalJump}cm</p>
          </div>
        )}
      </div>

      {/* Content */}
      <p className="text-gray-200 text-sm mt-3 leading-relaxed whitespace-pre-line">{post.content}</p>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {post.tags.map(tag => (
            <span key={tag} className="text-xs text-gray-500">#{tag}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
        <button
          onClick={() => onLike(post.id)}
          className={`flex items-center gap-1.5 text-sm font-bold transition-all active:scale-90 ${
            post.liked ? 'text-red-400' : 'text-gray-500'
          }`}
        >
          {post.liked ? '❤️' : '🤍'} {post.likes}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-sm text-gray-500"
        >
          💬 {post.comments.length}
        </button>
        <div className="flex-1" />
        <p className="text-gray-700 text-xs">
          {formatDistanceToNow(parseISO(post.date), { locale: ko, addSuffix: true })}
        </p>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-3 space-y-2 pt-3 border-t border-white/5">
          {post.comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-dark-700 flex items-center justify-center text-xs flex-shrink-0">
                👤
              </div>
              <div className="bg-dark-700 rounded-xl px-3 py-2 flex-1">
                <p className="text-orange-400 text-xs font-bold">{c.userName}</p>
                <p className="text-gray-300 text-xs mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="응원 댓글..."
              className="flex-1 bg-dark-700 text-white text-sm rounded-xl px-3 py-2 border border-gray-700 focus:border-orange-500 outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && commentText.trim()) {
                  onComment(post.id, commentText.trim())
                  setCommentText('')
                }
              }}
            />
            <button
              onClick={() => {
                if (commentText.trim()) {
                  onComment(post.id, commentText.trim())
                  setCommentText('')
                }
              }}
              className="btn-neon text-xs px-4 py-2"
            >
              전송
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CommunityScreen() {
  const { setScreen, profile, communityPosts, toggleLike, addComment } = useGameStore()
  const [showWrite, setShowWrite] = useState(false)
  const [writeContent, setWriteContent] = useState('')
  const [writeType, setWriteType] = useState<CommunityPost['type']>('workout')
  const [writeJump, setWriteJump] = useState('')
  const [filterType, setFilterType] = useState<CommunityPost['type'] | 'all'>('all')
  const { addCommunityPost } = useGameStore()

  const filtered = filterType === 'all'
    ? communityPosts
    : communityPosts.filter(p => p.type === filterType)

  const handleComment = (postId: string, text: string) => {
    if (!profile) return
    const comment: Comment = {
      id: Date.now().toString(),
      userId: profile.id,
      userName: profile.name,
      content: text,
      date: new Date().toISOString(),
    }
    addComment(postId, comment)
  }

  const handlePost = () => {
    if (!profile || !writeContent.trim()) return
    addCommunityPost({
      id: `post_${Date.now()}`,
      userId: profile.id,
      userName: profile.name,
      userAvatar: profile.avatar,
      date: new Date().toISOString(),
      content: writeContent.trim(),
      verticalJump: writeJump ? parseFloat(writeJump) : undefined,
      likes: 0,
      liked: false,
      comments: [],
      tags: ['덩크슛', '훈련'],
      type: writeType,
    })
    setWriteContent('')
    setWriteJump('')
    setShowWrite(false)
  }

  const achievedCount = communityPosts.filter(p => p.type === 'dunk_achieved').length

  return (
    <div className="fixed inset-0 arena-bg flex flex-col safe-top safe-bottom">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setScreen('menu')} className="text-gray-400 text-xl">←</button>
          <div className="flex-1">
            <h2 className="text-white font-black text-xl">덩크 커뮤니티</h2>
            <p className="text-gray-500 text-xs">
              하나의 목표 — 덩크슛. 함께 무작정 진격.
            </p>
          </div>
          <button onClick={() => setShowWrite(true)} className="btn-neon text-xs py-2 px-4">
            + 공유
          </button>
        </div>

        {/* Achieve counter */}
        {achievedCount > 0 && (
          <div className="card-dark p-3 flex items-center gap-3 mb-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-yellow-400 font-bold text-sm">지금까지 {achievedCount}명이 덩크슛 달성!</p>
              <p className="text-gray-500 text-xs">당신도 반드시 됩니다</p>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto">
          {(['all', 'workout', 'progress', 'dunk_achieved', 'milestone'] as const).map(type => (
            <button key={type} onClick={() => setFilterType(type)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterType === type ? 'bg-orange-500 text-white' : 'bg-dark-700 text-gray-400'
              }`}>
              {type === 'all' ? '전체' : POST_TYPE_LABELS[type as CommunityPost['type']]}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            <p className="text-4xl mb-3">📭</p>
            <p>아직 게시물이 없습니다</p>
            <p className="text-sm mt-1">첫 번째로 훈련을 공유해보세요!</p>
          </div>
        )}
        {filtered.map(post => (
          <PostCard
            key={post.id}
            post={post}
            onLike={toggleLike}
            onComment={handleComment}
          />
        ))}
      </div>

      {/* Write modal */}
      {showWrite && (
        <div className="fixed inset-0 bg-black/85 z-20 flex items-end">
          <div className="bg-dark-800 rounded-t-3xl w-full p-5 safe-bottom">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black text-lg">오늘의 훈련 공유</h3>
              <button onClick={() => setShowWrite(false)} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="space-y-4">
              {/* Type */}
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(POST_TYPE_LABELS) as [CommunityPost['type'], string][]).map(([k, v]) => (
                  <button key={k} onClick={() => setWriteType(k)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                      writeType === k ? 'bg-orange-500 text-white' : 'bg-dark-700 text-gray-400'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>

              <textarea
                value={writeContent}
                onChange={e => setWriteContent(e.target.value)}
                placeholder={writeType === 'dunk_achieved'
                  ? '🎉 드디어 해냈습니다!! 여러분도 할 수 있어요!'
                  : '오늘 훈련 내용, 느낀 점, 다른 사람들에게 하고 싶은 말...'}
                rows={4}
                className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 border border-gray-700 focus:border-orange-500 outline-none resize-none text-sm"
              />

              <div>
                <label className="text-gray-400 text-xs font-bold mb-1 block">
                  오늘 수직 점프 (cm) - 선택
                </label>
                <input type="number" placeholder="65" value={writeJump}
                  onChange={e => setWriteJump(e.target.value)}
                  className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 border border-gray-700 focus:border-orange-500 outline-none" />
              </div>

              <button onClick={handlePost} disabled={!writeContent.trim()}
                className="btn-neon w-full font-bold disabled:opacity-40">
                공유하기 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
