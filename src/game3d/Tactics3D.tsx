import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Court3D } from './Court3D'
import { Hoop3D } from './Hoop3D'
import { TacticsWorld, type PlayEvent } from './TacticsWorld'

interface Tactics3DProps {
  repKey: number
  onPlayEvent: (ev: PlayEvent) => void
  onPhaseHint: (hint: string) => void
}

/**
 * Canvas + input shell for the tactics trainer.
 * Keyboard: arrows = dribble/move · P = pass to the roller · SPACE = finish.
 * Mobile: left D-pad + PASS / FINISH buttons.
 */
export default function Tactics3D({ repKey, onPlayEvent, onPhaseHint }: Tactics3DProps) {
  const heldRef = useRef<Set<string>>(new Set())
  const [heldDisplay, setHeldDisplay] = useState<string[]>([])
  const [passTrigger, setPassTrigger] = useState(0)
  const [finishTrigger, setFinishTrigger] = useState(0)
  const [netImpulse, setNetImpulse] = useState(0)

  useEffect(() => {
    const norm = (e: KeyboardEvent): string | null => {
      if (e.key === ' ') return 'SPACE'
      if (e.key.startsWith('Arrow')) return e.key
      if (e.key.length === 1) return e.key.toUpperCase()
      return null
    }
    const down = (e: KeyboardEvent) => {
      const k = norm(e)
      if (!k) return
      if (k === 'SPACE') e.preventDefault()
      if (!heldRef.current.has(k)) {
        heldRef.current.add(k)
        setHeldDisplay(Array.from(heldRef.current))
        if (k === 'SPACE') setFinishTrigger(v => v + 1)
        if (k === 'P') setPassTrigger(v => v + 1)
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = norm(e)
      if (k && heldRef.current.delete(k)) setHeldDisplay(Array.from(heldRef.current))
    }
    const blur = () => { heldRef.current.clear(); setHeldDisplay([]) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const press = (k: string) => {
    if (!heldRef.current.has(k)) {
      heldRef.current.add(k)
      setHeldDisplay(Array.from(heldRef.current))
    }
  }
  const release = (k: string) => {
    heldRef.current.delete(k)
    setHeldDisplay(Array.from(heldRef.current))
  }

  return (
    <div className="relative w-full h-full" style={{ background: 'linear-gradient(180deg,#1A2740 0%,#0A0F1A 100%)' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 5, 11], fov: 60, near: 0.1, far: 120 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight
          castShadow position={[6, 12, 4]} intensity={1.2}
          shadow-mapSize-width={1024} shadow-mapSize-height={1024}
          shadow-camera-left={-12} shadow-camera-right={12}
          shadow-camera-top={12} shadow-camera-bottom={-2}
        />
        <directionalLight position={[-8, 6, -4]} intensity={0.35} color="#88CCFF" />
        <hemisphereLight args={['#FFE0B2', '#1A0F2E', 0.25]} />
        <color attach="background" args={['#0A0F1A']} />
        <fog attach="fog" args={['#0A0F1A', 18, 45]} />

        <Court3D />
        <Hoop3D netImpulse={netImpulse} onDecay={setNetImpulse} />
        <TacticsWorld
          heldKeys={new Set(heldDisplay)}
          passTrigger={passTrigger}
          finishTrigger={finishTrigger}
          repKey={repKey}
          onPlayEvent={onPlayEvent}
          onNetImpulse={() => setNetImpulse(1)}
          onPhaseHint={onPhaseHint}
        />
      </Canvas>

      {/* Mobile virtual controls */}
      <div style={{
        position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', left: 12,
        display: 'grid', gridTemplateColumns: '52px 52px 52px', gridTemplateRows: '52px 52px 52px', gap: 4,
      }}>
        <div />{padBtn('ArrowUp', '↑', press, release)}<div />
        {padBtn('ArrowLeft', '←', press, release)}<div />{padBtn('ArrowRight', '→', press, release)}
        <div />{padBtn('ArrowDown', '↓', press, release)}<div />
      </div>
      <div style={{
        position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', right: 12,
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
      }}>
        <button
          onPointerDown={e => { e.preventDefault(); setPassTrigger(v => v + 1) }}
          aria-label="패스"
          className="press"
          style={{
            width: 64, height: 64, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
            background: 'linear-gradient(135deg,#5BC0EB,#2E86AB)', color: '#fff',
            fontWeight: 900, fontSize: 13, boxShadow: '0 4px 16px rgba(91,192,235,0.4)',
            touchAction: 'none', userSelect: 'none',
          }}
        >패스<br /><span style={{ fontSize: 9, opacity: 0.8 }}>P</span></button>
        <button
          onPointerDown={e => { e.preventDefault(); setFinishTrigger(v => v + 1) }}
          aria-label="마무리"
          className="press"
          style={{
            width: 72, height: 72, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
            background: 'radial-gradient(circle at 35% 35%, #FF8A4D, #E63946 70%, #5B0E0E)', color: '#fff',
            fontWeight: 900, fontSize: 13, boxShadow: '0 6px 24px rgba(255,77,31,0.55)',
            touchAction: 'none', userSelect: 'none',
          }}
        >마무리<br /><span style={{ fontSize: 9, opacity: 0.8 }}>SPACE</span></button>
      </div>
    </div>
  )
}

function padBtn(k: string, label: string, press: (k: string) => void, release: (k: string) => void) {
  return (
    <button
      key={k}
      aria-label={k}
      onPointerDown={e => { e.preventDefault(); press(k) }}
      onPointerUp={e => { e.preventDefault(); release(k) }}
      onPointerCancel={() => release(k)}
      onPointerLeave={() => release(k)}
      style={{
        width: 52, height: 52, borderRadius: '50%', background: '#334', color: '#fff',
        border: 'none', fontSize: 17, fontWeight: 800, touchAction: 'none', userSelect: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
      }}
    >{label}</button>
  )
}
