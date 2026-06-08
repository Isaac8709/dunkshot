import Phaser from 'phaser'

export type DunkAnimId =
  | 'basic_two' | 'basic_one' | 'reverse' | 'windmill'
  | 'three_sixty' | 'between_legs' | 'alleyoop' | 'tomahawk'
  | 'cradle' | 'putback' | 'tip_dunk' | 'chaser' | 'double_pump'
  | 'freethrow_line' | 'eastbay'

type DunkMotionProfile = {
  runEndYOffset: number
  runEndScale: number
  peakYOffset: number
  driftX: number
  releaseAt: number
  runMul: number
  airExtra: number
  gather: 'balanced' | 'power' | 'spin' | 'catch' | 'quick' | 'long'
}

/**
 * Stylized basketball player drawn entirely with Phaser graphics primitives.
 * Designed for a "behind the camera" perspective camera angle (NBA 2K mobile-ish).
 *
 * Container origin = player's center-of-mass (roughly hips). Drawing extends:
 *   - head top    ≈ -68
 *   - shoulders   ≈ -32
 *   - hips        ≈ 0
 *   - feet bottom ≈ +50
 */
export class Player {
  scene: Phaser.Scene
  container: Phaser.GameObjects.Container
  gfx!: Phaser.GameObjects.Graphics
  jerseyNum!: Phaser.GameObjects.Text
  shadow!: Phaser.GameObjects.Ellipse
  isAnimating = false
  baseX: number
  baseY: number
  onDunkComplete?: (dunkId: string) => void
  onBallRelease?: (x: number, y: number, dunkId: string) => void
  onShotRelease?: (x: number, y: number) => void
  onShotComplete?: () => void

  /** Local-space position of the hand currently controlling the ball. */
  private _activeHandLocal: { x: number; y: number } = { x: 22, y: 4 }

  // Palette
  SKIN     = 0xE8B58E
  SKIN_DK  = 0xC79468
  JERSEY   = 0xFF4D1F  // NBA red-orange
  JERSEY_HI= 0xFF8A4D
  SHORTS   = 0x12172A
  SHORTS_HI= 0x2C3A5C
  SHOE     = 0x0A0A14
  SHOE_HI  = 0xFFB627  // yellow accent
  BAND     = 0xFFB627  // wristband / headband

  private _ballReleased = false
  private _idleT = 0

  private readonly motionProfiles: Record<DunkAnimId, DunkMotionProfile> = {
    basic_two:      { runEndYOffset: 130, runEndScale: 0.78, peakYOffset: 50, driftX: 0,   releaseAt: 0.55, runMul: 1.00, airExtra: 360, gather: 'balanced' },
    basic_one:      { runEndYOffset: 126, runEndScale: 0.77, peakYOffset: 44, driftX: 14,  releaseAt: 0.52, runMul: 0.95, airExtra: 330, gather: 'quick' },
    reverse:        { runEndYOffset: 118, runEndScale: 0.76, peakYOffset: 38, driftX: -20, releaseAt: 0.58, runMul: 0.92, airExtra: 410, gather: 'spin' },
    windmill:       { runEndYOffset: 140, runEndScale: 0.80, peakYOffset: 30, driftX: 4,   releaseAt: 0.68, runMul: 1.05, airExtra: 520, gather: 'power' },
    three_sixty:    { runEndYOffset: 122, runEndScale: 0.76, peakYOffset: 26, driftX: -4,  releaseAt: 0.64, runMul: 0.90, airExtra: 560, gather: 'spin' },
    between_legs:   { runEndYOffset: 132, runEndScale: 0.78, peakYOffset: 24, driftX: 6,   releaseAt: 0.72, runMul: 0.98, airExtra: 600, gather: 'power' },
    alleyoop:       { runEndYOffset: 112, runEndScale: 0.74, peakYOffset: 20, driftX: 0,   releaseAt: 0.48, runMul: 0.82, airExtra: 430, gather: 'catch' },
    tomahawk:       { runEndYOffset: 136, runEndScale: 0.81, peakYOffset: 42, driftX: 0,   releaseAt: 0.60, runMul: 1.08, airExtra: 430, gather: 'power' },
    cradle:         { runEndYOffset: 128, runEndScale: 0.77, peakYOffset: 36, driftX: 18,  releaseAt: 0.62, runMul: 0.96, airExtra: 420, gather: 'balanced' },
    putback:        { runEndYOffset: 96,  runEndScale: 0.72, peakYOffset: 18, driftX: 0,   releaseAt: 0.44, runMul: 0.55, airExtra: 260, gather: 'quick' },
    tip_dunk:       { runEndYOffset: 92,  runEndScale: 0.70, peakYOffset: 14, driftX: 0,   releaseAt: 0.42, runMul: 0.52, airExtra: 230, gather: 'quick' },
    chaser:         { runEndYOffset: 124, runEndScale: 0.77, peakYOffset: 34, driftX: -48, releaseAt: 0.54, runMul: 0.86, airExtra: 360, gather: 'quick' },
    double_pump:    { runEndYOffset: 134, runEndScale: 0.78, peakYOffset: 22, driftX: 8,   releaseAt: 0.78, runMul: 0.98, airExtra: 660, gather: 'power' },
    freethrow_line: { runEndYOffset: 162, runEndScale: 0.84, peakYOffset: 28, driftX: 0,   releaseAt: 0.76, runMul: 1.55, airExtra: 620, gather: 'long' },
    eastbay:        { runEndYOffset: 130, runEndScale: 0.79, peakYOffset: 20, driftX: 10,  releaseAt: 0.76, runMul: 1.04, airExtra: 680, gather: 'power' },
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.baseX = x
    this.baseY = y
    this.container = scene.add.container(x, y)

    // Ground shadow — softer ellipse under the feet
    this.shadow = scene.add.ellipse(x, y + 48, 56, 14, 0x000000, 0.35)
    scene.children.sendToBack(this.shadow)

    this.gfx = scene.add.graphics()
    this.container.add(this.gfx)

    this.jerseyNum = scene.add.text(0, -8, '23', {
      fontFamily: 'Press Start 2P',
      fontSize: '9px',
      color: '#FFFFFF',
    }).setOrigin(0.5)
    this.container.add(this.jerseyNum)

    this.drawIdle()
  }

  /** Animate idle: gentle bob + dribbling arm. Called each frame from CourtScene. */
  tickIdle(dt: number) {
    this._idleT += dt
    // Slight breathing bob
    const bob = Math.sin(this._idleT * 2.2) * 0.6
    this.container.y = this.baseY + bob
  }

  /** Returns world-space position of the hand holding the ball. */
  getActiveHandPosition(): { x: number; y: number } {
    const sx = Math.abs(this.container.scaleX) || 1
    const sy = Math.abs(this.container.scaleY) || 1
    return {
      x: this.container.x + this._activeHandLocal.x * sx,
      y: this.container.y + this._activeHandLocal.y * sy,
    }
  }

  // ============================================================
  // IDLE pose — standing relaxed, weight on one foot, dribble-ready
  // ============================================================
  drawIdle() {
    this.gfx.clear()
    const g = this.gfx
    this.drawShoes(g, 0, false)
    this.drawLegs(g, 0)
    this.drawShorts(g)
    this.drawTorso(g, 0)
    this.drawArms(g, /* leftAngle */ -10, /* rightAngle */ 22)  // right arm slightly out for ball
    this.drawHead(g, 0)
    this._activeHandLocal = { x: 22, y: 4 }
    this.jerseyNum.setVisible(true)
    this.jerseyNum.setY(-12)
  }

  // ============================================================
  // RUN-UP pose — leaning forward, legs cycling, ball in hand
  // ============================================================
  drawRunning(progress: number) {
    this.gfx.clear()
    const g = this.gfx
    // Leg cycle — alternate front/back stride
    const cycle = Math.sin(progress * Math.PI * 8)
    const stride = cycle * 8
    // Forward body lean
    this.container.angle = Phaser.Math.Linear(0, 8, Math.min(1, progress * 2))
    // Shoes with alternating stride offset
    g.fillStyle(this.SHOE)
    g.fillRoundedRect(-16, 42 - stride * 0.6, 14, 9, { tl: 3, tr: 3, bl: 5, br: 1 })
    g.fillRoundedRect(3, 42 + stride * 0.6, 14, 9, { tl: 3, tr: 3, bl: 1, br: 5 })
    g.fillStyle(this.SHOE_HI)
    g.fillRect(-15, 47 - stride * 0.6, 12, 2)
    g.fillRect(4, 47 + stride * 0.6, 12, 2)
    // Legs (skin) angled by stride
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-13, 16, 8, 26 - stride * 0.5, 3)
    g.fillRoundedRect(5, 16, 8, 26 + stride * 0.5, 3)
    this.drawShorts(g)
    this.drawTorso(g, 0)
    // Arms pump opposite to legs
    this.drawArms(g, 30 + cycle * 25, 30 - cycle * 25)
    this.drawHead(g, 0)
    // Ball carried at hip while running
    if (!this._ballReleased) {
      this.drawBall(g, 20, 8, 10)
    }
    this._activeHandLocal = { x: 20, y: 8 }
  }

  // ============================================================
  // GATHER pose — deep crouch loading the legs right before takeoff
  // ============================================================
  drawGather(t: number) {
    this.gfx.clear()
    const g = this.gfx
    this.container.angle = Phaser.Math.Linear(8, 0, t)
    const crouch = t * 10  // sink down
    // Bent legs (wide stance, knees out)
    g.fillStyle(this.SHOE)
    g.fillRoundedRect(-20, 44 - crouch, 14, 9, { tl: 3, tr: 3, bl: 5, br: 1 })
    g.fillRoundedRect(7, 44 - crouch, 14, 9, { tl: 3, tr: 3, bl: 1, br: 5 })
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-16, 18, 9, 26 - crouch, 3)
    g.fillRoundedRect(8, 18, 9, 26 - crouch, 3)
    this.drawShorts(g)
    this.drawTorso(g, crouch * 0.4)
    // Arms swung back, ready to throw up
    this.drawArms(g, 55, 55)
    this.drawHead(g, crouch * 0.3)
    if (!this._ballReleased) {
      this.drawBall(g, 0, 12, 11)
    }
    this._activeHandLocal = { x: 0, y: 12 }
  }

  // ============================================================
  // LANDING pose — knees absorb impact (squash)
  // ============================================================
  drawLanding(t: number) {
    this.gfx.clear()
    const g = this.gfx
    this.container.angle = 0
    const absorb = Math.sin(t * Math.PI) * 8  // dip then recover
    g.fillStyle(this.SHOE)
    g.fillRoundedRect(-18, 44, 14, 9, { tl: 3, tr: 3, bl: 5, br: 1 })
    g.fillRoundedRect(5, 44, 14, 9, { tl: 3, tr: 3, bl: 1, br: 5 })
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-14, 18 + absorb, 9, 26 - absorb, 3)
    g.fillRoundedRect(6, 18 + absorb, 9, 26 - absorb, 3)
    this.drawShorts(g)
    this.drawTorso(g, absorb * 0.5)
    this.drawArms(g, 20, 20)
    this.drawHead(g, absorb * 0.4)
  }

  // ============================================================
  // JUMPING pose — body slightly tucked, arms raising
  // ============================================================
  drawJumping(progress: number) {
    this.gfx.clear()
    const g = this.gfx
    const tuck = progress * 0.8  // legs tuck in
    this.drawShoes(g, -tuck * 18, true)
    this.drawLegs(g, -tuck * 18, /* tucked */ true)
    this.drawShorts(g)
    this.drawTorso(g, -tuck * 4)
    // Arms raising up
    const a = -50 - progress * 70
    this.drawArms(g, a, a)
    this.drawHead(g, -tuck * 2)
    this.jerseyNum.setVisible(true)
    this.jerseyNum.setY(-12)
  }

  // ============================================================
  // DUNK poses — dispatch by dunkId
  // ============================================================
  drawDunking(dunkId: DunkAnimId, progress: number) {
    this.gfx.clear()
    const g = this.gfx
    const armUp = progress < 0.5 ? progress * 2 : 1

    switch (dunkId) {
      case 'basic_two':
        this.drawTwoHandDunk(g, armUp); break
      case 'tomahawk':
        this.drawTwoHandTomahawk(g, progress); break
      case 'basic_one':
      case 'tip_dunk':
      case 'putback':
        this.drawOneHandDunk(g, armUp, false); break
      case 'reverse':
        this.drawReversePose(g, armUp); break
      case 'windmill':
        this.drawWindmillPose(g, progress); break
      case 'three_sixty':
        this.drawSpinPose(g, progress); break
      case 'between_legs':
      case 'eastbay':
        this.drawBetweenLegsPose(g, progress); break
      case 'alleyoop':
        this.drawAlleyoopPose(g, armUp); break
      case 'cradle':
        this.drawCradlePose(g, armUp); break
      case 'freethrow_line':
        this.drawFreethrowLinePose(g, progress); break
      default:
        this.drawTwoHandDunk(g, armUp)
    }
    this.jerseyNum.setVisible(true)
    this.jerseyNum.setY(-15)
  }

  // ============================================================
  // BODY PARTS — primitives composed for each pose
  // ============================================================
  private drawShoes(g: Phaser.GameObjects.Graphics, offsetY: number, mid_air: boolean) {
    const y = 42 + offsetY
    // Left
    g.fillStyle(this.SHOE)
    g.fillRoundedRect(-16, y, 14, 9, { tl: 3, tr: 3, bl: 5, br: 1 })
    g.fillStyle(this.SHOE_HI)
    g.fillRect(-15, y + 5, 12, 2)
    // Right
    g.fillStyle(this.SHOE)
    g.fillRoundedRect(3, y, 14, 9, { tl: 3, tr: 3, bl: 1, br: 5 })
    g.fillStyle(this.SHOE_HI)
    g.fillRect(4, y + 5, 12, 2)
    // Toe accent (white sneaker swoosh)
    g.fillStyle(0xFFFFFF, 0.85)
    g.fillRect(-3, y + 1, 5, 2)
    if (mid_air) {
      // Tilt forward slightly when jumping
    }
  }

  private drawLegs(g: Phaser.GameObjects.Graphics, offsetY: number, tucked = false) {
    const top = 8
    const bot = 42 + offsetY
    // Sock band (white) at top of shoe
    g.fillStyle(0xFFFFFF, 1)
    g.fillRect(-14, bot - 8, 10, 5)
    g.fillRect(4, bot - 8, 10, 5)
    // Shins (skin)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-13, top + 8, 8, bot - top - 10, 3)
    g.fillRoundedRect(5, top + 8, 8, bot - top - 10, 3)
    // Knees (highlight)
    if (!tucked) {
      g.fillStyle(this.SKIN_DK)
      g.fillCircle(-9, top + 20, 3)
      g.fillCircle(9, top + 20, 3)
    }
  }

  private drawShorts(g: Phaser.GameObjects.Graphics) {
    // Main shorts (loose fit)
    g.fillStyle(this.SHORTS)
    g.fillRoundedRect(-18, -2, 36, 22, 4)
    // Center seam
    g.fillStyle(0x000000, 0.4)
    g.fillRect(-1, 0, 2, 18)
    // Side stripe (orange accent)
    g.fillStyle(0xFF6B2C, 0.85)
    g.fillRect(-18, 2, 3, 14)
    g.fillRect(15, 2, 3, 14)
    // Belt highlight
    g.fillStyle(this.SHORTS_HI, 0.6)
    g.fillRect(-18, -2, 36, 3)
  }

  private drawTorso(g: Phaser.GameObjects.Graphics, offsetY: number) {
    const top = -32 + offsetY
    const bot = -2
    // Body
    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(-17, top, 34, bot - top, 5)
    // Side highlight (rim light)
    g.fillStyle(this.JERSEY_HI, 0.4)
    g.fillRect(11, top + 4, 5, bot - top - 8)
    // Bottom hem stripe
    g.fillStyle(0xFFFFFF, 0.7)
    g.fillRect(-17, bot - 3, 34, 2)
    // Neckline cutout
    g.fillStyle(this.SKIN)
    g.fillTriangle(0, top + 1, -6, top + 8, 6, top + 8)
  }

  private drawArms(g: Phaser.GameObjects.Graphics, leftAngle: number, rightAngle: number) {
    // Shoulder pivots inside the torso edge
    this.drawArm(g, -15, -28, leftAngle, false)
    this.drawArm(g, 15, -28, rightAngle, true)
  }

  /**
   * Arm = shoulder cap → bicep (jersey sleeve) → forearm (skin) → wristband → hand.
   * `angle` is in degrees, 0 = straight down, negative = toward outside of body.
   */
  private drawArm(g: Phaser.GameObjects.Graphics, ox: number, oy: number, angle: number, isRight: boolean) {
    const w = 7
    const bicepLen = 14
    const forearmLen = 20
    g.save()
    g.translateCanvas(ox, oy)
    // For the LEFT arm, mirror the angle so positive angle = away from body on both sides
    g.rotateCanvas(Phaser.Math.DegToRad(isRight ? angle : -angle))

    // Shoulder cap (jersey, rounded)
    g.fillStyle(this.JERSEY)
    g.fillCircle(0, 0, w * 0.7)
    // Bicep (sleeve)
    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(-w/2, 0, w, bicepLen, 2)
    // Sleeve hem stripe
    g.fillStyle(0xFFFFFF, 0.7)
    g.fillRect(-w/2, bicepLen - 2, w, 1)
    // Forearm (skin)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-w/2 + 0.5, bicepLen, w - 1, forearmLen, 3)
    // Wristband
    g.fillStyle(this.BAND)
    g.fillRoundedRect(-w/2 + 0.5, bicepLen + forearmLen - 4, w - 1, 3, 1)
    // Hand
    g.fillStyle(this.SKIN_DK)
    g.fillCircle(0, bicepLen + forearmLen + 2, 4)
    g.restore()
  }

  private drawHead(g: Phaser.GameObjects.Graphics, offsetY: number) {
    const hy = -48 + offsetY
    // Neck
    g.fillStyle(this.SKIN_DK)
    g.fillRect(-4, hy + 10, 8, 6)
    // Head (skin oval)
    g.fillStyle(this.SKIN)
    g.fillCircle(0, hy, 12)
    // Hair — fills only the TOP HALF of the head (proper fade cut)
    g.fillStyle(0x1A0F08)
    g.beginPath()
    g.arc(0, hy, 12, Math.PI, 2 * Math.PI, false)   // upper half arc only
    g.closePath()
    g.fillPath()
    // Hair edge line (clean cut at headband level)
    g.fillStyle(this.SKIN)
    g.fillRect(-12, hy - 1, 24, 2)
    // Headband (yellow with red stripe)
    g.fillStyle(this.BAND)
    g.fillRoundedRect(-12, hy - 5, 24, 4, 1)
    g.fillStyle(0xE63946)
    g.fillRect(-12, hy - 4, 24, 1)
    // Cheek/shadow under headband
    g.fillStyle(this.SKIN_DK, 0.25)
    g.fillRect(-11, hy + 1, 22, 3)
    // Eyes — small focused dots with white below
    g.fillStyle(0x0A0A14)
    g.fillRect(-5, hy + 2, 2, 2)
    g.fillRect(3, hy + 2, 2, 2)
    // Mouth (focused line)
    g.fillStyle(0x4A1F0A)
    g.fillRect(-3, hy + 7, 6, 1)
    // Chin/jaw shadow
    g.fillStyle(this.SKIN_DK, 0.5)
    g.fillEllipse(0, hy + 9, 8, 3)
  }

  // ============================================================
  // DUNK POSE COMPOSITIONS — each visually distinct
  // ============================================================

  /** Helper to draw the basketball at a position with seams. */
  private drawBall(g: Phaser.GameObjects.Graphics, x: number, y: number, r = 12) {
    g.fillStyle(0xFF8A1F)
    g.fillCircle(x, y, r)
    g.fillStyle(0xFFB76A, 0.6)
    g.fillCircle(x - r * 0.3, y - r * 0.35, r * 0.4)
    g.lineStyle(1.8, 0x4A1F0A, 1)
    g.strokeCircle(x, y, r)
    g.lineBetween(x - r, y, x + r, y)
    g.lineBetween(x, y - r, x, y + r)
    g.lineStyle(1.4, 0x4A1F0A, 0.7)
    g.strokeEllipse(x, y, r * 1.5, r * 2)
  }

  /** TWO-HAND (basic_two): both arms reaching up together, gripping the ball. */
  private drawTwoHandDunk(g: Phaser.GameObjects.Graphics, armUp: number) {
    this.container.angle = 0
    this.drawShoes(g, -20, true)
    this.drawLegs(g, -20, true)
    this.drawShorts(g)
    this.drawTorso(g, -4)
    // Both arms reach STRAIGHT UP with shoulder caps + sleeves + skin forearm + wristband
    const armReach = 38 + armUp * 30   // length grows as arms extend
    const armY = -34 - armUp * 24
    const w = 7
    // Shoulder caps
    g.fillStyle(this.JERSEY)
    g.fillCircle(-15, -28, w * 0.8)
    g.fillCircle(15, -28, w * 0.8)
    // Bicep / sleeve (jersey)
    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(-15 - w/2, armY, w, 14, 2)
    g.fillRoundedRect(15 - w/2, armY, w, 14, 2)
    g.fillStyle(0xFFFFFF, 0.7)
    g.fillRect(-15 - w/2, armY + 12, w, 1)
    g.fillRect(15 - w/2, armY + 12, w, 1)
    // Forearm (skin)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-15 - w/2 + 0.5, armY + 14, w - 1, armReach - 14, 3)
    g.fillRoundedRect(15 - w/2 + 0.5, armY + 14, w - 1, armReach - 14, 3)
    // Wristband
    g.fillStyle(this.BAND)
    g.fillRoundedRect(-15 - w/2 + 0.5, armY + armReach - 5, w - 1, 3, 1)
    g.fillRoundedRect(15 - w/2 + 0.5, armY + armReach - 5, w - 1, 3, 1)
    // Hands (gripping ball)
    g.fillStyle(this.SKIN_DK)
    g.fillCircle(-15, armY + armReach + 1, 4.5)
    g.fillCircle(15, armY + armReach + 1, 4.5)
    this.drawHead(g, -8)
    // Ball between the two hands, slightly above
    if (armUp > 0.4 && !this._ballReleased) {
      this.drawBall(g, 0, armY + armReach - 10, 13)
    }
  }

  private drawOneHandDunk(g: Phaser.GameObjects.Graphics, armUp: number, reverse: boolean) {
    this.drawShoes(g, -18, true)
    this.drawLegs(g, -18, true)
    this.drawShorts(g)
    this.drawTorso(g, -4)
    const dir = reverse ? -1 : 1
    const w = 7
    // Dunking arm — raised STRAIGHT UP
    const armReach = 42 + armUp * 30
    const armY = -32 - armUp * 24
    g.fillStyle(this.JERSEY)
    g.fillCircle(dir * 14, -28, w * 0.8)              // shoulder cap
    g.fillRoundedRect(dir * 14 - w/2, armY, w, 14, 2) // bicep
    g.fillStyle(0xFFFFFF, 0.7)
    g.fillRect(dir * 14 - w/2, armY + 12, w, 1)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(dir * 14 - w/2 + 0.5, armY + 14, w - 1, armReach - 14, 3)
    g.fillStyle(this.BAND)
    g.fillRoundedRect(dir * 14 - w/2 + 0.5, armY + armReach - 5, w - 1, 3, 1)
    g.fillStyle(this.SKIN_DK)
    g.fillCircle(dir * 14, armY + armReach + 1, 4.5)

    // Off arm — bent at side for balance, drawn via drawArm so the angle reads correctly
    this.drawArm(g, -dir * 13, -28, 30, dir > 0)

    this.drawHead(g, -6)
    if (armUp > 0.5 && !this._ballReleased) {
      this.drawBall(g, dir * 16, armY + armReach - 10, 12)
    }
  }

  /**
   * REVERSE: player IMMEDIATELY shows their BACK to the camera, dunks over head.
   * Whole pose shows the back of the jersey — big "23" on the back.
   */
  private drawReversePose(g: Phaser.GameObjects.Graphics, armUp: number) {
    this.container.angle = 0
    // INSTANT flip — back to camera for the whole dunk
    const absScale = Math.abs(this.container.scaleY) || 1
    this.container.scaleX = -absScale  // negative X = mirrored = looks like back-turned

    this.drawShoes(g, -18, true)
    this.drawLegs(g, -18, true)
    this.drawShorts(g)

    // Torso — show jersey BACK after flip
    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(-17, -36, 34, 34, 5)
    // Big "23" number on back (white block)
    g.fillStyle(0xFFFFFF, 0.95)
    g.fillRect(-9, -26, 18, 14)
    g.fillStyle(this.JERSEY)
    // Hint the "23" number with negative space
    g.fillRect(-7, -24, 4, 10)
    g.fillRect(3, -24, 4, 10)

    // Both arms going up and BACK (over head)
    const armY = -38 - armUp * 55
    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(-22, armY, 8, 14, 2)
    g.fillRoundedRect(14, armY, 8, 14, 2)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-22, armY + 14, 8, 30 + armUp * 26, 3)
    g.fillRoundedRect(14, armY + 14, 8, 30 + armUp * 26, 3)
    g.fillStyle(this.BAND)
    g.fillRect(-22, armY + 38, 8, 3)
    g.fillRect(14, armY + 38, 8, 3)

    // Head — back of head (no face)
    const hy = -54
    g.fillStyle(this.SKIN)
    g.fillCircle(0, hy, 12)
    // Back of head = mostly hair
    g.fillStyle(0x1A0F08)
    g.fillCircle(0, hy - 2, 12)
    g.fillStyle(this.SKIN)
    g.fillRect(-12, hy + 4, 24, 6)  // neck shadow
    // Headband from behind
    g.fillStyle(this.BAND)
    g.fillRoundedRect(-12, hy - 7, 24, 4, 1)
    g.fillStyle(0xE63946)
    g.fillRect(-12, hy - 6, 24, 1)

    // Ball gripped over head from behind
    if (armUp > 0.5 && !this._ballReleased) {
      this.drawBall(g, 0, armY - 8, 13)
    }
  }

  /**
   * TOMAHAWK: ball cocked BACK over head at start, then SLAMS forward.
   * Visual: ball clearly visible PULLED back at progress 0-0.4 (behind head),
   * then SLAMS forward/down at progress 0.6+.
   */
  private drawTwoHandTomahawk(g: Phaser.GameObjects.Graphics, progress: number) {
    this.container.angle = 0
    this.drawShoes(g, -18, true)
    this.drawLegs(g, -18, true)
    this.drawShorts(g)
    this.drawTorso(g, -4)

    // Phase: 0-0.5 = cock back (ball behind head, going UP/BACK)
    //        0.5-1 = slam forward (ball comes OVER and DOWN)
    const isCocking = progress < 0.5
    const cockT = isCocking ? progress * 2 : 1
    const slamT = isCocking ? 0 : (progress - 0.5) * 2

    // Arm tilt — during cock-back, arms pull behind (negative Z, i.e., visually UP and slightly back)
    // during slam, arms thrust forward
    const armY = isCocking
      ? -34 - cockT * 60      // pulling up/back
      : -94 + slamT * 40       // slamming forward/down
    const armForward = isCocking ? 0 : slamT * 8

    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(-22 + armForward, armY, 8, 16, 2)
    g.fillRoundedRect(14 + armForward, armY, 8, 16, 2)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-22 + armForward, armY + 14, 8, 32, 3)
    g.fillRoundedRect(14 + armForward, armY + 14, 8, 32, 3)
    g.fillStyle(this.BAND)
    g.fillRect(-22 + armForward, armY + 42, 8, 3)
    g.fillRect(14 + armForward, armY + 42, 8, 3)
    g.fillStyle(this.SKIN_DK)
    g.fillCircle(-18 + armForward, armY + 50, 5)
    g.fillCircle(18 + armForward, armY + 50, 5)

    this.drawHead(g, -6)
    // Mean focused face during slam
    if (slamT > 0.3) {
      g.fillStyle(0x0A0A14)
      g.fillRect(-5, -47, 10, 1)  // grit teeth line
    }

    // Ball — clearly behind head during cock, then over front during slam
    if (!this._ballReleased) {
      const ballY = armY - 10
      const ballX = isCocking ? 0 : armForward * 1.2
      this.drawBall(g, ballX, ballY, 13)
    }

    // Whoosh trail line during slam
    if (slamT > 0.3 && slamT < 0.9) {
      g.lineStyle(3, 0xFFFFFF, 0.4)
      g.lineBetween(-22, -80, -22 + armForward, armY + 20)
      g.lineBetween(22, -80, 22 + armForward, armY + 20)
    }
  }

  /**
   * WINDMILL: arm with ball traces a FULL CIRCLE around the body, then slams.
   * Big arc trail makes the windmill motion unmistakable.
   */
  private drawWindmillPose(g: Phaser.GameObjects.Graphics, progress: number) {
    this.container.angle = 0
    this.drawShoes(g, -16, true)
    this.drawLegs(g, -16, true)
    this.drawShorts(g)
    this.drawTorso(g, -4)

    // Arm pivots at shoulder. Bigger radius makes the circle obvious.
    const startAngle = -Math.PI * 0.5
    const sweepAngle = Math.PI * 2.0
    const angle = startAngle + progress * sweepAngle
    const pivotX = 0, pivotY = -28
    const radius = 65
    const ballX = pivotX + Math.cos(angle) * radius
    const ballY = pivotY + Math.sin(angle) * radius

    // GHOST CIRCLE — full faint trail of the windmill path (always visible)
    g.lineStyle(2, 0xFFB76A, 0.18)
    g.strokeCircle(pivotX, pivotY, radius)

    // SOLID ARC — the portion the ball has already traveled (gets longer)
    g.lineStyle(10, 0xFF6B2C, 0.55)
    g.beginPath()
    g.arc(pivotX, pivotY, radius, startAngle, angle, false)
    g.strokePath()

    // Dunking arm — full anatomical chain rotating around shoulder
    const armEndR = radius - 8
    g.save()
    g.translateCanvas(pivotX, pivotY)
    g.rotateCanvas(angle - Math.PI / 2)  // align local +Y with the swing direction
    // Shoulder cap (visible at pivot)
    g.fillStyle(this.JERSEY)
    g.fillCircle(0, 0, 6)
    // Bicep
    g.fillRoundedRect(-4, 0, 8, 16, 2)
    g.fillStyle(0xFFFFFF, 0.7)
    g.fillRect(-4, 14, 8, 1)
    // Forearm (skin)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-3.5, 16, 7, armEndR - 16, 3)
    // Wristband
    g.fillStyle(this.BAND)
    g.fillRoundedRect(-3.5, armEndR - 5, 7, 3, 1)
    // Hand gripping ball
    g.fillStyle(this.SKIN_DK)
    g.fillCircle(0, armEndR + 1, 5)
    g.restore()

    // Off arm — tucked across chest for balance
    this.drawArm(g, -16, -28, 35, false)

    this.drawHead(g, -2)

    // Ball gripped in dunking hand
    if (!this._ballReleased) {
      this.drawBall(g, ballX, ballY, 12)
    }
  }

  /**
   * 360°: the WHOLE body rotates a full revolution during the dunk.
   * We rotate container.angle directly so the rotation is unmistakable.
   * Ball stays gripped over head while the body spins.
   */
  private drawSpinPose(g: Phaser.GameObjects.Graphics, progress: number) {
    // Use container.angle for true rotation (2 full turns)
    this.container.angle = progress * 720
    // Body stays the same — drawn at standard orientation, will appear rotated
    this.drawShoes(g, -16, true)
    this.drawLegs(g, -16, true)
    this.drawShorts(g)
    this.drawTorso(g, -4)
    // Both arms up holding ball (so it stays in frame during spin)
    const armUp = Math.min(1, progress * 1.5)
    const armY = -34 - armUp * 40
    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(-22, armY, 8, 14, 2)
    g.fillRoundedRect(14, armY, 8, 14, 2)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-22, armY + 14, 8, 28, 3)
    g.fillRoundedRect(14, armY + 14, 8, 28, 3)
    g.fillStyle(this.SKIN_DK)
    g.fillCircle(-18, armY + 44, 5)
    g.fillCircle(18, armY + 44, 5)
    this.drawHead(g, -4)
    // Excited mouth (open)
    g.fillStyle(0x0A0A14)
    g.fillEllipse(0, -42, 6, 4)
    if (armUp > 0.3 && !this._ballReleased) {
      this.drawBall(g, 0, armY - 6, 13)
    }
  }

  /**
   * BETWEEN LEGS: legs spread WIDE, ball clearly passes between them at midpoint,
   * then comes up over head for the dunk.
   */
  private drawBetweenLegsPose(g: Phaser.GameObjects.Graphics, progress: number) {
    this.container.angle = 0
    // DRAMATIC leg spread — much wider than before for unmistakable visual
    const spread = Math.sin(progress * Math.PI) * 38
    g.fillStyle(this.SHOE)
    g.fillRoundedRect(-22 - spread, 32, 16, 9, 3)
    g.fillRoundedRect(6 + spread, 32, 16, 9, 3)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-18 - spread, -2, 9, 32, 3)
    g.fillRoundedRect(9 + spread, -2, 9, 32, 3)
    this.drawShorts(g)
    this.drawTorso(g, -2)
    // Ball path: starts at right hand, goes DOWN between legs (0.3-0.5),
    // then comes UP to left hand which dunks
    const ballPhase = progress
    let ballX = 0, ballY = 0
    if (ballPhase < 0.3) {
      // Ball at right hand
      ballX = 22 - (22 - 0) * (ballPhase / 0.3)
      ballY = -10 + (25 - (-10)) * (ballPhase / 0.3)
    } else if (ballPhase < 0.6) {
      // Ball between legs
      ballX = 0
      ballY = 25
    } else {
      // Ball goes up and over to left hand for dunk
      const upT = (ballPhase - 0.6) / 0.4
      ballX = 0 - 20 * upT
      ballY = 25 - 70 * upT
    }
    if (!this._ballReleased) {
      this.drawBall(g, ballX, ballY, 14)
      // Motion trail showing ball's path between legs
      if (ballPhase > 0.3 && ballPhase < 0.7) {
        g.lineStyle(6, 0xFF8A1F, 0.3)
        g.lineBetween(22, -10, 0, 25)  // right hand to between legs
      }
    }
    // Arms — right arm reaches down to push ball through, then left arm goes up
    const rightArmDown = Math.min(1, progress * 2)
    const leftArmUp = Math.max(0, (progress - 0.5) * 2)
    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(14, -32, 8, 14, 2)
    g.fillRoundedRect(-22, -34 - leftArmUp * 40, 8, 14, 2)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(14, -18 + rightArmDown * 30, 8, 30, 3)  // right arm down
    g.fillRoundedRect(-22, -20 - leftArmUp * 50, 8, 30 + leftArmUp * 20, 3)  // left arm up
    this.drawHead(g, -2)
  }

  private drawAlleyoopPose(g: Phaser.GameObjects.Graphics, armUp: number) {
    this.drawShoes(g, -22, true)
    this.drawLegs(g, -22, true)
    this.drawShorts(g)
    this.drawTorso(g, -4)
    // Both arms reaching up like catching a pass
    const armY = -40 - armUp * 45
    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(-22, armY, 8, 14, 2)
    g.fillRoundedRect(14, armY, 8, 14, 2)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-22, armY + 14, 8, 32, 3)
    g.fillRoundedRect(14, armY + 14, 8, 32, 3)
    this.drawHead(g, -4)
    // Eyes wide (excited)
    g.fillStyle(0xFFFFFF)
    g.fillCircle(-5, -47, 2)
    g.fillCircle(5, -47, 2)
    g.fillStyle(0x000000)
    g.fillRect(-5, -46, 1, 1)
    g.fillRect(5, -46, 1, 1)
    if (armUp > 0.5 && !this._ballReleased) {
      this.drawBall(g, 0, armY - 8, 13)
    }
  }

  private drawCradlePose(g: Phaser.GameObjects.Graphics, armUp: number) {
    this.drawShoes(g, -18, true)
    this.drawLegs(g, -18, true)
    this.drawShorts(g)
    this.drawTorso(g, -4)
    // Cradle arm (bent elbow, ball cradled at chest)
    const armY = -36 - armUp * 50
    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(10, armY, 8, 20, 2)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(10, armY + 20, 8, 36, 3)
    g.fillRoundedRect(8, armY + 18, 28, 8, 3)  // forearm extension
    // Other arm
    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(-22, -32, 8, 14, 2)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-22, -18, 8, 32, 3)
    this.drawHead(g, -2)
    if (armUp > 0.4 && !this._ballReleased) {
      this.drawBall(g, 30, armY + 8, 12)
    }
  }

  /**
   * FREE-THROW LINE DUNK: player flies horizontally like superman from FT line to rim.
   * Body is more horizontal, both arms extended forward, ball gripped between hands.
   */
  private drawFreethrowLinePose(g: Phaser.GameObjects.Graphics, progress: number) {
    this.container.angle = 0
    // Tilt the body forward (like flying) — use container angle slightly
    this.container.angle = -15 + progress * 10  // tilts forward
    // Body in flight pose
    this.drawShoes(g, -24, true)
    // Legs extended back
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-13, 8, 8, 28, 3)
    g.fillRoundedRect(5, 8, 8, 28, 3)
    this.drawShorts(g)
    this.drawTorso(g, -4)
    // Both arms forward like flying
    const armY = -32
    g.fillStyle(this.JERSEY)
    g.fillRoundedRect(-22, armY, 8, 14, 2)
    g.fillRoundedRect(14, armY, 8, 14, 2)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-22, armY + 14, 8, 38, 3)
    g.fillRoundedRect(14, armY + 14, 8, 38, 3)
    g.fillStyle(this.SKIN_DK)
    g.fillCircle(-18, armY + 56, 5)
    g.fillCircle(18, armY + 56, 5)
    this.drawHead(g, -4)
    // SPEED LINES around the player (whoosh)
    g.lineStyle(2, 0xFFFFFF, 0.4)
    for (let i = 0; i < 5; i++) {
      const lineY = -50 + i * 18
      g.lineBetween(-50, lineY, -30 + progress * 10, lineY)
      g.lineBetween(30 - progress * 10, lineY, 50, lineY)
    }
    if (progress > 0.3 && !this._ballReleased) {
      this.drawBall(g, 0, armY + 50, 13)
    }
  }

  private getBallReleaseOffset(dunkId: DunkAnimId): [number, number] {
    switch (dunkId) {
      case 'between_legs': return [0, 18]
      case 'windmill':     return [0, -60]
      case 'basic_one':
      case 'tip_dunk':     return [22, -88]
      case 'alleyoop':     return [0, -82]
      case 'cradle':       return [30, -72]
      default:             return [0, -88]
    }
  }

  private getMotionProfile(dunkId: DunkAnimId): DunkMotionProfile {
    return this.motionProfiles[dunkId] || this.motionProfiles.basic_two
  }

  private drawSignatureGather(kind: DunkMotionProfile['gather'], progress: number) {
    if (kind === 'power') {
      this.drawGather(progress)
      this.container.angle = Phaser.Math.Linear(10, -4, progress)
      return
    }
    if (kind === 'spin') {
      this.drawGather(progress)
      this.container.angle = Phaser.Math.Linear(-18, 18, progress)
      return
    }
    if (kind === 'catch') {
      this.gfx.clear()
      this.drawShoes(this.gfx, -8 * progress, false)
      this.drawLegs(this.gfx, -8 * progress)
      this.drawShorts(this.gfx)
      this.drawTorso(this.gfx, -2)
      this.drawArms(this.gfx, -70, -70)
      this.drawHead(this.gfx, -4)
      return
    }
    if (kind === 'long') {
      this.drawRunning(progress)
      this.container.angle = Phaser.Math.Linear(12, 24, progress)
      return
    }
    if (kind === 'quick') {
      this.drawGather(Math.min(1, progress * 1.4))
      return
    }
    this.drawGather(progress)
  }

  // ============================================================
  // DUNK SEQUENCE — phase chain: run-up → jump → dunk → land
  // ============================================================
  playDunk(dunkId: DunkAnimId, hoopX: number, hoopY: number) {
    if (this.isAnimating) return
    this.isAnimating = true
    this._ballReleased = false

    this.scene.tweens.killTweensOf(this.container)
    this.scene.tweens.killTweensOf(this.shadow)
    // Reset any leftover rotation/flip from previous dunk
    this.container.angle = 0

    const startX = this.container.x
    const startY = this.container.y
    const startScale = this.container.scale || 1

    const motion = this.getMotionProfile(dunkId)
    // Where the player lands the dunk. Each dunk now has a distinct runway, scale,
    // drift, release timing, and hang-time so styles do not feel interchangeable.
    const runEndY = hoopY + motion.runEndYOffset
    const runEndScale = motion.runEndScale
    const peakY = hoopY + motion.peakYOffset
    const peakScale = motion.runEndScale
    const dunkX = hoopX + motion.driftX

    // Run duration scales with distance
    const distance = Math.hypot(dunkX - startX, runEndY - startY)
    const runDuration = Math.max(220, Math.min(1150, distance * 1.8 * motion.runMul))

    // Per-dunk pose-phase duration — slower for showy ones so user can SEE the motion
    const dunkPoseDuration: number =
      dunkId === 'windmill'       ? 1300 :
      dunkId === 'three_sixty'    ? 1400 :
      dunkId === 'between_legs'   ? 1100 :
      dunkId === 'eastbay'        ? 1300 :
      dunkId === 'tomahawk'       ? 1100 :
      dunkId === 'reverse'        ?  950 :
      dunkId === 'alleyoop'       ?  950 :
      dunkId === 'cradle'         ?  900 :
      dunkId === 'freethrow_line' ? 1100 :
      720  // basic_two, basic_one, etc.

    // ---- Phase 1: Run up the court (scale down for perspective) ----
    this.scene.tweens.add({
      targets: this.container,
      x: dunkX,
      y: runEndY,
      scale: runEndScale,
      duration: runDuration,
      ease: 'Quad.easeInOut',
      onUpdate: (tween) => {
        // Subtle running step bob
        const p = tween.progress
        const stepBob = Math.sin(p * Math.PI * 6) * 4
        this.container.y = (startY + (runEndY - startY) * p) - stepBob
        // Lean forward into the run + gather crouch right before takeoff
        if (p < 0.85) {
          this.drawRunning(p)
        } else {
          this.drawSignatureGather(motion.gather, (p - 0.85) / 0.15)  // style-specific load-up
        }
      },
      onComplete: () => {
        // ============================================================
        // Phase 2+3: ONE continuous parabolic LEAP with the dunk pose
        // playing through the apex. This removes the old "float frozen
        // in mid-air" feel — the body now genuinely rises, hangs, slams,
        // and falls along a real arc.
        // ============================================================
        const takeoffY = runEndY
        const apexY = peakY - 40           // true top of the jump (above rim)
        const jumpHeight = takeoffY - apexY
        const jt = { value: 0 }
        const totalAir = dunkPoseDuration + motion.airExtra

        this.scene.tweens.add({
          targets: jt,
          value: 1,
          duration: totalAir,
          ease: 'Linear',
          onUpdate: () => {
            const t = jt.value
            // Parabolic vertical: 0 at takeoff, -jumpHeight at apex (t=0.5), back to 0.
            // Slight hang-time bias: spend a touch longer near the apex.
            const arc = Math.sin(Math.PI * Math.pow(t, 0.92))
            this.container.y = takeoffY - jumpHeight * arc
            // Scale: grow slightly toward the rim for readable pose detail
            const s = peakScale + (runEndScale - peakScale) * (1 - arc) * 0.5
            this.container.setScale(s)

            // Pose mapping along the jump:
            //   rising  (0   .. 0.30): jump tuck
            //   dunk    (0.30.. 0.92): the signature dunk pose progresses
            //   recover (0.92.. 1.0 ): release/limbs settle (handled by pose end)
            if (t < 0.30) {
              this.drawJumping(t / 0.30)
            } else {
              const dp = Phaser.Math.Clamp((t - 0.30) / 0.62, 0, 1)
              this.drawDunking(dunkId as DunkAnimId, dp)
              if (!this._ballReleased && dp >= motion.releaseAt) {
                this._ballReleased = true
                const [hx, hy] = this.getBallReleaseOffset(dunkId as DunkAnimId)
                this.onBallRelease?.(
                  this.container.x + hx * this.container.scale,
                  this.container.y + hy * this.container.scale,
                  dunkId
                )
              }
            }
          },
          onComplete: () => {
            // ---- Phase 4: small recovery hop back to the spot, knees absorb ----
            this.scene.tweens.add({
              targets: this.container,
              y: startY,
              x: startX,
              scale: startScale,
              duration: 300,
              ease: 'Quad.easeIn',
              onUpdate: (tw) => {
                // land-and-absorb squash on touchdown
                if (tw.progress > 0.8) this.drawLanding((tw.progress - 0.8) / 0.2)
              },
              onComplete: () => {
                this.container.setScale(startScale)
                this.container.angle = 0  // reset rotation (spin / freethrow)
                this.container.scaleX = startScale  // reset flip (reverse)
                this.container.scaleY = startScale
                this.isAnimating = false
                this.drawIdle()
                this.onDunkComplete?.(dunkId)
              }
            })
          }
        })
      }
    })

    // Shadow follows player up the court
    this.scene.tweens.add({
      targets: this.shadow,
      x: dunkX,
      y: runEndY + 48 * runEndScale,
      scaleX: runEndScale,
      scaleY: runEndScale,
      duration: runDuration,
      ease: 'Quad.easeInOut',
    })
    // Shadow shrinks more during jump (player airborne)
    this.scene.time.delayedCall(runDuration, () => {
      this.scene.tweens.add({
        targets: this.shadow,
        scaleX: 0.25, scaleY: 0.25,
        alpha: 0.45,
        duration: 280,
        ease: 'Quad.easeOut',
      })
    })
    // Shadow back to start on land
    this.scene.time.delayedCall(runDuration + 280 + Math.min(760, motion.airExtra), () => {
      this.scene.tweens.add({
        targets: this.shadow,
        x: startX,
        y: startY + 48 * startScale,
        scaleX: startScale, scaleY: startScale,
        alpha: 0.35,
        duration: 460,
        ease: 'Quad.easeIn',
      })
    })

    // Hard timeout safety (long enough for slowest dunk)
    this.scene.time.delayedCall(runDuration + 280 + dunkPoseDuration + 600 + 500, () => {
      if (this.isAnimating) {
        this.scene.tweens.killTweensOf(this.container)
        this.scene.tweens.killTweensOf(this.shadow)
        this.container.setPosition(startX, startY)
        this.container.setScale(startScale)
        this.shadow.setPosition(startX, startY + 48 * startScale)
        this.shadow.setScale(startScale)
        this.shadow.setAlpha(0.35)
        this.isAnimating = false
        this.drawIdle()
        this.onDunkComplete?.(dunkId)
      }
    })
  }

  /**
   * Player tries to dunk from too far away — jumps short, ball thrown
   * but clangs off the rim. No score.
   */
  playMissedDunk(hoopX: number, hoopY: number, distance: number, maxDistance: number) {
    if (this.isAnimating) return
    this.isAnimating = true
    this._ballReleased = false

    this.scene.tweens.killTweensOf(this.container)
    this.scene.tweens.killTweensOf(this.shadow)

    const startX = this.container.x
    const startY = this.container.y
    const startScale = this.container.scale || 1

    // Player runs PART of the way (or stays if very far), then jumps and reaches.
    const overshoot = Math.min(1, distance / maxDistance) - 1
    // Move toward hoop only by (1 - overshoot), so further dunks = less movement
    const moveT = Math.max(0.2, 1 - overshoot * 0.6)
    const targetX = startX + (hoopX - startX) * moveT
    const targetY = startY + ((hoopY + 100) - startY) * moveT
    const peakScale = Phaser.Math.Linear(startScale, 0.6, moveT)

    // Run-up
    this.scene.tweens.add({
      targets: this.container,
      x: targetX,
      y: targetY,
      scale: peakScale,
      duration: 320,
      ease: 'Quad.easeInOut',
      onUpdate: (tween) => {
        const p = tween.progress
        this.container.y = (startY + (targetY - startY) * p) - Math.sin(p * Math.PI * 5) * 3
      },
      onComplete: () => {
        // Jump up but not as high as a real dunk
        this.scene.tweens.add({
          targets: this.container,
          y: targetY - 90 * peakScale,
          duration: 280,
          ease: 'Quad.easeOut',
          onUpdate: (tween) => this.drawJumping(tween.progress * 0.6),
          onComplete: () => {
            // Release ball at peak — toward the rim, but it'll fall short
            const [hx, hy] = [0, -88]
            this.onBallRelease?.(
              this.container.x + hx * peakScale,
              this.container.y + hy * peakScale,
              'miss'
            )
            this._ballReleased = true
            // Hover/flail briefly
            this.drawDunking('basic_two', 0.5)
            // Land — back at start
            this.scene.tweens.add({
              targets: this.container,
              y: startY,
              x: startX,
              scale: startScale,
              duration: 460,
              delay: 80,
              ease: 'Quad.easeIn',
              onComplete: () => {
                this.container.setScale(startScale)
                this.isAnimating = false
                this.drawIdle()
                this.onDunkComplete?.('miss')
              }
            })
          }
        })
      }
    })

    // Shadow tween — partial
    this.scene.tweens.add({
      targets: this.shadow,
      x: targetX,
      y: targetY + 48 * peakScale,
      scaleX: peakScale,
      scaleY: peakScale,
      duration: 320,
      ease: 'Quad.easeInOut',
    })

    // Safety
    this.scene.time.delayedCall(3000, () => {
      if (this.isAnimating) {
        this.scene.tweens.killTweensOf(this.container)
        this.scene.tweens.killTweensOf(this.shadow)
        this.container.setPosition(startX, startY)
        this.container.setScale(startScale)
        this.shadow.setPosition(startX, startY + 48 * startScale)
        this.shadow.setScale(startScale)
        this.isAnimating = false
        this.drawIdle()
        this.onDunkComplete?.('miss')
      }
    })
  }

  // ============================================================
  // JUMP SHOT — stationary vertical jump + release at peak
  // ============================================================
  playJumpShot(onRelease: (x: number, y: number) => void) {
    if (this.isAnimating) return
    this.isAnimating = true
    this._ballReleased = false

    this.scene.tweens.killTweensOf(this.container)
    this.scene.tweens.killTweensOf(this.shadow)

    const startX = this.container.x
    const startY = this.container.y
    const startScale = this.container.scale || 1

    // Phase 1: Quick gather (crouch) — 180ms
    const gt = { value: 0 }
    this.scene.tweens.add({
      targets: gt,
      value: 1,
      duration: 180,
      ease: 'Quad.easeIn',
      onUpdate: () => this.drawJumpShotGather(gt.value),
      onComplete: () => {
        // Phase 2: Jump up + shooting motion — 420ms parabolic
        const jumpH = 55 * startScale
        const jt = { value: 0 }
        this.scene.tweens.add({
          targets: jt,
          value: 1,
          duration: 420,
          ease: 'Linear',
          onUpdate: () => {
            const arc = Math.sin(Math.PI * jt.value)
            this.container.y = startY - jumpH * arc
            this.drawJumpShotPose(jt.value)
            // Release at peak
            if (!this._ballReleased && jt.value >= 0.45) {
              this._ballReleased = true
              const hand = this.getActiveHandPosition()
              onRelease(hand.x, hand.y)
            }
          },
          onComplete: () => {
            // Phase 3: Land — 200ms
            this.scene.tweens.add({
              targets: this.container,
              y: startY,
              duration: 200,
              ease: 'Quad.easeIn',
              onUpdate: (tw) => this.drawLanding(tw.progress),
              onComplete: () => {
                this.container.setScale(startScale)
                this.container.angle = 0
                this.isAnimating = false
                this.drawIdle()
                this.onShotComplete?.()
              },
            })
          },
        })
      },
    })

    // Shadow shrinks during jump
    this.scene.time.delayedCall(180, () => {
      this.scene.tweens.add({
        targets: this.shadow,
        scaleX: startScale * 0.4,
        scaleY: startScale * 0.4,
        alpha: 0.45,
        duration: 210,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.shadow.setScale(startScale)
          this.shadow.setAlpha(0.35)
        },
      })
    })

    // Safety timeout
    this.scene.time.delayedCall(1500, () => {
      if (this.isAnimating) {
        this.scene.tweens.killTweensOf(this.container)
        this.scene.tweens.killTweensOf(this.shadow)
        this.container.setPosition(startX, startY)
        this.container.setScale(startScale)
        this.isAnimating = false
        this.drawIdle()
        this.onShotComplete?.()
      }
    })
  }

  private drawJumpShotGather(t: number) {
    this.gfx.clear()
    const g = this.gfx
    this.container.angle = 0
    const crouch = t * 6
    g.fillStyle(this.SHOE)
    g.fillRoundedRect(-16, 44 - crouch, 14, 9, { tl: 3, tr: 3, bl: 5, br: 1 })
    g.fillRoundedRect(3, 44 - crouch, 14, 9, { tl: 3, tr: 3, bl: 1, br: 5 })
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-13, 16, 8, 26 - crouch, 3)
    g.fillRoundedRect(5, 16, 8, 26 - crouch, 3)
    this.drawShorts(g)
    this.drawTorso(g, crouch * 0.3)
    this.drawArms(g, 40, 40)
    this.drawHead(g, crouch * 0.2)
    if (!this._ballReleased) {
      this.drawBall(g, 4, -18, 10)
      this._activeHandLocal = { x: 4, y: -18 }
    }
  }

  private drawJumpShotPose(progress: number) {
    this.gfx.clear()
    const g = this.gfx
    this.container.angle = 0
    const tuck = Math.min(progress * 2, 1) * 0.6
    this.drawShoes(g, -tuck * 14, true)
    this.drawLegs(g, -tuck * 14, true)
    this.drawShorts(g)
    this.drawTorso(g, -tuck * 3)

    // Shooting arm: right arm extends up (classic jump shot form)
    const armExtend = Math.min(1, progress * 2.5)
    const armY = -34 - armExtend * 36
    const w = 7
    // Right arm (shooting arm) — straight up
    g.fillStyle(this.JERSEY)
    g.fillCircle(15, -28, w * 0.7)
    g.fillRoundedRect(15 - w / 2, armY, w, 14, 2)
    g.fillStyle(0xFFFFFF, 0.7)
    g.fillRect(15 - w / 2, armY + 12, w, 1)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(15 - w / 2 + 0.5, armY + 14, w - 1, 24 + armExtend * 12, 3)
    g.fillStyle(this.BAND)
    g.fillRoundedRect(15 - w / 2 + 0.5, armY + 32 + armExtend * 10, w - 1, 3, 1)
    g.fillStyle(this.SKIN_DK)
    g.fillCircle(15, armY + 38 + armExtend * 12, 4)

    // Left arm (guide hand) — slightly up and away
    this.drawArm(g, -15, -28, -30 - armExtend * 20, false)

    this.drawHead(g, -tuck * 2)
    this.jerseyNum.setVisible(true)
    this.jerseyNum.setY(-12)

    if (!this._ballReleased) {
      const ballY = armY + 20 + armExtend * 8
      this.drawBall(g, 15, ballY, 10)
      this._activeHandLocal = { x: 15, y: ballY }
    }
  }

  // ============================================================
  // LAYUP — short approach + one-foot jump + soft release near rim
  // ============================================================
  playLayup(hoopX: number, hoopY: number, onRelease: (x: number, y: number) => void) {
    if (this.isAnimating) return
    this.isAnimating = true
    this._ballReleased = false

    this.scene.tweens.killTweensOf(this.container)
    this.scene.tweens.killTweensOf(this.shadow)

    const startX = this.container.x
    const startY = this.container.y
    const startScale = this.container.scale || 1

    // Short run toward hoop
    const runTargetX = startX + (hoopX - startX) * 0.35
    const runTargetY = startY + ((hoopY + 100) - startY) * 0.3
    const runScale = Phaser.Math.Linear(startScale, 0.75, 0.3)

    this.scene.tweens.add({
      targets: this.container,
      x: runTargetX,
      y: runTargetY,
      scale: runScale,
      duration: 280,
      ease: 'Quad.easeInOut',
      onUpdate: (tween) => {
        this.drawRunning(tween.progress)
      },
      onComplete: () => {
        // Jump phase — one-foot takeoff with knee drive
        const jumpH = 80 * runScale
        const jt = { value: 0 }
        this.scene.tweens.add({
          targets: jt,
          value: 1,
          duration: 500,
          ease: 'Linear',
          onUpdate: () => {
            const arc = Math.sin(Math.PI * Math.pow(jt.value, 0.85))
            this.container.y = runTargetY - jumpH * arc
            this.drawLayupPose(jt.value)
            if (!this._ballReleased && jt.value >= 0.55) {
              this._ballReleased = true
              const hand = this.getActiveHandPosition()
              onRelease(hand.x, hand.y)
            }
          },
          onComplete: () => {
            // Return to start
            this.scene.tweens.add({
              targets: this.container,
              y: startY,
              x: startX,
              scale: startScale,
              duration: 300,
              ease: 'Quad.easeIn',
              onUpdate: (tw) => {
                if (tw.progress > 0.7) this.drawLanding((tw.progress - 0.7) / 0.3)
              },
              onComplete: () => {
                this.container.setScale(startScale)
                this.container.angle = 0
                this.isAnimating = false
                this.drawIdle()
                this.onShotComplete?.()
              },
            })
          },
        })
      },
    })

    // Shadow follows approach
    this.scene.tweens.add({
      targets: this.shadow,
      x: runTargetX,
      y: runTargetY + 48 * runScale,
      scaleX: runScale,
      scaleY: runScale,
      duration: 280,
      ease: 'Quad.easeInOut',
    })
    this.scene.time.delayedCall(280, () => {
      this.scene.tweens.add({
        targets: this.shadow,
        scaleX: 0.3, scaleY: 0.3, alpha: 0.4,
        duration: 200,
        ease: 'Quad.easeOut',
      })
    })
    this.scene.time.delayedCall(280 + 500, () => {
      this.scene.tweens.add({
        targets: this.shadow,
        x: startX, y: startY + 48 * startScale,
        scaleX: startScale, scaleY: startScale, alpha: 0.35,
        duration: 350,
        ease: 'Quad.easeIn',
      })
    })

    // Safety timeout
    this.scene.time.delayedCall(2500, () => {
      if (this.isAnimating) {
        this.scene.tweens.killTweensOf(this.container)
        this.scene.tweens.killTweensOf(this.shadow)
        this.container.setPosition(startX, startY)
        this.container.setScale(startScale)
        this.shadow.setPosition(startX, startY + 48 * startScale)
        this.shadow.setScale(startScale)
        this.isAnimating = false
        this.drawIdle()
        this.onShotComplete?.()
      }
    })
  }

  private drawLayupPose(progress: number) {
    this.gfx.clear()
    const g = this.gfx
    this.container.angle = Phaser.Math.Linear(5, -5, progress)

    // Legs: one leg drives up (knee lift), other trails
    const kneeUp = Math.sin(progress * Math.PI) * 20
    g.fillStyle(this.SHOE)
    g.fillRoundedRect(-16, 38 - kneeUp, 14, 9, { tl: 3, tr: 3, bl: 5, br: 1 })
    g.fillRoundedRect(3, 38, 14, 9, { tl: 3, tr: 3, bl: 1, br: 5 })
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(-13, 10, 8, 28 - kneeUp, 3)
    g.fillRoundedRect(5, 10, 8, 28, 3)
    this.drawShorts(g)
    this.drawTorso(g, -3)

    // Right arm extends up with ball (layup reach)
    const armExtend = Math.min(1, progress * 2)
    const armY = -34 - armExtend * 44
    const w = 7
    g.fillStyle(this.JERSEY)
    g.fillCircle(15, -28, w * 0.7)
    g.fillRoundedRect(15 - w / 2, armY, w, 14, 2)
    g.fillStyle(0xFFFFFF, 0.7)
    g.fillRect(15 - w / 2, armY + 12, w, 1)
    g.fillStyle(this.SKIN)
    g.fillRoundedRect(15 - w / 2 + 0.5, armY + 14, w - 1, 28 + armExtend * 16, 3)
    g.fillStyle(this.BAND)
    g.fillRoundedRect(15 - w / 2 + 0.5, armY + 36 + armExtend * 14, w - 1, 3, 1)
    g.fillStyle(this.SKIN_DK)
    g.fillCircle(15, armY + 42 + armExtend * 16, 4.5)

    // Left arm — balance
    this.drawArm(g, -15, -28, 20 + kneeUp, false)

    this.drawHead(g, -4)
    this.jerseyNum.setVisible(true)
    this.jerseyNum.setY(-15)

    if (!this._ballReleased) {
      const ballY = armY + 18 + armExtend * 12
      this.drawBall(g, 17, ballY, 10)
      this._activeHandLocal = { x: 17, y: ballY }
    }
  }
}
