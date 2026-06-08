import { useState } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { calculateDunkRequirement } from '@/utils/trainingCalculator'
import { audioManager } from '@/utils/audio'
import { useCountUp } from '@/utils/useCountUp'
import SettingsPanel from '@/components/SettingsPanel'
import TiltCard from '@/components/TiltCard'

type SecondaryItem = {
  screen: 'training' | 'progress' | 'dunks' | 'community'
  icon: string
  title: string
  caption: string
  gradient: string
  glow: string
}

const SECONDARY: SecondaryItem[] = [
  { screen: 'training',  icon: '💪', title: '훈련',     caption: 'TRAINING',
    gradient: 'linear-gradient(135deg, #5BC0EB 0%, #2E86AB 100%)',
    glow: 'rgba(91,192,235,0.35)' },
  { screen: 'progress',  icon: '📈', title: '성장',     caption: 'STATS',
    gradient: 'linear-gradient(135deg, #22C55E 0%, #15803D 100%)',
    glow: 'rgba(34,197,94,0.35)' },
  { screen: 'dunks',     icon: '📖', title: '도감',     caption: 'COLLECTION',
    gradient: 'linear-gradient(135deg, #9B59B6 0%, #6C2D8C 100%)',
    glow: 'rgba(155,89,182,0.35)' },
  { screen: 'community', icon: '👥', title: '커뮤',     caption: 'CREW',
    gradient: 'linear-gradient(135deg, #FFB627 0%, #FF8A1F 100%)',
    glow: 'rgba(255,182,39,0.35)' },
]

export default function MainMenuScreen() {
  const { profile, sessions, setScreen, unlockedDunkIds } = useGameStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (!profile) return null

  const req = calculateDunkRequirement(profile)
  const totalSessions = sessions.length
  const latestJump = sessions.find(s => s.verticalJump)?.verticalJump || profile.currentVertical
  const progressPct = Math.min(100, Math.round((req.currentVertical / req.requiredVertical) * 100))

  // Animated counters
  const jumpDisplay = useCountUp(latestJump, 1100)
  const gapDisplay = useCountUp(Math.max(0, req.gap), 1100)
  const sessionDisplay = useCountUp(totalSessions, 900)
  const dunkDisplay = useCountUp(unlockedDunkIds.length, 900)

  const go = (s: 'game' | 'training' | 'progress' | 'dunks' | 'community') => {
    audioManager.playSfx('tap')
    setScreen(s)
  }

  return (
    <div className="fixed inset-0 arena-bg flex flex-col overflow-hidden safe-top safe-bottom">
      {/* Top status strip */}
      <div className="px-5 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative inline-flex w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-75" />
            <span className="relative w-2.5 h-2.5 rounded-full bg-orange-400" />
          </span>
          <p className="eyebrow text-orange-300/90">ARENA · LIVE</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { audioManager.playSfx('tap'); setSettingsOpen(true) }}
            className="w-11 h-11 rounded-full bg-white/5 border border-white/10 text-white/80 press text-lg flex items-center justify-center"
            aria-label="settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 stagger-children">

        {/* Player banner — avatar + name only */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl animate-glow flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #FF6B2C 0%, #E63946 100%)',
              boxShadow: '0 6px 18px -2px rgba(255,107,44,0.6), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            {profile.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="eyebrow text-white/50">WELCOME BACK</p>
            <h1 className="text-white font-black text-2xl truncate" style={{ letterSpacing: '-0.02em' }}>
              {profile.name}
            </h1>
          </div>
          <span className="chip chip-orange">📏 {profile.height}cm</span>
        </div>

        {/* HERO — PLAY card (dominant) */}
        <TiltCard
          onClick={() => go('game')}
          className="hero-play-card press tap-ripple mb-3 cursor-pointer"
          intensity={0.5}
        >
          {/* Light follow gradient */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at var(--lx,50%) var(--ly,40%), rgba(255,255,255,0.18), transparent 60%)',
              transition: 'background 0.2s',
            }}
          />
          {/* Diagonal hardwood pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-15"
            style={{
              background:
                'repeating-linear-gradient(90deg, rgba(0,0,0,0.5) 0 1px, transparent 1px 28px)',
            }}
          />
          {/* Big basketball orb */}
          <div
            className="absolute -right-8 -bottom-10 w-44 h-44 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 35% 30%, #FF9555, #E63946 70%, #4A0F0F)',
              boxShadow: '0 0 60px rgba(255,107,44,0.5), inset -10px -16px 32px rgba(0,0,0,0.5)',
              transform: 'translateZ(40px)',
            }}
          >
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-70">
              <path d="M 50,2 Q 78,50 50,98" stroke="#1A0500" strokeWidth="2" fill="none" />
              <path d="M 2,50 Q 50,78 98,50" stroke="#1A0500" strokeWidth="2" fill="none" />
            </svg>
          </div>

          <div className="relative p-6" style={{ transform: 'translateZ(20px)' }}>
            <p
              className="font-black tracking-[0.32em] text-[10px]"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                color: '#FFFFFF',
                opacity: 0.85,
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
            >
              DUNK LAB PRO
            </p>
            <h2
              className="font-black text-5xl mt-2 leading-none"
              style={{
                letterSpacing: '-0.04em',
                color: '#FFFFFF',
                textShadow: '0 2px 16px rgba(0,0,0,0.45)',
              }}
            >
              덩크<br />
              <span style={{ color: '#FFE093' }}>시뮬레이터</span>
            </h2>

            <div className="mt-4 flex items-center gap-2">
              <div className="chip chip-gold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                LIVE
              </div>
              <span className="text-white/70 text-sm font-bold tracking-wide">60초 코칭 세션 시작 →</span>
            </div>

            <p className="text-white/60 text-xs mt-3 font-mono tracking-wider">
              덩크별 접근거리·체공시간·실패 원인이 다른 실전 랩 · {unlockedDunkIds.length} / 15 해제
            </p>
          </div>
        </TiltCard>

        {/* Stat row — 3 metric cards */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <StatTile
            label="현재 점프"
            value={jumpDisplay}
            unit="cm"
            accent="#FF6B2C"
          />
          <StatTile
            label="목표까지"
            value={req.gap <= 0 ? 0 : gapDisplay}
            unit="cm"
            accent="#FFB627"
            highlight={req.gap <= 0 ? '🎉 가능!' : undefined}
          />
          <StatTile
            label="훈련 횟수"
            value={sessionDisplay}
            unit="회"
            accent="#5BC0EB"
          />
        </div>

        {/* Premium training/simulation promise */}
        <div className="card-premium px-4 py-3 mb-3 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-orange-400/10 blur-2xl" />
          <p className="eyebrow text-orange-300 mb-2">PRO TRAINING STACK</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/5 p-2"><p className="text-lg">🎮</p><p className="text-white text-[10px] font-bold">스타일별 물리</p></div>
            <div className="rounded-xl bg-white/5 p-2"><p className="text-lg">📋</p><p className="text-white text-[10px] font-bold">개인 훈련</p></div>
            <div className="rounded-xl bg-white/5 p-2"><p className="text-lg">📈</p><p className="text-white text-[10px] font-bold">성장 리포트</p></div>
          </div>
        </div>

        {/* Dunk progress bar — slim, centered */}
        <div className="card-premium px-4 py-3 mb-3 relative">
          <div className="flex justify-between items-center text-[10px] tracking-widest font-mono mb-2">
            <span className="text-white/40">진행률</span>
            <span className="text-orange-300 font-bold">{progressPct}%</span>
            <span className="text-white/40">{req.requiredVertical}cm</span>
          </div>
          <div className="progress-bar-bg h-2">
            <div className="progress-bar-fill h-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Secondary menu — 2x2 grid */}
        <p className="eyebrow text-white/40 mt-4 mb-2.5 px-1">MENU</p>
        <div className="grid grid-cols-2 gap-3">
          {SECONDARY.map((item) => (
            <SecondaryCard
              key={item.screen}
              item={item}
              onClick={() => go(item.screen)}
            />
          ))}
        </div>

        {/* Footer line — collected dunks */}
        <div className="mt-5 mb-2 text-center">
          <p className="text-white/30 text-[10px] tracking-widest font-mono">
            DUNK CODEX · {dunkDisplay} / 15
          </p>
          <p className="text-white/40 text-xs italic mt-2">
            "{req.estimatedMonths > 0
              ? `앞으로 ${req.estimatedMonths}개월. 한 걸음씩.`
              : '오늘 코트에서 증명하세요.'}"
          </p>
        </div>
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Hero card styles */}
      <style>{`
        .hero-play-card {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          background:
            linear-gradient(135deg, #FF4D1F 0%, #E63946 50%, #8B1A1A 100%);
          border: 1px solid rgba(255,182,39,0.4);
          box-shadow:
            0 20px 50px -12px rgba(230,57,70,0.55),
            0 0 0 1px rgba(255,255,255,0.08) inset,
            0 1px 0 rgba(255,255,255,0.2) inset;
          min-height: 180px;
        }
      `}</style>
    </div>
  )
}

function StatTile({ label, value, unit, accent, highlight }: {
  label: string; value: number; unit: string; accent: string; highlight?: string
}) {
  return (
    <div
      className="card-premium px-3 py-3 relative overflow-hidden"
      style={{ borderColor: `${accent}33`, minHeight: 72 }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      <p className="text-white/45 text-[10px] tracking-widest font-mono truncate">{label}</p>
      {highlight ? (
        <p className="text-sm font-black mt-1 leading-tight" style={{ color: accent }}>
          {highlight}
        </p>
      ) : (
        <p className="font-black mt-1 leading-none flex items-baseline" style={{ color: '#FFFFFF' }}>
          <span style={{
            fontFamily: '"Noto Sans KR", sans-serif',
            fontSize: '26px',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            textShadow: `0 0 12px ${accent}55`,
            color: accent,
          }}>{value}</span>
          <span className="text-white/40 text-[11px] ml-1">{unit}</span>
        </p>
      )}
    </div>
  )
}

function SecondaryCard({ item, onClick }: { item: SecondaryItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tap-ripple press relative overflow-hidden text-left p-4 rounded-2xl"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 50%),' +
          'linear-gradient(180deg, #1A2238 0%, #131A2E 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: `0 8px 20px -10px ${item.glow}`,
        minHeight: 110,
      }}
    >
      {/* Top accent strip */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: item.gradient, boxShadow: `0 0 10px ${item.glow}` }}
      />
      {/* Icon orb */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-2"
        style={{
          background: item.gradient,
          boxShadow: `0 4px 12px -2px ${item.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
        }}
      >
        {item.icon}
      </div>
      <p className="text-white font-black text-base">{item.title}</p>
      <p className="text-white/40 text-[10px] mt-0.5 font-mono tracking-widest">
        {item.caption}
      </p>
    </button>
  )
}
