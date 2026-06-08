/**
 * AudioManager — handles BGM and SFX for 덩크슛
 *
 * Strategy:
 *   1. Try to load `/audio/dunkshot.mp3` (a user-provided, legally-owned file).
 *   2. If the file is missing / fails to decode, fall back to a procedurally
 *      generated, royalty-free synth track using the Web Audio API.
 *   3. SFX (whoosh, swish, rim, combo) are always synthesized — no audio
 *      assets required.
 *
 * Browsers require a user gesture before audio can start. `unlock()` must be
 * called from a click/tap handler at least once (we do this on the splash
 * screen's "TAP TO START" button).
 */

type SfxName = 'whoosh' | 'swish' | 'rim' | 'combo' | 'unlock' | 'tap' | 'fanfare' | 'dribble' | 'miss'

interface AudioState {
  bgmVolume: number    // 0..1
  sfxVolume: number    // 0..1
  bgmMuted: boolean
  sfxMuted: boolean
  bgmSource: 'file' | 'synth' | 'none'
}

const STORAGE_KEY = 'dunkshot_audio_settings'

const DEFAULT_STATE: AudioState = {
  bgmVolume: 0.5,
  sfxVolume: 0.7,
  // BGM defaults to MUTED. Synth/file BGM was distracting during gameplay
  // testing; user must explicitly unmute in Settings to hear it.
  bgmMuted: true,
  sfxMuted: false,
  bgmSource: 'none',
}

class AudioManagerImpl {
  private state: AudioState = { ...DEFAULT_STATE }
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private bgmGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private bgmAudioEl: HTMLAudioElement | null = null
  private synthNodes: AudioNode[] = []
  private synthInterval: number | null = null
  private unlocked = false
  private listeners = new Set<(s: AudioState) => void>()

  constructor() {
    this.loadSettings()
  }

  // ----------------------------------------------------------------------
  // Persistence
  // ----------------------------------------------------------------------
  private loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        // bgmSource is RUNTIME state — never restore it from storage,
        // or a stale 'synth'/'file' value will short-circuit playBgm()
        // forever after the next page load.
        const { bgmSource: _ignored, ...persistable } = parsed || {}
        this.state = { ...DEFAULT_STATE, ...persistable }

        // One-time migration: if the user is on the legacy default (BGM
        // unmuted, 50% volume) — which was the OLD default that auto-played
        // synth music as soon as they tapped through splash — force-mute it.
        // The user explicitly asked to kill background music. They can still
        // unmute manually in Settings if they want it back.
        const MIGRATED_FLAG = '__bgmMutedMigrated_v1'
        if (!parsed[MIGRATED_FLAG]) {
          this.state.bgmMuted = true
          ;(this.state as any)[MIGRATED_FLAG] = true
          this.saveSettings()
        }
      }
    } catch {}
  }
  private saveSettings() {
    try {
      const { bgmSource: _ignored, ...persistable } = this.state
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable))
    } catch {}
  }

  getState(): AudioState { return { ...this.state } }

  subscribe(fn: (s: AudioState) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private emit() { this.listeners.forEach(l => l(this.getState())) }

  // ----------------------------------------------------------------------
  // Unlock (must be called from a user gesture)
  // ----------------------------------------------------------------------
  async unlock(): Promise<void> {
    if (this.unlocked) return
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      this.ctx = new Ctx()
      this.masterGain = this.ctx.createGain()
      this.bgmGain = this.ctx.createGain()
      this.sfxGain = this.ctx.createGain()
      this.bgmGain.connect(this.masterGain)
      this.sfxGain.connect(this.masterGain)
      this.masterGain.connect(this.ctx.destination)
      this.applyVolumes()

      if (this.ctx.state === 'suspended') await this.ctx.resume()
      this.unlocked = true
    } catch (e) {
      console.warn('Audio unlock failed:', e)
    }
  }

  private applyVolumes() {
    if (!this.ctx || !this.bgmGain || !this.sfxGain) return
    const bg = this.state.bgmMuted ? 0 : this.state.bgmVolume
    const sfx = this.state.sfxMuted ? 0 : this.state.sfxVolume
    this.bgmGain.gain.setTargetAtTime(bg, this.ctx.currentTime, 0.05)
    this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05)
    if (this.bgmAudioEl) this.bgmAudioEl.volume = bg
  }

  // ----------------------------------------------------------------------
  // BGM
  // ----------------------------------------------------------------------
  async playBgm(): Promise<void> {
    if (!this.unlocked) return
    // Respect mute: if user has BGM muted (default), don't start the BGM
    // pipeline at all. Even with bgmGain.gain = 0 the synth scheduler keeps
    // firing oscillators and consuming CPU. Skip cleanly until user unmutes.
    if (this.state.bgmMuted) return
    // Already playing AND the underlying source is actually alive?
    // HMR / scene swaps can leave bgmSource stuck at 'file'|'synth' while
    // the actual <audio> element has been GC'd — detect & recover.
    if (this.state.bgmSource === 'file' && this.bgmAudioEl && !this.bgmAudioEl.paused) {
      return
    }
    // For synth, require the scheduling interval to be alive too — bgmGain alone
    // persists across HMR even after stopSynthBgm() clears the interval.
    if (this.state.bgmSource === 'synth' && this.bgmGain && this.synthInterval) {
      return
    }
    // Otherwise: stale flag → reset and re-init
    this.state.bgmSource = 'none'
    if (this.bgmAudioEl) {
      try { this.bgmAudioEl.pause() } catch {}
      this.bgmAudioEl = null
    }

    // 1) Try the user's audio file first
    const fileOk = await this.tryPlayFileBgm()
    if (fileOk) {
      this.state.bgmSource = 'file'
      this.emit()
      return
    }

    // 2) Fallback to synthesized royalty-free track
    this.startSynthBgm()
    this.state.bgmSource = 'synth'
    this.emit()
  }

  stopBgm() {
    if (this.bgmAudioEl) {
      this.bgmAudioEl.pause()
      this.bgmAudioEl.currentTime = 0
      this.bgmAudioEl = null
    }
    this.stopSynthBgm()
    this.state.bgmSource = 'none'
    this.emit()
  }

  private tryPlayFileBgm(): Promise<boolean> {
    return new Promise(resolve => {
      const el = new Audio('/audio/dunkshot.mp3')
      el.loop = true
      el.volume = this.state.bgmMuted ? 0 : this.state.bgmVolume
      el.preload = 'auto'

      const onCanPlay = () => {
        el.play().then(() => {
          this.bgmAudioEl = el
          resolve(true)
        }).catch(() => resolve(false))
        cleanup()
      }
      const onError = () => { cleanup(); resolve(false) }
      const cleanup = () => {
        el.removeEventListener('canplaythrough', onCanPlay)
        el.removeEventListener('error', onError)
      }

      el.addEventListener('canplaythrough', onCanPlay, { once: true })
      el.addEventListener('error', onError, { once: true })

      // Safety timeout
      setTimeout(() => { cleanup(); resolve(false) }, 1500)
    })
  }

  /**
   * Original sports-arena anthem BGM, royalty-free.
   * Mimics the feel of slam-dunk / NBA hype tracks WITHOUT copying any melody.
   *
   * Structure (4-bar progression at ~128 BPM):
   *   Am  - F  - C  - G       (i - VI - III - VII in A minor)
   *
   * Layers:
   *   - Kick: four-on-the-floor with reinforced 1 + 3
   *   - Snare-like noise burst on 2 and 4 (backbeat)
   *   - Closed hi-hat on offbeat 8ths
   *   - Sub-bass: octave-jumping 8th pattern (sports-pump feel)
   *   - Brass-like saw lead (anthemic motif, my own composition)
   *   - String pad (triangle wave) holding chord
   */
  private startSynthBgm() {
    if (!this.ctx || !this.bgmGain) return
    const ctx = this.ctx
    const out = this.bgmGain

    // ~128 BPM → quarter beat = 0.469s, but to keep numbers clean: beat = 0.46s
    const beat = 0.46
    const barLen = beat * 4

    // Chord roots & scale degrees (Hz)
    // Am-F-C-G in low octave
    const chords = [
      { root: 110.0, third: 130.81, fifth: 164.81, name: 'Am' }, // A3
      { root:  87.3, third: 110.0,  fifth: 130.81, name: 'F'  }, // F2 - inversion
      { root: 130.81,third: 164.81, fifth: 196.0,  name: 'C'  }, // C3
      { root:  98.0, third: 123.47, fifth: 146.83, name: 'G'  }, // G2
    ]

    // Anthemic lead motif (relative scale degrees, in A minor: A=1, B=2, C=3, D=4, E=5, F=6, G=7)
    // A simple rising motif with a punch: 1-3-5-3 | 6-5-3-1 | 3-5-1↑-5 | 5-4-3-2
    // Mapped to Hz frequencies of A minor:
    const leadMotif = [
      // Bar 1 (over Am): A4 C5 E5 C5
      [440, 523.25, 659.25, 523.25],
      // Bar 2 (over F): F4 A4 C5 A4
      [349.23, 440, 523.25, 440],
      // Bar 3 (over C): C5 E5 G5 E5
      [523.25, 659.25, 783.99, 659.25],
      // Bar 4 (over G): G4 B4 D5 B4
      [392, 493.88, 587.33, 493.88],
    ]

    let bar = 0
    const scheduleBar = (when: number) => {
      const c = chords[bar % chords.length]
      const lead = leadMotif[bar % leadMotif.length]
      bar++

      // ---- KICK on every beat (four-on-the-floor) ----
      for (let i = 0; i < 4; i++) {
        const isAccent = (i === 0 || i === 2)
        this.playKick(when + i * beat, out, isAccent ? 0.55 : 0.40)
      }

      // ---- SNARE backbeat (beats 2 and 4) ----
      this.playSnare(when + beat, out)
      this.playSnare(when + 3 * beat, out)

      // ---- HI-HAT on offbeat 8ths ----
      for (let i = 0; i < 8; i++) {
        const offset = (i % 2 === 1) ? 0 : beat * 0.5  // accent offbeats
        this.playHat(when + (i * beat / 2) + offset * 0.001, out, i % 4 === 3 ? 0.10 : 0.06)
      }

      // ---- SUB BASS — pumping 8th pattern (root, octave, root, fifth) ----
      const bassPattern = [c.root, c.root * 2, c.root, c.fifth, c.root, c.root * 2, c.fifth, c.fifth]
      for (let i = 0; i < 8; i++) {
        this.playBass(bassPattern[i], when + i * (beat / 2), beat * 0.45, out)
      }

      // ---- STRING PAD (triangle chord stab held throughout the bar) ----
      this.playNote(c.root * 2,  when, barLen * 0.92, 'triangle', 0.08, out)
      this.playNote(c.third * 2, when, barLen * 0.92, 'triangle', 0.06, out)
      this.playNote(c.fifth * 2, when, barLen * 0.92, 'triangle', 0.07, out)

      // ---- BRASS LEAD (saw with quick attack, anthemic motif) ----
      for (let i = 0; i < 4; i++) {
        this.playBrass(lead[i], when + i * beat, beat * 0.85, out)
      }

      // ---- CYMBAL CRASH at bar 1 (start of progression) for big arena feel ----
      if (bar % chords.length === 1) {
        this.playCrash(when, out)
      }
    }

    // Prime two bars then keep scheduling
    let nextTime = ctx.currentTime + 0.1
    scheduleBar(nextTime)
    nextTime += barLen
    scheduleBar(nextTime)
    nextTime += barLen

    this.synthInterval = window.setInterval(() => {
      if (!this.ctx) return
      while (nextTime < this.ctx.currentTime + barLen * 1.5) {
        scheduleBar(nextTime)
        nextTime += barLen
      }
    }, Math.floor(barLen * 1000))
  }

  private playSnare(when: number, dest: AudioNode) {
    if (!this.ctx) return
    const ctx = this.ctx
    // Snare = mixed tone + noise burst with quick decay
    const bufSize = ctx.sampleRate * 0.12
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 1.2
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.18, when)
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.12)
    src.connect(bp).connect(g).connect(dest)
    src.start(when)
    this.trackNode(src, when + 0.12)
    // Tonal layer
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(220, when)
    osc.frequency.exponentialRampToValueAtTime(140, when + 0.06)
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0.07, when)
    g2.gain.exponentialRampToValueAtTime(0.001, when + 0.08)
    osc.connect(g2).connect(dest)
    osc.start(when); osc.stop(when + 0.10)
    this.trackNode(osc, when + 0.10)
  }

  private playBass(freq: number, when: number, duration: number, dest: AudioNode) {
    if (!this.ctx) return
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    // Low-pass filter for sub feel
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 350
    lp.Q.value = 0.7
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(0.18, when + 0.012)
    g.gain.setValueAtTime(0.18, when + duration - 0.06)
    g.gain.exponentialRampToValueAtTime(0.001, when + duration)
    osc.connect(lp).connect(g).connect(dest)
    osc.start(when)
    osc.stop(when + duration + 0.02)
    this.trackNode(osc, when + duration + 0.02)
  }

  private playBrass(freq: number, when: number, duration: number, dest: AudioNode) {
    if (!this.ctx) return
    const ctx = this.ctx
    // Layered saws for brass feel
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    osc1.type = 'sawtooth'
    osc2.type = 'sawtooth'
    osc1.frequency.value = freq
    osc2.frequency.value = freq * 1.005  // slight detune for fatness
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(700, when)
    lp.frequency.linearRampToValueAtTime(2000, when + 0.08)
    lp.frequency.linearRampToValueAtTime(1200, when + duration)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(0.10, when + 0.03)
    g.gain.setValueAtTime(0.10, when + duration - 0.10)
    g.gain.exponentialRampToValueAtTime(0.001, when + duration)
    osc1.connect(lp); osc2.connect(lp)
    lp.connect(g).connect(dest)
    osc1.start(when); osc2.start(when)
    osc1.stop(when + duration + 0.02)
    osc2.stop(when + duration + 0.02)
    this.trackNode(osc1, when + duration + 0.02)
    this.trackNode(osc2, when + duration + 0.02)
  }

  private playCrash(when: number, dest: AudioNode) {
    if (!this.ctx) return
    const ctx = this.ctx
    const bufSize = ctx.sampleRate * 1.0
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.35))
    const src = ctx.createBufferSource()
    src.buffer = buf
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 4000
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.12, when)
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.9)
    src.connect(hp).connect(g).connect(dest)
    src.start(when)
    this.trackNode(src, when + 1.0)
  }

  private stopSynthBgm() {
    if (this.synthInterval !== null) {
      clearInterval(this.synthInterval)
      this.synthInterval = null
    }
    this.synthNodes.forEach(n => { try { (n as OscillatorNode).stop?.() } catch {} })
    this.synthNodes = []
  }

  private trackNode(node: OscillatorNode | AudioBufferSourceNode, stopAt: number) {
    this.synthNodes.push(node)
    // Auto-remove once stopped
    node.onended = () => {
      const i = this.synthNodes.indexOf(node)
      if (i >= 0) this.synthNodes.splice(i, 1)
    }
    return stopAt
  }

  private playNote(
    freq: number, when: number, duration: number,
    type: OscillatorType, vol: number, dest: AudioNode
  ) {
    if (!this.ctx) return
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq

    // Soft attack/release envelope
    const a = 0.04, r = 0.15
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(vol, when + a)
    g.gain.setValueAtTime(vol, when + duration - r)
    g.gain.linearRampToValueAtTime(0, when + duration)

    osc.connect(g).connect(dest)
    osc.start(when)
    osc.stop(when + duration + 0.05)
    this.trackNode(osc, when + duration + 0.05)
  }

  private playKick(when: number, dest: AudioNode, vol = 0.45) {
    if (!this.ctx) return
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, when)
    osc.frequency.exponentialRampToValueAtTime(38, when + 0.14)
    g.gain.setValueAtTime(vol, when)
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.22)
    osc.connect(g).connect(dest)
    osc.start(when)
    osc.stop(when + 0.26)
    this.trackNode(osc, when + 0.26)
  }

  private playHat(when: number, dest: AudioNode, vol = 0.06) {
    if (!this.ctx) return
    const ctx = this.ctx
    const bufSize = ctx.sampleRate * 0.04
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    g.gain.setValueAtTime(vol, when)
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.045)
    src.connect(hp).connect(g).connect(dest)
    src.start(when)
    this.trackNode(src, when + 0.05)
  }

  // ----------------------------------------------------------------------
  // SFX
  // ----------------------------------------------------------------------
  playSfx(name: SfxName) {
    if (!this.ctx || !this.sfxGain || !this.unlocked || this.state.sfxMuted) return
    const ctx = this.ctx
    const out = this.sfxGain
    const t = ctx.currentTime

    switch (name) {
      case 'whoosh': {
        // White-noise sweep
        const bufSize = ctx.sampleRate * 0.3
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize)
        const src = ctx.createBufferSource()
        src.buffer = buf
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.setValueAtTime(800, t)
        bp.frequency.exponentialRampToValueAtTime(200, t + 0.3)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.5, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
        src.connect(bp).connect(g).connect(out)
        src.start(t)
        break
      }
      case 'swish': {
        // Net swish — short hi-passed noise
        const bufSize = ctx.sampleRate * 0.18
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1)
        const src = ctx.createBufferSource()
        src.buffer = buf
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 3000
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.6, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
        src.connect(hp).connect(g).connect(out)
        src.start(t)
        break
      }
      case 'rim': {
        const osc = ctx.createOscillator()
        osc.type = 'square'
        osc.frequency.setValueAtTime(1200, t)
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.12)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.18, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
        osc.connect(g).connect(out)
        osc.start(t); osc.stop(t + 0.16)
        break
      }
      case 'combo': {
        // Ascending chime
        const notes = [523.25, 659.25, 783.99, 1046.50] // C E G C
        notes.forEach((f, i) => {
          const osc = ctx.createOscillator()
          osc.type = 'triangle'
          osc.frequency.value = f
          const g = ctx.createGain()
          const start = t + i * 0.06
          g.gain.setValueAtTime(0, start)
          g.gain.linearRampToValueAtTime(0.18, start + 0.02)
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
          osc.connect(g).connect(out)
          osc.start(start); osc.stop(start + 0.28)
        })
        break
      }
      case 'unlock': {
        const notes = [392, 523.25, 783.99]
        notes.forEach((f, i) => {
          const osc = ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = f
          const g = ctx.createGain()
          const start = t + i * 0.08
          g.gain.setValueAtTime(0, start)
          g.gain.linearRampToValueAtTime(0.22, start + 0.03)
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.4)
          osc.connect(g).connect(out)
          osc.start(start); osc.stop(start + 0.45)
        })
        break
      }
      case 'tap': {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(900, t)
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.04)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.12, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
        osc.connect(g).connect(out)
        osc.start(t); osc.stop(t + 0.08)
        break
      }
      case 'fanfare': {
        const notes = [392, 523.25, 659.25, 783.99, 1046.50]
        notes.forEach((f, i) => {
          const osc = ctx.createOscillator()
          osc.type = 'sawtooth'
          osc.frequency.value = f
          const g = ctx.createGain()
          const start = t + i * 0.1
          g.gain.setValueAtTime(0, start)
          g.gain.linearRampToValueAtTime(0.14, start + 0.02)
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.5)
          osc.connect(g).connect(out)
          osc.start(start); osc.stop(start + 0.55)
        })
        break
      }
      case 'dribble': {
        // Ball-on-wood-floor thump — low sine pulse + short noise burst
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(200, t)
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.08)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.30, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.10)
        osc.connect(g).connect(out)
        osc.start(t); osc.stop(t + 0.12)
        // Wood-knock noise layer
        const bufSize = ctx.sampleRate * 0.04
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize)
        const noise = ctx.createBufferSource()
        noise.buffer = buf
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 800
        bp.Q.value = 1.5
        const ng = ctx.createGain()
        ng.gain.setValueAtTime(0.14, t)
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
        noise.connect(bp).connect(ng).connect(out)
        noise.start(t)
        break
      }
      case 'miss': {
        // Ball clanging off rim — metallic thunk
        const osc = ctx.createOscillator()
        osc.type = 'square'
        osc.frequency.setValueAtTime(550, t)
        osc.frequency.exponentialRampToValueAtTime(180, t + 0.18)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.22, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
        osc.connect(g).connect(out)
        osc.start(t); osc.stop(t + 0.28)
        // Second clang
        const osc2 = ctx.createOscillator()
        osc2.type = 'triangle'
        osc2.frequency.setValueAtTime(380, t + 0.05)
        osc2.frequency.exponentialRampToValueAtTime(130, t + 0.20)
        const g2 = ctx.createGain()
        g2.gain.setValueAtTime(0.15, t + 0.05)
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
        osc2.connect(g2).connect(out)
        osc2.start(t + 0.05); osc2.stop(t + 0.28)
        break
      }
    }
  }

  // ----------------------------------------------------------------------
  // Settings API
  // ----------------------------------------------------------------------
  setBgmVolume(v: number) {
    this.state.bgmVolume = Math.min(1, Math.max(0, v))
    this.applyVolumes(); this.saveSettings(); this.emit()
  }
  setSfxVolume(v: number) {
    this.state.sfxVolume = Math.min(1, Math.max(0, v))
    this.applyVolumes(); this.saveSettings(); this.emit()
  }
  toggleBgmMute() {
    this.state.bgmMuted = !this.state.bgmMuted
    this.applyVolumes(); this.saveSettings(); this.emit()
    // If user just UN-muted, kick BGM back on. If they muted, stop the
    // synth/file pipeline cleanly (don't just zero the gain — keeps CPU low).
    if (this.state.bgmMuted) {
      this.stopBgm()
    } else {
      this.playBgm().catch(() => {})
    }
  }
  toggleSfxMute() {
    this.state.sfxMuted = !this.state.sfxMuted
    this.applyVolumes(); this.saveSettings(); this.emit()
  }
}

export const audioManager = new AudioManagerImpl()
export type { AudioState, SfxName }
