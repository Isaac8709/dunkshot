import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { audioManager } from '@/utils/audio'

type Phase = 'court' | 'ball' | 'title' | 'quote' | 'start'

export default function SplashScreen() {
  const { setScreen, loadFromStorage } = useGameStore()
  const [phase, setPhase] = useState<Phase>('court')

  useEffect(() => {
    loadFromStorage()
    const t1 = setTimeout(() => setPhase('ball'),  600)
    const t2 = setTimeout(() => setPhase('title'), 1400)
    const t3 = setTimeout(() => setPhase('quote'), 2600)
    const t4 = setTimeout(() => setPhase('start'), 3800)
    return () => { [t1, t2, t3, t4].forEach(clearTimeout) }
  }, [])

  const handleStart = async () => {
    if (phase !== 'start') return
    await audioManager.unlock()
    audioManager.playSfx('fanfare')
    // Kick BGM right at the gesture — App.tsx will keep it alive across screens
    audioManager.playBgm().catch(() => {})
    const profile = useGameStore.getState().profile
    setScreen(profile ? 'menu' : 'setup')
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#070912]"
      onClick={handleStart}
      style={{ cursor: phase === 'start' ? 'pointer' : 'default', perspective: '1200px' }}
    >
      {/* PHASE 1: Court — zoom into hardwood floor */}
      <div
        className="absolute inset-0 transition-all duration-[1200ms] ease-out"
        style={{
          transform: phase === 'court' ? 'scale(1.4)' : 'scale(1)',
          opacity: phase === 'court' || phase === 'ball' ? 1 : 0.6,
        }}
      >
        {/* Hardwood floor with perspective */}
        <div
          className="absolute bottom-0 left-0 right-0 h-3/5"
          style={{
            background:
              'linear-gradient(to bottom, transparent, rgba(7,9,18,0.7) 4%, transparent 8%),' +
              'repeating-linear-gradient(90deg, rgba(0,0,0,0.2) 0 14px, transparent 14px 32px),' +
              'linear-gradient(to bottom, #B86A2C 0%, #7A3F18 60%, #4A2810 100%)',
            transform: 'perspective(500px) rotateX(58deg)',
            transformOrigin: '50% 0%',
            boxShadow: 'inset 0 60px 80px -40px rgba(255,182,39,0.25)',
          }}
        />
        {/* Three point arc on floor */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-[6%] w-[120%] h-32 rounded-t-full"
          style={{
            borderTop: '3px solid rgba(255,255,255,0.5)',
            transform: 'perspective(500px) rotateX(58deg)',
            transformOrigin: '50% 100%',
          }}
        />
        {/* Center logo on court */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-[20%] w-40 h-20 rounded-t-full opacity-30"
          style={{
            border: '2px solid rgba(255,182,39,0.6)',
            transform: 'perspective(500px) rotateX(58deg)',
            transformOrigin: '50% 100%',
          }}
        />
      </div>

      {/* Atmospheric light beams from above */}
      <div
        className="absolute top-0 left-0 right-0 h-3/5 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(255,182,39,0.22) 0%, rgba(255,107,44,0.12) 30%, transparent 70%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 100 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 0.5,
              height: Math.random() * 2 + 0.5,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 55}%`,
              opacity: Math.random() * 0.6 + 0.1,
              animation: `pulse ${Math.random() * 3 + 2}s infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* PHASE 2: Basketball drops from sky */}
      <div
        className="absolute left-1/2 -translate-x-1/2 transition-all duration-[800ms]"
        style={{
          top: '20%',
          transform:
            phase === 'court'
              ? 'translate(-50%, -150%) scale(0.6) rotate(0deg)'
              : phase === 'ball'
              ? 'translate(-50%, 0%) scale(1) rotate(720deg)'
              : 'translate(-50%, -10%) scale(0.55) rotate(900deg)',
          opacity: phase === 'court' ? 0 : phase === 'ball' ? 1 : 0.85,
          transitionTimingFunction: phase === 'ball' ? 'cubic-bezier(0.5, 0, 0.75, 0)' : 'cubic-bezier(0.16,1,0.3,1)',
          filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.6))',
        }}
      >
        <div
          className="w-28 h-28 rounded-full relative"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #FF9555, #E63946 70%, #4A0F0F)',
            boxShadow:
              '0 0 60px rgba(255,107,44,0.7), inset -10px -16px 32px rgba(0,0,0,0.55), inset 6px 6px 12px rgba(255,255,255,0.25)',
          }}
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
            <path d="M 50,3 Q 78,50 50,97" stroke="#1A0500" strokeWidth="2.5" fill="none" opacity="0.85" />
            <path d="M 3,50 Q 50,78 97,50" stroke="#1A0500" strokeWidth="2.5" fill="none" opacity="0.85" />
            <circle cx="50" cy="50" r="46" stroke="#7A1F0E" strokeWidth="1.5" fill="none" opacity="0.5" />
            <path d="M 50,3 L 50,97" stroke="#1A0500" strokeWidth="1" fill="none" opacity="0.45" />
          </svg>
        </div>
      </div>

      {/* PHASE 3+: Title */}
      <div
        className="relative z-10 text-center"
        style={{
          transform:
            phase === 'court' || phase === 'ball'
              ? 'translateY(40px) scale(0.85)'
              : 'translateY(0) scale(1)',
          opacity: phase === 'court' || phase === 'ball' ? 0 : 1,
          transition: 'all 700ms cubic-bezier(0.16,1,0.3,1)',
          marginTop: '4rem',
        }}
      >
        <p className="eyebrow mb-3" style={{ color: '#FFB627', letterSpacing: '0.5em' }}>
          KOREAN · DUNK · LEAGUE
        </p>

        {/* Title — KO + EN stacked */}
        <h1
          className="title-hero text-[88px] leading-[0.85] tracking-tighter"
          style={{
            fontWeight: 900,
            filter: 'drop-shadow(0 4px 32px rgba(255,107,44,0.7))',
          }}
        >
          덩크슛
        </h1>

        {/* Pixel subtitle with horizontal bars */}
        <div className="flex items-center justify-center gap-3 mt-1 mb-1">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-orange-400/70" />
          <p
            className="text-orange-300/80 tracking-[0.4em] font-black"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '11px' }}
          >
            DUNK · SHOT
          </p>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-orange-400/70" />
        </div>

        <p className="text-white/50 text-xs mt-1.5 tracking-wider">
          이승환 헌정 · 진짜 덩크슛을 위한 여정
        </p>
      </div>

      {/* Quote (phase 4) */}
      <div
        className="relative z-10 max-w-sm text-center mt-7 px-6"
        style={{
          opacity: phase === 'quote' || phase === 'start' ? 1 : 0,
          transform: phase === 'quote' || phase === 'start' ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 600ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <p className="text-white/70 text-sm leading-loose">
          "언젠가 나도 저 하늘 높이 날아서
          <br />
          <span className="title-display text-lg">덩크슛</span>을 꽂고 싶어..."
        </p>
        <p className="text-white/30 text-xs mt-3 tracking-widest">— 이승환</p>
      </div>

      {/* Start prompt (phase 5) */}
      <div
        className="relative z-10 mt-10 text-center"
        style={{
          opacity: phase === 'start' ? 1 : 0,
          transform: phase === 'start' ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
          transition: 'all 600ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-orange-400/50 bg-black/50 backdrop-blur-md">
          <span className="relative inline-flex w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-75" />
            <span className="relative w-2.5 h-2.5 rounded-full bg-orange-400" />
          </span>
          <p
            className="text-orange-200 font-black tracking-[0.32em]"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}
          >
            TAP TO ENTER COURT
          </p>
        </div>
        <p className="text-white/45 text-xs mt-4 italic">
          아들 앞에서 덩크슛 하는 그 날까지
        </p>
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(7,9,18,0.7) 100%)',
        }}
      />

      {/* Version stamp */}
      <p className="absolute bottom-3 text-white/20 text-[10px] z-10 tracking-[0.3em] font-mono">
        v1.2.0  ·  PREMIUM EDITION
      </p>
    </div>
  )
}
