# design-sync notes — dunk-shot

## Context
- **This repo is a PWA game app, NOT a design system.** This sync is a best-effort
  *trial* of the 4 UI components under `src/components/` (TiltCard, ScreenTransition,
  SettingsPanel, ExerciseModal), per the user's explicit choice. Project: "Dunk Shot UI".
- Shape is `package` with **no library build** — the app builds to a deployable bundle,
  not a component library (`main`/`exports` absent).

## How the build is wired (re-sync needs all of this)
- **Custom named-export entry**: `--entry ./.design-sync/build/ds-entry.tsx`. The 4
  components are `export default`, so a synth `export *` entry would NOT expose them.
  ds-entry.tsx re-exports each as a named export → `window.DunkShotUI.<Name>`.
- **node_modules must be installed**: run `npm ci` first (react/phaser must resolve).
  Build cmd: `node .ds-sync/package-build.mjs --config .design-sync/config.json
  --node-modules ./node_modules --entry ./.design-sync/build/ds-entry.tsx --out ./ds-bundle`
- **Phaser is stubbed**: ExerciseModal embeds a Phaser canvas; bundling Phaser made
  `_ds_bundle.js` 6.7 MB (> the 5 MB upload limit). `cfg.tsconfig` →
  `.design-sync/build/tsconfig.dssync.json` aliases `phaser` →
  `.design-sync/build/phaser-stub.js`. The stub must satisfy module-eval
  `class ExerciseScene extends Phaser.Scene` AND ExercisePhaserGame's useEffect
  (`game.events.on`, `game.scene.start/getScene`, `game.destroy`). With the stub the
  bundle is ~82 KB.
- **Render check uses system Chrome**: `export DS_CHROMIUM_PATH="/Applications/Google
  Chrome.app/Contents/MacOS/Google Chrome"` — no chromium download. `playwright` npm
  pkg is installed under `.ds-sync/`.

## Known render warns (recorded — not new on re-sync)
- `[RENDER_THIN]` on **SettingsPanel** and **ExerciseModal**: both are `position: fixed`
  full-screen overlays, so document height measures 0. BENIGN — the authored previews
  wrap each in a `transform: translateZ(0)` sized box, which makes the wrapper the
  containing block for the fixed overlay so it's framed inside the card. Confirmed via
  `_screenshots/review/` (both render fully and on-brand).
- `[FONT_REMOTE]` "Press Start 2P" (+ Bebas Neue, Oswald, Noto Sans KR): loaded via a
  Google Fonts `@import` (see CSS note below), not shipped @font-face. Expected.

## Authored-preview notes
- **ExerciseModal**: the embedded animation panel renders EMPTY by design (Phaser
  stubbed). The rest of the modal chrome is the real component. Not a defect.
- **ScreenTransition**: a pure animation wrapper — no static variant axis, so a single
  cell is correct.

## Re-sync risks (watch-list)
- **`cfg.cssEntry` = `.design-sync/build/ds-styles.css` inlines a COPY of the compiled
  app CSS.** It was built as: `Google Fonts @import` line + the contents of
  `dist/assets/index-<hash>.css`. That source filename is content-hashed and changes on
  every `npm run build`. **On re-sync: rebuild ds-styles.css from the current
  `dist/assets/index-*.css`** (run `npm run build`, then regenerate the combined file)
  or the component styling goes stale.
- **Phaser stub is tied to `src/game/ExercisePhaserGame.tsx` + `ExerciseScene.ts`.** If
  their Phaser API surface changes, the stub may throw at module-eval and blank the
  whole bundle (one IIFE). Re-check the stub if ExerciseModal renders empty.
- Fonts load over the network (Google Fonts) at render time — needs connectivity.
- Only `src/components/` was scoped. Screens (`src/screens/`) and 3D/game pieces were
  intentionally excluded.
