import { useState, lazy, Suspense } from 'react'
import { useGameStore } from '@/store/useGameStore'
import type { PlayEvent } from '@/game3d/TacticsWorld'
import { audioManager } from '@/utils/audio'
import { useCountUp } from '@/utils/useCountUp'

const Tactics3D = lazy(() => import('@/game3d/Tactics3D'))

const TOTAL_REPS = 5

const GRADE_STYLE: Record<PlayEvent['grade'], { color: string; label: string }> = {
  perfect: { color: '#FFB627', label: 'PERFECT' },
  good:    { color: '#22C55E', label: 'GOOD' },
  normal:  { color: '#5BC0EB', label: 'OK' },
  early:   { color: '#C58FE0', label: 'EARLY' },
  miss:    { color: '#FF6B7A', label: 'MISS' },
}

export default function TacticsScreen() {
  const { setScreen } = useGameStore()
  const [rep, setRep] = useState(1)
  const [repKey, setRepKey] = useState(0)
  const [events, setEvents] = useState<PlayEvent[]>([])
  const [lastEvent, setLastEvent] = useState<PlayEvent | null>(null)
  const [hint, setHint] = useState('')
  const [sessionOver, setSessionOver] = useState(false)
  const [showIntro, setShowIntro] = useState(true)

  const totalScore = events.reduce((s, e) => s + e.points, 0)
  const finalScoreDisplay = useCountUp(sessionOver ? totalScore : 0, 1200)

  const handlePlayEvent = (ev: PlayEvent) => {
    audioManager.playSfx(ev.grade === 'miss' || ev.grade === 'early' ? 'rim' : ev.grade === 'perfect' ? 'combo' : 'swish')
    setLastEvent(ev)
    setEvents(prev => {
      const next = [...prev, ev]
      // next rep (or wrap up) after a beat so the player sees the result
      setTimeout(() => {
        if (next.length >= TOTAL_REPS) {
          audioManager.playSfx('fanfare')
          setSessionOver(true)
        } else {
          setRep(next.length + 1)
          setRepKey(k => k + 1)
          setLastEvent(null)
        }
      }, 1800)
      return next
    })
  }

  const restart = () => {
    setEvents([]); setLastEvent(null); setRep(1); setSessionOver(false)
    setRepKey(k => k + 1)
  }

  const perfects = events.filter(e => e.grade === 'perfect').length
  const makes = events.filter(e => e.grade !== 'miss' && e.grade !== 'early').length

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-2 safe-top pointer-events-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScreen('training')}
            aria-label="뒤로"
            className="pointer-events-auto press w-10 h-10 rounded-full bg-black/60 border border-white/20 text-white/80 flex items-center justify-center backdrop-blur"
          >←</button>
          <div className="scoreboard px-3 py-2 text-[10px] flex-1 flex items-center justify-between">
            <span>PICK &amp; ROLL</span>
            <span>REP {Math.min(rep, TOTAL_REPS)}/{TOTAL_REPS}</span>
            <span>{totalScore}점</span>
          </div>
        </div>

        {/* Phase hint / coaching line */}
        {(hint || lastEvent) && (
          <div className="mt-2 mx-auto max-w-[360px]">
            {lastEvent ? (
              <div className="animate-pop-in rounded-2xl border px-4 py-3 text-center backdrop-blur bg-black/70"
                style={{ borderColor: `${GRADE_STYLE[lastEvent.grade].color}66` }}>
                <p className="font-black text-sm" style={{ color: GRADE_STYLE[lastEvent.grade].color }}>
                  {GRADE_STYLE[lastEvent.grade].label} · {lastEvent.label} {lastEvent.points > 0 && `+${lastEvent.points}`}
                </p>
                <p className="text-white/60 text-xs mt-1">{lastEvent.cue}</p>
              </div>
            ) : (
              <div className="rounded-xl bg-black/55 border border-white/10 px-3 py-2 text-center backdrop-blur">
                <p className="text-orange-200 text-xs font-bold">{hint}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3D court */}
      <div className="flex-1">
        <Suspense fallback={
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <div className="text-5xl animate-bounce">🏀</div>
            <p className="label-gold text-xs">LOADING PLAYBOOK...</p>
          </div>
        }>
          <Tactics3D repKey={repKey} onPlayEvent={handlePlayEvent} onPhaseHint={setHint} />
        </Suspense>
      </div>

      {/* Intro overlay */}
      {showIntro && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center px-5 screen-fade-in">
          <div className="w-full max-w-[380px] rounded-3xl border border-ice/40 bg-[#090d1a] p-6 animate-pop-in" style={{ borderColor: 'rgba(91,192,235,0.4)' }}>
            <p className="eyebrow text-orange-300 mb-1">TACTICS TRAINING</p>
            <h2 className="text-white text-2xl font-black mb-3">픽앤롤 (2 대 2)</h2>
            <ol className="text-white/75 text-sm space-y-2 mb-4 leading-relaxed">
              <li><b className="text-orange-300">1.</b> 동료가 올라와 수비에게 <b>스크린</b>을 겁니다</li>
              <li><b className="text-orange-300">2.</b> 방향키로 <b>스크린 쪽으로 드리블</b> — 수비가 걸립니다</li>
              <li><b className="text-orange-300">3.</b> 동료가 림으로 <b>롤</b> — 프리해지는 순간 <b className="text-ice" style={{ color: '#5BC0EB' }}>P (패스)</b></li>
              <li><b className="text-orange-300">4.</b> 내 앞이 열렸으면 <b className="text-orange-300">SPACE (직접 마무리)</b></li>
            </ol>
            <p className="text-white/40 text-xs mb-4">판정은 패스/슛 순간의 수비 간격으로 계산됩니다 — 진짜 농구처럼 "언제"가 전부예요.</p>
            <button onClick={() => setShowIntro(false)} className="btn-neon w-full py-3 font-black">시작 · {TOTAL_REPS}회 반복</button>
          </div>
        </div>
      )}

      {/* Session report */}
      {sessionOver && (
        <div className="absolute inset-0 z-50 bg-black/82 backdrop-blur-sm flex items-center justify-center px-5 screen-fade-in">
          <div className="w-full max-w-[380px] rounded-3xl border border-orange-300/40 bg-[#090d1a] p-6 text-center shadow-2xl animate-pop-in">
            <p className="eyebrow text-orange-300 mb-2">PLAYBOOK SESSION REPORT</p>
            <h2 className="text-white text-3xl font-black mb-1">픽앤롤 훈련 완료</h2>
            <p className="text-orange-300 font-black text-4xl my-4" style={{ fontFamily: '"Press Start 2P", monospace' }}>{finalScoreDisplay}</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-white/5 p-3"><p className="text-white/40 text-[10px]">성공</p><p className="text-white font-black">{makes}/{TOTAL_REPS}</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-white/40 text-[10px]">PERFECT</p><p className="text-white font-black">{perfects}</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-white/40 text-[10px]">평균</p><p className="text-white font-black">{Math.round(totalScore / TOTAL_REPS)}</p></div>
            </div>
            <p className="text-white/60 text-xs mb-5 leading-relaxed">
              코칭 리포트: {(() => {
                const fails = events.filter(e => e.grade === 'miss' || e.grade === 'early')
                return fails[fails.length - 1]?.cue
                  ?? '패스 타이밍이 안정적이에요. 다음엔 스위치 상황에서 미스매치 공략을 연습해보세요.'
              })()}
            </p>
            <div className="flex gap-2">
              <button onClick={restart} className="btn-neon flex-1 py-3 text-sm font-black">다시 훈련</button>
              <button onClick={() => setScreen('training')} className="btn-ghost flex-1 py-3 text-sm font-black">훈련 플랜</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
