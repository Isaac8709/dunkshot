import { SettingsPanel } from 'dunk-shot'

// SettingsPanel is a full-screen bottom-sheet overlay (position: fixed).
// It reads live state from the app's audioManager singleton, so the open
// state renders the real BGM / SFX controls.
//
// The wrapper sets a `transform`, which makes it the containing block for the
// panel's `position: fixed` — so the bottom sheet is framed inside the card
// (420x560, matching cfg.overrides) instead of escaping to the viewport.

export function Open() {
  return (
    <div style={{ position: 'relative', width: 420, height: 560, transform: 'translateZ(0)', overflow: 'hidden', background: '#0A0F1A' }}>
      <SettingsPanel open onClose={() => {}} />
    </div>
  )
}
