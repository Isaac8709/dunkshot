import { useState, useRef, lazy, Suspense, useEffect } from 'react'
import { useGameStore } from '@/store/useGameStore'
import type { DunkFeedback } from '@/game/scenes/CourtScene'
import { audioManager } from '@/utils/audio'
import { storage } from '@/utils/storage'
import { useCountUp } from '@/utils/useCountUp'

const PhaserGame = lazy(() => import('@/game3d/Game3D'))

export default function GameScreen() {
  const { setScreen, unlockedDunkIds, unlockDunk } = useGameStore()
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [, setDunkCount] = useState<Record<string, number>>({})
  const [showUnlock, setShowUnlock] = useState<string | null>(null)
  const [scorePulse, setScorePulse] = useState(false)
  const [showHint, setShowHint] = useState(true)   // always visible by default; toggle via ⌨ button
  const [timeLeft, setTimeLeft] = useState(60)
  const [heldKeys, setHeldKeys] = useState<string[]>([])
  const [lastFeedback, setLastFeedback] = useState<DunkFeedback | null>(null)
  const [sessionFocus, setSessionFocus] = useState('림 접근 S등급 3회 · 서로 다른 덩크 5종 성공')
  const [gameOver, setGameOver] = useState<null | { score: number; dunks: number; maxCombo: number; perfects: number; best: number; isNewBest: boolean }>(null)
  const [restartKey, setRestartKey] = useState(0)
  // Final-score ticker for the session report (spec: dashboard-grade numbers count up)
  const finalScoreDisplay = useCountUp(gameOver?.score ?? 0, 1200)

  // On mount, remove focus from any React button so SPACE doesn't accidentally
  // trigger a "click" on (for example) the EXIT button.
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null
    if (active && active !== document.body) active.blur()
  }, [])

  const handleTimerUpdate = (secs: number) => setTimeLeft(secs)

  const handleGameOver = (finalScore: number, stats: { dunks: number; maxCombo: number; perfects: number }) => {
    const best = storage.loadHighScore()
    const isNewBest = finalScore > best
    if (isNewBest) storage.saveHighScore(finalScore)
    audioManager.playSfx('fanfare')
    setGameOver({
      score: finalScore,
      dunks: stats.dunks,
      maxCombo: stats.maxCombo,
      perfects: stats.perfects,
      best: isNewBest ? finalScore : best,
      isNewBest,
    })
  }

  const restart = () => {
    setScore(0); setCombo(0); setTimeLeft(60); setDunkCount({}); setGameOver(null)
    setRestartKey(k => k + 1)  // remounts PhaserGame → fresh round
  }

  // Keyboard hint stays open by default — user can toggle via ⌨ button.

  const [comboMs, setComboMs] = useState(0)
  const comboDeadlineRef = useRef<number>(0)

  const handleScoreUpdate = (s: number, c: number) => {
    setScore(s)
    setCombo(c)
    setScorePulse(true)
    setTimeout(() => setScorePulse(false), 300)
    audioManager.playSfx('swish')
    if (c > 1) audioManager.playSfx('combo')
    comboDeadlineRef.current = Date.now() + 4000  // 4s window for next combo
  }

  // Combo meter drain — rAF-driven so it stays frame-synced (a 50ms
  // setInterval visibly steps at 20fps on 60/120Hz screens). Stops ticking
  // while the meter is empty and resumes on the next combo.
  useEffect(() => {
    let raf: number
    const tick = () => {
      const remaining = Math.max(0, comboDeadlineRef.current - Date.now())
      setComboMs(prev => (prev === remaining ? prev : remaining))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleDunkPerformed = (dunkId: string) => {
    setDunkCount(prev => {
      const next = { ...prev, [dunkId]: (prev[dunkId] || 0) + 1 }
      const counts = next
      let unlockedAny = false
      const tryUnlock = (id: string, condition: () => boolean) => {
        if (!unlockedDunkIds.includes(id) && condition()) {
          unlockDunk(id)
          setShowUnlock(id)
          setTimeout(() => setShowUnlock(null), 3000)
          unlockedAny = true
        }
      }
      tryUnlock('basic_one', () => (counts['basic_two'] || 0) >= 5)
      tryUnlock('putback', () => (counts['basic_two'] || 0) >= 10)
      tryUnlock('alleyoop', () => (counts['basic_two'] || 0) >= 20)
      tryUnlock('tomahawk', () => (counts['basic_two'] || 0) >= 15)
      tryUnlock('reverse', () => (counts['basic_one'] || 0) >= 10)
      tryUnlock('tip_dunk', () => (counts['basic_one'] || 0) >= 20)
      tryUnlock('windmill', () => (counts['reverse'] || 0) >= 10)
      tryUnlock('cradle', () => (counts['basic_one'] || 0) >= 15)
      tryUnlock('three_sixty', () => (counts['windmill'] || 0) >= 5)
      tryUnlock('chaser', () => (counts['basic_two'] || 0) >= 30)
      tryUnlock('double_pump', () => (counts['tomahawk'] || 0) >= 10)
      tryUnlock('between_legs', () => (counts['three_sixty'] || 0) >= 3)
      tryUnlock('eastbay', () => (counts['between_legs'] || 0) >= 5)
      tryUnlock('freethrow_line', () =>
        ['basic_two', 'basic_one', 'reverse', 'windmill', 'three_sixty', 'between_legs',
          'alleyoop', 'tomahawk', 'cradle', 'putback', 'tip_dunk', 'chaser', 'double_pump', 'eastbay'
        ].every(id => unlockedDunkIds.includes(id))
      )
      if (unlockedAny) audioManager.playSfx('unlock')
      return next
    })
  }

  const clockSec = timeLeft
  const mmss = `${String(Math.floor(clockSec / 60)).padStart(2, '0')}:${String(clockSec % 60).padStart(2, '0')}`

  const handleDunkFeedback = (feedback: DunkFeedback) => {
    setLastFeedback(feedback)
    if (feedback.tier === 'perfect') setSessionFocus('다음 목표: 같은 덩크 말고 다른 스타일로 PERFECT 연결')
    else if (feedback.tier === 'miss') setSessionFocus(feedback.trainingCue)
    else setSessionFocus(`${feedback.name}: ${feedback.trainingCue}`)
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">

      {/* ============ TOP: Broadcast Scoreboard ============ */}
      <div className="absolute top-0 left-0 right-0 z-30 px-2 pt-2 safe-top pointer-events-none">
        <div
          className="pointer-events-auto mx-auto flex items-stretch overflow-hidden rounded-2xl w-full"
          style={{
            maxWidth: 420,
            background: 'linear-gradient(180deg, rgba(7,9,18,0.93) 0%, rgba(13,20,40,0.93) 100%)',
            border: '1px solid rgba(255,182,39,0.35)',
            boxShadow:
              '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.4) inset, 0 0 30px rgba(255,182,39,0.12)',
          }}
        >
          {/* Left: exit — tabIndex -1 so SPACE doesn't activate it */}
          <button
            className="press flex items-center justify-center px-2 text-orange-300 text-lg font-bold border-r border-white/10"
            onClick={() => { audioManager.playSfx('tap'); setScreen('menu') }}
            aria-label="exit"
            tabIndex={-1}
          >
            ←
          </button>

          {/* Clock */}
          <div className="px-2 py-1.5 border-r border-white/10 flex flex-col items-center justify-center">
            <span className="text-[7px] text-white/40 tracking-widest leading-none">CLOCK</span>
            <span
              className="text-white font-black mt-0.5"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px', letterSpacing: '0.02em' }}
            >
              {mmss}
            </span>
          </div>

          {/* Center: SCORE — flexes to fill */}
          <div className="flex-1 min-w-0 px-2 py-1.5 flex flex-col items-center justify-center relative">
            <span className="text-[7px] text-orange-300/80 tracking-[0.3em] leading-none">SCORE</span>
            <span
              key={score}
              className={`font-black transition-transform duration-300 mt-0.5 ${scorePulse ? 'scale-110' : 'scale-100'}`}
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '15px',
                color: '#FFB627',
                textShadow: '0 0 10px rgba(255,182,39,0.55)',
                letterSpacing: '0.02em',
              }}
            >
              {score.toLocaleString().padStart(5, '0')}
            </span>
          </div>

          {/* Combo */}
          <div className="px-2 py-1.5 border-l border-white/10 flex flex-col items-center justify-center">
            <span className="text-[7px] text-white/40 tracking-widest leading-none">COMBO</span>
            <span
              key={combo}
              className="font-black animate-pop-in mt-0.5"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '11px',
                color: combo >= 5 ? '#FF4D1F' : combo >= 2 ? '#FFB627' : '#6B7591',
                textShadow: combo >= 2 ? '0 0 8px rgba(255,182,39,0.55)' : 'none',
              }}
            >
              ×{combo}
            </span>
          </div>

          {/* Dunks */}
          <div className="px-2 py-1.5 border-l border-white/10 flex flex-col items-center justify-center">
            <span className="text-[7px] text-white/40 tracking-widest leading-none">DUNKS</span>
            <span
              className="text-white font-black mt-0.5"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}
            >
              {unlockedDunkIds.length}<span className="text-white/30 text-[8px]">/15</span>
            </span>
          </div>
        </div>

        {/* Combo meter — drains over 4s after each dunk */}
        {combo >= 1 && comboMs > 0 && (
          <div className="mx-auto mt-1.5 w-fit pointer-events-none" style={{ maxWidth: 420 }}>
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{
                width: 240,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,182,39,0.3)',
              }}
            >
              <div
                style={{
                  width: `${(comboMs / 4000) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #FF4D1F, #FFB627)',
                  boxShadow: '0 0 8px rgba(255,182,39,0.6)',
                  transition: 'width 0.1s linear',
                }}
              />
            </div>
            <p className="text-[8px] text-orange-300/80 text-center mt-0.5 tracking-widest font-mono">
              COMBO WINDOW
            </p>
          </div>
        )}

        {/* Hot streak ribbon */}
        {combo >= 3 && (
          <div
            className="mx-auto mt-2 px-4 py-1 rounded-full text-center w-fit animate-pop-in"
            style={{
              background: 'linear-gradient(90deg, #FF4D1F, #FFB627, #FF4D1F)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s linear infinite, pop-in 0.4s',
              boxShadow: '0 0 24px rgba(255,77,31,0.55)',
            }}
          >
            <span className="text-black text-[10px] font-black tracking-[0.3em]">
              🔥 HOT STREAK · {combo} COMBO 🔥
            </span>
          </div>
        )}
      </div>


      {/* ============ Coaching / Simulation HUD ============ */}
      <div className="absolute top-[88px] left-3 right-3 z-20 pointer-events-none flex justify-center">
        <div
          className="w-full max-w-[420px] rounded-2xl border px-3 py-2 backdrop-blur-md"
          style={{
            background: 'linear-gradient(180deg, rgba(3,5,16,0.76), rgba(13,20,40,0.58))',
            borderColor: lastFeedback ? `${lastFeedback.color}80` : 'rgba(255,255,255,0.14)',
            boxShadow: lastFeedback ? `0 0 28px ${lastFeedback.color}22` : '0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[8px] tracking-[0.28em] text-white/40 font-black">DUNK LAB COACH</p>
              <p className="text-[11px] text-white/90 font-bold truncate">
                {lastFeedback ? `${lastFeedback.name} · ${lastFeedback.style}` : '실전 시뮬레이션: 접근거리와 덩크별 타이밍이 다릅니다'}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[8px] text-white/40 tracking-widest">GRADE</p>
              <p className="font-black" style={{ color: lastFeedback?.color || '#FFB627', fontFamily: '"Press Start 2P", monospace', fontSize: 13 }}>
                {lastFeedback?.approachGrade || '—'}
              </p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-[9px] font-bold">
            <div className="rounded-lg bg-white/5 px-2 py-1 text-white/70">포커스: {sessionFocus}</div>
            <div className="rounded-lg bg-white/5 px-2 py-1 text-white/70">판정: {lastFeedback ? lastFeedback.tier.toUpperCase() : 'READY'}</div>
            <div className="rounded-lg bg-white/5 px-2 py-1 text-white/70">리스크: {lastFeedback?.risk || '개인 점프력 기반'}</div>
          </div>
        </div>
      </div>

      {/* ============ Phaser Canvas ============ */}
      <div className="flex-1">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center arena-bg h-full">
            <div className="text-center">
              <div
                className="text-6xl mb-4 animate-bounce"
                style={{ filter: 'drop-shadow(0 0 20px rgba(255,107,44,0.7))' }}
              >🏀</div>
              <p
                className="text-orange-300 tracking-[0.3em]"
                style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}
              >
                LOADING COURT...
              </p>
            </div>
          </div>
        }>
          <PhaserGame
            unlockedDunkIds={unlockedDunkIds}
            onScoreUpdate={handleScoreUpdate}
            key={restartKey}
            onDunkPerformed={handleDunkPerformed}
            onDunkFeedback={handleDunkFeedback}
            onKeysChange={setHeldKeys}
            onTimerUpdate={handleTimerUpdate}
            onGameOver={handleGameOver}
            timeAttack={true}
          />
        </Suspense>
      </div>

      {/* ============ BOTTOM: Action zone ============ */}
      {/* Live held-key indicator — appears above the DUNK button */}
      {heldKeys.length > 0 && (
        <div
          className="absolute bottom-28 right-4 z-20 flex flex-col items-end gap-1 pointer-events-none"
          aria-live="polite"
        >
          <span className="text-[8px] tracking-[0.3em] text-orange-300/80 font-black"
                style={{ fontFamily: '"Press Start 2P", monospace' }}>
            HOLDING
          </span>
          <div className="flex gap-1">
            {heldKeys.map(k => (
              <span
                key={k}
                className="animate-pop-in inline-flex items-center justify-center w-9 h-9 rounded-lg font-black"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: '13px',
                  background: 'linear-gradient(180deg, #FFB627, #FF6B2C)',
                  color: '#2A1A05',
                  border: '2px solid rgba(255,255,255,0.4)',
                  boxShadow: '0 0 16px rgba(255,182,39,0.7), 0 2px 0 rgba(0,0,0,0.4)',
                }}
              >
                {k}
              </span>
            ))}
            <span
              className="inline-flex items-center justify-center px-3 h-9 rounded-lg font-black text-white/60"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '10px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px dashed rgba(255,255,255,0.25)',
              }}
            >
              +SPC
            </span>
          </div>
        </div>
      )}

      {/* Big mobile dunk button — right (kept above the iOS home indicator) */}
      <div className="absolute right-4 z-20" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
        <button
          className="relative w-20 h-20 rounded-full text-white font-black active:scale-90 transition-transform"
          style={{
            background:
              'radial-gradient(circle at 35% 35%, #FF8A4D, #E63946 70%, #5B0E0E)',
            boxShadow:
              '0 6px 32px rgba(255,77,31,0.65), inset -4px -6px 12px rgba(0,0,0,0.4), inset 3px 3px 8px rgba(255,255,255,0.3)',
          }}
          onClick={(e) => {
            e.preventDefault()
            // Dispatch a pointerdown on the Phaser canvas to trigger dunk.
            const canvas = document.querySelector('#phaser-game canvas') as HTMLCanvasElement | null
            if (canvas) {
              const rect = canvas.getBoundingClientRect()
              const pd = new PointerEvent('pointerdown', {
                bubbles: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                pointerType: 'mouse',
                button: 0,
              })
              canvas.dispatchEvent(pd)
            }
          }}
          onTouchStart={(e) => e.preventDefault()}
          aria-label="dunk"
          tabIndex={-1}
        >
          <span className="text-3xl">🏀</span>
          <span
            className="absolute inset-0 rounded-full animate-ping pointer-events-none"
            style={{ background: 'rgba(255,107,44,0.3)' }}
          />
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-black tracking-[0.3em] text-orange-200 whitespace-nowrap"
            style={{ fontFamily: '"Press Start 2P", monospace' }}
          >
            DUNK
          </span>
        </button>
      </div>

      {/* Keyboard hint — auto-collapses (kept above the iOS home indicator) */}
      <div className="absolute left-4 z-20" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
        <button
          onClick={() => setShowHint(s => !s)}
          className="press w-10 h-10 rounded-full bg-black/60 border border-white/20 text-white/80 text-base backdrop-blur"
          aria-label="controls"
          tabIndex={-1}
        >
          ⌨
        </button>
        {showHint && (
          <div
            className="absolute bottom-12 left-0 bg-black/80 backdrop-blur rounded-xl p-2.5 border border-white/15 animate-pop-in"
            style={{
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              minWidth: 168,
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <p className="eyebrow text-orange-300/80 text-[9px]">CONTROLS</p>
              <button
                onClick={() => setShowHint(false)}
                className="text-white/40 text-xs hover:text-white/80"
                tabIndex={-1}
                aria-label="hide hint"
              >✕</button>
            </div>
            <div className="space-y-1.5 text-[10px] text-white/80 leading-tight">
              <p><kbd className="kbd">←↑↓→</kbd> 드리블 이동</p>
              <p><kbd className="kbd">SPACE</kbd> 양손 덩크</p>
              <p><kbd className="kbd">A</kbd>+ 원핸드</p>
              <p><kbd className="kbd">D</kbd>+ 윈드밀</p>
              <p><kbd className="kbd">W</kbd>+ 토마호크</p>
              <p><kbd className="kbd">S</kbd>+ 리버스</p>
              <p className="text-white/35 text-[9px] mt-1.5 pt-1 border-t border-white/10">
                4초 내 다음 덩크 → 콤보!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Unlock toast — bigger, more dramatic */}
      {showUnlock && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div
            className="text-white rounded-3xl px-8 py-5 text-center animate-pop-in"
            style={{
              background:
                'linear-gradient(135deg, #FFB627 0%, #FF6B2C 50%, #E63946 100%)',
              boxShadow:
                '0 20px 60px rgba(255,107,44,0.7), 0 0 0 2px rgba(255,255,255,0.25) inset, 0 0 80px rgba(255,182,39,0.5)',
              minWidth: 240,
            }}
          >
            <p className="eyebrow text-white/90 mb-1">🔓 NEW DUNK UNLOCKED</p>
            <p className="text-2xl font-black tracking-wide leading-tight mt-2">
              {showUnlock.replace(/_/g, ' ').toUpperCase()}
            </p>
            <div className="mt-2 inline-flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="text-yellow-200 text-sm">★</span>
              ))}
            </div>
          </div>
        </div>
      )}


      {gameOver && (
        <div className="absolute inset-0 z-50 bg-black/82 backdrop-blur-sm flex items-center justify-center px-5 screen-fade-in">
          <div className="w-full max-w-[380px] rounded-3xl border border-orange-300/40 bg-[#090d1a] p-6 text-center shadow-2xl animate-pop-in">
            <p className="eyebrow text-orange-300 mb-2">DUNK LAB SESSION REPORT</p>
            <h2 className="text-white text-3xl font-black mb-1">{gameOver.isNewBest ? '신기록!' : '훈련 완료'}</h2>
            <p className="text-orange-300 font-black text-4xl my-4" style={{ fontFamily: '"Press Start 2P", monospace' }}>{finalScoreDisplay}</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-white/5 p-3"><p className="text-white/40 text-[10px]">DUNKS</p><p className="text-white font-black">{gameOver.dunks}</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-white/40 text-[10px]">MAX COMBO</p><p className="text-white font-black">×{gameOver.maxCombo}</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-white/40 text-[10px]">PERFECT</p><p className="text-white font-black">{gameOver.perfects}</p></div>
            </div>
            <p className="text-white/60 text-xs mb-5 leading-relaxed">
              코칭 리포트: {lastFeedback?.trainingCue || '림 접근 거리와 마지막 두 스텝 타이밍을 계속 측정하세요.'}
            </p>
            <div className="flex gap-2">
              <button onClick={restart} className="btn-neon flex-1 py-3 text-sm font-black">다시 훈련</button>
              <button onClick={() => setScreen('training')} className="btn-ghost flex-1 py-3 text-sm font-black">훈련 플랜</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        kbd.kbd {
          font-family: "Press Start 2P", monospace;
          font-size: 10px;
          padding: 4px 7px;
          background: linear-gradient(180deg, #2A3450, #1A2238);
          border: 1px solid rgba(255,182,39,0.4);
          border-radius: 5px;
          color: #FFB627;
          margin-right: 6px;
          box-shadow: 0 2px 0 rgba(0,0,0,0.45);
          display: inline-block;
          letter-spacing: 0.04em;
          line-height: 1;
        }
      `}</style>
    </div>
  )
}
