import Phaser from 'phaser'

// ── palette ───────────────────────────────────────────────────────────────────
const OUTLINE  = 0x0f0f1e
const SKIN     = 0xF4BE7C
const SKIN_D   = 0xD99550
const HAIR     = 0x1a0800
const JERSEY   = 0xFF6B00
const JERSEY_D = 0xCC4400
const SHORTS   = 0x1a1a3e
const SHORTS_D = 0x0f0f28
const SOCK     = 0xeeeeee
const SHOE_B   = 0x111122
const SHOE_A   = 0xFF3300
const BALL_C   = 0xFF8C00
const BALL_D   = 0xCC5500
const WHITE    = 0xffffff
const BG_TOP   = 0x0d0d1f
const BG_BOT   = 0x1a1a30
const FLOOR_C  = 0x5C3A1E

type G = Phaser.GameObjects.Graphics
type P = { x: number; y: number }
const pt = (x: number, y: number): P => ({ x, y })
const lerp = (a: P, b: P, t: number): P => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)

// ── illustration primitives ───────────────────────────────────────────────────

function limb(g: G, A: P, B: P, wA: number, wB: number, col: number) {
  const dx = B.x - A.x, dy = B.y - A.y
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d < 1) return
  const nx = -dy / d * 0.5, ny = dx / d * 0.5
  const pts = [
    pt(A.x + nx * wA, A.y + ny * wA),
    pt(A.x - nx * wA, A.y - ny * wA),
    pt(B.x - nx * wB, B.y - ny * wB),
    pt(B.x + nx * wB, B.y + ny * wB),
  ]
  g.fillStyle(col, 1)
  g.fillPoints(pts, true)
  g.lineStyle(1.5, OUTLINE, 1)
  g.strokePoints(pts, true)
  g.lineStyle(0, 0, 0)
}

function jnt(g: G, x: number, y: number, r: number, col: number) {
  g.fillStyle(col, 1)
  g.fillCircle(x, y, r)
  g.lineStyle(1.5, OUTLINE, 1)
  g.strokeCircle(x, y, r)
  g.lineStyle(0, 0, 0)
}

function shoe(g: G, ankle: P, facing: 1 | -1) {
  const fx = ankle.x + facing * 13
  const sole = [
    pt(ankle.x - facing * 3, ankle.y + 4),
    pt(ankle.x - facing * 3, ankle.y - 3),
    pt(fx, ankle.y - 3),
    pt(fx + facing * 4, ankle.y + 4),
  ]
  g.fillStyle(SHOE_B, 1)
  g.fillPoints(sole, true)
  g.lineStyle(1.5, OUTLINE, 1)
  g.strokePoints(sole, true)
  g.lineStyle(0, 0, 0)
  g.fillStyle(SHOE_A, 1)
  g.fillRect(ankle.x - facing * 2, ankle.y - 1, facing * 9, 3)
}

function drawHead(g: G, cx: number, cy: number) {
  const r = 18
  jnt(g, cx, cy + r - 4, 5, SKIN)
  g.fillStyle(SKIN, 1)
  g.fillCircle(cx, cy, r)
  g.lineStyle(1.5, OUTLINE, 1)
  g.strokeCircle(cx, cy, r)
  g.lineStyle(0, 0, 0)
  // hair
  g.fillStyle(HAIR, 1)
  g.fillEllipse(cx, cy - r * 0.3, r * 1.95, r * 1.1)
  g.lineStyle(1, OUTLINE, 0.8)
  g.strokeEllipse(cx, cy - r * 0.3, r * 1.95, r * 1.1)
  g.lineStyle(0, 0, 0)
  // ear
  jnt(g, cx + r * 0.9, cy + 2, 4.5, SKIN_D)
  // eyebrows
  g.lineStyle(2.5, HAIR, 1)
  g.lineBetween(cx - 9, cy - 6, cx - 3, cy - 8)
  g.lineBetween(cx + 3, cy - 8, cx + 9, cy - 6)
  g.lineStyle(0, 0, 0)
  // eyes
  g.fillStyle(WHITE, 1)
  g.fillEllipse(cx - 6, cy - 3, 8, 6)
  g.fillEllipse(cx + 6, cy - 3, 8, 6)
  g.fillStyle(0x222222, 1)
  g.fillCircle(cx - 5, cy - 3, 2.5)
  g.fillCircle(cx + 7, cy - 3, 2.5)
  g.fillStyle(WHITE, 1)
  g.fillCircle(cx - 4, cy - 4, 1)
  g.fillCircle(cx + 8, cy - 4, 1)
  // mouth
  g.lineStyle(1.5, OUTLINE, 0.75)
  g.lineBetween(cx - 4, cy + 7, cx, cy + 9)
  g.lineBetween(cx, cy + 9, cx + 4, cy + 7)
  g.lineStyle(0, 0, 0)
  // headband
  g.fillStyle(WHITE, 1)
  g.fillRect(cx - r, cy - r + 2, r * 2, 5)
  g.fillStyle(JERSEY, 1)
  g.fillRect(cx - r, cy - r + 2, r * 2, 2)
  g.lineStyle(1, OUTLINE, 0.4)
  g.strokeRect(cx - r, cy - r + 2, r * 2, 5)
  g.lineStyle(0, 0, 0)
}

function drawTorso(g: G, cx: number, ty: number, hy: number) {
  const pts = [
    pt(cx - 17, ty), pt(cx + 17, ty),
    pt(cx + 13, hy), pt(cx - 13, hy),
  ]
  g.fillStyle(JERSEY, 1)
  g.fillPoints(pts, true)
  g.lineStyle(1.5, OUTLINE, 1)
  g.strokePoints(pts, true)
  g.lineStyle(0, 0, 0)
  g.fillStyle(WHITE, 0.5)
  g.fillRect(cx - 6, ty + 7, 12, 9)
}

function drawShorts(g: G, cx: number, hy: number, kLy: number, kRy: number) {
  const bot = hy + (((kLy + kRy) / 2) - hy) * 0.58
  const pts = [
    pt(cx - 16, hy), pt(cx + 16, hy),
    pt(cx + 14, bot), pt(cx - 14, bot),
  ]
  g.fillStyle(SHORTS, 1)
  g.fillPoints(pts, true)
  g.lineStyle(1.5, OUTLINE, 1)
  g.strokePoints(pts, true)
  g.lineStyle(0, 0, 0)
  g.lineStyle(1.5, JERSEY_D, 0.65)
  g.lineBetween(cx + 12, hy + 2, cx + 12, bot - 2)
  g.lineBetween(cx - 12, hy + 2, cx - 12, bot - 2)
  g.lineStyle(0, 0, 0)
}

function drawBall(g: G, bx: number, by: number, r = 13) {
  g.fillStyle(0x000000, 0.14)
  g.fillEllipse(bx + 2, by + 2, r * 2, r * 1.5)
  g.fillStyle(BALL_C, 1)
  g.fillCircle(bx, by, r)
  g.lineStyle(2, BALL_D, 1)
  g.strokeCircle(bx, by, r)
  g.lineStyle(1.5, BALL_D, 1)
  g.lineBetween(bx - r, by, bx + r, by)
  g.lineBetween(bx, by - r, bx, by + r)
  g.lineStyle(0, 0, 0)
}

// ── pose ──────────────────────────────────────────────────────────────────────

interface Pose {
  head: P
  sL: P; sR: P
  eL: P; eR: P
  wL: P; wR: P
  hL: P; hR: P
  kL: P; kR: P
  aL: P; aR: P
  ball?: P; ballR?: number
  facing?: 1 | -1
}

function character(g: G, pose: Pose) {
  const facing = pose.facing ?? 1

  // shadow
  const shadowY = Math.max(pose.aL.y, pose.aR.y) + 4
  g.fillStyle(0x000000, 0.16)
  g.fillEllipse(
    (pose.aL.x + pose.aR.x) / 2, shadowY,
    Math.abs(pose.aL.x - pose.aR.x) + 30, 10,
  )

  // back arm
  const [bS, bE, bW] = facing > 0
    ? [pose.sL, pose.eL, pose.wL] : [pose.sR, pose.eR, pose.wR]
  limb(g, bS, bE, 9, 7, SKIN_D)
  limb(g, bE, bW, 7, 6, SKIN_D)
  jnt(g, bE.x, bE.y, 4.5, SKIN_D)
  jnt(g, bW.x, bW.y, 5.5, SKIN_D)

  // back leg
  const [bH, bK, bA] = facing > 0
    ? [pose.hL, pose.kL, pose.aL] : [pose.hR, pose.kR, pose.aR]
  limb(g, bH, bK, 13, 11, SHORTS_D)
  const bSockTop = lerp(bK, bA, 0.55)
  limb(g, bK, bSockTop, 11, 9, SHORTS_D)
  limb(g, bSockTop, bA, 9, 7, 0xdddddd)
  jnt(g, bK.x, bK.y, 6.5, SHORTS_D)
  shoe(g, bA, facing as 1 | -1)

  // torso + shorts (depth middle)
  const hipCX = (pose.hL.x + pose.hR.x) / 2
  const sCX   = (pose.sL.x + pose.sR.x) / 2
  const sY    = (pose.sL.y + pose.sR.y) / 2
  const hY    = (pose.hL.y + pose.hR.y) / 2
  drawShorts(g, hipCX, hY, pose.kL.y, pose.kR.y)
  drawTorso(g, sCX, sY, hY)

  // front leg
  const [fH, fK, fA] = facing > 0
    ? [pose.hR, pose.kR, pose.aR] : [pose.hL, pose.kL, pose.aL]
  limb(g, fH, fK, 13, 11, SHORTS)
  const fSockTop = lerp(fK, fA, 0.55)
  limb(g, fK, fSockTop, 11, 9, SHORTS)
  limb(g, fSockTop, fA, 9, 7, SOCK)
  jnt(g, fK.x, fK.y, 6.5, SHORTS)
  shoe(g, fA, facing as 1 | -1)

  // front arm
  const [fS, fE, fW] = facing > 0
    ? [pose.sR, pose.eR, pose.wR] : [pose.sL, pose.eL, pose.wL]
  limb(g, fS, fE, 9, 7, SKIN)
  limb(g, fE, fW, 7, 6, SKIN)
  jnt(g, fE.x, fE.y, 4.5, SKIN)
  jnt(g, fW.x, fW.y, 5.5, SKIN)

  drawHead(g, pose.head.x, pose.head.y)

  if (pose.ball) drawBall(g, pose.ball.x, pose.ball.y, pose.ballR ?? 13)
}

// ── pose factories ────────────────────────────────────────────────────────────

function standPose(cx: number, fy: number, bob = 0): Pose {
  const hy = fy - 56 + bob, sy = hy - 46
  return {
    head: pt(cx, sy - 26),
    sL: pt(cx - 15, sy), sR: pt(cx + 15, sy),
    eL: pt(cx - 19, sy + 22), eR: pt(cx + 19, sy + 22),
    wL: pt(cx - 17, sy + 44), wR: pt(cx + 17, sy + 44),
    hL: pt(cx - 10, hy), hR: pt(cx + 10, hy),
    kL: pt(cx - 10, hy + 28), kR: pt(cx + 10, hy + 28),
    aL: pt(cx - 10, fy - 2), aR: pt(cx + 10, fy - 2),
  }
}

function squatPose(cx: number, fy: number, depth: number): Pose {
  const drop = depth * 25, sp = depth * 12
  const hy = fy - 56 + drop, sy = hy - 42 + drop * 0.2
  const kx = 11 + sp * 0.5
  return {
    head: pt(cx, sy - 24),
    sL: pt(cx - 15, sy), sR: pt(cx + 15, sy),
    eL: pt(cx - 22 - sp * 0.4, sy + 14), eR: pt(cx + 22 + sp * 0.4, sy + 14),
    wL: pt(cx - 24 - sp * 0.8, sy + 10), wR: pt(cx + 24 + sp * 0.8, sy + 10),
    hL: pt(cx - 11, hy), hR: pt(cx + 11, hy),
    kL: pt(cx - kx, hy + 24 - drop * 0.5), kR: pt(cx + kx, hy + 24 - drop * 0.5),
    aL: pt(cx - kx + sp * 0.3, fy - 2), aR: pt(cx + kx - sp * 0.3, fy - 2),
  }
}

function calfRaisePose(cx: number, fy: number, lift: number): Pose {
  const yOff = -lift * 13
  const hy = fy - 56 + yOff, sy = hy - 46
  return {
    head: pt(cx, sy - 26),
    sL: pt(cx - 14, sy), sR: pt(cx + 14, sy),
    eL: pt(cx - 18, sy + 22), eR: pt(cx + 18, sy + 22),
    wL: pt(cx - 16, sy + 42), wR: pt(cx + 16, sy + 42),
    hL: pt(cx - 9, hy), hR: pt(cx + 9, hy),
    kL: pt(cx - 9, hy + 28), kR: pt(cx + 9, hy + 28),
    aL: pt(cx - 7, fy - 2 + yOff * 0.4), aR: pt(cx + 7, fy - 2 + yOff * 0.4),
  }
}

function jumpPose(cx: number, fy: number, tuck: number, armUp: number): Pose {
  const hy = fy - 60 - tuck * 6, sy = hy - 44
  const kLift = tuck * 20
  return {
    head: pt(cx, sy - 26),
    sL: pt(cx - 15, sy), sR: pt(cx + 15, sy),
    eL: pt(cx - 25 + armUp * 10, sy + 14 - armUp * 18),
    eR: pt(cx + 25 - armUp * 10, sy + 14 - armUp * 18),
    wL: pt(cx - 20 + armUp * 14, sy + 10 - armUp * 45),
    wR: pt(cx + 20 - armUp * 14, sy + 10 - armUp * 45),
    hL: pt(cx - 10, hy), hR: pt(cx + 10, hy),
    kL: pt(cx - 13, hy + 26 - kLift), kR: pt(cx + 13, hy + 26 - kLift),
    aL: pt(cx - 9, fy - 3 - tuck * 16), aR: pt(cx + 9, fy - 3 - tuck * 16),
  }
}

function lungePose(cx: number, fy: number, depth: number): Pose {
  const hy = fy - 60, sy = hy - 42
  return {
    head: pt(cx, sy - 24),
    sL: pt(cx - 13, sy), sR: pt(cx + 13, sy),
    eL: pt(cx - 17, sy + 20), eR: pt(cx + 17, sy + 20),
    wL: pt(cx - 15, sy + 40), wR: pt(cx + 15, sy + 40),
    hL: pt(cx - 9, hy), hR: pt(cx + 9, hy),
    kL: pt(cx - 28, fy - 16 + depth * 10), kR: pt(cx + 28, fy - 24),
    aL: pt(cx - 38, fy - 2), aR: pt(cx + 28, fy - 2),
  }
}

function plankPose(cx: number, fy: number, breathe: number): Pose {
  const hy = fy - 22 + breathe
  return {
    head: pt(cx - 44, hy - 8),
    sL: pt(cx - 26, hy), sR: pt(cx - 18, hy - 6),
    eL: pt(cx - 28, fy - 6), eR: pt(cx - 14, fy - 6),
    wL: pt(cx - 28, fy + 1), wR: pt(cx - 14, fy + 1),
    hL: pt(cx + 18, hy + 4), hR: pt(cx + 22, hy),
    kL: pt(cx + 38, fy - 5), kR: pt(cx + 42, fy - 3),
    aL: pt(cx + 54, fy + 1), aR: pt(cx + 58, fy + 1),
  }
}

function bridgePose(cx: number, fy: number, lift: number): Pose {
  const hipY = fy - 8 - lift * 32
  return {
    head: pt(cx - 44, fy - 22),
    sL: pt(cx - 26, fy - 14), sR: pt(cx - 18, fy - 14),
    eL: pt(cx - 30, fy - 2), eR: pt(cx - 12, fy - 2),
    wL: pt(cx - 30, fy + 1), wR: pt(cx - 12, fy + 1),
    hL: pt(cx + 6, hipY), hR: pt(cx + 20, hipY),
    kL: pt(cx - 10, fy - 10), kR: pt(cx + 36, fy - 10),
    aL: pt(cx - 14, fy - 2), aR: pt(cx + 42, fy - 2),
  }
}

function rdlPose(cx: number, fy: number, hinge: number): Pose {
  const rad = hinge * 1.18
  const hipY = fy - 58
  const tLen = 46
  const tx = cx + Math.sin(rad) * tLen, ty = hipY - Math.cos(rad) * tLen
  return {
    head: pt(tx, ty - 20),
    sL: pt(tx - 13, ty), sR: pt(tx + 13, ty),
    eL: pt(tx - 9 + Math.sin(rad) * 18, ty + Math.cos(rad) * 18),
    eR: pt(tx + 9 + Math.sin(rad) * 18, ty + Math.cos(rad) * 18),
    wL: pt(tx - 9 + Math.sin(rad) * 36, ty + Math.cos(rad) * 36),
    wR: pt(tx + 9 + Math.sin(rad) * 36, ty + Math.cos(rad) * 36),
    hL: pt(cx - 9, hipY), hR: pt(cx + 9, hipY),
    kL: pt(cx - 9, hipY + 26), kR: pt(cx + 9, hipY + 26),
    aL: pt(cx - 9, fy - 2), aR: pt(cx + 9, fy - 2),
  }
}

function hamstringPose(cx: number, fy: number, fold: number): Pose {
  const rad = fold * 1.0
  const sY = fy - 14
  const tLen = 46
  const tx = cx + Math.sin(rad) * tLen, ty = sY - Math.cos(rad) * tLen
  return {
    head: pt(tx, ty - 20),
    sL: pt(tx - 12, ty), sR: pt(tx + 12, ty),
    eL: pt(tx - 8 + Math.sin(rad) * 18, ty + Math.cos(rad) * 18),
    eR: pt(tx + 8 + Math.sin(rad) * 18, ty + Math.cos(rad) * 18),
    wL: pt(cx + 34, sY - 4), wR: pt(cx + 38, sY - 4),
    hL: pt(cx - 8, sY), hR: pt(cx + 8, sY),
    kL: pt(cx + 22, sY - 5), kR: pt(cx + 26, sY - 5),
    aL: pt(cx + 48, sY - 7), aR: pt(cx + 52, sY - 7),
  }
}

function layupPose(cx: number, fy: number, p: number): Pose {
  const hy = fy - 60, sy = hy - 42
  return {
    head: pt(cx, sy - 24),
    sL: pt(cx - 13, sy), sR: pt(cx + 13, sy),
    eL: pt(cx - 18, sy + 18), eR: pt(cx + 16, sy - 4 - p * 18),
    wL: pt(cx - 16, sy + 36), wR: pt(cx + 20, sy - 22 - p * 22),
    hL: pt(cx - 9, hy), hR: pt(cx + 9, hy),
    kL: pt(cx - 16, hy + 20 + p * 10), kR: pt(cx + 12, hy + 28),
    aL: pt(cx - 14, fy - 3), aR: pt(cx + 10, fy - 3),
    ball: pt(cx + 26, sy - 14 - p * 20),
    ballR: 11,
  }
}

function dribblePose(cx: number, fy: number, t: number): Pose {
  const bounce = Math.sin(t * Math.PI * 2)
  const hy = fy - 54, sy = hy - 44
  const handY = sy + 34 + Math.abs(bounce) * 16
  const ballY = fy - 4 - (1 - Math.abs(bounce)) * 16
  return {
    head: pt(cx, sy - 26),
    sL: pt(cx - 14, sy), sR: pt(cx + 14, sy),
    eL: pt(cx - 18, sy + 22), eR: pt(cx + 20, sy + 12 + Math.abs(bounce) * 6),
    wL: pt(cx - 16, sy + 44), wR: pt(cx + 26, handY),
    hL: pt(cx - 11, hy), hR: pt(cx + 11, hy),
    kL: pt(cx - 11, hy + 26), kR: pt(cx + 11, hy + 26),
    aL: pt(cx - 9, fy - 2), aR: pt(cx + 9, fy - 2),
    ball: pt(cx + 32, ballY),
    ballR: 12,
  }
}

function ropePose(cx: number, fy: number, yOff: number): Pose {
  const hy = fy - 55 + yOff, sy = hy - 44
  return {
    head: pt(cx, sy - 26),
    sL: pt(cx - 15, sy), sR: pt(cx + 15, sy),
    eL: pt(cx - 25, sy + 16), eR: pt(cx + 25, sy + 16),
    wL: pt(cx - 33, sy + 28), wR: pt(cx + 33, sy + 28),
    hL: pt(cx - 9, hy), hR: pt(cx + 9, hy),
    kL: pt(cx - 8, hy + 28), kR: pt(cx + 8, hy + 28),
    aL: pt(cx - 8, fy - 2 + yOff), aR: pt(cx + 8, fy - 2 + yOff),
  }
}

function seatedPose(cx: number, fy: number, fold: number): Pose {
  const sY = fy - 14
  const rad = fold * 0.9
  const tx = cx + Math.sin(rad) * 44, ty = sY - Math.cos(rad) * 44
  return {
    head: pt(tx, ty - 20),
    sL: pt(tx - 11, ty), sR: pt(tx + 11, ty),
    eL: pt(tx + 2, ty + 8), eR: pt(tx + 6, ty + 8),
    wL: pt(cx + 34, sY - 3), wR: pt(cx + 38, sY - 3),
    hL: pt(cx - 13, sY), hR: pt(cx + 13, sY),
    kL: pt(cx - 22, sY - 2), kR: pt(cx + 22, sY - 2),
    aL: pt(cx - 30, sY + 2), aR: pt(cx + 30, sY + 2),
  }
}

function pigeonPose(cx: number, fy: number, hold: number): Pose {
  const ang = hold * 0.22
  const tx = cx - 6 + Math.sin(ang) * 28, ty = fy - 18 - Math.cos(ang) * 38
  return {
    head: pt(tx, ty - 20),
    sL: pt(tx - 11, ty), sR: pt(tx + 11, ty),
    eL: pt(tx - 18, ty + 12), eR: pt(tx + 18, ty + 12),
    wL: pt(cx - 32, fy - 4), wR: pt(cx + 14, fy - 4),
    hL: pt(cx - 6, fy - 14), hR: pt(cx + 14, fy - 14),
    kL: pt(cx - 26, fy - 8), kR: pt(cx + 46, fy - 6),
    aL: pt(cx - 20, fy - 3), aR: pt(cx + 52, fy - 3),
  }
}

function pushupPose(cx: number, fy: number, p: number): Pose {
  const bH = 18 + p * 14
  return {
    head: pt(cx - 36, fy - bH - 8),
    sL: pt(cx - 22, fy - bH), sR: pt(cx - 12, fy - bH - 4),
    eL: pt(cx - 24, fy - bH * 0.45), eR: pt(cx - 8, fy - bH * 0.45),
    wL: pt(cx - 24, fy), wR: pt(cx - 8, fy),
    hL: pt(cx + 22, fy - bH * 0.3), hR: pt(cx + 26, fy - bH * 0.1),
    kL: pt(cx + 42, fy - 4), kR: pt(cx + 46, fy - 2),
    aL: pt(cx + 56, fy + 1), aR: pt(cx + 60, fy + 1),
  }
}

// ── background ────────────────────────────────────────────────────────────────

function drawGymBG(g: G, w: number, h: number, fy: number) {
  g.fillGradientStyle(BG_TOP, BG_TOP, BG_BOT, BG_BOT, 1)
  g.fillRect(0, 0, w, fy)
  g.fillStyle(FLOOR_C, 1)
  g.fillRect(0, fy, w, h - fy)
  for (let i = 0; i < w; i += 22) {
    g.lineStyle(1, 0x4A2E14, 0.45)
    g.lineBetween(i, fy, i, h)
  }
  g.lineStyle(2, 0x3D2410, 0.6)
  g.lineBetween(0, fy, w, fy)
  g.lineStyle(1.5, WHITE, 0.12)
  g.lineBetween(0, fy + 9, w, fy + 9)
  g.lineStyle(0, 0, 0)
}

// ── phase instruction labels ──────────────────────────────────────────────────

type PhaseFn = (t: number, dir: 1 | -1) => string

const PHASES: Record<string, PhaseFn> = {
  squat:         (t, d) => d > 0 ? (t < 0.5 ? '↓ 천천히 내려가기' : '무릎 90도 유지!') : '↑ 폭발적으로 올라오기',
  barbell_squat: (t, d) => d > 0 ? (t < 0.5 ? '↓ 허리 아치 유지하며' : '최하점 도달!') : '↑ 무게 밀어올리기',
  squat_jump:    (t)    => t < 0.3 ? '↓ 스쿼트 준비' : t < 0.55 ? '더 낮게!' : '↑ 폭발적으로 점프!',
  calf_raise:    (_, d) => d > 0 ? '↑ 발꿈치 최대한 올리기' : '↓ 천천히 내려오기',
  tuck_jump:     (t)    => t < 0.3 ? '준비!' : t < 0.65 ? '↑ 높이 점프!' : t < 0.85 ? '무릎 가슴으로!' : '↓ 부드럽게 착지',
  box_jump:      (t)    => t < 0.3 ? '↓ 스쿼트 준비' : t < 0.65 ? '↑ 박스 위로 점프!' : '착지 후 균형 잡기',
  depth_jump:    (t)    => t < 0.25 ? '박스 위에서 대기' : t < 0.45 ? '→ 박스에서 내려서기' : t < 0.58 ? '즉시 착지!' : '↑ 반사적으로 점프!',
  plank:         ()     => '코어에 힘! 몸이 일직선',
  bridge:        (_, d) => d > 0 ? '↑ 엉덩이 들어올리기' : '↓ 천천히 내려오기',
  jump_rope:     ()     => '발목 힘으로! 리듬감 있게',
  hip_flexor:    (_, d) => d > 0 ? '앞으로 골반 밀기' : '30초 유지, 호흡',
  split_squat:   (_, d) => d > 0 ? '↓ 앞 무릎 90도' : '↑ 다리로 밀어올리기',
  hamstring:     (t)    => t < 0.5 ? '↓ 허리 곧게 앞으로' : '허벅지 뒤쪽 당기는 느낌!',
  ankle:         (t)    => t < 0.5 ? '→ 시계 방향으로' : '← 반시계 방향으로',
  rdl:           (_, d) => d > 0 ? '↓ 엉덩이 뒤로, 허리 중립' : '↑ 햄스트링으로 올라오기',
  lateral_bound: ()     => '← → 옆으로 최대한 멀리!',
  broad_jump:    (t)    => t < 0.15 ? '준비!' : t < 0.7 ? '↑ 멀리 점프!' : '↓ 무릎 쿠션 착지',
  single_hop:    ()     => '한 발 착지 안정성!',
  hurdle:        ()     => '무릎 높이 들어 넘기!',
  ankle_bounce:  ()     => '발목만! 지면 접촉 최소화',
  rim_reach:     (t)    => t < 0.4 ? '도움닫기 준비' : '↑ 팔 뻗어 림 터치!',
  approach_jump: (t)    => t < 0.4 ? '→ 3-4걸음 도움닫기' : '↑ 마지막 스텝 점프!',
  vert_test:     (t)    => t < 0.4 ? '전력 점프!' : '↑ 손끝 최대한 높이',
  dunk_attempt:  (t)    => t < 0.35 ? '→ 빠른 도움닫기' : t < 0.7 ? '↑ 점프 정점에서!' : '공을 림 안으로!',
  tip_dunk:      (t)    => t < 0.4 ? '림 가까이 접근' : '↑ 손끝 팁으로 넣기!',
  power_clean:   (t)    => t < 0.4 ? '↓ 풀 자세 준비' : '↑ 폭발적으로 당기기!',
  layup:         (t)    => t < 0.5 ? '→ 3보 리듬' : '↑ 림 안쪽 벽에 부드럽게!',
  ball_handle:   ()     => '눈은 앞으로! 손가락 끝 컨트롤',
  foam_roll:     ()     => '압통점에서 20-30초 멈추기',
  yoga:          ()     => '호흡과 함께 천천히',
  dynamic:       ()     => '관절 가열, 점점 범위 확장',
  hip_hinge:     (_, d) => d > 0 ? '↓ 엉덩이 뒤로 빼기' : '↑ 엉덩이로 일어서기',
  pigeon:        ()     => '엉덩이 완전히 열기, 1분 유지',
  achilles:      ()     => '발뒤꿈치 바닥에, 30초 유지',
  plyo_pushup:   (_, d) => d > 0 ? '↑ 폭발적으로 밀기!' : '↓ 부드럽게 착지',
  default:       ()     => '정확한 자세로 천천히',
}

// ── scene ─────────────────────────────────────────────────────────────────────

export type ExerciseAnimType = string

export class ExerciseScene extends Phaser.Scene {
  private charGfx!: Phaser.GameObjects.Graphics
  private envGfx!:  Phaser.GameObjects.Graphics
  private bgGfx!:   Phaser.GameObjects.Graphics
  private phaseLabel!: Phaser.GameObjects.Text
  private animType = 'default'
  private t = 0
  private dir: 1 | -1 = 1
  private W = 280
  private H = 180
  private FLOOR_Y = 148

  constructor() { super({ key: 'ExerciseScene' }) }

  init(data: { animType?: string }) {
    this.animType = data?.animType ?? 'default'
    this.t = 0
    this.dir = 1
  }

  create() {
    this.W = this.scale.width
    this.H = this.scale.height
    this.FLOOR_Y = Math.round(this.H * 0.82)
    this.bgGfx   = this.add.graphics()
    this.envGfx  = this.add.graphics()
    this.charGfx = this.add.graphics()
    drawGymBG(this.bgGfx, this.W, this.H, this.FLOOR_Y)
    this.drawEnv()

    this.phaseLabel = this.add.text(this.W / 2, this.H - 6, '', {
      fontSize: '10px',
      fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", Arial, sans-serif',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    })
    this.phaseLabel.setOrigin(0.5, 1)
    this.phaseLabel.setDepth(10)
  }

  update(_time: number, delta: number) {
    const speed = this.speedFor(this.animType)
    this.t += this.dir * (delta / 1000) * speed
    if (this.t >= 1) { this.t = 1; this.dir = -1 }
    if (this.t <= 0) { this.t = 0; this.dir =  1 }
    this.charGfx.clear()
    this.drawExercise(this.t)
    const fn = PHASES[this.animType] ?? PHASES.default
    this.phaseLabel.setText(fn(this.t, this.dir))
  }

  private speedFor(type: string): number {
    const fast = ['jump_rope', 'squat_jump', 'tuck_jump', 'lateral_bound', 'ankle_bounce', 'box_jump']
    const slow = ['plank', 'bridge', 'hamstring', 'hip_flexor', 'pigeon', 'foam_roll', 'yoga']
    if (fast.includes(type)) return 1.3
    if (slow.includes(type)) return 0.35
    return 0.65
  }

  private drawEnv() {
    const g = this.envGfx
    const cx = Math.round(this.W / 2)
    const fy = this.FLOOR_Y

    if (this.animType === 'box_jump' || this.animType === 'depth_jump') {
      const bx = cx + 44, bw = 48, bh = 36
      g.fillStyle(0x8B6914, 1)
      g.fillRect(bx - bw / 2, fy - bh, bw, bh)
      g.fillStyle(0xA07820, 1)
      g.fillRect(bx - bw / 2, fy - bh, bw, 6)
      g.lineStyle(2, 0x6B5010, 1)
      g.strokeRect(bx - bw / 2, fy - bh, bw, bh)
      g.lineStyle(0, 0, 0)
    }

    if (['barbell_squat', 'rdl', 'power_clean'].includes(this.animType)) {
      g.fillStyle(0x888888, 1)
      g.fillRect(cx - 60, fy - 6, 120, 6)
      g.fillStyle(0x555555, 1)
      g.fillCircle(cx - 60, fy - 3, 14)
      g.fillCircle(cx + 60, fy - 3, 14)
      g.lineStyle(2, 0x333333, 1)
      g.strokeCircle(cx - 60, fy - 3, 14)
      g.strokeCircle(cx + 60, fy - 3, 14)
      g.lineStyle(0, 0, 0)
    }

    if (['split_squat', 'hip_flexor'].includes(this.animType)) {
      const bx = cx + 44
      g.fillStyle(0x2244AA, 1)
      g.fillRoundedRect(bx - 20, fy - 22, 40, 22, 4)
      g.fillStyle(0x1133AA, 1)
      g.fillRoundedRect(bx - 22, fy - 24, 44, 8, 3)
      g.lineStyle(1.5, 0x334488, 1)
      g.strokeRoundedRect(bx - 22, fy - 24, 44, 26, 4)
      g.lineStyle(0, 0, 0)
    }

    if (['rim_reach', 'dunk_attempt', 'approach_jump', 'tip_dunk', 'vert_test'].includes(this.animType)) {
      const rx = this.W - 32
      g.fillStyle(0x888888, 1)
      g.fillRect(rx - 3, 16, 6, fy - 16)
      g.fillStyle(WHITE, 0.14)
      g.fillRect(rx - 34, 6, 24, 34)
      g.lineStyle(2, WHITE, 0.7)
      g.strokeRect(rx - 34, 6, 24, 34)
      g.lineStyle(1.5, 0xffaa00, 0.8)
      g.strokeRect(rx - 28, 14, 14, 12)
      g.lineStyle(0, 0, 0)
      g.fillStyle(0xCC4400, 1)
      g.fillEllipse(rx - 10, 44, 28, 7)
      g.lineStyle(3, 0xCC4400, 1)
      g.strokeEllipse(rx - 10, 44, 28, 8)
      g.lineStyle(1, WHITE, 0.4)
      for (let i = 0; i < 6; i++) g.lineBetween(rx - 14 + i * 5, 48, rx - 16 + i * 5, 64)
      g.lineBetween(rx - 14, 56, rx + 16, 56)
      g.lineStyle(0, 0, 0)
    }
  }

  private drawExercise(t: number) {
    const cx = Math.round(this.W / 2) - 12
    const fy = this.FLOOR_Y
    const g  = this.charGfx

    switch (this.animType) {

      case 'squat': {
        character(g, squatPose(cx, fy, Math.sin(t * Math.PI)))
        break
      }

      case 'barbell_squat': {
        const p = squatPose(cx, fy, Math.sin(t * Math.PI))
        character(g, p)
        const sy = p.sL.y
        g.fillStyle(0x888888, 1); g.fillRoundedRect(cx - 58, sy - 5, 116, 7, 3)
        g.fillStyle(0x555555, 1)
        g.fillCircle(cx - 58, sy - 2, 13); g.fillCircle(cx + 58, sy - 2, 13)
        g.lineStyle(2, 0x333333, 1)
        g.strokeCircle(cx - 58, sy - 2, 13); g.strokeCircle(cx + 58, sy - 2, 13)
        g.lineStyle(0, 0, 0)
        break
      }

      case 'squat_jump': {
        if (t < 0.55) {
          character(g, squatPose(cx, fy, t / 0.55))
        } else {
          const a = (t - 0.55) / 0.45
          character(g, jumpPose(cx, fy - Math.sin(a * Math.PI) * 40, a * 0.5, a * 0.6))
        }
        break
      }

      case 'calf_raise': {
        character(g, calfRaisePose(cx, fy, t))
        break
      }

      case 'tuck_jump': {
        const yOff = -Math.sin(t * Math.PI) * 46
        const tuck = (t > 0.3 && t < 0.75) ? Math.sin((t - 0.3) / 0.45 * Math.PI) : 0
        character(g, jumpPose(cx, fy + yOff, tuck, 0.3))
        break
      }

      case 'box_jump': {
        if (t < 0.3)       character(g, squatPose(cx, fy, (t / 0.3) * 0.6))
        else if (t < 0.65) {
          const a = (t - 0.3) / 0.35
          character(g, jumpPose(cx, fy - Math.sin(a * Math.PI) * 56, a * 0.6, a * 0.5))
        } else             character(g, standPose(cx + 44, fy - 36, 0))
        break
      }

      case 'depth_jump': {
        if (t < 0.25)      character(g, standPose(cx + 44, fy - 36, 0))
        else if (t < 0.45) {
          const f = (t - 0.25) / 0.2
          character(g, standPose(cx + 44 - f * 44, fy - 36 + f * 36, 0))
        } else if (t < 0.58) character(g, squatPose(cx, fy, (t - 0.45) / 0.13 * 0.5))
        else {
          const u = (t - 0.58) / 0.42
          character(g, jumpPose(cx, fy - Math.sin(u * Math.PI) * 52, u * 0.4, u * 0.7))
        }
        break
      }

      case 'plank': {
        character(g, plankPose(cx, fy, Math.sin(t * Math.PI * 2) * 1.5))
        break
      }

      case 'bridge': {
        character(g, bridgePose(cx, fy, Math.sin(t * Math.PI)))
        break
      }

      case 'jump_rope': {
        const yOff = -Math.abs(Math.sin(t * Math.PI * 2)) * 15
        character(g, ropePose(cx, fy + yOff, yOff))
        const rad = t * Math.PI * 2
        const rW = 46, rH = 24, ropeCX = cx, ropeCY = fy - 60 + yOff
        g.lineStyle(2, 0xDDDDDD, 0.85)
        const rPts: P[] = []
        for (let a = 0; a <= Math.PI * 2; a += 0.15)
          rPts.push(pt(ropeCX + Math.cos(a + rad) * rW, ropeCY + Math.sin(a + rad) * rH * 0.52))
        for (let i = 0; i < rPts.length - 1; i++)
          g.lineBetween(rPts[i].x, rPts[i].y, rPts[i + 1].x, rPts[i + 1].y)
        g.lineStyle(0, 0, 0)
        break
      }

      case 'hip_flexor':
      case 'split_squat': {
        character(g, lungePose(cx, fy, 0.6 + Math.sin(t * Math.PI) * 0.35))
        break
      }

      case 'hamstring':
      case 'ankle': {
        character(g, hamstringPose(cx, fy, t))
        break
      }

      case 'rdl': {
        const h = Math.sin(t * Math.PI)
        const p = rdlPose(cx, fy, h)
        character(g, p)
        const bx = (p.wL.x + p.wR.x) / 2, by = (p.wL.y + p.wR.y) / 2
        g.fillStyle(0x888888, 1); g.fillRoundedRect(bx - 34, by - 3, 68, 6, 3)
        g.fillStyle(0x555555, 1)
        g.fillCircle(bx - 34, by, 10); g.fillCircle(bx + 34, by, 10)
        g.lineStyle(0, 0, 0)
        break
      }

      case 'lateral_bound': {
        const xOff = this.dir === 1 ? t * 36 : (1 - t) * 36 - 18
        character(g, jumpPose(cx + xOff, fy - Math.sin(t * Math.PI) * 20, 0.2, 0.1))
        break
      }

      case 'broad_jump': {
        if (t < 0.15) character(g, squatPose(cx, fy, (t / 0.15) * 0.55))
        else {
          const a = (t - 0.15) / 0.85
          character(g, jumpPose(cx + a * 55, fy - Math.sin(a * Math.PI) * 42,
            Math.sin(a * Math.PI) * 0.6, a * 0.3))
        }
        break
      }

      case 'single_hop':
      case 'hurdle': {
        const yOff = -Math.sin(t * Math.PI) * 30
        character(g, jumpPose(cx, fy + yOff, yOff < -12 ? 0.3 : 0, 0.1))
        break
      }

      case 'ankle_bounce': {
        character(g, standPose(cx, fy - Math.abs(Math.sin(t * Math.PI * 2)) * 10, 0))
        break
      }

      case 'rim_reach':
      case 'approach_jump':
      case 'vert_test': {
        const yOff = -Math.sin(t * Math.PI) * 64
        const armUp = t > 0.25 ? (t - 0.25) / 0.75 : 0
        character(g, jumpPose(cx - 8, fy + yOff, 0, armUp))
        break
      }

      case 'dunk_attempt':
      case 'tip_dunk': {
        const yOff = -Math.sin(t * Math.PI) * 66
        const armUp = t > 0.2 ? (t - 0.2) / 0.8 : 0
        const p2 = jumpPose(cx - 4, fy + yOff, 0, armUp)
        if (t > 0.35) { p2.ball = pt(cx + 18, fy + yOff - 38 - armUp * 12); p2.ballR = 11 }
        character(g, p2)
        break
      }

      case 'power_clean': {
        if (t < 0.4) {
          character(g, rdlPose(cx, fy, t / 0.4))
        } else {
          const u = (t - 0.4) / 0.6
          character(g, jumpPose(cx, fy - Math.sin(u * Math.PI) * 18, 0, u * 0.5))
          const barY = fy - 74 - u * 20
          g.fillStyle(0x888888, 1); g.fillRoundedRect(cx - 54, barY, 108, 6, 3)
          g.fillStyle(0x555555, 1)
          g.fillCircle(cx - 54, barY + 3, 12); g.fillCircle(cx + 54, barY + 3, 12)
          g.lineStyle(0, 0, 0)
        }
        break
      }

      case 'layup': {
        character(g, layupPose(cx, fy, Math.min(1, t * 1.4)))
        break
      }

      case 'ball_handle': {
        character(g, dribblePose(cx, fy, t))
        break
      }

      case 'foam_roll':
      case 'yoga':
      case 'dynamic':
      case 'hip_hinge': {
        character(g, seatedPose(cx, fy, Math.abs(Math.sin(t * Math.PI * 0.85))))
        break
      }

      case 'pigeon':
      case 'achilles': {
        character(g, pigeonPose(cx, fy, 0.7 + Math.sin(t * Math.PI) * 0.3))
        break
      }

      case 'plyo_pushup': {
        character(g, pushupPose(cx, fy, Math.sin(t * Math.PI)))
        break
      }

      default:
        character(g, standPose(cx, fy, Math.sin(t * Math.PI) * 0.04))
        break
    }
  }
}
