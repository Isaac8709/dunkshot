import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Court3D } from './Court3D'
import { GameWorld, type DunkEvent } from './GameWorld'
import { DUNK_CATALOG } from './dunkCatalog'
import type { Game3DProps, DunkFeedback } from './types'

export default function Game3D({
  unlockedDunkIds,
  onScoreUpdate,
  onDunkPerformed,
  onDunkFeedback,
  onKeysChange,
  onTimerUpdate,
  onGameOver,
  timeAttack,
}: Game3DProps) {
  // ---- Input state ----
  const heldRef = useRef<Set<string>>(new Set())
  const [heldDisplay, setHeldDisplay] = useState<string[]>([])
  const [shootTrigger, setShootTrigger] = useState(0)
  const [netImpulse, setNetImpulse] = useState(0)
  void netImpulse

  // ---- Scoring state ----
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const dunksRef = useRef(0)
  const perfectsRef = useRef(0)
  const lastDunkAtRef = useRef(0)
  const [, forceRender] = useState(0)

  // ---- Timer (time-attack) ----
  const [secondsLeft, setSecondsLeft] = useState(60)
  const timerActiveRef = useRef(!!timeAttack)
  useEffect(() => {
    if (!timeAttack) return
    timerActiveRef.current = true
    setSecondsLeft(60)
    const id = setInterval(() => {
      setSecondsLeft(s => {
        const next = Math.max(0, s - 1)
        onTimerUpdate?.(next)
        if (next === 0) {
          timerActiveRef.current = false
          onGameOver?.(scoreRef.current, {
            dunks: dunksRef.current,
            maxCombo: maxComboRef.current,
            perfects: perfectsRef.current,
          })
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [timeAttack, onTimerUpdate, onGameOver])

  // ---- Keyboard listeners ----
  useEffect(() => {
    const norm = (e: KeyboardEvent): string | null => {
      const k = e.key
      if (k === ' ') return 'SPACE'
      if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') return k
      if (k.length === 1) return k.toUpperCase()
      return null
    }
    const down = (e: KeyboardEvent) => {
      const k = norm(e)
      if (!k) return
      if (k === 'SPACE') e.preventDefault()
      if (!heldRef.current.has(k)) {
        heldRef.current.add(k)
        const list = Array.from(heldRef.current)
        setHeldDisplay(list)
        onKeysChange?.(list)
        if (k === 'SPACE') setShootTrigger(v => v + 1)
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = norm(e)
      if (!k) return
      if (heldRef.current.delete(k)) {
        const list = Array.from(heldRef.current)
        setHeldDisplay(list)
        onKeysChange?.(list)
      }
    }
    const blur = () => { heldRef.current.clear(); setHeldDisplay([]); onKeysChange?.([]) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [onKeysChange])

  // ---- Mobile virtual controls ----
  const press = (k: string) => {
    if (!heldRef.current.has(k)) {
      heldRef.current.add(k)
      setHeldDisplay(Array.from(heldRef.current))
    }
    if (k === 'SPACE') setShootTrigger(v => v + 1)
  }
  const release = (k: string) => {
    heldRef.current.delete(k)
    setHeldDisplay(Array.from(heldRef.current))
  }

  // ---- Dunk resolution ----
  const handleDunk = (ev: DunkEvent) => {
    const now = performance.now()
    if (ev.tier === 'miss') {
      comboRef.current = 0
    } else {
      const sinceLast = now - lastDunkAtRef.current
      if (sinceLast < 4000) comboRef.current += 1
      else comboRef.current = 1
      lastDunkAtRef.current = now
      if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current
      const comboBonus = 1 + Math.min(0.5, (comboRef.current - 1) * 0.1)
      scoreRef.current += Math.round(ev.points * comboBonus)
      dunksRef.current += 1
      if (ev.tier === 'perfect') perfectsRef.current += 1
      onScoreUpdate(scoreRef.current, comboRef.current)
      onDunkPerformed(ev.spec.id)
      setNetImpulse(1)
    }
    const fb: DunkFeedback = ev.feedback
    onDunkFeedback?.(fb)
    forceRender(x => x + 1)
  }

  // ---- HUD ----
  const heldMods = heldDisplay.filter(k => k !== 'SPACE')
  const upcoming = DUNK_CATALOG
    .filter(d => unlockedDunkIds.includes(d.id) || d.id === 'basic_two')
    .filter(d => {
      const need = d.keys.filter(k => k !== 'SPACE')
      return need.length > 0 && need.every(k => heldMods.includes(k))
    })
    .sort((a, b) => b.keys.length - a.keys.length)[0]

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: 'linear-gradient(180deg,#1A2740 0%,#0A0F1A 100%)',
      overflow: 'hidden', userSelect: 'none', touchAction: 'none',
    }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 5, 11], fov: 60, near: 0.1, far: 120 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.45} />
        <directionalLight
          castShadow
          position={[6, 12, 4]}
          intensity={1.2}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-2}
        />
        <directionalLight position={[-8, 6, -4]} intensity={0.35} color="#88CCFF" />
        <hemisphereLight args={['#FFE0B2', '#1A0F2E', 0.25]} />

        {/* Sky/arena backdrop */}
        <color attach="background" args={['#0A0F1A']} />
        <fog attach="fog" args={['#0A0F1A', 18, 45]} />

        <Court3D />
        <GameWorld
          unlockedDunkIds={unlockedDunkIds}
          heldKeys={new Set(heldDisplay)}
          shootTrigger={shootTrigger}
          onDunkEvent={handleDunk}
          onNetImpulse={() => setNetImpulse(1)}
        />
      </Canvas>

      {/* HUD: combo + dunk preview */}
      <div style={{
        position: 'absolute', top: 12, left: 12, color: '#fff',
        fontFamily: 'system-ui,-apple-system,sans-serif', pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 14, opacity: 0.8 }}>SCORE</div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{scoreRef.current.toLocaleString()}</div>
        {comboRef.current > 1 && (
          <div style={{ fontSize: 16, color: '#FFB627', marginTop: 4 }}>
            x{comboRef.current} COMBO
          </div>
        )}
        {timeAttack && (
          <div style={{ marginTop: 8, fontSize: 18, color: secondsLeft <= 10 ? '#FF4D1F' : '#fff' }}>
            ⏱ {secondsLeft}s
          </div>
        )}
      </div>

      {/* Upcoming dunk preview */}
      {upcoming && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          padding: '8px 12px', borderRadius: 8,
          border: `2px solid ${upcoming.color}`,
          fontFamily: 'system-ui,sans-serif',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>다음 덩크</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: upcoming.color }}>{upcoming.name}</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>난이도 {'★'.repeat(upcoming.difficulty)}</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, maxWidth: 220 }}>{upcoming.cue}</div>
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
            누름: {upcoming.keys.map(k => k === 'SPACE' ? '⎵' : k).join(' + ')}
          </div>
        </div>
      )}

      {/* Held key indicator */}
      <div style={{
        position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0) + 100px)',
        left: 12, display: 'flex', gap: 6, flexWrap: 'wrap',
        pointerEvents: 'none',
      }}>
        {heldDisplay.map(k => (
          <span key={k} style={{
            background: k === 'SPACE' ? '#FF4D1F' : '#5BC0EB',
            color: '#fff', padding: '4px 8px', borderRadius: 4,
            fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
          }}>{k === 'SPACE' ? '⎵' : k}</span>
        ))}
      </div>

      {/* Mobile virtual controls */}
      <MobileControls onPress={press} onRelease={release} />

      {/* Instructions overlay (auto-hides after first dunk) */}
      {dunksRef.current === 0 && (
        <div style={{
          position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0) + 12px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.65)', color: '#fff',
          padding: '8px 14px', borderRadius: 8, fontSize: 12,
          fontFamily: 'system-ui,sans-serif', pointerEvents: 'none',
          textAlign: 'center', maxWidth: 360,
        }}>
          ← ↑ ↓ → 이동 · ⎵ 가까이서 덩크 / 멀리서 슈팅 · A/S/D/W/Q/E... 누른 채 ⎵ = 특수 덩크
        </div>
      )}
    </div>
  )
}

function MobileControls({ onPress, onRelease }: { onPress: (k: string) => void; onRelease: (k: string) => void }) {
  const btnStyle = (bg: string): React.CSSProperties => ({
    width: 56, height: 56, borderRadius: '50%',
    background: bg, color: '#fff', border: 'none', fontSize: 18,
    fontWeight: 800, touchAction: 'none', userSelect: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
  })
  const mk = (k: string, label: string, bg: string) => (
    <button
      style={btnStyle(bg)}
      onPointerDown={e => { e.preventDefault(); onPress(k) }}
      onPointerUp={e => { e.preventDefault(); onRelease(k) }}
      onPointerCancel={() => onRelease(k)}
      onPointerLeave={() => onRelease(k)}
    >{label}</button>
  )
  return (
    <>
      {/* Left D-pad */}
      <div style={{
        position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0) + 16px)',
        left: 12,
        display: 'grid', gridTemplateColumns: '56px 56px 56px', gridTemplateRows: '56px 56px 56px',
        gap: 4,
      }}>
        <div />{mk('ArrowUp', '↑', '#334')}<div />
        {mk('ArrowLeft', '←', '#334')}<div />{mk('ArrowRight', '→', '#334')}
        <div />{mk('ArrowDown', '↓', '#334')}<div />
      </div>
      {/* Right action cluster */}
      <div style={{
        position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0) + 16px)',
        right: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {mk('A', 'A', '#5BC0EB')}
          {mk('S', 'S', '#5BC0EB')}
          {mk('D', 'D', '#5BC0EB')}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {mk('W', 'W', '#C58FE0')}
          {mk('Q', 'Q', '#C58FE0')}
          {mk('E', 'E', '#C58FE0')}
        </div>
        {mk('SPACE', '덩크', '#FF4D1F')}
      </div>
    </>
  )
}
