import type { PlayerPose } from './Player3D'
import { makeIdlePose } from './Player3D'

/**
 * A keyframe is a snapshot of the pose at a specific normalized time (0..1)
 * within a dunk's flight phase. Between keyframes we linearly interpolate.
 *
 * Why this exists: previously every dunk shared one hard-coded "raise arm"
 * pose function, so windmill, tomahawk, 360 etc. looked identical except for
 * a tiny body-yaw spin. The catalog described 15 dunks but the engine only
 * rendered 2. This file is the missing data layer that makes each dunk's
 * limbs actually move along their own trajectory.
 */
export interface DunkKeyframe {
  /** Normalized time within the flight 0..1 */
  t: number
  /** Pose fragment; missing fields inherit from previous keyframe */
  pose: Partial<PlayerPose>
  /** Override ball position relative to player root [x,y,z] in world units.
   *  Use when the ball is NOT in a hand (e.g. between legs, alley-oop catch). */
  ballOffset?: [number, number, number]
  /** Push the player's root position along world axes during this frame.
   *  Used for horizontal_glide (free-throw line) or chaser side-cross. */
  rootOffset?: [number, number, number]
}

export type DunkTrajectory =
  | 'parabola'          // classic vertical-dominant arc
  | 'horizontal_glide'  // long forward leap, low apex (free-throw line)
  | 'tucked_high'       // higher apex, slow descent (360, between-legs)
  | 'low_explosive'     // short fast pop (putback, tip)

export interface DunkChoreography {
  id: string
  trajectory: DunkTrajectory
  /** Apex multiplier on the default vertical jump (1.0 = default) */
  apexBoost: number
  /** Forward distance carried during flight (m). Free-throw line ≈ 4.5, putback ≈ 0.2 */
  carryDistance: number
  /** When in flight 0..1 the slam happens (ball goes through rim) */
  grabT: number
  /** Which hand finishes at the rim */
  grabHand: 'L' | 'R' | 'BOTH'
  keyframes: DunkKeyframe[]
}

// ---- Pose math helpers ----

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Shortest-path angle interpolation around the unit circle */
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

function lerpTriple(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerpAngle(a[0], b[0], t), lerpAngle(a[1], b[1], t), lerpAngle(a[2], b[2], t)]
}

function mergePose(base: PlayerPose, frag: Partial<PlayerPose>): PlayerPose {
  return {
    phase: frag.phase ?? base.phase,
    airT: frag.airT ?? base.airT,
    bodyYaw: frag.bodyYaw ?? base.bodyYaw,
    bodyPitch: frag.bodyPitch ?? base.bodyPitch,
    bodyRoll: frag.bodyRoll ?? base.bodyRoll,
    facing: frag.facing ?? base.facing,
    stride: frag.stride ?? base.stride,
    armL: frag.armL ?? base.armL,
    armR: frag.armR ?? base.armR,
    legL: frag.legL ?? base.legL,
    legR: frag.legR ?? base.legR,
    headPitch: frag.headPitch ?? base.headPitch,
    headYaw: frag.headYaw ?? base.headYaw,
    ballHand: frag.ballHand ?? base.ballHand,
    betweenLegs: frag.betweenLegs ?? base.betweenLegs,
  }
}

/** Per-field interpolation between two FULL poses */
function lerpPose(a: PlayerPose, b: PlayerPose, t: number): PlayerPose {
  return {
    phase: t < 0.5 ? a.phase : b.phase,
    airT: lerp(a.airT, b.airT, t),
    bodyYaw: lerpAngle(a.bodyYaw, b.bodyYaw, t),
    bodyPitch: lerpAngle(a.bodyPitch, b.bodyPitch, t),
    bodyRoll: lerpAngle(a.bodyRoll, b.bodyRoll, t),
    facing: lerpAngle(a.facing, b.facing, t),
    stride: lerp(a.stride, b.stride, t),
    armL: { shoulder: lerpTriple(a.armL.shoulder, b.armL.shoulder, t), elbow: lerp(a.armL.elbow, b.armL.elbow, t) },
    armR: { shoulder: lerpTriple(a.armR.shoulder, b.armR.shoulder, t), elbow: lerp(a.armR.elbow, b.armR.elbow, t) },
    legL: { hip: lerpTriple(a.legL.hip, b.legL.hip, t), knee: lerp(a.legL.knee, b.legL.knee, t) },
    legR: { hip: lerpTriple(a.legR.hip, b.legR.hip, t), knee: lerp(a.legR.knee, b.legR.knee, t) },
    headPitch: lerpAngle(a.headPitch, b.headPitch, t),
    headYaw: lerpAngle(a.headYaw, b.headYaw, t),
    ballHand: t < 0.5 ? a.ballHand : b.ballHand,
    betweenLegs: t < 0.5 ? a.betweenLegs : b.betweenLegs,
  }
}

/**
 * Sample the choreography at normalized time tn (0..1).
 * Builds full poses by accumulating keyframe fragments (each fragment is a
 * partial override on top of the previous accumulated pose), then linearly
 * interpolates between the two surrounding accumulated poses.
 */
export function sampleChoreography(
  c: DunkChoreography,
  tn: number,
  facing: number,
): { pose: PlayerPose; ballOffset?: [number, number, number]; rootOffset?: [number, number, number] } {
  if (c.keyframes.length === 0) {
    return { pose: { ...makeIdlePose(facing), phase: 'apex' } }
  }
  // Accumulate full poses (each keyframe is partial override on previous)
  const accumulated: { t: number; pose: PlayerPose; ballOffset?: [number,number,number]; rootOffset?: [number,number,number] }[] = []
  let prev: PlayerPose = { ...makeIdlePose(facing), phase: 'launch' }
  for (const kf of c.keyframes) {
    const full = mergePose(prev, { ...kf.pose, facing })
    accumulated.push({ t: kf.t, pose: full, ballOffset: kf.ballOffset, rootOffset: kf.rootOffset })
    prev = full
  }
  // Clamp before first / after last
  if (tn <= accumulated[0].t) {
    const k = accumulated[0]
    return { pose: k.pose, ballOffset: k.ballOffset, rootOffset: k.rootOffset }
  }
  if (tn >= accumulated[accumulated.length - 1].t) {
    const k = accumulated[accumulated.length - 1]
    return { pose: k.pose, ballOffset: k.ballOffset, rootOffset: k.rootOffset }
  }
  // Find surrounding pair
  for (let i = 0; i < accumulated.length - 1; i++) {
    const a = accumulated[i], b = accumulated[i + 1]
    if (tn >= a.t && tn <= b.t) {
      const localT = (tn - a.t) / Math.max(1e-5, b.t - a.t)
      // Smoothstep for buttery transitions
      const s = localT * localT * (3 - 2 * localT)
      const pose = lerpPose(a.pose, b.pose, s)
      // ballOffset and rootOffset: linear interpolation if both sides defined,
      // otherwise carry forward whichever exists
      let ballOffset: [number, number, number] | undefined
      if (a.ballOffset && b.ballOffset) {
        ballOffset = [
          lerp(a.ballOffset[0], b.ballOffset[0], s),
          lerp(a.ballOffset[1], b.ballOffset[1], s),
          lerp(a.ballOffset[2], b.ballOffset[2], s),
        ]
      } else {
        ballOffset = a.ballOffset ?? b.ballOffset
      }
      let rootOffset: [number, number, number] | undefined
      if (a.rootOffset && b.rootOffset) {
        rootOffset = [
          lerp(a.rootOffset[0], b.rootOffset[0], s),
          lerp(a.rootOffset[1], b.rootOffset[1], s),
          lerp(a.rootOffset[2], b.rootOffset[2], s),
        ]
      } else {
        rootOffset = a.rootOffset ?? b.rootOffset
      }
      return { pose, ballOffset, rootOffset }
    }
  }
  const last = accumulated[accumulated.length - 1]
  return { pose: last.pose, ballOffset: last.ballOffset, rootOffset: last.rootOffset }
}

// ---- Per-dunk choreographies (15 distinct visual signatures) ----

// Common pose snippets
const BENT_LEGS_TUCK: Partial<PlayerPose> = {
  legL: { hip: [-0.6, 0, 0], knee: 1.1 },
  legR: { hip: [-0.6, 0, 0], knee: 1.1 },
}
const LANDING_POSE: Partial<PlayerPose> = {
  phase: 'land',
  legL: { hip: [-0.3, 0, 0.05], knee: 0.55 },
  legR: { hip: [-0.3, 0, -0.05], knee: 0.55 },
  bodyPitch: 0.1,
}

const CHOREO: Record<string, DunkChoreography> = {
  // 1) basic_two — clean two-hand power slam
  basic_two: {
    id: 'basic_two',
    trajectory: 'parabola',
    apexBoost: 1.0,
    carryDistance: 1.4,
    grabT: 0.50,
    grabHand: 'BOTH',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', armL: { shoulder: [-1.2, 0, 0.4], elbow: 0.3 }, armR: { shoulder: [-1.2, 0, -0.4], elbow: 0.3 }, legL: { hip: [-0.4, 0, 0], knee: 0.4 }, legR: { hip: [-0.4, 0, 0], knee: 0.4 }, ballHand: 'BOTH', headPitch: -0.2 } },
      { t: 0.40, pose: { phase: 'apex', armL: { shoulder: [-2.5, 0, 0.2], elbow: 0.1 }, armR: { shoulder: [-2.5, 0, -0.2], elbow: 0.1 }, ...BENT_LEGS_TUCK, ballHand: 'BOTH', headPitch: -0.35 } },
      { t: 0.50, pose: { phase: 'apex', armL: { shoulder: [-3.0, 0, 0.1], elbow: 0.0 }, armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.0 }, ballHand: 'BOTH' } },
      { t: 0.65, pose: { phase: 'apex', armL: { shoulder: [-2.2, 0, 0.4], elbow: 0.6 }, armR: { shoulder: [-2.2, 0, -0.4], elbow: 0.6 }, ballHand: 'NONE' } },
      { t: 1.00, pose: LANDING_POSE },
    ],
  },

  // 2) basic_one — single-hand finger-roll style
  basic_one: {
    id: 'basic_one',
    trajectory: 'parabola',
    apexBoost: 1.05,
    carryDistance: 1.4,
    grabT: 0.50,
    grabHand: 'R',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', armR: { shoulder: [-0.6, 0, -0.3], elbow: 1.2 }, armL: { shoulder: [0.2, 0, 0.5], elbow: 0.4 }, legL: { hip: [-0.4, 0, 0], knee: 0.4 }, legR: { hip: [-0.4, 0, 0], knee: 0.4 }, ballHand: 'R', headPitch: -0.15 } },
      { t: 0.35, pose: { phase: 'apex', armR: { shoulder: [-2.0, 0, -0.3], elbow: 0.4 }, armL: { shoulder: [-0.4, 0, 0.8], elbow: 0.5 }, ...BENT_LEGS_TUCK, ballHand: 'R' } },
      { t: 0.50, pose: { phase: 'apex', armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.05 }, armL: { shoulder: [-0.2, 0, 1.0], elbow: 0.5 }, ballHand: 'R', headPitch: -0.4 } },
      { t: 0.65, pose: { phase: 'apex', armR: { shoulder: [-2.3, 0, -0.4], elbow: 0.7 }, armL: { shoulder: [-0.2, 0, 1.0], elbow: 0.5 }, ballHand: 'NONE' } },
      { t: 1.00, pose: LANDING_POSE },
    ],
  },

  // 3) reverse — back to the rim, body yaw rotates 180° during flight
  reverse: {
    id: 'reverse',
    trajectory: 'parabola',
    apexBoost: 1.05,
    carryDistance: 1.1,
    grabT: 0.58,
    grabHand: 'BOTH',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', bodyYaw: 0, armL: { shoulder: [-0.4, 0, 0.4], elbow: 1.0 }, armR: { shoulder: [-0.4, 0, -0.4], elbow: 1.0 }, legL: { hip: [-0.5, 0, 0], knee: 0.5 }, legR: { hip: [-0.5, 0, 0], knee: 0.5 }, ballHand: 'BOTH', headYaw: 0.5 } },
      { t: 0.30, pose: { phase: 'apex', bodyYaw: Math.PI * 0.5, armL: { shoulder: [-1.8, 0.3, 0.5], elbow: 0.5 }, armR: { shoulder: [-1.8, -0.3, -0.5], elbow: 0.5 }, ...BENT_LEGS_TUCK, ballHand: 'BOTH', headYaw: 1.0 } },
      { t: 0.58, pose: { phase: 'apex', bodyYaw: Math.PI, armL: { shoulder: [-3.0, 0, 0.1], elbow: 0.0 }, armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.0 }, ballHand: 'BOTH', headPitch: -0.5, headYaw: 0 } },
      { t: 0.75, pose: { phase: 'apex', bodyYaw: Math.PI, armL: { shoulder: [-2.2, 0, 0.5], elbow: 0.8 }, armR: { shoulder: [-2.2, 0, -0.5], elbow: 0.8 }, ballHand: 'NONE' } },
      { t: 1.00, pose: { ...LANDING_POSE, bodyYaw: Math.PI } },
    ],
  },

  // 4) windmill — right arm makes a FULL CIRCLE via shoulder.z swinging through ±π
  windmill: {
    id: 'windmill',
    trajectory: 'tucked_high',
    apexBoost: 1.15,
    carryDistance: 1.0,
    grabT: 0.62,
    grabHand: 'R',
    keyframes: [
      // Start: arm by side, ball in R hand
      { t: 0.00, pose: { phase: 'launch', armR: { shoulder: [0.0, 0, -0.2], elbow: 0.3 }, armL: { shoulder: [0.2, 0, 0.6], elbow: 0.5 }, legL: { hip: [-0.5, 0, 0], knee: 0.5 }, legR: { hip: [-0.5, 0, 0], knee: 0.5 }, ballHand: 'R' } },
      // Arm swings down/back  (shoulder.z = +π/2 = arm pointing OUT to the right and back)
      { t: 0.18, pose: { phase: 'apex', armR: { shoulder: [0.3, 0, -1.4], elbow: 0.2 }, ...BENT_LEGS_TUCK, ballHand: 'R' } },
      // Arm sweeps OVER THE TOP (shoulder.x going negative = arm raised, shoulder.z continues rotating)
      { t: 0.36, pose: { phase: 'apex', armR: { shoulder: [-1.8, 0, -2.4], elbow: 0.1 }, ballHand: 'R' } },
      // Arm passes vertical above head (full extended overhead)
      { t: 0.50, pose: { phase: 'apex', armR: { shoulder: [-3.0, 0, 0.3], elbow: 0.05 }, ballHand: 'R', headPitch: -0.4 } },
      // Slam down — arm fully extended, hand at rim
      { t: 0.62, pose: { phase: 'apex', armR: { shoulder: [-3.0, 0, -0.2], elbow: 0.0 }, ballHand: 'R' } },
      { t: 0.78, pose: { phase: 'apex', armR: { shoulder: [-2.0, 0, -0.5], elbow: 0.8 }, ballHand: 'NONE' } },
      { t: 1.00, pose: LANDING_POSE },
    ],
  },

  // 5) tomahawk — ball cocked BEHIND HEAD (shoulder x ≈ -2.4, elbow bent), then axe-chop down
  tomahawk: {
    id: 'tomahawk',
    trajectory: 'parabola',
    apexBoost: 1.05,
    carryDistance: 1.2,
    grabT: 0.55,
    grabHand: 'R',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', armR: { shoulder: [-0.4, 0, -0.3], elbow: 1.0 }, armL: { shoulder: [0.2, 0, 0.6], elbow: 0.5 }, legL: { hip: [-0.5, 0, 0], knee: 0.5 }, legR: { hip: [-0.5, 0, 0], knee: 0.5 }, ballHand: 'R' } },
      // Cock the axe behind head: shoulder rotated WAY back (x=-2.4), elbow deeply bent
      { t: 0.30, pose: { phase: 'apex', armR: { shoulder: [-2.4, 0, -0.3], elbow: 2.0 }, armL: { shoulder: [-0.4, 0, 0.9], elbow: 0.6 }, ...BENT_LEGS_TUCK, ballHand: 'R', headPitch: -0.2 } },
      { t: 0.45, pose: { phase: 'apex', armR: { shoulder: [-2.8, 0, -0.2], elbow: 1.5 }, ballHand: 'R' } },
      // Axe DOWN — shoulder swings forward, elbow straightens explosively
      { t: 0.55, pose: { phase: 'apex', armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.0 }, ballHand: 'R', headPitch: -0.5 } },
      { t: 0.72, pose: { phase: 'apex', armR: { shoulder: [-2.3, 0, -0.4], elbow: 0.7 }, ballHand: 'NONE' } },
      { t: 1.00, pose: LANDING_POSE },
    ],
  },

  // 6) three_sixty — body spins 360°, ball does L→R handoff at apex
  three_sixty: {
    id: 'three_sixty',
    trajectory: 'tucked_high',
    apexBoost: 1.2,
    carryDistance: 0.8,
    grabT: 0.62,
    grabHand: 'R',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', bodyYaw: 0, armL: { shoulder: [-0.4, 0, 0.6], elbow: 1.1 }, armR: { shoulder: [0.3, 0, -0.6], elbow: 0.4 }, legL: { hip: [-0.5, 0, 0], knee: 0.5 }, legR: { hip: [-0.5, 0, 0], knee: 0.5 }, ballHand: 'L', headYaw: 0.6 } },
      { t: 0.25, pose: { phase: 'apex', bodyYaw: Math.PI * 0.6, armL: { shoulder: [-1.0, 0, 0.9], elbow: 1.4 }, armR: { shoulder: [-1.0, 0, -0.4], elbow: 1.0 }, ...BENT_LEGS_TUCK, ballHand: 'L', headYaw: 1.2 } },
      // Handoff at half rotation: ball moves from L to R
      { t: 0.45, pose: { phase: 'apex', bodyYaw: Math.PI * 1.1, armL: { shoulder: [-1.4, 0, 0.5], elbow: 1.5 }, armR: { shoulder: [-1.4, 0, -0.3], elbow: 1.5 }, ballHand: 'BOTH', headYaw: 0.5 } },
      { t: 0.62, pose: { phase: 'apex', bodyYaw: Math.PI * 1.8, armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.0 }, armL: { shoulder: [-0.5, 0, 0.9], elbow: 0.8 }, ballHand: 'R', headPitch: -0.4, headYaw: 0 } },
      { t: 0.80, pose: { phase: 'apex', bodyYaw: Math.PI * 2, armR: { shoulder: [-2.0, 0, -0.5], elbow: 0.8 }, ballHand: 'NONE' } },
      { t: 1.00, pose: { ...LANDING_POSE, bodyYaw: Math.PI * 2 } },
    ],
  },

  // 7) between_legs — hips open, knees bend wide, ball passes BETWEEN LEGS then to R hand
  between_legs: {
    id: 'between_legs',
    trajectory: 'tucked_high',
    apexBoost: 1.2,
    carryDistance: 0.7,
    grabT: 0.65,
    grabHand: 'R',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', armR: { shoulder: [-0.4, 0, -0.3], elbow: 1.0 }, armL: { shoulder: [-0.4, 0, 0.3], elbow: 1.0 }, legL: { hip: [-0.5, 0, -0.1], knee: 0.5 }, legR: { hip: [-0.5, 0, 0.1], knee: 0.5 }, ballHand: 'L' } },
      // Tuck knees up to chest, hips OPEN wide for ball to pass through
      { t: 0.25, pose: { phase: 'apex', armR: { shoulder: [-0.8, 0, -0.8], elbow: 1.6 }, armL: { shoulder: [-1.2, 0, 0.6], elbow: 1.4 }, legL: { hip: [-1.6, 0, -0.6], knee: 1.8 }, legR: { hip: [-1.6, 0, 0.6], knee: 1.8 }, ballHand: 'L', betweenLegs: false } },
      // Ball is BETWEEN LEGS — under torso, hand-off
      { t: 0.40, pose: { phase: 'apex', armL: { shoulder: [-1.8, 0.5, 1.0], elbow: 1.8 }, armR: { shoulder: [-1.8, -0.5, -1.0], elbow: 1.8 }, legL: { hip: [-1.7, 0, -0.7], knee: 1.9 }, legR: { hip: [-1.7, 0, 0.7], knee: 1.9 }, ballHand: 'NONE', betweenLegs: true }, ballOffset: [0, 1.6, 0] },
      // Ball now in R hand on far side
      { t: 0.52, pose: { phase: 'apex', armR: { shoulder: [-1.4, 0, -0.6], elbow: 0.8 }, armL: { shoulder: [-1.0, 0, 0.9], elbow: 1.4 }, legL: { hip: [-1.2, 0, -0.3], knee: 1.4 }, legR: { hip: [-1.2, 0, 0.3], knee: 1.4 }, ballHand: 'R', betweenLegs: false } },
      { t: 0.65, pose: { phase: 'apex', armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.0 }, ...BENT_LEGS_TUCK, ballHand: 'R', headPitch: -0.4 } },
      { t: 0.82, pose: { phase: 'apex', armR: { shoulder: [-2.2, 0, -0.5], elbow: 0.8 }, ballHand: 'NONE' } },
      { t: 1.00, pose: LANDING_POSE },
    ],
  },

  // 8) alleyoop — ball is in the AIR at start (NONE), caught mid-flight, then slammed
  alleyoop: {
    id: 'alleyoop',
    trajectory: 'parabola',
    apexBoost: 1.1,
    carryDistance: 1.1,
    grabT: 0.55,
    grabHand: 'R',
    keyframes: [
      // Hands UP catching incoming pass — no ball yet
      { t: 0.00, pose: { phase: 'launch', armR: { shoulder: [-2.6, 0, -0.3], elbow: 0.3 }, armL: { shoulder: [-2.6, 0, 0.3], elbow: 0.3 }, legL: { hip: [-0.5, 0, 0], knee: 0.5 }, legR: { hip: [-0.5, 0, 0], knee: 0.5 }, ballHand: 'NONE', headPitch: -0.3 }, ballOffset: [0.5, 2.4, 0.3] },
      // Ball arrives — pose stays high catching
      { t: 0.25, pose: { phase: 'apex', armR: { shoulder: [-2.9, 0, -0.2], elbow: 0.15 }, armL: { shoulder: [-2.9, 0, 0.2], elbow: 0.15 }, ...BENT_LEGS_TUCK, ballHand: 'NONE', headPitch: -0.4 }, ballOffset: [0.2, 2.2, 0.1] },
      // Catch! Ball is now in R hand
      { t: 0.40, pose: { phase: 'apex', armR: { shoulder: [-2.8, 0, -0.1], elbow: 0.2 }, armL: { shoulder: [-2.6, 0, 0.4], elbow: 0.4 }, ballHand: 'R' } },
      { t: 0.55, pose: { phase: 'apex', armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.0 }, ballHand: 'R' } },
      { t: 0.72, pose: { phase: 'apex', armR: { shoulder: [-2.2, 0, -0.5], elbow: 0.8 }, ballHand: 'NONE' } },
      { t: 1.00, pose: LANDING_POSE },
    ],
  },

  // 9) cradle — ball brought into the chest then released soft and high
  cradle: {
    id: 'cradle',
    trajectory: 'parabola',
    apexBoost: 1.0,
    carryDistance: 1.2,
    grabT: 0.55,
    grabHand: 'R',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', armR: { shoulder: [-0.3, 0, -0.4], elbow: 1.4 }, armL: { shoulder: [-0.3, 0, 0.4], elbow: 1.4 }, legL: { hip: [-0.5, 0, 0], knee: 0.5 }, legR: { hip: [-0.5, 0, 0], knee: 0.5 }, ballHand: 'BOTH' } },
      // Cradle: arms hug ball into chest (elbows VERY bent, shoulders pulled in)
      { t: 0.30, pose: { phase: 'apex', armR: { shoulder: [-1.0, 0.5, -1.0], elbow: 2.2 }, armL: { shoulder: [-1.0, -0.5, 1.0], elbow: 2.2 }, ...BENT_LEGS_TUCK, ballHand: 'BOTH', headPitch: -0.1 }, ballOffset: [0, 1.3, 0.2] },
      { t: 0.45, pose: { phase: 'apex', armR: { shoulder: [-2.0, 0.3, -0.5], elbow: 1.2 }, armL: { shoulder: [-2.0, -0.3, 0.5], elbow: 1.2 }, ballHand: 'BOTH' } },
      { t: 0.55, pose: { phase: 'apex', armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.1 }, armL: { shoulder: [-2.2, 0, 0.5], elbow: 0.5 }, ballHand: 'R', headPitch: -0.3 } },
      { t: 0.72, pose: { phase: 'apex', armR: { shoulder: [-2.2, 0, -0.5], elbow: 0.8 }, ballHand: 'NONE' } },
      { t: 1.00, pose: LANDING_POSE },
    ],
  },

  // 10) putback — short low explosive double-pop
  putback: {
    id: 'putback',
    trajectory: 'low_explosive',
    apexBoost: 0.75,
    carryDistance: 0.4,
    grabT: 0.50,
    grabHand: 'BOTH',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', armL: { shoulder: [-1.5, 0, 0.4], elbow: 0.3 }, armR: { shoulder: [-1.5, 0, -0.4], elbow: 0.3 }, legL: { hip: [-0.4, 0, 0], knee: 0.6 }, legR: { hip: [-0.4, 0, 0], knee: 0.6 }, ballHand: 'BOTH' } },
      { t: 0.40, pose: { phase: 'apex', armL: { shoulder: [-2.8, 0, 0.1], elbow: 0.05 }, armR: { shoulder: [-2.8, 0, -0.1], elbow: 0.05 }, ...BENT_LEGS_TUCK, ballHand: 'BOTH' } },
      { t: 0.50, pose: { phase: 'apex', armL: { shoulder: [-3.0, 0, 0.1], elbow: 0.0 }, armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.0 }, ballHand: 'BOTH' } },
      { t: 0.65, pose: { phase: 'apex', armL: { shoulder: [-2.0, 0, 0.5], elbow: 0.9 }, armR: { shoulder: [-2.0, 0, -0.5], elbow: 0.9 }, ballHand: 'NONE' } },
      { t: 1.00, pose: LANDING_POSE },
    ],
  },

  // 11) tip_dunk — tiny pop, fingertip tap (elbow stays bent, just wrist flick)
  tip_dunk: {
    id: 'tip_dunk',
    trajectory: 'low_explosive',
    apexBoost: 0.70,
    carryDistance: 0.3,
    grabT: 0.40,
    grabHand: 'R',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', armR: { shoulder: [-2.0, 0, -0.3], elbow: 0.8 }, armL: { shoulder: [-0.5, 0, 0.5], elbow: 1.0 }, legL: { hip: [-0.3, 0, 0], knee: 0.4 }, legR: { hip: [-0.3, 0, 0], knee: 0.4 }, ballHand: 'NONE' }, ballOffset: [0.2, 2.6, 0.0] },
      { t: 0.30, pose: { phase: 'apex', armR: { shoulder: [-2.8, 0, -0.1], elbow: 0.5 }, ...BENT_LEGS_TUCK, ballHand: 'NONE' }, ballOffset: [0.1, 2.9, 0.0] },
      // Tip — fingertip flick (small motion, elbow doesn't fully straighten)
      { t: 0.40, pose: { phase: 'apex', armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.4 }, ballHand: 'R' } },
      { t: 0.55, pose: { phase: 'apex', armR: { shoulder: [-2.6, 0, -0.4], elbow: 0.9 }, ballHand: 'NONE' } },
      { t: 1.00, pose: LANDING_POSE },
    ],
  },

  // 12) chaser — body tilts via bodyRoll, root slides sideways across baseline
  chaser: {
    id: 'chaser',
    trajectory: 'parabola',
    apexBoost: 1.0,
    carryDistance: 1.4,
    grabT: 0.55,
    grabHand: 'R',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', bodyRoll: 0.0, armR: { shoulder: [-0.4, 0, -0.3], elbow: 1.0 }, armL: { shoulder: [0.2, 0, 0.6], elbow: 0.5 }, legL: { hip: [-0.5, 0, 0], knee: 0.5 }, legR: { hip: [-0.5, 0, 0], knee: 0.5 }, ballHand: 'R' }, rootOffset: [-1.4, 0, 0] },
      { t: 0.30, pose: { phase: 'apex', bodyRoll: -0.35, armR: { shoulder: [-2.0, 0, -0.4], elbow: 0.5 }, ...BENT_LEGS_TUCK, ballHand: 'R' }, rootOffset: [-0.6, 0, 0] },
      { t: 0.55, pose: { phase: 'apex', bodyRoll: -0.25, armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.0 }, ballHand: 'R', headPitch: -0.3 }, rootOffset: [0.2, 0, 0] },
      { t: 0.75, pose: { phase: 'apex', bodyRoll: 0.0, armR: { shoulder: [-2.2, 0, -0.5], elbow: 0.8 }, ballHand: 'NONE' }, rootOffset: [0.8, 0, 0] },
      { t: 1.00, pose: { ...LANDING_POSE, bodyRoll: 0.0 }, rootOffset: [1.0, 0, 0] },
    ],
  },

  // 13) double_pump — armReach goes up→partial down→up (fake pump then real slam)
  double_pump: {
    id: 'double_pump',
    trajectory: 'tucked_high',
    apexBoost: 1.15,
    carryDistance: 1.0,
    grabT: 0.68,
    grabHand: 'R',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', armR: { shoulder: [-0.4, 0, -0.3], elbow: 1.0 }, armL: { shoulder: [0.2, 0, 0.5], elbow: 0.5 }, legL: { hip: [-0.5, 0, 0], knee: 0.5 }, legR: { hip: [-0.5, 0, 0], knee: 0.5 }, ballHand: 'R' } },
      // First pump UP
      { t: 0.30, pose: { phase: 'apex', armR: { shoulder: [-2.8, 0, -0.2], elbow: 0.2 }, ...BENT_LEGS_TUCK, ballHand: 'R', headPitch: -0.3 } },
      // Pull back DOWN (fake)
      { t: 0.45, pose: { phase: 'apex', armR: { shoulder: [-1.4, 0, -0.5], elbow: 1.6 }, ballHand: 'R', headPitch: 0 } },
      // Re-raise — slow lift
      { t: 0.58, pose: { phase: 'apex', armR: { shoulder: [-2.5, 0, -0.2], elbow: 0.5 }, ballHand: 'R' } },
      // Real slam
      { t: 0.68, pose: { phase: 'apex', armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.0 }, ballHand: 'R', headPitch: -0.4 } },
      { t: 0.85, pose: { phase: 'apex', armR: { shoulder: [-2.2, 0, -0.5], elbow: 0.8 }, ballHand: 'NONE' } },
      { t: 1.00, pose: LANDING_POSE },
    ],
  },

  // 14) freethrow_line — horizontal glide, body pitched forward like flying, slow descent
  freethrow_line: {
    id: 'freethrow_line',
    trajectory: 'horizontal_glide',
    apexBoost: 0.85,
    carryDistance: 4.5,
    grabT: 0.62,
    grabHand: 'BOTH',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', bodyPitch: 0.0, armL: { shoulder: [-1.0, 0, 0.5], elbow: 0.4 }, armR: { shoulder: [-1.0, 0, -0.5], elbow: 0.4 }, legL: { hip: [-0.5, 0, 0], knee: 0.5 }, legR: { hip: [-0.5, 0, 0], knee: 0.5 }, ballHand: 'BOTH' } },
      // Mid-flight Jordan pose — body angled forward, legs tucked behind, arm extending
      { t: 0.35, pose: { phase: 'apex', bodyPitch: 0.35, armL: { shoulder: [-2.4, 0, 0.3], elbow: 0.2 }, armR: { shoulder: [-2.4, 0, -0.3], elbow: 0.2 }, legL: { hip: [0.4, 0, 0.1], knee: 1.2 }, legR: { hip: [0.4, 0, -0.1], knee: 1.2 }, ballHand: 'BOTH', headPitch: -0.3 } },
      { t: 0.50, pose: { phase: 'apex', bodyPitch: 0.45, armL: { shoulder: [-2.8, 0, 0.2], elbow: 0.1 }, armR: { shoulder: [-2.8, 0, -0.2], elbow: 0.1 }, ballHand: 'BOTH' } },
      { t: 0.62, pose: { phase: 'apex', bodyPitch: 0.50, armL: { shoulder: [-3.0, 0, 0.1], elbow: 0.0 }, armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.0 }, ballHand: 'BOTH', headPitch: -0.45 } },
      { t: 0.80, pose: { phase: 'apex', bodyPitch: 0.30, armL: { shoulder: [-2.2, 0, 0.5], elbow: 0.8 }, armR: { shoulder: [-2.2, 0, -0.5], elbow: 0.8 }, ballHand: 'NONE' } },
      { t: 1.00, pose: { ...LANDING_POSE, bodyPitch: 0.1 } },
    ],
  },

  // 15) eastbay — between-legs L→R signature handoff at apex
  eastbay: {
    id: 'eastbay',
    trajectory: 'tucked_high',
    apexBoost: 1.2,
    carryDistance: 0.7,
    grabT: 0.68,
    grabHand: 'R',
    keyframes: [
      { t: 0.00, pose: { phase: 'launch', armL: { shoulder: [-0.3, 0, 0.4], elbow: 1.2 }, armR: { shoulder: [0.2, 0, -0.5], elbow: 0.5 }, legL: { hip: [-0.5, 0, -0.1], knee: 0.5 }, legR: { hip: [-0.5, 0, 0.1], knee: 0.5 }, ballHand: 'L' } },
      // Knees open up high
      { t: 0.25, pose: { phase: 'apex', armL: { shoulder: [-0.9, 0, 0.9], elbow: 1.6 }, armR: { shoulder: [-0.5, 0, -0.6], elbow: 1.0 }, legL: { hip: [-1.5, 0, -0.5], knee: 1.8 }, legR: { hip: [-1.5, 0, 0.5], knee: 1.8 }, ballHand: 'L' } },
      // L hand passes ball UNDER thigh through legs
      { t: 0.40, pose: { phase: 'apex', armL: { shoulder: [-2.2, 0.4, 0.8], elbow: 2.2 }, armR: { shoulder: [-1.0, -0.4, -0.9], elbow: 1.6 }, legL: { hip: [-1.7, 0, -0.6], knee: 2.0 }, legR: { hip: [-1.7, 0, 0.6], knee: 2.0 }, ballHand: 'NONE', betweenLegs: true }, ballOffset: [0, 1.5, 0] },
      // R hand catches on far side
      { t: 0.54, pose: { phase: 'apex', armR: { shoulder: [-1.0, 0, -0.8], elbow: 1.0 }, armL: { shoulder: [-1.5, 0, 0.6], elbow: 1.5 }, legL: { hip: [-1.2, 0, -0.3], knee: 1.4 }, legR: { hip: [-1.2, 0, 0.3], knee: 1.4 }, ballHand: 'R', betweenLegs: false } },
      { t: 0.68, pose: { phase: 'apex', armR: { shoulder: [-3.0, 0, -0.1], elbow: 0.0 }, ...BENT_LEGS_TUCK, ballHand: 'R', headPitch: -0.4 } },
      { t: 0.85, pose: { phase: 'apex', armR: { shoulder: [-2.2, 0, -0.5], elbow: 0.8 }, ballHand: 'NONE' } },
      { t: 1.00, pose: LANDING_POSE },
    ],
  },
}

export function getDunkChoreography(id: string): DunkChoreography {
  return CHOREO[id] ?? CHOREO.basic_two
}

/**
 * Compute the root Y position for a given trajectory at normalized time tn.
 * Different trajectories have different jump shapes.
 *
 * @param tn  flight progress 0..1
 * @param apexBoost multiplier on default apex height (1.0 = default)
 * @param baseApexY the default apex height (= rim height − arm reach offset)
 */
export function trajectoryY(traj: DunkTrajectory, tn: number, apexBoost: number, baseApexY: number): number {
  const apex = baseApexY * apexBoost
  switch (traj) {
    case 'parabola': {
      // Symmetric arc: -4(t-0.5)^2 + 1 = sine bell
      return apex * (1 - Math.pow(2 * tn - 1, 2))
    }
    case 'tucked_high': {
      // Higher apex, lingers at top (asymmetric — slow descent)
      if (tn < 0.5) return apex * Math.pow(tn / 0.5, 0.65)
      const u = (tn - 0.5) / 0.5
      return apex * (1 - Math.pow(u, 2.2))
    }
    case 'low_explosive': {
      // Short fast pop
      return apex * Math.sin(tn * Math.PI)
    }
    case 'horizontal_glide': {
      // Low flat apex (jumper stays airborne but doesn't rise much vertically)
      return apex * Math.sin(tn * Math.PI) * 0.7
    }
  }
}
