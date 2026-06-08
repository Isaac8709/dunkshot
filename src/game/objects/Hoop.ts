import Phaser from 'phaser'

/**
 * Front-facing hoop (NBA 2K mobile style camera view).
 * Backboard is square-on, rim is a slight perspective ellipse,
 * net hangs straight down narrowing toward the bottom.
 *
 * Container origin = top-center of backboard.
 */
export class Hoop {
  scene: Phaser.Scene
  x: number
  y: number
  container: Phaser.GameObjects.Container
  rimY: number
  rimX: number
  rimRadius = 36
  rimGfx!: Phaser.GameObjects.Graphics
  board!: Phaser.GameObjects.Rectangle
  netGfx!: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.rimY = y
    this.rimX = x
    this.container = scene.add.container(x, y)
    this.draw()
  }

  draw() {
    // Backboard support (vertical pole going UP off-screen)
    const support = this.scene.add.rectangle(0, -55, 6, 90, 0x4A5670)
    this.container.add(support)

    // Backboard shadow
    const boardShadow = this.scene.add.rectangle(2, 6, 130, 76, 0x000000, 0.35)
    this.container.add(boardShadow)

    // Backboard — front-facing rectangle, glassy translucent
    this.board = this.scene.add.rectangle(0, 0, 128, 74, 0xE8F1FB, 0.92)
    this.board.setStrokeStyle(3, 0xffffff, 1)
    this.container.add(this.board)

    // Backboard inner red square (shooter's target)
    const innerOuter = this.scene.add.rectangle(0, 8, 52, 36, 0, 0)
    innerOuter.setStrokeStyle(3, 0xff3333)
    this.container.add(innerOuter)

    // NBA logo placeholder — small red dot at top
    const logoDot = this.scene.add.circle(0, -24, 3, 0xE63946)
    this.container.add(logoDot)

    // Rim — front-facing slightly squashed ellipse (perspective)
    this.rimGfx = this.scene.add.graphics()
    this.rimGfx.fillStyle(0xFF4D1F, 1)
    this.rimGfx.fillEllipse(0, 50, this.rimRadius * 2, 12)
    this.rimGfx.lineStyle(4, 0xFF8A1F, 1)
    this.rimGfx.strokeEllipse(0, 50, this.rimRadius * 2, 12)
    // Inner ellipse (the hole)
    this.rimGfx.fillStyle(0x070912, 1)
    this.rimGfx.fillEllipse(0, 50, this.rimRadius * 2 - 8, 7)
    this.container.add(this.rimGfx)

    // Net — hangs straight down, narrows toward bottom
    this.netGfx = this.scene.add.graphics()
    const netGfx = this.netGfx
    netGfx.lineStyle(1.5, 0xffffff, 0.7)
    const netTopY = 53
    const netBottomY = 95
    const netTopL = -this.rimRadius + 2
    const netTopR = this.rimRadius - 2
    const netBotL = -this.rimRadius * 0.55
    const netBotR = this.rimRadius * 0.55

    // Vertical strands
    const strands = 9
    for (let i = 0; i <= strands; i++) {
      const t = i / strands
      const xTop = netTopL + (netTopR - netTopL) * t
      const xBot = netBotL + (netBotR - netBotL) * t
      netGfx.lineBetween(xTop, netTopY, xBot, netBottomY)
    }
    // Horizontal rings
    for (let j = 1; j <= 4; j++) {
      const t = j / 4
      const y = netTopY + (netBottomY - netTopY) * t
      const lerpL = netTopL + (netBotL - netTopL) * t
      const lerpR = netTopR + (netBotR - netTopR) * t
      netGfx.lineBetween(lerpL, y, lerpR, y)
    }
    this.container.add(netGfx)
  }

  flash() {
    // Rim shake + glow flash on successful dunk
    this.scene.tweens.add({
      targets: this.container,
      scaleY: 1.12,
      duration: 70,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    })
    this.scene.tweens.add({
      targets: this.container,
      angle: { from: -2, to: 2 },
      duration: 70,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    })
    // Glow pulse (alpha flash)
    this.scene.tweens.add({
      targets: this.rimGfx,
      alpha: { from: 1, to: 0.4 },
      duration: 90,
      yoyo: true,
      repeat: 1,
    })
    // Net swing — bulges down, recoils, settles (the satisfying "swish" effect)
    this.scene.tweens.add({
      targets: this.netGfx,
      scaleY: 1.35,
      y: 8,
      duration: 110,
      yoyo: true,
      ease: 'Sine.easeInOut',
    })
    this.scene.tweens.add({
      targets: this.netGfx,
      angle: { from: -4, to: 4 },
      duration: 90,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => { this.netGfx.angle = 0 }
    })
  }

  /**
   * Sway the net after a ball passes through or hits the rim.
   * intensity: 0..1 where 0.3 = gentle swish, 1.0 = violent dunk slam.
   */
  swayNet(intensity: number) {
    const clampI = Phaser.Math.Clamp(intensity, 0, 1)
    // Net bulge — stretches down then recoils
    this.scene.tweens.add({
      targets: this.netGfx,
      scaleY: 1 + clampI * 0.45,
      y: clampI * 10,
      duration: 80 + (1 - clampI) * 60,
      yoyo: true,
      ease: 'Sine.easeInOut',
    })
    // Side-to-side swing that decays
    const swingAngle = 2 + clampI * 5
    const repeats = 1 + Math.round(clampI * 3)
    this.scene.tweens.add({
      targets: this.netGfx,
      angle: { from: -swingAngle, to: swingAngle },
      duration: 70 + (1 - clampI) * 40,
      yoyo: true,
      repeat: repeats,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.netGfx.angle = 0
      },
    })
  }

  /** Returns the rim center in world coordinates (where the ball should pass). */
  getRimWorldPos() {
    return {
      x: this.x,
      y: this.y + 50,
    }
  }
}
