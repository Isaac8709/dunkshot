import { useState } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { generateTrainingPlan } from '@/utils/trainingCalculator'
import ExerciseModal from '@/components/ExerciseModal'
import type { WorkoutSession, Exercise, WorkoutType, ExerciseTemplate } from '@/types'

const DAY_LABELS: Record<string, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일'
}
const TYPE_LABELS: Record<WorkoutType, string> = {
  strength: '💪 근력',
  plyometric: '⚡ 플라이오',
  stretching: '🧘 스트레칭',
  basketball: '🏀 농구',
  rest: '😴 휴식',
}
const MOOD_LABELS = ['', '😫', '😕', '😐', '😊', '🔥']

export default function TrainingScreen() {
  const { profile, sessions, addSession, setScreen } = useGameStore()
  const [activeTab, setActiveTab] = useState<'today' | 'plan'>('today')
  const [logging, setLogging] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<ExerciseTemplate | null>(null)
  const [logForm, setLogForm] = useState<{
    type: WorkoutType
    duration: string
    verticalJump: string
    note: string
    mood: 1 | 2 | 3 | 4 | 5
    exercises: Exercise[]
    share: boolean
  }>({
    type: 'plyometric',
    duration: '60',
    verticalJump: '',
    note: '',
    mood: 4,
    exercises: [],
    share: true,
  })

  if (!profile) return null

  const plan = generateTrainingPlan(profile, {} as any)
  const todayIdx = new Date().getDay()
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const todayKey = dayKeys[todayIdx]
  const todayPlan = plan[0]?.weeklyPlan.find(d => d.day === todayKey)

  const recentSessions = sessions.slice(0, 7)

  const handleLogSubmit = () => {
    const session: WorkoutSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: logForm.type,
      exercises: logForm.exercises,
      verticalJump: logForm.verticalJump ? parseFloat(logForm.verticalJump) : undefined,
      duration: parseInt(logForm.duration) || 60,
      note: logForm.note,
      mood: logForm.mood,
      shared: logForm.share,
    }
    addSession(session)

    // Auto-share to community
    if (logForm.share) {
      const { addCommunityPost } = useGameStore.getState()
      const typeText = TYPE_LABELS[logForm.type]
      addCommunityPost({
        id: `post_${Date.now()}`,
        userId: profile.id,
        userName: profile.name,
        userAvatar: profile.avatar,
        date: new Date().toISOString(),
        content: `${typeText} 훈련 완료! ${parseInt(logForm.duration)}분\n${logForm.note || ''}${logForm.verticalJump ? `\n📏 오늘 수직 점프: ${logForm.verticalJump}cm` : ''}`,
        workoutSession: session,
        verticalJump: session.verticalJump,
        likes: 0,
        liked: false,
        comments: [],
        tags: [logForm.type, '덩크훈련'],
        type: 'workout',
      })
    }

    setLogging(false)
    setLogForm({ type: 'plyometric', duration: '60', verticalJump: '', note: '', mood: 4, exercises: [], share: true })
  }

  return (
    <div className="fixed inset-0 arena-bg flex flex-col safe-top safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <button onClick={() => setScreen('menu')} aria-label="뒤로" className="text-gray-400 text-xl press w-10 h-10 -ml-2 flex items-center justify-center">←</button>
        <div className="flex-1">
          <h2 className="text-white font-black text-xl">훈련 계획</h2>
          <p className="text-gray-500 text-xs">실제 덩크를 위한 코칭 · 플라이오 · 시뮬레이션 연동</p>
        </div>
        <button
          onClick={() => setLogging(true)}
          className="btn-neon text-xs py-2 px-4"
        >
          + 기록
        </button>
      </div>

      {/* Tabs */}
      <div className="flex mx-5 mb-3 bg-dark-800 rounded-xl p-1">
        {(['today', 'plan'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab ? 'bg-orange-500 text-white' : 'text-gray-500'
            }`}>
            {tab === 'today' ? '📅 오늘' : '📋 전체 플랜'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {activeTab === 'today' && (
          <div className="space-y-4 stagger-children">

            <div className="card-dark p-4 border border-orange-400/20 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-28 h-28 rounded-full bg-orange-400/10 blur-2xl" />
              <p className="eyebrow text-orange-300 mb-2">오늘의 덩크 랩</p>
              <h3 className="text-white font-black text-lg mb-2">게임에서 실패한 원인을 실제 훈련으로 연결</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-white/5 p-3"><p className="text-white font-bold">접근거리</p><p className="text-gray-400 mt-1">마지막 두 스텝 리듬 · 림과 거리 감각</p></div>
                <div className="rounded-xl bg-white/5 p-3"><p className="text-white font-bold">체공시간</p><p className="text-gray-400 mt-1">윈드밀/360/이스트베이 전용 플라이오</p></div>
                <div className="rounded-xl bg-white/5 p-3"><p className="text-white font-bold">착지 안정성</p><p className="text-gray-400 mt-1">무릎·발목 리스크를 기록하고 관리</p></div>
                <div className="rounded-xl bg-white/5 p-3"><p className="text-white font-bold">시뮬레이션</p><p className="text-gray-400 mt-1">60초 덩크 랩 점수로 실전 감각 확인</p></div>
              </div>
              <button onClick={() => setScreen('game')} className="btn-neon w-full mt-4 text-sm py-3 font-black">덩크 랩으로 측정하기 →</button>
            </div>

            {/* Today's plan */}
            {todayPlan && !todayPlan.isRest && (
              <div className="card-dark p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-bold">오늘의 훈련</h3>
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">
                    {TYPE_LABELS[todayPlan.workoutType]}
                  </span>
                </div>
                <div className="space-y-2">
                  {todayPlan.exercises.map((ex, i) => (
                    <div key={i} className="flex items-start gap-3 bg-dark-700 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-bold">{ex.nameKo}</p>
                        <p className="text-gray-400 text-xs">{ex.name}</p>
                        <div className="flex gap-2 mt-1">
                          {ex.sets && <span className="text-xs text-orange-400">{ex.sets}세트</span>}
                          {ex.reps && <span className="text-xs text-gray-500">× {ex.reps}</span>}
                          {ex.duration && <span className="text-xs text-gray-500">{ex.duration}</span>}
                          {'weight' in ex && ex.weight && <span className="text-xs text-blue-400">{ex.weight}kg</span>}
                        </div>
                        {ex.notes && <p className="text-gray-600 text-xs mt-0.5 italic">{ex.notes}</p>}
                      </div>
                      <button
                        onClick={() => setSelectedExercise(ex)}
                        className="flex-shrink-0 w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all"
                        title="운동 방법 보기"
                      >
                        ▶
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {todayPlan?.isRest && (
              <div className="card-dark p-6 text-center">
                <div className="text-4xl mb-3">😴</div>
                <h3 className="text-white font-bold text-lg mb-1">오늘은 휴식일</h3>
                <p className="text-gray-400 text-sm">근육은 쉬는 동안 성장합니다.<br/>가벼운 스트레칭은 OK!</p>
              </div>
            )}

            {/* Recent sessions */}
            {recentSessions.length > 0 && (
              <div>
                <h3 className="text-white font-bold mb-3">최근 훈련 기록</h3>
                <div className="space-y-2">
                  {recentSessions.map(s => (
                    <div key={s.id} className="card-dark p-3 flex items-center gap-3">
                      <div className="text-2xl">{MOOD_LABELS[s.mood]}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-bold">{TYPE_LABELS[s.type]}</span>
                          <span className="text-gray-500 text-xs">{s.duration}분</span>
                        </div>
                        {s.verticalJump && (
                          <p className="text-green-400 text-xs">📏 점프: {s.verticalJump}cm</p>
                        )}
                        <p className="text-gray-500 text-xs">
                          {new Date(s.date).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      {s.shared && <span className="text-xs text-blue-400">공유됨</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentSessions.length === 0 && (
              <div className="text-center py-8 text-gray-600">
                <p className="text-4xl mb-3">📝</p>
                <p>아직 훈련 기록이 없습니다</p>
                <p className="text-sm mt-1">오늘 첫 훈련을 기록해보세요!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="space-y-4 stagger-children">
            {plan.map(phase => (
              <div key={phase.phase} className="card-dark p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-black text-sm">
                    {phase.phase}
                  </div>
                  <div>
                    <h3 className="text-white font-bold">{phase.name}</h3>
                    <p className="text-gray-500 text-xs">
                      {phase.weeks > 0 ? `${phase.weeks}주` : '목표 달성 시까지'}
                    </p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-3">{phase.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {phase.focus.map(f => (
                    <span key={f} className="text-xs bg-dark-700 text-orange-400 px-2 py-1 rounded-full">
                      {f}
                    </span>
                  ))}
                </div>
                {/* Weekly day grid */}
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {phase.weeklyPlan.map(day => (
                    <div key={day.day} className={`text-center p-1.5 rounded-lg ${
                      day.isRest ? 'bg-dark-700' :
                      day.workoutType === 'strength' ? 'bg-blue-500/20' :
                      day.workoutType === 'plyometric' ? 'bg-orange-500/20' :
                      day.workoutType === 'basketball' ? 'bg-green-500/20' :
                      'bg-purple-500/20'
                    }`}>
                      <p className="text-xs text-gray-500">{DAY_LABELS[day.day]}</p>
                      <p className="text-xs mt-0.5">
                        {day.isRest ? '😴' :
                         day.workoutType === 'strength' ? '💪' :
                         day.workoutType === 'plyometric' ? '⚡' :
                         day.workoutType === 'basketball' ? '🏀' : '🧘'}
                      </p>
                    </div>
                  ))}
                </div>
                {/* Exercise list for each non-rest day */}
                <div className="space-y-3">
                  {phase.weeklyPlan.filter(d => !d.isRest).map(day => (
                    <div key={day.day}>
                      <p className="text-gray-500 text-xs font-bold mb-1.5 flex items-center gap-1">
                        <span>{DAY_LABELS[day.day]}요일</span>
                        <span className="text-gray-700">—</span>
                        <span>{TYPE_LABELS[day.workoutType]}</span>
                      </p>
                      <div className="space-y-1.5">
                        {day.exercises.map((ex, i) => (
                          <div key={i} className="flex items-center gap-2 bg-dark-700/60 rounded-xl px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-xs font-bold truncate">{ex.nameKo}</p>
                              <p className="text-gray-600 text-xs">
                                {ex.sets}세트
                                {ex.reps ? ` × ${ex.reps}` : ''}
                                {ex.duration ? ` ${ex.duration}` : ''}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedExercise(ex)}
                              className="flex-shrink-0 text-gray-600 hover:text-orange-400 transition-colors text-xs px-2 py-1 rounded-lg hover:bg-orange-500/10"
                            >
                              ▶ 방법
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exercise demo modal */}
      {selectedExercise && (
        <ExerciseModal exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />
      )}

      {/* Log sheet — no backdrop-tap close: protects in-progress entries (ui-motion spec exception) */}
      {logging && (
        <div className="fixed inset-0 bg-black/80 z-20 flex items-end screen-fade-in">
          <div className="bg-dark-800 rounded-t-3xl w-full p-5 max-h-[85vh] overflow-y-auto safe-bottom sheet-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black text-lg">훈련 기록</h3>
              <button onClick={() => setLogging(false)} aria-label="닫기" className="text-gray-400 text-xl press w-10 h-10 -mr-2 flex items-center justify-center">✕</button>
            </div>

            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className="text-gray-400 text-xs font-bold mb-2 block">훈련 종류</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(TYPE_LABELS) as [WorkoutType, string][]).filter(([k]) => k !== 'rest').map(([k, v]) => (
                    <button key={k} onClick={() => setLogForm(f => ({ ...f, type: k }))}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        logForm.type === k ? 'bg-orange-500 text-white' : 'bg-dark-700 text-gray-400'
                      }`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-gray-400 text-xs font-bold mb-1 block">운동 시간 (분)</label>
                <input type="number" value={logForm.duration}
                  onChange={e => setLogForm(f => ({ ...f, duration: e.target.value }))}
                  className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 border border-gray-700 focus:border-orange-500 outline-none" />
              </div>

              {/* Vertical jump */}
              <div>
                <label className="text-gray-400 text-xs font-bold mb-1 block">
                  오늘 수직 점프 측정 (cm) - 선택
                </label>
                <input type="number" placeholder={profile.currentVertical.toString()}
                  value={logForm.verticalJump}
                  onChange={e => setLogForm(f => ({ ...f, verticalJump: e.target.value }))}
                  className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 border border-gray-700 focus:border-orange-500 outline-none" />
              </div>

              {/* Note */}
              <div>
                <label className="text-gray-400 text-xs font-bold mb-1 block">오늘 훈련 메모</label>
                <textarea value={logForm.note}
                  onChange={e => setLogForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="오늘 어떤 훈련을 했나요? 커뮤니티에 공유됩니다!"
                  rows={3}
                  className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 border border-gray-700 focus:border-orange-500 outline-none resize-none" />
              </div>

              {/* Mood */}
              <div>
                <label className="text-gray-400 text-xs font-bold mb-2 block">오늘 컨디션</label>
                <div className="flex justify-between">
                  {([1, 2, 3, 4, 5] as const).map(m => (
                    <button key={m} onClick={() => setLogForm(f => ({ ...f, mood: m }))}
                      className={`text-2xl p-2 rounded-xl transition-all ${logForm.mood === m ? 'bg-orange-500/30 scale-110' : ''}`}>
                      {MOOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Share toggle */}
              <div className="flex items-center justify-between bg-dark-700 rounded-xl p-4">
                <div>
                  <p className="text-white text-sm font-bold">커뮤니티에 공유</p>
                  <p className="text-gray-500 text-xs">같이 덩크 꿈꾸는 사람들과 공유</p>
                </div>
                <button
                  onClick={() => setLogForm(f => ({ ...f, share: !f.share }))}
                  className={`w-12 h-6 rounded-full transition-all ${logForm.share ? 'bg-orange-500' : 'bg-gray-700'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-all mx-0.5 ${logForm.share ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <button onClick={handleLogSubmit} className="btn-neon w-full text-base font-bold">
                기록 저장 ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
