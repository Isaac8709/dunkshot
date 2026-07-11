import { ScreenTransition } from 'dunk-shot'

// ScreenTransition wraps a screen and replays an enter animation whenever
// `screenKey` changes. A static card shows the wrapped screen content; the
// animation itself isn't visible in a screenshot (noted in NOTES.md).

export function Default() {
  return (
    <div style={{ width: 360, height: 300, background: '#0A0F1A', padding: 18, fontFamily: 'Oswald, system-ui, sans-serif' }}>
      <ScreenTransition screenKey="menu">
        <div style={{ color: '#fff' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: '#FFB627', fontWeight: 700 }}>MAIN MENU</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: '6px 0 18px' }}>덩크슛</h2>
          <button
            style={{ width: '100%', padding: '13px', borderRadius: 14, border: 'none', background: '#FF4D1F', color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 10 }}
          >
            게임 시작
          </button>
          <button
            style={{ width: '100%', padding: '13px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 600, fontSize: 15 }}
          >
            훈련 모드
          </button>
        </div>
      </ScreenTransition>
    </div>
  )
}
