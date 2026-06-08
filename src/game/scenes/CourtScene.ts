import Phaser from 'phaser'
import { Player } from '../objects/Player'
import { Hoop } from '../objects/Hoop'
import { audioManager } from '../../utils/audio'

export type ShotType = 'layup' | 'jumpshot' | 'three'
export type ShotResult = 'swish' | 'rim_in' | 'rim_out' | 'airball'

type DunkKey = {
  keys: string[]
  dunkId: string
  name: string
  unlocked: boolean
  /** Max distance from rim where this dunk works (canvas pixels). */
  maxDistance: number
}

export type DunkFeedback = {
  dunkId: string
  name: string
  tier: 'perfect' | 'good' | 'normal' | 'miss'
  points: number
  approachGrade: string
  trainingCue: string
  risk: string
  style: string
  color: string
}

type DunkStyleProfile = {
  style: string
  badge: string
  color: string
  accent: number
  trainingCue: string
  risk: string
  perfectZone: number
  goodZone: number
  slowMo: number
  zoom: number
  shake: number
}

export class CourtScene extends Phaser.Scene {
  player!: Player
  hoop!: Hoop
  score = 0
  combo = 0
  lastDunkTime = 0
  scoreText!: Phaser.GameObjects.Text
  comboText!: Phaser.GameObjects.Text
  dunkNameText!: Phaser.GameObjects.Text
  keyHintText!: Phaser.GameObjects.Text
  // particles placeholder
  unlockedDunkIds: string[] = ['basic_two']
  onScoreUpdate?: (score: number, combo: number) => void
  onDunkPerformed?: (dunkId: string) => void
  onDunkFeedback?: (feedback: DunkFeedback) => void
  onKeysChange?: (keys: string[]) => void
  onTimerUpdate?: (secondsLeft: number) => void
  onGameOver?: (score: number, stats: { dunks: number; maxCombo: number; perfects: number }) => void

  // ---- Time-attack mode ----
  timeAttack = false
  private readonly ROUND_SECONDS = 60
  private timeLeftMs = 60000
  private roundActive = false
  private totalDunks = 0
  private maxCombo = 0
  private perfectCount = 0
  private _lastEmittedSec = 60
  // ---- Timing perfection (sweet-spot on takeoff) ----
  /** ms since this dunk's launch — used to judge PERFECT / GOOD timing. */
  private lastDunkPerfTier: 'perfect' | 'good' | 'normal' | 'miss' = 'normal'

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private pressedKeys = new Set<string>()
  // Visual ball that bounces next to player when dribbling
  private dribbleBall!: Phaser.GameObjects.Graphics
  private dribbleBounceT = 0
  private lastDribbleSinSign = 0
  // Player movement state
  private moveSpeed = 220                // px per second at scale 1
  private playerScale = 1                 // current perspective scale
  // Court bounds for the player (in canvas coords)
  private courtTopY = 0
  private courtBotY = 0
  private courtFarLeft = 0
  private courtFarRight = 0
  private courtNearLeft = 0
  private courtNearRight = 0
  // Visual key-state indicators (React HUD also shows them)
  private comboHintText!: Phaser.GameObjects.Text
  // External keyboard handler (window-level capture)
  private windowKeyDown?: (e: KeyboardEvent) => void
  private windowKeyUp?: (e: KeyboardEvent) => void

  // Physics ball
  private ballGfx!: Phaser.GameObjects.Graphics
  private ballShadowGfx!: Phaser.GameObjects.Graphics
  private ballVx = 0
  private ballVy = 0
  private ballActive = false
  private prevBallY = 0
  private ballAngle = 0
  private readonly BALL_GRAVITY = 500
  private lastApproachGrade = 'B'

  // Shot mechanic state
  private _shotShouldBounceOut = false
  private _lastShotType: ShotType = 'jumpshot'
  private _lastShotResult: ShotResult = 'swish'

  private readonly dunkProfiles: Record<string, DunkStyleProfile> = {
    basic_two:      { style: 'POWER FOUNDATION', badge: '균형·양발 폭발', color: '#FFFFFF', accent: 0xFFFFFF, trainingCue: '양발을 동시에 찍고 코어를 잠근 채 수직으로 솟으세요.', risk: '낮음 · 기본기 확인', perfectZone: 0.42, goodZone: 0.72, slowMo: 0.72, zoom: 1.04, shake: 0.006 },
    basic_one:      { style: 'REACH FINISH', badge: '한손 리치·손목 컨트롤', color: '#5BC0EB', accent: 0x5BC0EB, trainingCue: '마지막 스텝을 길게 밟고 덩크 손 반대 어깨를 낮추세요.', risk: '낮음 · 손목/어깨', perfectZone: 0.40, goodZone: 0.68, slowMo: 0.70, zoom: 1.045, shake: 0.007 },
    reverse:        { style: 'BACK-RIM CONTROL', badge: '등지고 회전·림 감각', color: '#FF4D1F', accent: 0xFF4D1F, trainingCue: '림 아래를 지나치지 말고 백보드 옆에서 어깨를 먼저 여세요.', risk: '중간 · 착지 방향', perfectZone: 0.34, goodZone: 0.60, slowMo: 0.62, zoom: 1.06, shake: 0.010 },
    windmill:       { style: 'FULL ARM CIRCLE', badge: '긴 체공·어깨 가동성', color: '#C58FE0', accent: 0xC58FE0, trainingCue: '공을 허리 아래까지 크게 떨어뜨린 뒤 어깨 원을 끝까지 그리세요.', risk: '높음 · 체공/어깨', perfectZone: 0.30, goodZone: 0.54, slowMo: 0.52, zoom: 1.08, shake: 0.012 },
    three_sixty:    { style: 'ROTATION TIMING', badge: '시선 고정·공중 회전', color: '#8B5CF6', accent: 0x8B5CF6, trainingCue: '도약 직후 머리와 시선을 먼저 돌려 몸통 회전을 끌어내세요.', risk: '높음 · 균형/착지', perfectZone: 0.28, goodZone: 0.50, slowMo: 0.48, zoom: 1.09, shake: 0.013 },
    between_legs:   { style: 'AIR HANDLE', badge: '무릎 접기·공중 핸들', color: '#FFB627', accent: 0xFFB627, trainingCue: '무릎을 가슴 쪽으로 접고 공은 몸 중심 아래로 통과시키세요.', risk: '매우 높음 · 햄스트링/착지', perfectZone: 0.24, goodZone: 0.45, slowMo: 0.44, zoom: 1.11, shake: 0.015 },
    alleyoop:       { style: 'CATCH POINT', badge: '캐치 타이밍·공간감', color: '#00FF88', accent: 0x00FF88, trainingCue: '점프 정점 전에 공을 받아 림 위에서 손목만 접어 마무리하세요.', risk: '중간 · 손가락/타이밍', perfectZone: 0.36, goodZone: 0.62, slowMo: 0.60, zoom: 1.07, shake: 0.011 },
    tomahawk:       { style: 'HAMMER FINISH', badge: '후방 장전·코어 폭발', color: '#FF6B2C', accent: 0xFF6B2C, trainingCue: '공을 귀 뒤까지 장전하고 복부 힘으로 도끼처럼 내리꽂으세요.', risk: '중간 · 허리/어깨', perfectZone: 0.34, goodZone: 0.58, slowMo: 0.58, zoom: 1.08, shake: 0.014 },
    cradle:         { style: 'BODY SHIELD', badge: '몸통 보호·부드러운 아크', color: '#F472B6', accent: 0xF472B6, trainingCue: '공을 몸 안쪽에 품고 수비를 등진다는 느낌으로 감싸세요.', risk: '중간 · 손목 컨트롤', perfectZone: 0.33, goodZone: 0.58, slowMo: 0.60, zoom: 1.07, shake: 0.010 },
    putback:        { style: 'SECOND JUMP', badge: '리바운드 반응·즉시 도약', color: '#22C55E', accent: 0x22C55E, trainingCue: '첫 착지 후 0.2초 안에 다시 튀어 오르는 발목 탄성이 핵심입니다.', risk: '중간 · 무릎/발목', perfectZone: 0.28, goodZone: 0.48, slowMo: 0.66, zoom: 1.055, shake: 0.009 },
    tip_dunk:       { style: 'FINGER FINISH', badge: '손끝 터치·림 위 마무리', color: '#A7F3D0', accent: 0xA7F3D0, trainingCue: '공을 오래 잡지 말고 손끝으로 림 위에서 짧게 눌러 넣으세요.', risk: '낮음 · 손가락', perfectZone: 0.25, goodZone: 0.43, slowMo: 0.68, zoom: 1.05, shake: 0.006 },
    chaser:         { style: 'BASELINE SPEED', badge: '측면 가속·각도 진입', color: '#38BDF8', accent: 0x38BDF8, trainingCue: '베이스라인 각도로 빠르게 진입하고 마지막 두 스텝을 짧고 강하게 밟으세요.', risk: '중간 · 발목 각도', perfectZone: 0.38, goodZone: 0.66, slowMo: 0.64, zoom: 1.065, shake: 0.010 },
    double_pump:    { style: 'HANG-TIME FAKE', badge: '체공 페이크·두 번째 장전', color: '#F97316', accent: 0xF97316, trainingCue: '첫 펌프는 수비를 속이는 동작, 두 번째 펌프 때 림을 강하게 보세요.', risk: '높음 · 체공시간', perfectZone: 0.28, goodZone: 0.50, slowMo: 0.50, zoom: 1.09, shake: 0.013 },
    freethrow_line: { style: 'LONG-RUN FLIGHT', badge: '긴 도움닫기·수평 비행', color: '#FFE093', accent: 0xFFE093, trainingCue: '뒤에서 충분히 속도를 만들고 마지막 발을 림 방향으로 길게 뻗으세요.', risk: '엘리트 · 햄스트링/무릎', perfectZone: 0.18, goodZone: 0.34, slowMo: 0.42, zoom: 1.12, shake: 0.016 },
    eastbay:        { style: 'ELITE AIR HANDLE', badge: '이스트베이·공중 쇼맨십', color: '#FDE68A', accent: 0xFDE68A, trainingCue: '다리 사이 패스 후 공을 몸 앞이 아니라 덩크 손 바깥으로 빼세요.', risk: '엘리트 · 전신 협응', perfectZone: 0.20, goodZone: 0.38, slowMo: 0.40, zoom: 1.13, shake: 0.017 },
  }

  private dunkMappings: DunkKey[] = [
    { keys: ['SPACE'],          dunkId: 'basic_two',      name: '양손 덩크',       unlocked: true,  maxDistance: 360 },
    { keys: ['A', 'SPACE'],     dunkId: 'basic_one',      name: '원핸드 덩크',     unlocked: false, maxDistance: 360 },
    { keys: ['S', 'SPACE'],     dunkId: 'reverse',        name: '리버스 덩크',     unlocked: false, maxDistance: 320 },
    { keys: ['D', 'SPACE'],     dunkId: 'windmill',       name: '윈드밀 덩크',     unlocked: false, maxDistance: 320 },
    { keys: ['W', 'SPACE'],     dunkId: 'tomahawk',       name: '토마호크 덩크',   unlocked: false, maxDistance: 340 },
    { keys: ['A', 'D', 'SPACE'],dunkId: 'three_sixty',    name: '360° 덩크',       unlocked: false, maxDistance: 300 },
    { keys: ['W', 'S', 'SPACE'],dunkId: 'between_legs',   name: '다리 사이 덩크',  unlocked: false, maxDistance: 300 },
    { keys: ['Q', 'SPACE'],     dunkId: 'alleyoop',       name: '앨리웁 덩크',     unlocked: false, maxDistance: 320 },
    { keys: ['E', 'SPACE'],     dunkId: 'cradle',         name: '크래들 덩크',     unlocked: false, maxDistance: 320 },
    { keys: ['R', 'SPACE'],     dunkId: 'putback',        name: '풋백 덩크',       unlocked: false, maxDistance: 320 },
    { keys: ['T', 'SPACE'],     dunkId: 'tip_dunk',       name: '팁 덩크',         unlocked: false, maxDistance: 320 },
    { keys: ['C', 'SPACE'],     dunkId: 'chaser',         name: '체이서 덩크',     unlocked: false, maxDistance: 360 },
    { keys: ['X', 'SPACE'],     dunkId: 'double_pump',    name: '더블 펌프 덩크',  unlocked: false, maxDistance: 320 },
    { keys: ['B', 'SPACE'],     dunkId: 'freethrow_line', name: '자유투 라인 덩크',unlocked: false, maxDistance: 700 },
    { keys: ['Z', 'SPACE'],     dunkId: 'eastbay',        name: '이스트베이 덩크', unlocked: false, maxDistance: 300 },
  ]

  constructor() {
    super({ key: 'CourtScene' })
  }

  preload() {}

  create() {
    const { width, height } = this.scale

    this.drawArenaBack(width, height)
    this.drawCourtPerspective(width, height)

    // Movement bounds — player can walk to either SCREEN EDGE at any depth.
    // The out-of-bounds floor fill extends edge-to-edge so visually the player
    // is always standing on the hardwood (in-bounds trapezoid OR out-of-bounds wings).
    this.courtTopY = height * 0.33
    this.courtBotY = height * 0.95
    this.courtFarLeft = 0
    this.courtFarRight = width
    this.courtNearLeft = 0
    this.courtNearRight = width

    // Hoop at TOP-CENTER, facing the camera
    const hoopX = width * 0.5
    const hoopY = height * 0.18
    this.hoop = new Hoop(this, hoopX, hoopY)
    this.hoop.container.setDepth(8)

    // Player starts at BOTTOM-CENTER
    const playerX = width * 0.5
    const playerY = height * 0.82
    this.player = new Player(this, playerX, playerY)
    this.player.container.setDepth(12)
    this.player.shadow.setDepth(11)
    this.player.onDunkComplete = this.handleDunkComplete.bind(this)
    this.player.onBallRelease = (x, y, dunkId) => this.launchBall(x, y, dunkId)
    // Disable Player's built-in idle bounce — we manage position in update()
    this.tweens.killTweensOf(this.player.container)
    this.tweens.killTweensOf(this.player.shadow)
    this.playerScale = 1

    // Physics ball + its floor shadow
    this.ballShadowGfx = this.add.graphics()
    this.ballShadowGfx.setVisible(false)
    this.ballShadowGfx.setDepth(2)   // on court floor, beneath player
    this.ballGfx = this.add.graphics()
    this.ballGfx.setVisible(false)
    this.ballGfx.setDepth(13)

    // Dribble ball — bounces next to the player while idle
    this.dribbleBall = this.add.graphics()
    this.dribbleBall.setDepth(11)

    this.setupUI(width, height)
    this.setupInput()
    this.setupParticles()
    this.updateDunkUnlocks()
    this.showControls()
  }

  /**
   * Starts (or restarts) a time-attack round. Called by PhaserGame once the
   * scene is wired up. In free-play mode (timeAttack=false) the timer is
   * disabled and the game runs endlessly as before.
   */
  startTimeAttack() {
    this.score = 0
    this.combo = 0
    this.totalDunks = 0
    this.maxCombo = 0
    this.perfectCount = 0
    this.lastDunkTime = 0
    this.timeLeftMs = this.ROUND_SECONDS * 1000
    this.roundActive = this.timeAttack
    this.onScoreUpdate?.(this.score, this.combo)
    if (this.timeAttack) {
      this.onTimerUpdate?.(this.ROUND_SECONDS)
    }
  }

  private endRound() {
    if (!this.roundActive) return
    this.roundActive = false
    this.timeLeftMs = 0
    this.onTimerUpdate?.(0)
    // Final buzzer flair
    this.cameras.main.flash(400, 255, 182, 39)
    audioManager.playSfx('fanfare')
    this.onGameOver?.(this.score, {
      dunks: this.totalDunks,
      maxCombo: this.maxCombo,
      perfects: this.perfectCount,
    })
  }

  // ============================================================
  // NBA 2K mobile perspective scene
  // ============================================================

  /**
   * Arena backdrop — deep midnight + side crowd stands receding into depth,
   * stadium spotlight cones aimed down at the hoop.
   */
  private drawArenaBack(w: number, h: number) {
    // Ceiling / sky
    const sky = this.add.graphics()
    sky.fillGradientStyle(0x030510, 0x030510, 0x0B1024, 0x101630, 1)
    sky.fillRect(0, 0, w, h * 0.5)

    // Stadium light fixtures (3 along the top)
    this.drawStadiumLight(w * 0.20, h * 0.025)
    this.drawStadiumLight(w * 0.50, h * 0.012)
    this.drawStadiumLight(w * 0.80, h * 0.025)

    // Back wall / scoreboard panel behind the hoop
    const backWall = this.add.graphics()
    backWall.fillStyle(0x0A0F1E, 1)
    backWall.fillRect(w * 0.20, h * 0.08, w * 0.60, h * 0.22)
    backWall.lineStyle(2, 0x2C3A5C, 0.8)
    backWall.strokeRect(w * 0.20, h * 0.08, w * 0.60, h * 0.22)

    // Scoreboard LED dots inside the back wall
    backWall.fillStyle(0xFFB627, 0.35)
    for (let i = 0; i < 50; i++) {
      const sx = Phaser.Math.Between(w * 0.21, w * 0.79)
      const sy = Phaser.Math.Between(h * 0.09, h * 0.29)
      backWall.fillCircle(sx, sy, Phaser.Math.FloatBetween(0.5, 1.4))
    }
    backWall.fillStyle(0xE63946, 0.3)
    for (let i = 0; i < 14; i++) {
      const sx = Phaser.Math.Between(w * 0.22, w * 0.78)
      const sy = Phaser.Math.Between(h * 0.10, h * 0.28)
      backWall.fillCircle(sx, sy, 1)
    }

    // Left crowd stand (perspective trapezoid receding)
    this.drawCrowdStand(w, h, 'left')
    this.drawCrowdStand(w, h, 'right')

    // Far wall edge (between back wall and crowd)
    const farEdge = this.add.graphics()
    farEdge.lineStyle(2, 0xFFB627, 0.4)
    farEdge.lineBetween(0, h * 0.30, w, h * 0.30)
    farEdge.fillStyle(0x040611, 1)
    farEdge.fillRect(0, h * 0.30, w, 3)

    // LED ribbon ad band — runs across the front of the stands
    const ribbon = this.add.graphics()
    ribbon.fillStyle(0x070912, 1)
    ribbon.fillRect(0, h * 0.305, w, 8)
    ribbon.fillStyle(0xFF6B2C, 0.8)
    for (let x = 0; x < w; x += 6) {
      if (Math.random() > 0.25) ribbon.fillRect(x, h * 0.307 + 1, 3, 5)
    }
  }

  /** Crowd stand on one side — slanted band with abstract heads. */
  private drawCrowdStand(w: number, h: number, side: 'left' | 'right') {
    const g = this.add.graphics()
    const top = h * 0.08
    const bot = h * 0.30
    const innerX = side === 'left' ? 0 : w
    const outerX = side === 'left' ? w * 0.20 : w * 0.80

    // Stand backdrop (gradient)
    g.fillGradientStyle(0x0A1020, 0x0A1020, 0x161F35, 0x161F35, 1)
    g.fillPoints([
      { x: innerX, y: top },
      { x: outerX, y: top },
      { x: outerX, y: bot },
      { x: innerX, y: bot },
    ], true)

    // Crowd heads — denser at top (further) sparser toward front
    for (let row = 0; row < 5; row++) {
      const rowY = top + (bot - top) * (row + 0.5) / 5
      const headSize = 2 + row * 0.7
      const spacing = 8 + row * 2
      const startX = side === 'left' ? innerX + 4 : outerX
      const endX = side === 'left' ? outerX : innerX - 4
      for (let cx = Math.min(startX, endX); cx < Math.max(startX, endX); cx += spacing) {
        const jitterX = Phaser.Math.Between(-2, 2)
        const jitterY = Phaser.Math.Between(-2, 2)
        const shade = Phaser.Math.Between(0, 2)
        const color = shade === 0 ? 0x1F2A45 : shade === 1 ? 0x2C3A5C : 0x070912
        g.fillStyle(color, 0.9)
        g.fillCircle(cx + jitterX, rowY + jitterY, headSize)
      }
    }

    // Phone lights occasionally in the crowd
    g.fillStyle(0xFFFAF0, 0.7)
    for (let i = 0; i < 6; i++) {
      const cx = Phaser.Math.Between(side === 'left' ? 4 : Math.floor(w * 0.80),
                                       side === 'left' ? Math.floor(w * 0.20) : w - 4)
      const cy = Phaser.Math.Between(top + 10, bot - 10)
      g.fillCircle(cx, cy, 0.8)
    }
  }

  /**
   * Court rendered with PROPER basketball geometry projected through a simple
   * perspective transform. Real NBA dimensions:
   *   - half court: 47 ft deep × 50 ft wide
   *   - paint:      16 ft × 19 ft (FT line is 15 ft from baseline)
   *   - 3pt arc:    23.75 ft top, 22 ft corner (~14 ft of straight at corner)
   *   - FT circle:  12 ft diameter (6 ft radius)
   *   - restricted: 4 ft radius arc directly under basket
   */
  private drawCourtPerspective(w: number, h: number) {
    // Camera setup: view is looking down the court FROM camera (bottom) TOWARD hoop (top).
    // Widened so the court occupies most of the screen left-to-right —
    // at the near edge the trapezoid extends BEYOND the screen so the player
    // can walk all the way to either screen edge.
    const courtTopY = h * 0.31     // baseline (just below hoop)
    const courtBotY = h            // near edge (camera position)
    const farHalf = w * 0.32       // top sidelines at 0.18w / 0.82w  (~64% of screen)
    const nearHalf = w * 0.82      // bottom sidelines at -0.32w / 1.32w (extends well beyond screen)
    const cx = w * 0.5             // center X of court

    // ---- helpers ----------------------------------------------------------
    // Project a point from "court space" to screen space.
    // courtX ∈ [-1, +1] (sideline to sideline)
    // depthT ∈ [0, 1]   (0 = baseline at top of view, 1 = near edge)
    const project = (courtX: number, depthT: number) => {
      const halfW = farHalf + (nearHalf - farHalf) * depthT
      return {
        x: cx + courtX * halfW,
        y: courtTopY + (courtBotY - courtTopY) * depthT,
      }
    }

    const court = this.add.graphics()
    court.setDepth(1)

    // ---- OUT-OF-BOUNDS FLOOR (extends edge-to-edge across the whole screen) -----
    // In real arenas the hardwood floor continues past the painted court lines,
    // out to the scorer's table / sideline benches. This darker fill ensures
    // there's no visible "void" left/right of the perspective trapezoid.
    court.fillStyle(0x6B3F18, 1)  // darker hardwood (out-of-bounds)
    court.fillRect(0, courtTopY, w, courtBotY - courtTopY)
    // Darker plank tone for the out-of-bounds area
    for (let i = 1; i <= 30; i++) {
      const t = i / 30
      const y = courtTopY + (courtBotY - courtTopY) * t
      court.lineStyle(1, 0x4A2A0F, 0.45)
      court.lineBetween(0, y, w, y)
    }

    // ---- IN-BOUNDS FLOOR (perspective trapezoid, brighter hardwood) ------------
    const tl = project(-1, 0), tr = project(1, 0)
    const bl = project(-1, 1), br = project(1, 1)
    court.fillStyle(0xB86A2C, 1)
    court.fillPoints([tl, tr, br, bl], true)

    // Plank seams running depth-wise (converge toward vanishing point)
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue
      const cxRatio = i * 0.18
      const a = project(cxRatio, 0)
      const b = project(cxRatio, 1)
      court.lineStyle(1, 0x6B3614, 0.28)
      court.lineBetween(a.x, a.y, b.x, b.y)
    }
    // Horizontal plank lines (along depth) — only within the trapezoid
    for (let i = 1; i <= 26; i++) {
      const t = Math.pow(i / 26, 1.5)
      const l = project(-1, t), r = project(1, t)
      const tone = i % 3
      const color = tone === 0 ? 0x9C5320 : tone === 1 ? 0x8E4D1C : 0xA85C24
      court.lineStyle(1, color, 0.32)
      court.lineBetween(l.x, l.y, r.x, r.y)
    }

    // ============ COURT LINES (geometric basketball court) =================
    const lineWidth = 2.5
    const lineColor = 0xFFFFFF
    const lineAlpha = 0.9

    // Court constants — fractions of court half-width / half-court depth.
    // NBA court: 50ft × 47ft half. Half court is from baseline to half-court line.
    const COURT_HALF_FT = 25
    const COURT_DEPTH_FT = 47
    const ARC_R_FT = 23.75
    const CORNER3_FT = 22
    const PAINT_HALF = 16 / 50              // paint half-width (= 0.32)
    const FT_DEPTH   = 15 / 47              // FT line depth (= 0.319)
    const CORNER3_X  = CORNER3_FT / COURT_HALF_FT          // (= 0.88)
    // depth where arc meets corner straight: sqrt(R² - corner_x²)
    const CORNER3_DEPTH_FT = Math.sqrt(ARC_R_FT * ARC_R_FT - CORNER3_FT * CORNER3_FT)
    const CORNER3_LEN = CORNER3_DEPTH_FT / COURT_DEPTH_FT  // (≈ 0.19)
    const REST_ARC_R = 4 / 25               // restricted area arc radius / half-width

    // -- 1. baseline (behind hoop) --
    court.lineStyle(lineWidth, lineColor, lineAlpha)
    const blnL = project(-1, 0), blnR = project(1, 0)
    court.lineBetween(blnL.x, blnL.y, blnR.x, blnR.y)

    // -- 2. sidelines (converging perspective) --
    court.lineBetween(tl.x, tl.y, bl.x, bl.y)
    court.lineBetween(tr.x, tr.y, br.x, br.y)

    // -- 3. PAINT / KEY (trapezoid: narrower at baseline, wider at FT line) --
    const ptl = project(-PAINT_HALF, 0)
    const ptr = project(PAINT_HALF, 0)
    const pbl = project(-PAINT_HALF, FT_DEPTH)
    const pbr = project(PAINT_HALF, FT_DEPTH)
    // Paint fill — subtle court team color tint
    court.fillStyle(0xFF6B2C, 0.10)
    court.fillPoints([ptl, ptr, pbr, pbl], true)
    // Edges
    court.lineStyle(lineWidth, lineColor, lineAlpha)
    court.lineBetween(ptl.x, ptl.y, pbl.x, pbl.y)   // left edge
    court.lineBetween(ptr.x, ptr.y, pbr.x, pbr.y)   // right edge
    court.lineBetween(pbl.x, pbl.y, pbr.x, pbr.y)   // FT line

    // -- 4. FREE-THROW CIRCLE (perspective-squashed ellipse) --
    const ftCenter = project(0, FT_DEPTH)
    const ftDiameter = pbr.x - pbl.x       // same width as paint at FT line
    const ftEllipseHeight = ftDiameter * 0.40
    court.lineStyle(lineWidth, lineColor, lineAlpha)
    court.strokeEllipse(ftCenter.x, ftCenter.y, ftDiameter, ftEllipseHeight)

    // -- 5. RESTRICTED AREA arc (small arc just below the rim) --
    const restCenter = project(0, 0.025)
    const restW = (project(REST_ARC_R, 0).x - project(-REST_ARC_R, 0).x)
    const restH = restW * 0.32
    court.lineStyle(2, lineColor, 0.75)
    court.strokeEllipse(restCenter.x, restCenter.y, restW, restH)

    // -- 6. THREE-POINT LINE --
    // The 3pt line is a circle of radius 23.75ft centered at the basket.
    // In the corners, since the court is only 25ft wide, it's replaced by
    // STRAIGHT lines parallel to the sideline until the circle meets them.
    const c3tL = project(-CORNER3_X, 0)
    const c3bL = project(-CORNER3_X, CORNER3_LEN)
    const c3tR = project(CORNER3_X, 0)
    const c3bR = project(CORNER3_X, CORNER3_LEN)
    court.lineStyle(lineWidth, lineColor, lineAlpha)
    court.lineBetween(c3tL.x, c3tL.y, c3bL.x, c3bL.y)
    court.lineBetween(c3tR.x, c3tR.y, c3bR.x, c3bR.y)
    // Arc from corner-left endpoint through the top to corner-right endpoint.
    // Parameterize in court-foot space then project each point.
    const angleL = Math.atan2(CORNER3_DEPTH_FT, -CORNER3_FT) // ~ 2.74 rad (upper-left of basket origin)
    const angleR = Math.atan2(CORNER3_DEPTH_FT, CORNER3_FT)  // ~ 0.40 rad
    // Sweep from angleL through π/2 to angleR — but going clockwise around the basket
    // (which means angle DECREASES from angleL down through π/2 to angleR)
    const arcSegments = 36
    court.beginPath()
    court.moveTo(c3bL.x, c3bL.y)
    for (let i = 1; i <= arcSegments; i++) {
      const t = i / arcSegments
      const angle = angleL + (angleR - angleL) * t
      const xFt = ARC_R_FT * Math.cos(angle)
      const depthFt = ARC_R_FT * Math.sin(angle)
      const p = project(xFt / COURT_HALF_FT, depthFt / COURT_DEPTH_FT)
      court.lineTo(p.x, p.y)
    }
    court.strokePath()

    // -- 7. HALFCOURT LINE (at depth 1.0 — just visible at very bottom) --
    // For our half-court view, we don't need this since the camera is past it.

    // -- 8. CENTER LOGO (near the bottom — half-court area) --
    const logoCenter = project(0, 0.78)
    const logoOuter = this.add.graphics().setDepth(1.5)
    logoOuter.lineStyle(2, 0xFFB627, 0.45)
    logoOuter.strokeEllipse(logoCenter.x, logoCenter.y, 240, 70)
    logoOuter.lineStyle(3, 0xFFB627, 0.7)
    logoOuter.strokeEllipse(logoCenter.x, logoCenter.y, 175, 52)
    const wordmark = this.add.text(logoCenter.x, logoCenter.y, 'DUNK · SHOT', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '18px',
      color: '#FFB627',
      align: 'center',
    }).setOrigin(0.5).setAlpha(0.75).setDepth(1.6)
    wordmark.setScale(1, 0.4)

    // -- 9. RIM SHADOW on the court floor (under the hoop) --
    const rimShadow = this.add.graphics().setDepth(1.2)
    rimShadow.fillStyle(0x000000, 0.35)
    rimShadow.fillEllipse(cx, courtTopY + 6, 70, 10)
    // Soft glow
    rimShadow.fillStyle(0xFFFFFF, 0.06)
    rimShadow.fillEllipse(cx, courtTopY + 6, 160, 16)
    rimShadow.fillStyle(0xFF6B2C, 0.07)
    rimShadow.fillEllipse(cx, courtTopY + 18, 120, 12)

    // -- 10. Court rim glow (subtle warm rim on sidelines) --
    const glow = this.add.graphics().setDepth(2)
    glow.lineStyle(3, 0xFFB627, 0.12)
    glow.lineBetween(tl.x - 1, tl.y, bl.x - 1, bl.y)
    glow.lineBetween(tr.x + 1, tr.y, br.x + 1, br.y)

    // -- 11. DUNK ZONE — pulsing ellipse around the rim showing where dunks succeed --
    const dunkZoneG = this.add.graphics().setDepth(1.4)
    dunkZoneG.lineStyle(2, 0xFFB627, 0.45)
    dunkZoneG.strokeEllipse(cx, courtTopY + 80, 320, 110)
    dunkZoneG.lineStyle(1.5, 0xFFB627, 0.2)
    dunkZoneG.strokeEllipse(cx, courtTopY + 80, 360, 130)
    // Pulse the zone subtly
    this.tweens.add({
      targets: dunkZoneG,
      alpha: { from: 0.85, to: 0.4 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    // Tiny label "DUNK ZONE"
    const zoneLabel = this.add.text(cx, courtTopY + 80, 'DUNK ZONE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#FFB627',
    }).setOrigin(0.5).setAlpha(0.35).setDepth(1.5)
    void zoneLabel
  }

  // ============================================================
  // (legacy method kept for compatibility — never called now)
  // ============================================================
  private _unused_drawBackground(w: number, h: number) {
    // Indoor arena — deep midnight ceiling fading to warm court level
    const sky = this.add.graphics()
    sky.fillGradientStyle(0x040611, 0x040611, 0x0E1426, 0x1A2238, 1)
    sky.fillRect(0, 0, w, h * 0.55)

    // Spotlight cones from above
    const spots = this.add.graphics()
    spots.fillStyle(0xFFB627, 0.06)
    const courtCenterX = w * 0.55
    spots.fillTriangle(courtCenterX, 0, courtCenterX - w * 0.5, h * 0.55, courtCenterX + w * 0.5, h * 0.55)
    spots.fillStyle(0xFF6B2C, 0.04)
    spots.fillTriangle(w * 0.78, 0, w * 0.78 - w * 0.3, h * 0.5, w * 0.78 + w * 0.3, h * 0.5)

    // Ambient warm rim lighting at court level
    const ambient = this.add.graphics()
    ambient.fillGradientStyle(0xFF6B2C, 0xFF6B2C, 0x000000, 0x000000, 0.18, 0.18, 0, 0)
    ambient.fillRect(0, h * 0.36, w, h * 0.2)

    // Distant arena seating — abstract horizontal bands
    const seats = this.add.graphics()
    for (let i = 0; i < 6; i++) {
      const band = h * 0.30 + i * 4
      const alpha = 0.7 - i * 0.08
      seats.fillStyle(0x0A1020, alpha)
      seats.fillRect(0, band, w, 3)
    }

    // Far-back twinkling LED dots (suggests crowd phones / scoreboard pixels)
    const leds = this.add.graphics()
    leds.fillStyle(0xFFB627, 0.4)
    for (let i = 0; i < 60; i++) {
      const sx = Phaser.Math.Between(0, w)
      const sy = Phaser.Math.Between(h * 0.32, h * 0.42)
      leds.fillCircle(sx, sy, Phaser.Math.FloatBetween(0.5, 1.2))
    }
    // Some red and ice-blue accents
    leds.fillStyle(0xE63946, 0.3)
    for (let i = 0; i < 18; i++) {
      const sx = Phaser.Math.Between(0, w)
      const sy = Phaser.Math.Between(h * 0.34, h * 0.42)
      leds.fillCircle(sx, sy, 1)
    }
    leds.fillStyle(0x5BC0EB, 0.25)
    for (let i = 0; i < 12; i++) {
      const sx = Phaser.Math.Between(0, w)
      const sy = Phaser.Math.Between(h * 0.34, h * 0.42)
      leds.fillCircle(sx, sy, 1)
    }

    // Ground beyond court — dark hardwood-blend
    const ground = this.add.graphics()
    ground.fillGradientStyle(0x1A1410, 0x1A1410, 0x0A0608, 0x0A0608, 1)
    ground.fillRect(0, h * 0.55, w, h * 0.45)

    // Arena rim / barrier (subtle horizontal band where court meets seating)
    const rim = this.add.graphics()
    rim.fillStyle(0x1F2A45, 1)
    rim.fillRect(0, h * 0.43, w, 4)
    rim.fillStyle(0xFFB627, 0.4)
    rim.fillRect(0, h * 0.43, w, 1)

    // LED scoreboard ribbon on the rim — animated text scroll feel
    const ribbon = this.add.graphics()
    ribbon.fillStyle(0x040611, 1)
    ribbon.fillRect(0, h * 0.40, w, 6)
    ribbon.fillStyle(0xFF6B2C, 0.7)
    for (let x = 0; x < w; x += 8) {
      if (Math.random() > 0.3) ribbon.fillRect(x, h * 0.40 + 1, 4, 4)
    }

    // Stars (high ceiling sparkles)
    const stars = this.add.graphics()
    stars.fillStyle(0xffffff, 0.7)
    for (let i = 0; i < 30; i++) {
      const sx = Phaser.Math.Between(0, w)
      const sy = Phaser.Math.Between(0, h * 0.25)
      stars.fillCircle(sx, sy, Phaser.Math.FloatBetween(0.5, 1.2))
    }

    // Stadium light fixtures along the top
    this.drawStadiumLight(w * 0.18, h * 0.04)
    this.drawStadiumLight(w * 0.50, h * 0.02)
    this.drawStadiumLight(w * 0.82, h * 0.04)
  }

  private drawStadiumLight(x: number, y: number) {
    const g = this.add.graphics()
    // Mount bracket
    g.fillStyle(0x1F2A45)
    g.fillRect(x - 12, y, 24, 4)
    // Lamp body
    g.fillStyle(0x2C3A5C)
    g.fillRect(x - 8, y + 4, 16, 6)
    // Bright bulb
    g.fillStyle(0xFFFAF0, 0.95)
    g.fillCircle(x, y + 11, 4)
    // Hot core
    g.fillStyle(0xFFFFFF, 1)
    g.fillCircle(x, y + 11, 2)
    // Light cone — long & narrow toward the court
    g.fillStyle(0xFFEFB0, 0.07)
    g.fillTriangle(x, y + 12, x - 90, y + 380, x + 90, y + 380)
  }

  private drawCourt(w: number, h: number) {
    const courtTop = h * 0.45
    const courtBottom = h
    const courtLeft = 0
    const courtRight = w

    // Court floor (hardwood style) — richer NBA hardwood
    const court = this.add.graphics()
    court.fillGradientStyle(0xB86A2C, 0xB86A2C, 0x8E4D1C, 0x7A3F18, 1)
    court.fillRect(courtLeft, courtTop, courtRight - courtLeft, courtBottom - courtTop)

    // Hardwood planks (varied wood tones)
    for (let y = courtTop; y < courtBottom; y += 14) {
      const tone = Phaser.Math.Between(0, 2)
      const color = tone === 0 ? 0x9C5320 : tone === 1 ? 0x8E4D1C : 0xA85C24
      court.lineStyle(1, color, 0.35)
      court.lineBetween(courtLeft, y, courtRight, y)
    }
    // Subtle vertical plank seams
    court.lineStyle(1, 0x6B3614, 0.25)
    for (let x = courtLeft; x < courtRight; x += 80) {
      court.lineBetween(x, courtTop, x, courtBottom)
    }

    // Court lines
    court.lineStyle(2, 0xffffff, 0.9)
    // Half court line
    court.lineBetween(w / 2, courtTop, w / 2, courtBottom)
    // Three point arc (right side, for hoop at 78%)
    const hoopX = w * 0.78
    const hoopFloorY = courtTop + (courtBottom - courtTop) * 0.33
    court.beginPath()
    court.arc(hoopX, hoopFloorY, 130, Math.PI, 2 * Math.PI)
    court.strokePath()
    court.lineBetween(hoopX - 130, hoopFloorY, hoopX - 130, courtBottom)
    court.lineBetween(hoopX + 20, hoopFloorY, hoopX + 20, courtBottom)

    // Paint / key
    court.strokeRect(hoopX - 80, hoopFloorY - 30, 100, courtBottom - hoopFloorY + 30)

    // Free throw circle
    court.strokeEllipse(hoopX - 30, courtTop + (courtBottom - courtTop) * 0.55, 80, 40)

    // Court boundary
    court.lineStyle(3, 0xffffff, 1)
    court.strokeRect(courtLeft + 10, courtTop + 5, courtRight - courtLeft - 20, courtBottom - courtTop - 10)

    // Center circle
    court.strokeEllipse(w / 2, courtTop + (courtBottom - courtTop) * 0.6, 90, 45)
    court.fillStyle(0xffffff)
    court.fillCircle(w / 2, courtTop + (courtBottom - courtTop) * 0.6, 5)
  }

  private setupUI(w: number, h: number) {
    // The React HUD layer covers the top score area now, so we keep
    // Phaser's internal score text invisible (kept as text refs for
    // compatibility with rest of the code). React handles display.
    this.scoreText = this.add.text(-1000, -1000, '0', { fontSize: '1px' })
    this.comboText = this.add.text(-1000, -1000, '',  { fontSize: '1px' })

    this.dunkNameText = this.add.text(w / 2, h * 0.38, '', {
      fontFamily: 'Noto Sans KR',
      fontSize: '32px',
      color: '#FFB627',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 0, color: '#FF6B2C', blur: 22, fill: true },
    }).setOrigin(0.5).setAlpha(0).setDepth(25)

    this.keyHintText = this.add.text(w * 0.5, h * 0.95, '', {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5).setAlpha(0.7)
  }

  private setupInput() {
    const kb = this.input.keyboard!
    this.cursors = kb.createCursorKeys()

    // Capture keys so the browser doesn't scroll the page (Space, Arrows, etc.).
    kb.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.Q,
      Phaser.Input.Keyboard.KeyCodes.E,
      Phaser.Input.Keyboard.KeyCodes.R,
      Phaser.Input.Keyboard.KeyCodes.T,
      Phaser.Input.Keyboard.KeyCodes.C,
      Phaser.Input.Keyboard.KeyCodes.X,
      Phaser.Input.Keyboard.KeyCodes.Z,
      Phaser.Input.Keyboard.KeyCodes.F,
      Phaser.Input.Keyboard.KeyCodes.B,
      Phaser.Input.Keyboard.KeyCodes.J,
      Phaser.Input.Keyboard.KeyCodes.K,
      Phaser.Input.Keyboard.KeyCodes.L,
    ])

    this.keys = {
      A: kb.addKey('A'),
      S: kb.addKey('S'),
      D: kb.addKey('D'),
      W: kb.addKey('W'),
      Q: kb.addKey('Q'),
      E: kb.addKey('E'),
      R: kb.addKey('R'),
      T: kb.addKey('T'),
      C: kb.addKey('C'),
      X: kb.addKey('X'),
      Z: kb.addKey('Z'),
      F: kb.addKey('F'),
      SPACE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    }

    // --- BULLETPROOF KEYBOARD ---
    // Window-level capture-phase listener that always runs FIRST before any
    // React/Phaser handler, so SPACE etc. can never be hijacked by buttons.
    const keyToLabel = (e: KeyboardEvent): string | null => {
      switch (e.code) {
        case 'Space':       return 'SPACE'
        case 'ArrowUp':     return 'UP'
        case 'ArrowDown':   return 'DOWN'
        case 'ArrowLeft':   return 'LEFT'
        case 'ArrowRight':  return 'RIGHT'
        case 'KeyA': return 'A'
        case 'KeyS': return 'S'
        case 'KeyD': return 'D'
        case 'KeyW': return 'W'
        case 'KeyQ': return 'Q'
        case 'KeyE': return 'E'
        case 'KeyR': return 'R'
        case 'KeyT': return 'T'
        case 'KeyC': return 'C'
        case 'KeyX': return 'X'
        case 'KeyZ': return 'Z'
        case 'KeyF': return 'F'
        case 'KeyB': return 'B'
        case 'KeyJ': return 'J'
        case 'KeyK': return 'K'
        case 'KeyL': return 'L'
        default: return null
      }
    }

    const emitKeys = () => {
      // Only show MODIFIER keys (letters that change the dunk type), not movement
      const modifiers = Array.from(this.pressedKeys).filter(k =>
        ['A','S','D','W','Q','E','R','T','C','X','Z','F'].includes(k)
      )
      this.onKeysChange?.(modifiers)
    }

    this.windowKeyDown = (e: KeyboardEvent) => {
      const label = keyToLabel(e)
      if (!label) return
      // Prevent page scroll on Space/arrows
      if (['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT'].includes(label)) {
        e.preventDefault()
      }
      if (!this.pressedKeys.has(label)) {
        this.pressedKeys.add(label)
        emitKeys()
      }
      if (label === 'SPACE' && !this.player.isAnimating) {
        this.triggerDunk()
      }
      // SHOOT system: J = jump shot (mid-range), K = layup (close), L = three-pointer (far)
      if ((label === 'J' || label === 'K' || label === 'L') && !this.player.isAnimating) {
        const shotType: ShotType = label === 'J' ? 'jumpshot' : label === 'K' ? 'layup' : 'three'
        this.triggerShot(shotType)
      }
    }
    this.windowKeyUp = (e: KeyboardEvent) => {
      const label = keyToLabel(e)
      if (!label) return
      if (this.pressedKeys.has(label)) {
        this.pressedKeys.delete(label)
        emitKeys()
      }
    }

    // Use capture: true so we intercept BEFORE any React onKeyDown,
    // and use both window and document for maximum compatibility.
    window.addEventListener('keydown', this.windowKeyDown, true)
    window.addEventListener('keyup', this.windowKeyUp, true)
    document.addEventListener('keydown', this.windowKeyDown, true)
    document.addEventListener('keyup', this.windowKeyUp, true)

    const cleanup = () => {
      if (this.windowKeyDown) {
        window.removeEventListener('keydown', this.windowKeyDown, true)
        document.removeEventListener('keydown', this.windowKeyDown, true)
      }
      if (this.windowKeyUp) {
        window.removeEventListener('keyup', this.windowKeyUp, true)
        document.removeEventListener('keyup', this.windowKeyUp, true)
      }
    }
    this.events.once('shutdown', cleanup)
    this.events.once('destroy', cleanup)

    // Touch/click dunk anywhere on the canvas
    this.input.on('pointerdown', () => {
      if (!this.player.isAnimating) {
        this.triggerDunk()
      }
    })
  }

  private setupParticles() {
    // Will create particles on dunk
  }

  // ----------------------------------------------------------------------
  // FRAME LOOP — called every tick by Phaser.
  // Handles player movement (arrow keys + WASD), idle bounce, ball physics.
  // Movement & shooting input live here. SPACE/J/K/L action triggers stay
  // in the window-level keydown handler in setupInput().
  // ----------------------------------------------------------------------
  update(_time: number, delta: number) {
    const dt = delta / 1000

    // Ball physics
    this.updateBall(delta)

    // Player movement — only while not in a dunk/shot animation
    if (this.player && !this.player.isAnimating) {
      const c = this.player.container
      const W = this.scale.width
      const H = this.scale.height

      // ----- read input -----
      let vx = 0
      if (this.cursors?.left?.isDown || this.pressedKeys.has('A') || this.pressedKeys.has('LEFT')) vx -= 1
      if (this.cursors?.right?.isDown || this.pressedKeys.has('D') || this.pressedKeys.has('RIGHT')) vx += 1
      let vy = 0
      if (this.cursors?.up?.isDown || this.pressedKeys.has('W') || this.pressedKeys.has('UP')) vy -= 1
      if (this.cursors?.down?.isDown || this.pressedKeys.has('S') || this.pressedKeys.has('DOWN')) vy += 1

      // ----- court bounds (USE FULL COURT, baseline → near edge) -----
      // courtTopY/courtBotY already match drawCourtPerspective() exactly.
      // Allow approach to within ~24px of the baseline (under-the-rim dunks)
      // and let player back up to within ~16px of the near edge.
      const courtTop = (this.courtTopY || H * 0.33) + 24
      const courtBot = (this.courtBotY || H * 0.95) - 16

      if (vx !== 0 || vy !== 0) {
        // Forward/back is SLOWER (depth axis is foreshortened in real perspective)
        // — lateral moves feel snappier than approach moves. This sells the 3D illusion.
        const lateralSpeed  = 360
        const depthSpeed    = 240
        const nx = vx * lateralSpeed * dt
        const ny = vy * depthSpeed   * dt

        let newY = Phaser.Math.Clamp(c.y + ny, courtTop, courtBot)

        // ----- perspective: court is a trapezoid that NARROWS toward the rim -----
        // Compute X bounds based on depthT (0 = far/baseline, 1 = near).
        // Matches drawCourtPerspective() projection but extended to FULL screen
        // (out-of-bounds floor is walkable too, like real arena floor).
        const depthT = (newY - (this.courtTopY || 0)) / Math.max(1, (this.courtBotY || H) - (this.courtTopY || 0))
        // Clamp inside SCREEN edges at any depth — the OOB floor fills the screen.
        const margin = 24
        const minX = margin
        const maxX = W - margin

        const newX = Phaser.Math.Clamp(c.x + nx, minX, maxX)
        c.setPosition(newX, newY)
        this.player.baseY = newY

        // ----- 3D-style scaling: depth → size -----
        // At baseline (depthT=0): 0.55x scale (far away, small).
        // At near edge (depthT=1): 1.25x scale (close to camera, big).
        const persp = 0.55 + 0.70 * depthT
        this.playerScale = persp
        const facing = vx < 0 ? -1 : vx > 0 ? 1 : Math.sign(c.scaleX || 1) || 1
        c.setScale(facing * persp, persp)
        // Depth sort: lower Y on screen = closer to camera = render on top
        c.setDepth(10 + newY * 0.01)

        // Shadow: scaled with perspective, offset shrinks with distance
        if (this.player.shadow) {
          const shadowOffset = 28 + 30 * persp
          this.player.shadow.setPosition(newX, newY + shadowOffset * 0.5)
          this.player.shadow.setScale(persp * 1.1, persp * 0.55)
          this.player.shadow.setAlpha(0.25 + 0.20 * persp)
        }
      } else {
        // Idle bob
        this.player.tickIdle(dt)
        if (this.player.shadow) {
          const persp = this.playerScale || 1
          this.player.shadow.setPosition(c.x, this.player.baseY + (28 + 30 * persp) * 0.5)
        }
      }
    }
  }

  updateDunkUnlocks() {
    this.dunkMappings = this.dunkMappings.map(d => ({
      ...d,
      unlocked: this.unlockedDunkIds.includes(d.dunkId)
    }))
  }

  private triggerDunk() {
    // Find the most specific matching dunk (most keys pressed)
    const active = [...this.pressedKeys]
    active.push('SPACE')

    let bestMatch: DunkKey | null = null
    let bestCount = 0

    for (const mapping of this.dunkMappings) {
      if (!mapping.unlocked) continue
      const required = mapping.keys
      const hasAll = required.every(k => active.includes(k))
      if (hasAll && required.length > bestCount) {
        bestMatch = mapping
        bestCount = required.length
      }
    }

    if (!bestMatch) {
      const basic = this.dunkMappings.find(d => d.dunkId === 'basic_two')
      if (basic?.unlocked) bestMatch = basic
    }

    if (!bestMatch) return

    // Distance check — too far away to dunk?
    const dx = this.player.container.x - this.hoop.x
    const dy = this.player.container.y - (this.hoop.y + 50)  // y of rim
    const dist = Math.hypot(dx, dy)

    if (dist > bestMatch.maxDistance) {
      this.performMissedDunk(bestMatch, dist)
    } else {
      const profile = this.getDunkProfile(bestMatch.dunkId)
      const normalized = dist / bestMatch.maxDistance

      // Technique-specific failure: showy/elite dunks no longer feel like aliases.
      // Each has a believable training constraint instead of just a generic distance check.
      if (bestMatch.dunkId === 'freethrow_line' && normalized < 0.42) {
        this.performTechniqueFail(bestMatch, 'RUNWAY 부족', '자유투 라인은 너무 가까우면 실패합니다. 뒤로 물러나 긴 도움닫기를 만드세요.')
        return
      }
      if (['windmill', 'three_sixty', 'between_legs', 'eastbay', 'double_pump'].includes(bestMatch.dunkId) && normalized > profile.goodZone + 0.20) {
        this.performTechniqueFail(bestMatch, '체공시간 부족', `${profile.badge} 동작은 림에 더 가까운 완벽 구간에서만 안정적으로 성공합니다.`)
        return
      }
      if (['putback', 'tip_dunk'].includes(bestMatch.dunkId) && normalized > 0.55) {
        this.performTechniqueFail(bestMatch, '리바운드 위치 불량', '풋백/팁 덩크는 림 바로 앞 반응 점프가 핵심입니다. 페인트 안쪽으로 들어가세요.')
        return
      }

      if (normalized <= profile.perfectZone)      this.lastDunkPerfTier = 'perfect'
      else if (normalized <= profile.goodZone)   this.lastDunkPerfTier = 'good'
      else                                       this.lastDunkPerfTier = 'normal'
      this.lastApproachGrade = normalized <= profile.perfectZone ? 'S' : normalized <= profile.goodZone ? 'A' : 'B'

      // NORMAL tier (between goodZone and 100%) is now genuinely risky:
      // success probability falls off linearly. perfect/good zones are guaranteed.
      if (this.lastDunkPerfTier === 'normal') {
        const t = (normalized - profile.goodZone) / Math.max(0.001, 1 - profile.goodZone)
        // 75% chance at goodZone boundary, dropping to ~30% near maxDistance
        const successProb = Math.max(0.3, 0.75 - t * 0.45)
        const rng = Math.random()
        if (rng > successProb) {
          this.performTechniqueFail(
            bestMatch,
            '림에 손이 안 닿음',
            `${profile.badge} 동작에 필요한 점프력이 부족했습니다. 조금 더 가까이서 시도하세요. (성공률 ${Math.round(successProb*100)}%)`
          )
          return
        }
      }
      this.performDunk(bestMatch)
    }
  }

  /**
   * Player attempts the dunk but is too far away → jumps, misses, ball clangs off rim.
   * Combo resets to 0, no score awarded.
   */
  private performMissedDunk(mapping: DunkKey, distance: number) {
    const hoopPos = this.hoop.getRimWorldPos()
    this.player.playMissedDunk(hoopPos.x, hoopPos.y, distance, mapping.maxDistance)

    // Big red "TOO FAR!" label
    this.dunkNameText.setText('너무 멀어요! · TOO FAR')
    this.dunkNameText.setColor('#E63946')
    this.dunkNameText.setAlpha(1)
    this.dunkNameText.setScale(2.2)
    this.dunkNameText.setY(this.scale.height * 0.42)
    this.tweens.add({
      targets: this.dunkNameText,
      scale: 1.0,
      duration: 260,
      ease: 'Back.easeOut',
    })
    this.tweens.add({
      targets: this.dunkNameText,
      alpha: 0,
      y: this.dunkNameText.y - 40,
      duration: 900,
      delay: 700,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.dunkNameText.setY(this.scale.height * 0.42)
      }
    })

    // Camera small zoom + slight shake for the miss
    this.cameras.main.shake(180, 0.010)

    // Reset combo
    this.combo = 0
    this.onScoreUpdate?.(this.score, this.combo)

    // Trigger miss SFX after a short delay (ball reaches rim)
    this.time.delayedCall(900, () => audioManager.playSfx('miss'))
  }

  private getDunkProfile(dunkId: string): DunkStyleProfile {
    return this.dunkProfiles[dunkId] || this.dunkProfiles.basic_two
  }

  private performTechniqueFail(mapping: DunkKey, title: string, cue: string) {
    this.combo = 0
    this.lastDunkPerfTier = 'miss'
    this.onScoreUpdate?.(this.score, this.combo)
    this.onDunkFeedback?.({
      dunkId: mapping.dunkId,
      name: mapping.name,
      tier: 'miss',
      points: 0,
      approachGrade: 'F',
      trainingCue: cue,
      risk: this.getDunkProfile(mapping.dunkId).risk,
      style: this.getDunkProfile(mapping.dunkId).style,
      color: '#E63946',
    })
    this.dunkNameText.setText(`${mapping.name}\n${title}`)
    this.dunkNameText.setColor('#E63946')
    this.dunkNameText.setAlpha(1)
    this.dunkNameText.setScale(1.7)
    this.dunkNameText.setY(this.scale.height * 0.40)
    this.tweens.add({ targets: this.dunkNameText, scale: 1.0, duration: 220, ease: 'Back.easeOut' })
    this.tweens.add({
      targets: this.dunkNameText, alpha: 0, y: this.dunkNameText.y - 36,
      duration: 1100, delay: 900, ease: 'Quad.easeOut',
      onComplete: () => this.dunkNameText.setY(this.scale.height * 0.42),
    })
    this.cameras.main.shake(220, 0.013)
    audioManager.playSfx('miss')
  }

  // ============================================================
  // SHOOT MECHANIC — J = jump shot, K = layup, L = 3-pointer
  // ============================================================

  private triggerShot(shotType: ShotType) {
    const rimPos = this.hoop.getRimWorldPos()
    const dx = this.player.container.x - rimPos.x
    const dy = this.player.container.y - rimPos.y
    const dist = Math.hypot(dx, dy)

    // Determine actual shot type from distance if needed
    let effectiveType = shotType
    if (shotType === 'layup' && dist > 180) {
      // Too far for layup — reject
      this.showHoopEffect('TOO FAR FOR LAYUP', '#E63946')
      return
    }
    if (shotType === 'three' && dist < 280) {
      // Inside 3pt range — downgrade to midrange
      effectiveType = 'jumpshot'
    }

    // Shot outcome probability based on distance and shot type
    const outcome = this.determineShotOutcome(effectiveType, dist)
    this._lastShotType = effectiveType
    this._lastShotResult = outcome

    if (effectiveType === 'layup') {
      this.player.playLayup(rimPos.x, rimPos.y, (x, y) => {
        this.launchShotBall(x, y, effectiveType, outcome)
      })
    } else {
      // Jump shot or three-pointer — stationary shot
      this.player.playJumpShot((x, y) => {
        this.launchShotBall(x, y, effectiveType, outcome)
      })
    }
  }

  private determineShotOutcome(shotType: ShotType, dist: number): ShotResult {
    // Base success probability — closer = higher chance
    let successRate: number
    if (shotType === 'layup') {
      successRate = 0.82  // layups are high percentage
    } else if (shotType === 'three' || dist > 350) {
      successRate = 0.32  // three-pointers are hard
    } else {
      // mid-range: 200-350 px
      const t = Phaser.Math.Clamp((dist - 150) / 250, 0, 1)
      successRate = Phaser.Math.Linear(0.65, 0.38, t)
    }

    const roll = Math.random()
    if (roll < successRate * 0.55) return 'swish'       // clean swish
    if (roll < successRate) return 'rim_in'              // rattles in
    if (roll < successRate + (1 - successRate) * 0.55) return 'rim_out'  // rim out
    return 'airball'                                     // complete miss
  }

  private launchShotBall(fromX: number, fromY: number, shotType: ShotType, outcome: ShotResult) {
    this.ballGfx.setVisible(false)
    this.ballActive = false

    const rimCX = this.hoop.x
    const rimY = this.hoop.y + 50

    // Determine target offset based on outcome
    let offsetX: number
    switch (outcome) {
      case 'swish':
        offsetX = Phaser.Math.Between(-6, 6)
        this._shotShouldBounceOut = false
        break
      case 'rim_in':
        offsetX = Phaser.Math.Between(-18, 18)
        this._shotShouldBounceOut = false
        break
      case 'rim_out':
        offsetX = (Math.random() < 0.5 ? -1 : 1) * Phaser.Math.Between(24, 34)
        this._shotShouldBounceOut = true
        break
      case 'airball':
        offsetX = (Math.random() < 0.5 ? -1 : 1) * Phaser.Math.Between(50, 70)
        this._shotShouldBounceOut = false
        break
    }

    const targetX = rimCX + offsetX
    // Shot arc — higher arc for jump shots vs layups
    const isLayup = shotType === 'layup'
    const flightSec = isLayup ? 0.45 : 0.65

    const ddx = targetX - fromX
    const ddy = rimY - fromY

    this.ballVx = ddx / flightSec
    this.ballVy = (ddy - 0.5 * this.BALL_GRAVITY * flightSec * flightSec) / flightSec
    this.ballAngle = 0

    this.ballGfx.setPosition(fromX, fromY)
    this.ballGfx.setRotation(0)
    this.ballGfx.setAlpha(1)
    this.prevBallY = fromY
    this.drawBallGraphic()
    this.ballGfx.setVisible(true)
    this.ballActive = true

    this.ballShadowGfx.setVisible(true)
    this.ballShadowGfx.setAlpha(1)
    this.updateBallShadow()

    // Hide dribble ball during shot
    this.dribbleBall.clear()
  }

  private handleShotScore(shotType: ShotType, result: ShotResult) {
    if (result === 'airball' || result === 'rim_out') {
      // Miss — reset combo
      this.combo = 0
      this.onScoreUpdate?.(this.score, this.combo)
      const label = result === 'airball' ? 'AIRBALL!' : 'RIM OUT!'
      this.showHoopEffect(label, '#E63946')
      audioManager.playSfx('miss')
      return
    }

    // Made basket
    const now = this.time.now
    const timeSinceLast = now - this.lastDunkTime
    if (timeSinceLast < 4000) {
      this.combo++
    } else {
      this.combo = 1
    }
    this.lastDunkTime = now

    const basePoints: Record<ShotType, number> = {
      layup: 60,
      jumpshot: 80,
      three: 120,
    }
    const resultMul = result === 'swish' ? 1.5 : 1.0
    const comboBonus = Math.pow(this.combo, 1.3)
    const points = Math.round((basePoints[shotType] || 80) * resultMul * comboBonus)
    this.score += points

    this.totalDunks++
    if (this.combo > this.maxCombo) this.maxCombo = this.combo

    const label = result === 'swish' ? 'SWISH!' : 'BANG!'
    const color = result === 'swish' ? '#00FF88' : '#FFD700'
    this.showHoopEffect(label, color)
    this.hoop.swayNet(result === 'swish' ? 0.4 : 0.6)
    audioManager.playSfx('swish')

    // Score popup
    const popupColor = result === 'swish' ? '#00FF88' : '#FFB627'
    const popup = this.add.text(
      this.hoop.x, this.hoop.y + 50,
      `${result === 'swish' ? 'SWISH ' : ''}+${points}`,
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '16px',
        color: popupColor,
        stroke: '#000000',
        strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 0, color: popupColor, blur: 12, fill: true },
      }
    ).setOrigin(0.5).setDepth(20).setScale(0)
    this.tweens.add({ targets: popup, scale: 1, duration: 220, ease: 'Back.easeOut' })
    this.tweens.add({ targets: popup, y: popup.y - 70, alpha: 0, duration: 900, delay: 300, ease: 'Quad.easeOut', onComplete: () => popup.destroy() })

    this.onScoreUpdate?.(this.score, this.combo)
  }

  /** Color codes by dunk tier — gives each dunk type its own visual identity. */
  private dunkColor(dunkId: string): string {
    return this.getDunkProfile(dunkId).color
  }


  private performDunk(mapping: DunkKey) {
    const hoopPos = this.hoop.getRimWorldPos()
    this.player.playDunk(mapping.dunkId as any, hoopPos.x, hoopPos.y)

    // Burst of motion streaks radiating from the player at takeoff — gives
    // a sense of explosive energy without the cheesy emoji.
    this.spawnTakeoffBurst(this.player.container.x, this.player.container.y)

    // ---- Camera zoom toward the hoop during the dunk (NBA 2K cinematic) ----
    const cam = this.cameras.main
    const profile = this.getDunkProfile(mapping.dunkId)
    const isLegendary = ['freethrow_line', 'eastbay'].includes(mapping.dunkId)
    cam.pan(hoopPos.x, hoopPos.y + 100, 600, 'Quad.easeOut', true)
    cam.zoomTo(profile.zoom, 600, 'Quad.easeOut', true)
    // Per-dunk slow motion: each style now has its own tempo and impact feel.
    this.tweens.timeScale = profile.slowMo
    // Reset camera after the dunk lands — slow-mo adds time so we wait longer.
    // With timeScale 0.65, real wall-clock is ~1.5x animation time.
    const isSlow = ['windmill', 'three_sixty', 'between_legs', 'eastbay'].includes(mapping.dunkId)
    this.time.delayedCall(isSlow ? 4500 : 3300, () => {
      cam.pan(this.scale.width / 2, this.scale.height / 2, 500, 'Quad.easeInOut', true)
      cam.zoomTo(1.0, 500, 'Quad.easeInOut', true)
      this.tweens.timeScale = 1
    })

    // ---- Dunk name burst — colored by tier, huge entrance ----
    const color = this.dunkColor(mapping.dunkId)
    this.dunkNameText.setText(`${mapping.name}\n${profile.style}`)
    this.dunkNameText.setColor(color)
    this.dunkNameText.setAlpha(1)
    this.dunkNameText.setScale(1.9)
    this.dunkNameText.setY(this.scale.height * 0.42)
    this.tweens.add({
      targets: this.dunkNameText,
      scale: 1.0,
      duration: 280,
      ease: 'Back.easeOut',
    })
    this.spawnSignatureVfx(mapping.dunkId, this.player.container.x, this.player.container.y, hoopPos.x, hoopPos.y)
    this.tweens.add({
      targets: this.dunkNameText,
      alpha: 0,
      y: this.dunkNameText.y - 50,
      duration: 1100,
      delay: 800,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.dunkNameText.setY(this.scale.height * 0.42)
      }
    })
  }

  private handleDunkComplete(dunkId: string) {
    // Missed dunk — combo was already reset in performMissedDunk, no score
    if (dunkId === 'miss') return

    const now = this.time.now
    const timeSinceLast = now - this.lastDunkTime

    if (timeSinceLast < 4000) {
      this.combo++
    } else {
      this.combo = 1
    }
    this.lastDunkTime = now

    const comboBonus = Math.pow(this.combo, 1.5)
    const dunkMapping = this.dunkMappings.find(d => d.dunkId === dunkId)
    const difficultyMap: Record<string, number> = {
      basic_two: 100, basic_one: 150, reverse: 200, windmill: 300,
      tomahawk: 200, three_sixty: 350, between_legs: 500, alleyoop: 250,
      cradle: 300, putback: 150, tip_dunk: 120, chaser: 180,
      double_pump: 280, freethrow_line: 1000, eastbay: 600,
    }
    // ---- Timing/precision multiplier ----
    const perfMul = this.lastDunkPerfTier === 'perfect' ? 1.5
                  : this.lastDunkPerfTier === 'good'    ? 1.2
                  : 1.0
    const basePts = dunkMapping ? (difficultyMap[dunkId] || 100) : 100
    const points = Math.round(basePts * comboBonus * perfMul)
    this.score += points

    // ---- Round stats ----
    this.totalDunks++
    if (this.combo > this.maxCombo) this.maxCombo = this.combo
    if (this.lastDunkPerfTier === 'perfect') {
      this.perfectCount++
      this.spawnPerfectBadge()
    }

    this.scoreText.setText(this.score.toString())
    if (this.combo > 1) {
      this.comboText.setText(`${this.combo}x COMBO!`)
      this.tweens.add({
        targets: this.comboText,
        scaleX: 1.3, scaleY: 1.3,
        duration: 150,
        yoyo: true,
      })
    } else {
      this.comboText.setText('')
    }

    // Score popup — emerges from the rim, arcs up, fades
    const dunkProfile = this.getDunkProfile(dunkId)
    const popupColor = this.lastDunkPerfTier === 'perfect' ? '#00FF88' : this.combo >= 3 ? '#FFB627' : this.combo === 2 ? '#FF6B2C' : dunkProfile.color
    const popupSize = this.combo >= 3 ? 28 : this.combo >= 2 ? 22 : 18
    const popup = this.add.text(
      this.hoop.x,
      this.hoop.y + 50,
      `${this.lastDunkPerfTier === 'perfect' ? 'PERFECT ' : this.lastDunkPerfTier === 'good' ? 'GOOD ' : ''}+${points}`,
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${popupSize}px`,
        color: popupColor,
        stroke: '#000000',
        strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 0, color: popupColor, blur: 12, fill: true },
      }
    ).setOrigin(0.5).setDepth(20).setScale(0)

    // Pop in big, then float up
    this.tweens.add({
      targets: popup,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
    })
    this.tweens.add({
      targets: popup,
      y: popup.y - 90,
      alpha: 0,
      duration: 1100,
      delay: 300,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy()
    })

    // Bonus chip for combo
    if (this.combo > 1) {
      const comboChip = this.add.text(
        this.hoop.x,
        this.hoop.y + 78,
        `× ${this.combo} COMBO`,
        {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '12px',
          color: '#FFB627',
          stroke: '#000000',
          strokeThickness: 3,
        }
      ).setOrigin(0.5).setDepth(20).setScale(0.3)
      this.tweens.add({
        targets: comboChip,
        scale: 1,
        duration: 220,
        ease: 'Back.easeOut',
      })
      this.tweens.add({
        targets: comboChip,
        y: comboChip.y - 60,
        alpha: 0,
        duration: 900,
        delay: 350,
        ease: 'Quad.easeOut',
        onComplete: () => comboChip.destroy()
      })
    }

    // Flash hoop & shake camera
    this.hoop.flash()
    this.cameras.main.shake(170, Math.max(dunkProfile.shake, this.combo > 2 ? 0.012 : 0.006))

    // Particles burst — emit from the rim center
    this.spawnConfetti(this.hoop.x, this.hoop.y + 55)
    this.spawnImpactRing(this.hoop.x, this.hoop.y + 50)
    this.spawnSparkles(this.hoop.x, this.hoop.y + 55)
    this.spawnStyleBadge(dunkProfile)

    // Legendary dunk → full-screen flash
    const legendaryIds = ['freethrow_line', 'eastbay', 'between_legs', 'three_sixty']
    if (legendaryIds.includes(dunkId) || this.combo >= 5) {
      this.spawnScreenFlash()
    }

    this.onScoreUpdate?.(this.score, this.combo)
    this.onDunkFeedback?.({
      dunkId,
      name: dunkMapping?.name || dunkId,
      tier: this.lastDunkPerfTier,
      points,
      approachGrade: this.lastApproachGrade,
      trainingCue: dunkProfile.trainingCue,
      risk: dunkProfile.risk,
      style: dunkProfile.style,
      color: dunkProfile.color,
    })
    this.onDunkPerformed?.(dunkId)
  }

  /**
   * Radial speed lines bursting outward from the player at the moment of takeoff.
   * Conveys explosive energy in a cinematic way (no cartoonish emoji).
   */
  private spawnTakeoffBurst(x: number, y: number) {
    const lineCount = 14
    for (let i = 0; i < lineCount; i++) {
      const baseAngle = (Math.PI * 2 * i) / lineCount
      const angle = baseAngle + Phaser.Math.FloatBetween(-0.08, 0.08)
      const innerR = 32
      const outerR = innerR + Phaser.Math.Between(22, 38)
      const x1 = x + Math.cos(angle) * innerR
      const y1 = y + Math.sin(angle) * innerR
      const x2 = x + Math.cos(angle) * outerR
      const y2 = y + Math.sin(angle) * outerR
      const line = this.add.graphics().setDepth(9)
      line.lineStyle(2.5, 0xFFFFFF, 0.85)
      line.lineBetween(x1, y1, x2, y2)
      line.setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({
        targets: line,
        alpha: 0,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => line.destroy(),
      })
    }
    // Dust ring kicked up by the jump
    const ring = this.add.graphics().setDepth(9)
    ring.lineStyle(2, 0xC8A878, 0.55)
    ring.strokeEllipse(0, 0, 50, 12)
    ring.setPosition(x, y + 38 * this.playerScale)
    this.tweens.add({
      targets: ring,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: 450,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    })
  }

  /** "PERFECT!" badge that punches in above the rim when timing is on the sweet spot. */
  private spawnStyleBadge(profile: DunkStyleProfile) {
    const badge = this.add.text(this.hoop.x, this.hoop.y + 88, `${profile.badge} · ${this.lastApproachGrade}등급`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: profile.color,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(24).setScale(0.35)
    badge.setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({ targets: badge, scale: 1, duration: 240, ease: 'Back.easeOut' })
    this.tweens.add({ targets: badge, y: badge.y + 42, alpha: 0, duration: 1100, delay: 500, ease: 'Quad.easeOut', onComplete: () => badge.destroy() })
  }

  private spawnSignatureVfx(dunkId: string, x: number, y: number, rimX: number, rimY: number) {
    const profile = this.getDunkProfile(dunkId)
    const color = profile.accent
    if (dunkId === 'windmill' || dunkId === 'between_legs' || dunkId === 'eastbay') {
      const arc = this.add.graphics().setDepth(21)
      arc.lineStyle(4, color, 0.9)
      arc.beginPath()
      arc.arc(x, y - 70, 58, Phaser.Math.DegToRad(205), Phaser.Math.DegToRad(520), false)
      arc.strokePath()
      arc.setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: arc, alpha: 0, scale: 1.35, duration: 900, ease: 'Quad.easeOut', onComplete: () => arc.destroy() })
    }
    if (dunkId === 'three_sixty' || dunkId === 'reverse') {
      for (let i = 0; i < 3; i++) {
        const ring = this.add.graphics().setDepth(20)
        ring.lineStyle(2, color, 0.75)
        ring.strokeEllipse(0, 0, 70 + i * 18, 22 + i * 6)
        ring.setPosition(x, y - 44)
        ring.setBlendMode(Phaser.BlendModes.ADD)
        this.tweens.add({ targets: ring, rotation: Math.PI * 1.6, alpha: 0, duration: 650 + i * 120, ease: 'Sine.easeOut', onComplete: () => ring.destroy() })
      }
    }
    if (dunkId === 'tomahawk' || dunkId === 'double_pump' || dunkId === 'freethrow_line') {
      for (let i = 0; i < 7; i++) {
        const slash = this.add.graphics().setDepth(22)
        slash.lineStyle(3, color, 0.85)
        const ox = Phaser.Math.Between(-46, 46)
        slash.lineBetween(rimX + ox, rimY - 80 - i * 8, rimX + ox * 0.25, rimY + 20)
        slash.setBlendMode(Phaser.BlendModes.ADD)
        this.tweens.add({ targets: slash, alpha: 0, y: slash.y + 28, duration: 520, ease: 'Quad.easeOut', onComplete: () => slash.destroy() })
      }
    }
    if (dunkId === 'alleyoop' || dunkId === 'putback' || dunkId === 'tip_dunk') {
      const target = this.add.graphics().setDepth(22)
      target.lineStyle(3, color, 0.9)
      target.strokeCircle(rimX, rimY + 50, 42)
      target.lineBetween(rimX - 58, rimY + 50, rimX + 58, rimY + 50)
      target.lineBetween(rimX, rimY - 8, rimX, rimY + 108)
      target.setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: target, scale: 1.25, alpha: 0, duration: 620, ease: 'Quad.easeOut', onComplete: () => target.destroy() })
    }
  }

  private spawnPerfectBadge() {
    const x = this.hoop.x
    const y = this.hoop.y + 14
    const badge = this.add.text(x, y, 'PERFECT!', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#00FF88',
      stroke: '#000000',
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 0, color: '#00FF88', blur: 18, fill: true },
    }).setOrigin(0.5).setDepth(26).setScale(0.2)
    badge.setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({ targets: badge, scale: 1.0, duration: 240, ease: 'Back.easeOut' })
    this.tweens.add({
      targets: badge,
      y: y - 60,
      alpha: 0,
      duration: 800,
      delay: 350,
      ease: 'Quad.easeOut',
      onComplete: () => badge.destroy(),
    })
    audioManager.playSfx('combo')
  }

  private spawnConfetti(x: number, y: number) {
    // NBA palette confetti
    const colors = [0xFF6B2C, 0xFFB627, 0xE63946, 0x5BC0EB, 0xFFFFFF]
    for (let i = 0; i < 22; i++) {
      const w = Phaser.Math.Between(4, 8)
      const h = Phaser.Math.Between(4, 8)
      const confetti = this.add.rectangle(
        x + Phaser.Math.Between(-25, 25),
        y,
        w, h,
        colors[i % colors.length]
      ).setDepth(20)
      confetti.setBlendMode(Phaser.BlendModes.ADD)
      const angle = Phaser.Math.FloatBetween(-Math.PI, 0)
      const speed = Phaser.Math.Between(100, 220)
      const targetX = confetti.x + Math.cos(angle) * speed
      const targetY = confetti.y + Math.sin(angle) * speed + 200  // gravity tail
      this.tweens.add({
        targets: confetti,
        x: targetX,
        y: targetY,
        rotation: Phaser.Math.FloatBetween(-4, 4),
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: Phaser.Math.Between(900, 1400),
        ease: 'Cubic.easeOut',
        onComplete: () => confetti.destroy()
      })
    }
  }

  private spawnImpactRing(x: number, y: number) {
    // Expanding orange shockwave ring on rim
    const ring = this.add.graphics().setDepth(18)
    ring.lineStyle(3, 0xFFB627, 1)
    ring.strokeCircle(0, 0, 8)
    ring.setPosition(x, y)
    ring.setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({
      targets: ring,
      scaleX: 6,
      scaleY: 6,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    })
  }

  private spawnSparkles(x: number, y: number) {
    // Small white sparkles that drift up like net snap
    for (let i = 0; i < 8; i++) {
      const s = this.add.circle(
        x + Phaser.Math.Between(-15, 15),
        y + Phaser.Math.Between(-5, 10),
        Phaser.Math.Between(2, 3),
        0xFFFFFF
      ).setDepth(19)
      s.setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({
        targets: s,
        y: s.y + Phaser.Math.Between(40, 90),
        x: s.x + Phaser.Math.Between(-25, 25),
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(500, 800),
        ease: 'Quad.easeOut',
        onComplete: () => s.destroy()
      })
    }
  }

  private spawnScreenFlash() {
    const flash = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0xFFB627
    ).setDepth(50).setAlpha(0.6)
    flash.setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy()
    })
  }

  private launchBall(fromX: number, fromY: number, dunkId: string) {
    // Reset any in-flight ball
    this.ballGfx.setVisible(false)
    this.ballActive = false

    const rimCX = this.hoop.x
    const rimY  = this.hoop.y + 50

    // For MISS attempts the ball is aimed OFF the rim — guaranteed clang
    let offsetX: number
    if (dunkId === 'miss') {
      const side = Math.random() < 0.5 ? -1 : 1
      offsetX = side * Phaser.Math.Between(28, 44)  // way off-center
    } else {
      offsetX = Phaser.Math.Between(-9, 9)
    }
    const targetX = rimCX + offsetX

    const dx = targetX - fromX
    const dy = rimY - fromY          // positive = going down
    const flightSec = 0.52

    this.ballVx = dx / flightSec
    this.ballVy = (dy - 0.5 * this.BALL_GRAVITY * flightSec * flightSec) / flightSec
    this.ballAngle = 0

    this.ballGfx.setPosition(fromX, fromY)
    this.ballGfx.setRotation(0)
    this.ballGfx.setAlpha(1)
    this.prevBallY = fromY
    this.drawBallGraphic()
    this.ballGfx.setVisible(true)
    this.ballActive = true

    // Floor shadow tracks the ball directly below
    this.ballShadowGfx.setVisible(true)
    this.ballShadowGfx.setAlpha(1)
    this.updateBallShadow()
  }

  /** Draws an ellipse shadow on the floor below the flying ball — grows softer as ball rises. */
  private updateBallShadow() {
    if (!this.ballActive) return
    const floorY = this.hoop.y + 50 + 80   // just below the rim level on the floor
    const heightAboveFloor = Math.max(0, floorY - this.ballGfx.y)
    const fadeT = Math.min(1, heightAboveFloor / 220)
    const scale = 1 + fadeT * 0.6
    const alpha = 0.45 - fadeT * 0.3
    const g = this.ballShadowGfx
    g.clear()
    g.fillStyle(0x000000, alpha)
    g.fillEllipse(this.ballGfx.x, floorY, 24 * scale, 6)
  }

  private drawBallGraphic() {
    const g = this.ballGfx
    g.clear()
    const r = 11
    // Body
    g.fillStyle(0xFF8A1F)
    g.fillCircle(0, 0, r)
    // Inner highlight (upper-left, gives volume)
    g.fillStyle(0xFFB76A, 0.7)
    g.fillCircle(-r * 0.3, -r * 0.35, r * 0.45)
    // Outline
    g.lineStyle(1.8, 0x4A1F0A, 1)
    g.strokeCircle(0, 0, r)
    // Seams — cross + curved side
    g.lineBetween(-r, 0, r, 0)
    g.lineBetween(0, -r, 0, r)
    g.lineStyle(1.4, 0x4A1F0A, 0.75)
    g.strokeEllipse(0, 0, r * 1.5, r * 2)
  }

  /** Faint orange motion trail behind the flying ball. */
  private spawnBallTrail() {
    const dot = this.add.circle(this.ballGfx.x, this.ballGfx.y, 6, 0xFF8A1F, 0.45)
      .setDepth(12)
    dot.setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({
      targets: dot,
      scale: 0.2,
      alpha: 0,
      duration: 240,
      ease: 'Quad.easeOut',
      onComplete: () => dot.destroy()
    })
  }

  private _ballTrailT = 0
  private updateBall(delta: number) {
    if (!this.ballActive) return
    const dt = delta / 1000

    this.prevBallY = this.ballGfx.y
    this.ballVy += this.BALL_GRAVITY * dt
    this.ballGfx.x += this.ballVx * dt
    this.ballGfx.y += this.ballVy * dt

    // Spin based on horizontal movement (and a little from falling)
    this.ballAngle += (this.ballVx * 0.003) + (Math.abs(this.ballVy) * 0.0008)
    this.ballGfx.setRotation(this.ballAngle)

    // Motion trail every ~30ms
    this._ballTrailT += delta
    if (this._ballTrailT > 30) {
      this._ballTrailT = 0
      this.spawnBallTrail()
    }

    this.updateBallShadow()
    this.checkHoopCollision()

    if (this.ballGfx.y > this.scale.height + 60) {
      this.ballActive = false
      this.ballGfx.setVisible(false)
      this.ballShadowGfx.setVisible(false)
    }
  }

  private checkHoopCollision() {
    // Match the actual new hoop coordinates (hoop.draw centers rim at y+50 with radius 36).
    const rimCX = this.hoop.x
    const rimY  = this.hoop.y + 50
    const rimR  = this.hoop.rimRadius
    const ballR = 11

    const bx = this.ballGfx.x
    const by = this.ballGfx.y

    if (this.prevBallY < rimY && by >= rimY) {
      const dist = Math.abs(bx - rimCX)

      if (dist < rimR * 0.55) {
        this.showHoopEffect('SWISH!', '#00FF88')
        this.spawnSwishTrail(bx, rimY)
        this.ballActive = false
        // Ball drops straight through the net
        this.tweens.add({
          targets: this.ballGfx,
          y: rimY + 60,
          alpha: 0,
          duration: 320,
          ease: 'Quad.easeIn',
          onComplete: () => {
            this.ballGfx.setVisible(false)
            this.ballGfx.setAlpha(1)
            this.ballShadowGfx.setVisible(false)
          }
        })
      } else if (dist < rimR + ballR * 0.7) {
        // Rim contact — bang and roll toward center
        this.showHoopEffect('BANG!', '#FFD700')
        this.ballVy = -Math.abs(this.ballVy) * 0.55   // small upward kick
        this.ballVx = (rimCX - bx) * 3.5               // strong nudge toward center
        this.cameras.main.shake(80, 0.004)
      }
    }

    // Ball passes through net region after rim crossing — clean cleanup
    if (by > rimY + 50 && Math.abs(bx - rimCX) < rimR * 0.7 && this.ballActive) {
      this.ballActive = false
      this.tweens.add({
        targets: this.ballGfx,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.ballGfx.setVisible(false)
          this.ballGfx.setAlpha(1)
        }
      })
    }
  }

  // ============================================================
  // Helper stubs (called by shot system; visual-only)
  // ============================================================
  private showHoopEffect(label: string, color: string) {
    if (!this.hoop) return
    const txt = this.add.text(this.hoop.x, this.hoop.y - 40, label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '18px',
      color,
      stroke: '#000',
      strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 0, color, blur: 12, fill: true },
    }).setOrigin(0.5).setDepth(25).setScale(0)
    this.tweens.add({ targets: txt, scale: 1, duration: 200, ease: 'Back.easeOut' })
    this.tweens.add({
      targets: txt, y: txt.y - 80, alpha: 0, duration: 900, delay: 350, ease: 'Quad.easeOut',
      onComplete: () => txt.destroy(),
    })
  }

  private spawnSwishTrail(_x: number, _y: number) {
    // Visual flourish on perfect swish; intentionally minimal
    if (!this.hoop) return
    const ring = this.add.graphics()
    ring.lineStyle(3, 0x00ff88, 0.9)
    ring.strokeCircle(this.hoop.x, this.hoop.y + 50, 30)
    ring.setDepth(20)
    this.tweens.add({
      targets: ring, alpha: 0, scaleX: 2, scaleY: 2, duration: 500,
      onComplete: () => ring.destroy(),
    })
  }

  showControls() {
    // Stub — was referenced by old code, no-op for now
  }


}
