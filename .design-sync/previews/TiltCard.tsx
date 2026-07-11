import { TiltCard } from 'dunk-shot'

// TiltCard is a parallax wrapper — it tilts its children toward the cursor.
// At rest (how a static card renders) it shows the styled children, so each
// cell pairs the component with realistic on-brand content.

const cardBase = {
  width: 240,
  borderRadius: 20,
  overflow: 'hidden',
  background: 'linear-gradient(160deg,#1b2233,#0e1320)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
  color: '#fff',
  fontFamily: 'Oswald, system-ui, sans-serif',
} as const

const stage = {
  padding: 36,
  display: 'flex',
  justifyContent: 'center',
  background: '#0A0F1A',
} as const

export function Default() {
  return (
    <div style={stage}>
      <TiltCard style={cardBase}>
        <div
          style={{
            height: 132,
            background: 'radial-gradient(circle at 50% 28%, #FF6B2C, #FF4D1F 60%, #7a1f08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 56,
          }}
        >
          🏀
        </div>
        <div style={{ padding: '14px 16px 18px' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: '#FFB627', fontWeight: 700 }}>DUNK DICTIONARY</div>
          <div style={{ fontSize: 23, fontWeight: 700, marginTop: 4 }}>윈드밀 덩크</div>
          <div style={{ fontSize: 13, color: '#FFB627', marginTop: 6 }}>★★★★☆</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 8, lineHeight: 1.5 }}>
            팔 전체로 원을 그리며 내리꽂는 시그니처 덩크.
          </div>
        </div>
      </TiltCard>
    </div>
  )
}

export function StatTile() {
  return (
    <div style={stage}>
      <TiltCard intensity={0.9} style={{ ...cardBase, width: 200 }}>
        <div style={{ padding: 22, textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>VERTICAL</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 24, color: '#FF4D1F', margin: '16px 0' }}>72cm</div>
          <div style={{ fontSize: 12, color: '#22C55E' }}>▲ 이번 주 +3cm</div>
        </div>
      </TiltCard>
    </div>
  )
}
