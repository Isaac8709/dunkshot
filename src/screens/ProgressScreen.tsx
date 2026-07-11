import { useGameStore } from '@/store/useGameStore'
import { calculateDunkRequirement } from '@/utils/trainingCalculator'
import { useCountUp } from '@/utils/useCountUp'
import { format, parseISO, startOfMonth, eachDayOfInterval, endOfMonth, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function ProgressScreen() {
  const { profile, sessions, setScreen } = useGameStore()

  const jumpSessions = sessions.filter(s => s.verticalJump).sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const latestJump = jumpSessions[jumpSessions.length - 1]?.verticalJump || profile?.currentVertical || 0
  const firstJump = profile?.currentVertical || 0
  const improvement = latestJump - firstJump

  // Hooks must run unconditionally — count-ups live above the profile guard.
  const req = profile ? calculateDunkRequirement(profile) : null
  const progressPctRaw = req ? Math.min(100, Math.round((latestJump / req.requiredVertical) * 100)) : 0
  const progressPctDisplay = useCountUp(progressPctRaw)
  const latestJumpDisplay = useCountUp(latestJump)

  if (!profile || !req) return null

  // Calendar
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const trainingDays = new Set(sessions.map(s => format(parseISO(s.date), 'yyyy-MM-dd')))

  // Stats
  const totalSessions = sessions.length
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0)
  const streakDays = (() => {
    let streak = 0
    const sorted = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const seenDates = new Set(sorted.map(s => format(parseISO(s.date), 'yyyy-MM-dd')))
    for (let i = 0; ; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = format(d, 'yyyy-MM-dd')
      if (seenDates.has(key)) streak++
      else break
    }
    return streak
  })()

  const progressPct = progressPctRaw

  // Jump history for mini chart
  const chartData = [
    { label: '시작', value: firstJump },
    ...jumpSessions.slice(-5).map(s => ({
      label: format(parseISO(s.date), 'M/d'),
      value: s.verticalJump!
    }))
  ]
  const maxVal = Math.max(...chartData.map(d => d.value), req.requiredVertical)
  const minVal = Math.min(...chartData.map(d => d.value)) - 5

  return (
    <div className="fixed inset-0 arena-bg flex flex-col safe-top safe-bottom">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <button onClick={() => setScreen('menu')} aria-label="뒤로" className="text-white/60 text-xl press w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">←</button>
        <div>
          <p className="eyebrow text-orange-300/70">STATS · 성장 기록</p>
          <h2 className="title-display text-2xl">나의 성장</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4 stagger-children">
        {/* Main progress ring */}
        <div className="card-dark p-5">
          <div className="flex items-center gap-5">
            {/* SVG progress circle */}
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                <defs>
                  <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF4D1F" />
                    <stop offset="50%" stopColor="#FF6B2C" />
                    <stop offset="100%" stopColor="#FFB627" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,107,44,0.15)" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#progressGrad)" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - progressPct / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-orange-400 font-black text-2xl">{progressPctDisplay}%</span>
                <span className="text-gray-500 text-xs">달성</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div>
                <p className="text-gray-500 text-xs">현재 점프력</p>
                <p className="text-white font-black text-2xl">{latestJumpDisplay}<span className="text-sm text-gray-400">cm</span></p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">목표</p>
                <p className="text-orange-400 font-bold">{req.requiredVertical}cm</p>
              </div>
              {improvement > 0 && (
                <div className="bg-green-500/15 rounded-lg px-3 py-1.5">
                  <p className="text-green-400 text-xs font-bold">+{improvement}cm 향상!</p>
                </div>
              )}
              {req.gap <= 0 && (
                <div className="bg-orange-500/20 rounded-lg px-3 py-1.5">
                  <p className="text-orange-400 text-xs font-bold">🎉 덩크 가능!</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 progress-bar-bg h-3">
            <div className="progress-bar-fill h-full" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>시작: {firstJump}cm</span>
            {req.gap > 0 && <span>앞으로 {req.gap}cm</span>}
            <span>목표: {req.requiredVertical}cm</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '총 훈련', value: `${totalSessions}회`, icon: '💪' },
            { label: '총 시간', value: `${Math.floor(totalDuration / 60)}h`, icon: '⏱️' },
            { label: '연속 훈련', value: `${streakDays}일`, icon: '🔥' },
          ].map(stat => (
            <div key={stat.label} className="card-dark p-3 text-center">
              <p className="text-xl mb-1">{stat.icon}</p>
              <p className="text-white font-black text-lg">{stat.value}</p>
              <p className="text-gray-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Jump chart — empty state until there are at least 2 data points */}
        {chartData.length <= 1 && (
          <div className="card-dark p-5 text-center">
            <h3 className="text-white font-bold mb-2 text-sm">수직 점프 성장 그래프</h3>
            <p className="text-3xl mb-2">📈</p>
            <p className="text-gray-500 text-xs leading-relaxed">
              훈련 기록에 점프 측정값을 남기면<br />성장 그래프가 여기에 나타나요
            </p>
          </div>
        )}
        {chartData.length > 1 && (
          <div className="card-dark p-4">
            <h3 className="text-white font-bold mb-3 text-sm">수직 점프 성장 그래프</h3>
            <div className="relative h-32">
              {/* Goal line */}
              <div className="absolute w-full border-t border-dashed border-orange-500/40"
                style={{ bottom: `${((req.requiredVertical - minVal) / (maxVal - minVal)) * 100}%` }}>
                <span className="text-orange-400 text-xs ml-1">목표 {req.requiredVertical}cm</span>
              </div>
              {/* Bars */}
              <div className="absolute inset-0 flex items-end gap-2 px-2">
                {chartData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-white text-xs font-bold">{d.value}</span>
                    <div className="w-full rounded-t-lg"
                      style={{
                        height: `${((d.value - minVal) / (maxVal - minVal)) * 85}%`,
                        background: i === chartData.length - 1
                          ? 'linear-gradient(to top, #FF4D1F, #FFB627)'
                          : 'linear-gradient(to top, rgba(255,107,44,0.4), rgba(255,107,44,0.6))',
                        boxShadow: i === chartData.length - 1 ? '0 0 12px rgba(255,107,44,0.4)' : 'none',
                        minHeight: 4,
                      }}
                    />
                    <span className="text-gray-600 text-xs">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Training calendar */}
        <div className="card-dark p-4">
          <h3 className="text-white font-bold mb-3 text-sm">
            {format(today, 'yyyy년 M월', { locale: ko })} 훈련 달력
          </h3>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} className="text-center text-gray-600 text-xs">{d}</div>
            ))}
          </div>
          {/* Fill leading empty cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: days[0].getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd')
              const isToday = isSameDay(day, today)
              const trained = trainingDays.has(key)
              return (
                <div key={key} className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold ${
                  isToday ? 'ring-2 ring-orange-500' : ''
                } ${
                  trained ? 'bg-orange-500 text-white' :
                  day > today ? 'bg-dark-700 text-gray-700' : 'bg-dark-700 text-gray-500'
                }`}>
                  {format(day, 'd')}
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span>훈련 완료</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-dark-700 ring-1 ring-orange-500" />
              <span>오늘</span>
            </div>
          </div>
        </div>

        {/* Milestone */}
        <div className="card-dark p-4">
          <h3 className="text-white font-bold mb-3 text-sm">🎯 달성 마일스톤</h3>
          {[
            { label: '림 터치 (손끝)', jump: req.standingReach >= 305 ? 0 : 305 - req.standingReach, desc: '점프 없이 림에 손 닿기' },
            { label: '원핸드 팁', jump: Math.max(0, req.requiredVertical - 10), desc: '한 손으로 림 터치 가능' },
            { label: '첫 덩크슛!', jump: req.requiredVertical, desc: '양손으로 공 꽂기' },
            { label: '리버스 덩크', jump: req.requiredVertical + 10, desc: '뒤로 돌아 덩크' },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                latestJump >= m.jump ? 'bg-green-500' : 'bg-dark-700'
              }`}>
                {latestJump >= m.jump ? '✓' : '○'}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${latestJump >= m.jump ? 'text-green-400 line-through' : 'text-white'}`}>
                  {m.label}
                </p>
                <p className="text-gray-600 text-xs">{m.desc}</p>
              </div>
              {latestJump < m.jump && (
                <span className="text-orange-400 text-xs">+{m.jump - latestJump}cm</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
