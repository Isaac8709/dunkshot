import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { COURT } from './Court3D'
import { Player3D, type PlayerHandle, makeIdlePose } from './Player3D'
import { Ball3D, type BallHandle } from './Ball3D'
import { Hoop3D } from './Hoop3D'
import { pickDunkFromKeys, resolveShot } from './dunkCatalog'
import {
  getDunkChoreography,
  sampleChoreography,
  trajectoryY,
  type DunkChoreography,
} from './dunkChoreography'
import type { DunkSpec, DunkFeedback } from './types'

interface GameWorldProps {
  unlockedDunkIds: string[]
  heldKeys: Set<string>
  /** rising-edge SPACE trigger */
  shootTrigger: number
  onDunkEvent: (ev: DunkEvent) => void
  onNetImpulse: () => void
}

export interface DunkEvent {
  spec: DunkSpec
  tier: 'perfect' | 'good' | 'normal' | 'miss'
  points: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
  distance: number
  feedback: DunkFeedback
}

type ActionState =
  | { kind: 'free' }
  | { kind: 'runup'; spec: DunkSpec; choreo: DunkChoreography; from: THREE.Vector3; targetXZ: THREE.Vector3 }
  | { kind: 'prep'; spec: DunkSpec; choreo: DunkChoreography; from: THREE.Vector3; t: number; duration: number; targetXZ: THREE.Vector3 }
  | { kind: 'flight'; spec: DunkSpec; choreo: DunkChoreography; from: THREE.Vector3; landAt: THREE.Vector3; t: number; duration: number; result: ReturnType<typeof resolveShot> | null; netPulsed?: boolean }
  | { kind: 'rimhang'; t: number; hangDur: number; side: number; facing: number; grabHand: 'L' | 'R' | 'BOTH'; y: number; vy: number; dropping: boolean }
  | { kind: 'shot'; t: number; jumpDur: number; releaseAt: number; flightT: number; facing: number; made: boolean; three: boolean; dist: number; resolved: boolean; releasePos: THREE.Vector3; missX: number }
  | { kind: 'land'; t: number; duration: number; facing: number }

export function GameWorld({ unlockedDunkIds, heldKeys, shootTrigger, onDunkEvent, onNetImpulse }: GameWorldProps) {
  const playerRef = useRef<PlayerHandle>(null!)
  const ballRef = useRef<BallHandle>(null!)
  const { camera } = useThree()

  const playerPosRef = useRef(new THREE.Vector3(0, 0, 7))
  const velRef = useRef(new THREE.Vector3())
  const facingRef = useRef(Math.PI) // face the hoop (rim is at z=0, player starts at z>0, so face -z)
  const strideRef = useRef(0)
  const actionRef = useRef<ActionState>({ kind: 'free' })
  const lastShootTriggerRef = useRef(0)
  const ballPosRef = useRef(new THREE.Vector3())
  const dribblePhaseRef = useRef(0)
  const shakeRef = useRef(0) // slam-impact camera shake intensity 0..1
  const unlockedSetRef = useRef(new Set(unlockedDunkIds))
  unlockedSetRef.current = new Set(unlockedDunkIds)

  useEffect(() => { unlockedSetRef.current.add('basic_two') }, [])

  useFrame((_, dt) => {
    const player = playerRef.current
    const ball = ballRef.current
    if (!player || !ball) return

    const pos = playerPosRef.current

    // Frame-rate-independent smoothing factor for a given rate (per second).
    const sm = (rate: number) => 1 - Math.exp(-rate * dt)
    // Smoothstep 0..1
    const ss = (x: number) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x) }

    // ---- Rising-edge shoot trigger ----
    if (shootTrigger !== lastShootTriggerRef.current && actionRef.current.kind === 'free') {
      lastShootTriggerRef.current = shootTrigger
      const mods = new Set<string>()
      for (const k of heldKeys) if (k !== 'SPACE') mods.add(k)
      const spec = pickDunkFromKeys(mods, unlockedSetRef.current)
      const choreo = getDunkChoreography(spec.id)

      const rimXZ = new THREE.Vector3(0, 0, 0)
      const dist = pos.clone().setY(0).distanceTo(rimXZ)

      // Out of dunk range → JUMP SHOT instead. Distance decides 2pt vs 3pt
      // and the make probability.
      if (dist > spec.maxDistance + 0.05) {
        facingRef.current = Math.atan2(pos.x, pos.z) // square up to the rim
        const three = dist > COURT.threePtRadius - 0.05
        const made = Math.random() < THREE.MathUtils.clamp(0.93 - dist * 0.06, 0.25, 0.93)
        actionRef.current = {
          kind: 'shot', t: 0, jumpDur: 0.85, releaseAt: 0.32,
          flightT: 0.7 + dist * 0.07, facing: facingRef.current,
          made, three, dist, resolved: false,
          releasePos: new THREE.Vector3(), missX: (Math.random() - 0.5) * 1.0,
        }
        velRef.current.set(0, 0, 0)
        return
      }

      // Approach target — for horizontal_glide dunks (free-throw) we LAUNCH far,
      // for others we hop closer.
      const approachZ = choreo.trajectory === 'horizontal_glide'
        ? Math.max(4.0, Math.min(dist, 5.0))
        : Math.max(0.5, dist > spec.maxDistance ? 1.2 : 0.5 + Math.random() * 0.3)
      const targetXZ = new THREE.Vector3(0, 0, approachZ)
      const startFrom = pos.clone()
      // Real attack: if we're not already at the launch spot, RUN there first
      // (Freestyle-style drive to the rim) instead of teleport-hopping.
      const runDist = pos.clone().setY(0).distanceTo(targetXZ)
      actionRef.current = runDist > 0.9
        ? { kind: 'runup', spec, choreo, from: startFrom, targetXZ }
        : { kind: 'prep', spec, choreo, from: startFrom, t: 0, duration: 0.26, targetXZ }
      velRef.current.set(0, 0, 0)
    }

    // ---- FREE MOVEMENT ----
    if (actionRef.current.kind === 'free') {
      const moveSpeed = 6.0
      const v = velRef.current.set(0, 0, 0)
      if (heldKeys.has('ArrowUp') || heldKeys.has('FWD')) v.z -= 1
      if (heldKeys.has('ArrowDown') || heldKeys.has('BACK')) v.z += 1
      if (heldKeys.has('ArrowLeft') || heldKeys.has('LEFT')) v.x -= 1
      if (heldKeys.has('ArrowRight') || heldKeys.has('RIGHT')) v.x += 1
      if (v.lengthSq() > 0) {
        v.normalize().multiplyScalar(moveSpeed)
        pos.x += v.x * dt
        pos.z += v.z * dt
        pos.x = THREE.MathUtils.clamp(pos.x, -COURT.width / 2 + 0.5, COURT.width / 2 - 0.5)
        // Keep the player in front of the broadcast camera (which sits at z≈10).
        pos.z = THREE.MathUtils.clamp(pos.z, -0.5, 8.5)
        const angle = Math.atan2(-v.x, -v.z)
        // Shortest-path turn so the player never spins the long way round.
        let dA = angle - facingRef.current
        while (dA > Math.PI) dA -= Math.PI * 2
        while (dA < -Math.PI) dA += Math.PI * 2
        facingRef.current += dA * sm(13)
        strideRef.current += dt * 1.5
        const idle = makeIdlePose(facingRef.current)
        // Slight forward lean while moving — standing bolt-upright at speed reads robotic
        player.setPose({ ...idle, phase: 'run', stride: strideRef.current, bodyPitch: 0.10 })
      } else {
        player.setPose(makeIdlePose(facingRef.current))
      }
      // Dribble
      dribblePhaseRef.current += dt * 4
      const bounceY = Math.abs(Math.sin(dribblePhaseRef.current * Math.PI)) * 0.85
      const sideOffset = new THREE.Vector3(0.35, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRef.current)
      ballPosRef.current.set(pos.x + sideOffset.x, 0.12 + bounceY, pos.z + sideOffset.z)
      ball.setPosition(ballPosRef.current)
      ball.setSpin(2.0)
    }

    // ---- RUN-UP: sprint to the launch spot with an attack dribble ----
    if (actionRef.current.kind === 'runup') {
      const a = actionRef.current
      const to = a.targetXZ.clone().sub(pos)
      to.y = 0
      const d = to.length()
      if (d < 0.2) {
        actionRef.current = {
          kind: 'prep', spec: a.spec, choreo: a.choreo, from: a.from,
          t: 0, duration: 0.26, targetXZ: a.targetXZ,
        }
      } else {
        // Accelerate into the rim — longer approach = faster final step
        const speed = THREE.MathUtils.clamp(3.5 + d * 1.6, 4.0, 7.5)
        to.normalize()
        pos.addScaledVector(to, Math.min(d, speed * dt))
        const angle = Math.atan2(-to.x, -to.z)
        let dA = angle - facingRef.current
        while (dA > Math.PI) dA -= Math.PI * 2
        while (dA < -Math.PI) dA += Math.PI * 2
        facingRef.current += dA * sm(16)
        strideRef.current += dt * 2.3
        const idle = makeIdlePose(facingRef.current)
        player.setPose({ ...idle, phase: 'run', stride: strideRef.current, bodyPitch: 0.16 })
        // Attack dribble — lower and faster than the relaxed walk dribble
        dribblePhaseRef.current += dt * 6
        const bounceY = Math.abs(Math.sin(dribblePhaseRef.current * Math.PI)) * 0.6
        const sideOffset = new THREE.Vector3(0.35, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRef.current)
        ballPosRef.current.set(pos.x + sideOffset.x, 0.12 + bounceY, pos.z + sideOffset.z)
        ball.setPosition(ballPosRef.current)
        ball.setSpin(3.0)
      }
    }

    // ---- PREP: gather step — deep squat + arms wind up behind the back ----
    if (actionRef.current.kind === 'prep') {
      const a = actionRef.current
      a.t += dt
      const tn = Math.min(1, a.t / a.duration)
      pos.lerpVectors(a.from, a.targetXZ.clone().setY(0), tn * 0.3)
      facingRef.current = Math.atan2(-(a.targetXZ.x - a.from.x), -(a.targetXZ.z - a.from.z))

      // Use first keyframe of choreography (launch pose) but with prep-phase squat.
      // Arms swing BEHIND the back (scaled by the dunk's armWindup) so the jump
      // reads as a loaded explosion instead of a passive lift — the windup then
      // whips forward into the flight's first keyframe via the pose smoothing.
      const { pose } = sampleChoreography(a.choreo, 0, facingRef.current)
      const w = a.spec.armWindup
      player.setPose({
        ...pose,
        phase: 'prep',
        armL: { shoulder: [0.45 + 0.75 * w * tn, 0, 0.3], elbow: 0.35 },
        armR: { shoulder: [0.45 + 0.75 * w * tn, 0, -0.3], elbow: 0.35 },
        legL: { hip: [-0.35 - 0.25 * tn, 0, 0], knee: 0.4 + 0.7 * tn },
        legR: { hip: [-0.35 - 0.25 * tn, 0, 0], knee: 0.4 + 0.7 * tn },
        bodyPitch: 0.18 * tn,
        facing: facingRef.current,
      })

      // Ball stays in shooting hand during prep
      const ballHand = a.spec.twoHand ? 'R' : 'R'
      const tgt = new THREE.Vector3()
      player.getHandWorldPos(ballHand, tgt)
      ball.setPosition(tgt)
      ball.setSpin(0)

      if (tn >= 1) {
        const distance = a.from.clone().setY(0).distanceTo(new THREE.Vector3(0, 0, 0))
        const timingError = Math.random() * 0.5
        const result = resolveShot({ distance, spec: a.spec, timingError })
        actionRef.current = {
          kind: 'flight', spec: a.spec, choreo: a.choreo,
          from: pos.clone(),
          landAt: new THREE.Vector3(
            // For reverse, player ends up BEHIND the rim
            a.spec.rimSide === -1 ? 0 : 0,
            0,
            a.spec.rimSide === -1 ? -0.9 : 0.5,
          ),
          t: 0,
          duration: a.spec.airTime,
          result,
        }
      }
    }

    // ---- FLIGHT: choreography-driven ----
    if (actionRef.current.kind === 'flight') {
      const a = actionRef.current
      // Slow-mo around the grab moment (defined per dunk).
      // Ramp the time dilation in and out with a smoothstep instead of a hard
      // 1.0→0.30→1.0 jump — the old binary switch caused a visible judder right
      // at the most important moment of the dunk.
      const tnRaw = a.t / a.duration
      const grabT = a.choreo.grabT
      const SLOW_MIN = 0.34
      const inStart = grabT - 0.13
      const inFull  = grabT - 0.04
      const outFull = grabT + 0.11
      const outEnd  = grabT + 0.21
      let slowF = 0 // 0 = real time, 1 = deepest slow-mo
      if (tnRaw > inStart && tnRaw < outEnd) {
        if (tnRaw < inFull)       slowF = ss((tnRaw - inStart) / (inFull - inStart))
        else if (tnRaw <= outFull) slowF = 1
        else                       slowF = 1 - ss((tnRaw - outFull) / (outEnd - outFull))
      }
      const timeScale = THREE.MathUtils.lerp(1.0, SLOW_MIN, slowF)
      a.t += dt * timeScale
      const tn = Math.min(1, a.t / a.duration)

      // ---- Root position ----
      // X/Z: parabolic blend from launch to landAt, passing through grab anchor (just under rim)
      const grabAnchorXZ = new THREE.Vector3(0, 0, a.spec.rimSide === -1 ? -0.55 : 0.55)
      let rootX: number, rootZ: number
      if (tn < grabT) {
        const u = tn / grabT
        const ease = u * u * (3 - 2 * u)
        rootX = THREE.MathUtils.lerp(a.from.x, grabAnchorXZ.x, ease)
        rootZ = THREE.MathUtils.lerp(a.from.z, grabAnchorXZ.z, ease)
      } else {
        const u = (tn - grabT) / (1 - grabT)
        const ease = u * u
        rootX = THREE.MathUtils.lerp(grabAnchorXZ.x, a.landAt.x, ease)
        rootZ = THREE.MathUtils.lerp(grabAnchorXZ.z, a.landAt.z, ease)
      }

      // Y: choreography-specific arc
      // baseApexY: player root height so that fully-extended hand reaches rim (3.05 + a bit clearance)
      const baseApexY = COURT.rimY - 1.65 + 0.15  // ≈ 1.55
      const rootY = trajectoryY(a.choreo.trajectory, tn, a.choreo.apexBoost, baseApexY)

      // Sample choreography for pose + ball/root offsets
      const { pose, ballOffset, rootOffset } = sampleChoreography(a.choreo, tn, facingRef.current)

      // Apply rootOffset (chaser side-cross, etc.)
      const offsetX = rootOffset?.[0] ?? 0
      const offsetY = rootOffset?.[1] ?? 0
      const offsetZ = rootOffset?.[2] ?? 0

      pos.x = rootX + offsetX
      pos.z = rootZ + offsetZ
      player.group.position.set(pos.x, rootY + offsetY, pos.z)
      player.setPose(pose)

      // ---- Ball trajectory ----
      const slamStart = grabT - 0.02
      const slamEnd = grabT + 0.13
      const dropEnd = grabT + 0.30
      const missShot = a.result?.tier === 'miss'
      const rimDir = a.spec.rimSide === -1 ? -1 : 1

      if (pose.ballHand === 'NONE' && ballOffset) {
        // Explicit ball offset (between-legs floating, alley-oop incoming pass)
        ballPosRef.current.set(
          player.group.position.x + ballOffset[0],
          player.group.position.y + ballOffset[1],
          player.group.position.z + ballOffset[2],
        )
        ball.setPosition(ballPosRef.current)
        ball.setSpin(2)
      } else if (tn < slamStart) {
        // Ball in the choreographed hand
        const handTarget = new THREE.Vector3()
        const hand = pose.ballHand === 'L' ? 'L' : pose.ballHand === 'R' ? 'R' : 'R'
        if (pose.betweenLegs) {
          player.getCrotchWorldPos(handTarget)
          handTarget.y += 0.05
        } else if (pose.ballHand === 'NONE') {
          // Hidden (shouldn't happen here, fallback)
          player.getHandWorldPos('R', handTarget)
        } else if (pose.ballHand === 'BOTH') {
          const l = new THREE.Vector3(), r = new THREE.Vector3()
          player.getHandWorldPos('L', l)
          player.getHandWorldPos('R', r)
          handTarget.lerpVectors(l, r, 0.5)
        } else {
          player.getHandWorldPos(hand, handTarget)
        }
        ball.setPosition(handTarget)
        ball.setSpin(a.spec.spin * 3 + 1.5)
      } else if (tn < slamEnd) {
        // SLAM DOWN — through the rim on a make, INTO the front iron on a miss
        const slamT = (tn - slamStart) / (slamEnd - slamStart)
        const startHand = new THREE.Vector3()
        const hand = a.choreo.grabHand === 'BOTH' ? 'R' : a.choreo.grabHand
        player.getHandWorldPos(hand, startHand)
        const slamTarget = missShot
          ? new THREE.Vector3(0, COURT.rimY + 0.05, rimDir * 0.26) // front iron — CLANK
          : new THREE.Vector3(0, COURT.rimY - 0.05, 0)
        ballPosRef.current.lerpVectors(startHand, slamTarget, slamT)
        ball.setPosition(ballPosRef.current)
        ball.setSpin(6)
        if (slamT > 0.5 && !a.netPulsed) {
          a.netPulsed = true
          if (!missShot) {
            onNetImpulse()
            shakeRef.current = 1 // impact — camera shake + FOV punch
          }
        }
      } else if (missShot) {
        // CLANK — ball ricochets off the front iron, away from the hoop
        const u = (tn - slamEnd) / Math.max(1e-5, 1 - slamEnd)
        const y = Math.max(0.13, COURT.rimY + 0.05 + 1.1 * u - 5.0 * u * u)
        ballPosRef.current.set(0.35 * u, y, rimDir * (0.26 + u * 2.8))
        ball.setPosition(ballPosRef.current)
        ball.setSpin(5)
      } else if (tn < dropEnd) {
        // Drop through net
        const dropT = (tn - slamEnd) / (dropEnd - slamEnd)
        ballPosRef.current.set(0, COURT.rimY - 0.05 - dropT * 0.6, 0)
        ball.setPosition(ballPosRef.current)
        ball.setSpin(4)
      } else {
        // Bounce away
        const bounceT = (tn - dropEnd) / (1 - dropEnd)
        const bounceY = Math.abs(Math.sin(bounceT * Math.PI * 1.5)) * 0.6 * (1 - bounceT)
        ballPosRef.current.set(0, 0.12 + bounceY, 0.5 + bounceT * 1.8)
        ball.setPosition(ballPosRef.current)
        ball.setSpin(3)
      }

      // Camera-relative facing override during flight for reverse
      if (a.spec.rimSide === -1) {
        facingRef.current = THREE.MathUtils.lerp(facingRef.current, 0, sm(12))
      }

      const res = a.result!
      const fireEvent = () => {
        const feedback: DunkFeedback = {
          dunkId: a.spec.id,
          name: a.spec.name,
          tier: res.tier,
          points: res.points,
          approachGrade: res.grade,
          trainingCue: a.spec.cue,
          risk: a.spec.difficulty >= 4 ? '높음' : a.spec.difficulty >= 3 ? '중간' : '낮음',
          style: a.spec.name,
          color: a.spec.color,
        }
        onDunkEvent({
          spec: a.spec, tier: res.tier, points: res.points, grade: res.grade,
          distance: a.from.distanceTo(new THREE.Vector3()), feedback,
        })
      }

      // Freestyle signature: on a powerful make, GRAB THE RIM and hang
      // instead of floating down. Perfect tier or high-difficulty dunks hang.
      const wantHang = res.tier !== 'miss' && (res.tier === 'perfect' || a.spec.difficulty >= 4)
      if (wantHang && tn >= grabT + 0.17) {
        fireEvent()
        const side = a.spec.rimSide === -1 ? -1 : 1
        pos.x = 0
        pos.z = side * 0.48
        actionRef.current = {
          kind: 'rimhang', t: 0, hangDur: 0.6, side, facing: facingRef.current,
          grabHand: a.choreo.grabHand, y: COURT.rimY - 1.82, vy: 0, dropping: false,
        }
      } else if (tn >= 1) {
        fireEvent()
        player.group.position.set(pos.x, 0, pos.z)
        actionRef.current = { kind: 'land', t: 0, duration: 0.42, facing: facingRef.current }
      }
    }

    // ---- RIM HANG: gripping the rim, swing decays, then drop and land ----
    if (actionRef.current.kind === 'rimhang') {
      const a = actionRef.current
      a.t += dt
      const decay = Math.exp(-a.t * 2.0)
      const swing = Math.sin(a.t * 6.5) * decay

      if (!a.dropping) {
        // Hanging: body sags a touch as the swing dies out
        a.y = COURT.rimY - 1.82 - 0.10 * (1 - decay)
        if (a.t >= a.hangDur) a.dropping = true
      } else {
        a.vy -= 14 * dt
        a.y += a.vy * dt
        if (a.y <= 0) {
          a.y = 0
          actionRef.current = { kind: 'land', t: 0, duration: 0.42, facing: a.facing }
        }
      }
      player.group.position.set(pos.x, Math.max(0, a.y), pos.z + swing * 0.09 * a.side)

      const gripL = !a.dropping && (a.grabHand === 'L' || a.grabHand === 'BOTH')
      const gripR = !a.dropping && (a.grabHand === 'R' || a.grabHand === 'BOTH')
      const idle = makeIdlePose(a.facing)
      player.setPose({
        ...idle,
        phase: 'apex',
        bodyPitch: 0.08 + swing * 0.20,
        armL: gripL ? { shoulder: [-2.95, 0, 0.12], elbow: 0.06 } : { shoulder: [-0.5, 0, 0.55], elbow: 0.45 },
        armR: gripR ? { shoulder: [-2.95, 0, -0.12], elbow: 0.06 } : { shoulder: [-0.5, 0, -0.55], elbow: 0.45 },
        legL: { hip: [-0.18 + swing * 0.22, 0, 0.05], knee: 0.5 },
        legR: { hip: [-0.18 + swing * 0.18, 0, -0.05], knee: 0.42 },
        headPitch: -0.25,
        ballHand: 'NONE',
      })

      // Ball keeps its own timeline: finish dropping through the net, then bounce away
      const bt = a.t + 0.08
      if (bt < 0.25) {
        ballPosRef.current.set(0, COURT.rimY - 0.05 - (bt / 0.25) * 0.6, 0)
        ball.setSpin(4)
      } else {
        const bounceT = Math.min(1, (bt - 0.25) / 1.1)
        const bounceY = Math.abs(Math.sin(bounceT * Math.PI * 1.5)) * 0.6 * (1 - bounceT)
        ballPosRef.current.set(0, 0.12 + bounceY, 0.5 + bounceT * 1.8)
        ball.setSpin(3)
      }
      ball.setPosition(ballPosRef.current)
    }

    // ---- JUMP SHOT: rise, release at the top, ball arcs to the rim ----
    if (actionRef.current.kind === 'shot') {
      const a = actionRef.current
      a.t += dt
      const jt = Math.min(1, a.t / a.jumpDur)
      const jumpY = 0.55 * Math.sin(jt * Math.PI)
      player.group.position.set(pos.x, jumpY, pos.z)

      // Shooting form: gather → set point above the forehead → extend + follow-through
      const setT = ss(Math.min(1, a.t / a.releaseAt))
      const relT = ss(THREE.MathUtils.clamp((a.t - a.releaseAt) / 0.12, 0, 1))
      const airBend = Math.sin(jt * Math.PI)
      const idle = makeIdlePose(a.facing)
      player.setPose({
        ...idle,
        phase: jt < 1 ? 'apex' : 'land',
        facing: a.facing,
        // Shooting arm: raises to a bent set point, then snaps straight overhead
        armR: {
          shoulder: [-1.0 - 1.4 * setT - 0.5 * relT, 0, -0.12],
          elbow: 1.9 * setT * (1 - relT) + 0.15 * relT,
        },
        // Guide hand: supports the ball, peels off at release
        armL: { shoulder: [-0.8 - 1.0 * setT * (1 - relT * 0.6), 0, 0.35], elbow: 1.1 * (1 - relT * 0.5) },
        legL: { hip: [-0.25 * airBend, 0, 0.04], knee: 0.5 * airBend },
        legR: { hip: [-0.25 * airBend, 0, -0.04], knee: 0.5 * airBend },
        headPitch: -0.35,
        ballHand: 'NONE',
      })

      // Ball: in the shooting hand until release, then a backspin arc to the rim
      if (a.t < a.releaseAt) {
        player.getHandWorldPos('R', a.releasePos)
        ball.setPosition(a.releasePos)
        ball.setSpin(1)
      } else {
        const u = Math.min(1, (a.t - a.releaseAt) / a.flightT)
        const arcH = Math.max(1.0, a.dist * 0.32)
        const target = a.made
          ? new THREE.Vector3(0, COURT.rimY - 0.02, 0)
          : new THREE.Vector3(0, COURT.rimY + 0.04, 0.21) // short — front iron
        if (u < 1) {
          ballPosRef.current.lerpVectors(a.releasePos, target, u)
          ballPosRef.current.y += arcH * Math.sin(u * Math.PI)
          ball.setPosition(ballPosRef.current)
          ball.setSpin(-2.5) // backspin
        } else {
          if (!a.resolved) {
            a.resolved = true
            if (a.made) onNetImpulse()
            const name = a.three ? '3점슛' : '점프슛'
            const spec: DunkSpec = {
              id: 'jumpshot', name, keys: ['SPACE'],
              maxDistance: 99, airTime: 0.8, spin: 0, armWindup: 0.2, twoHand: false,
              rimSide: 1, color: a.three ? '#FFD700' : '#9AE6B4',
              cue: '릴리즈 타이밍을 일정하게', difficulty: a.three ? 2 : 1,
            }
            const tier = a.made ? (a.three ? 'good' : 'normal') : 'miss'
            const points = a.made ? (a.three ? 45 : 25) : 0
            const grade = a.made ? (a.three ? 'A' : 'B') : 'D'
            onDunkEvent({
              spec, tier, points, grade, distance: a.dist,
              feedback: {
                dunkId: 'jumpshot', name, tier, points, approachGrade: grade,
                trainingCue: spec.cue, risk: '낮음', style: name, color: spec.color,
              },
            })
          }
          // After the rim: swish-drop + bounce on a make, ricochet out on a miss
          const pt = a.t - a.releaseAt - a.flightT
          if (a.made) {
            if (pt < 0.25) {
              ballPosRef.current.set(0, COURT.rimY - 0.02 - (pt / 0.25) * 0.6, 0)
              ball.setSpin(3)
            } else {
              const bounceT = Math.min(1, (pt - 0.25) / 1.1)
              const bounceY = Math.abs(Math.sin(bounceT * Math.PI * 1.5)) * 0.6 * (1 - bounceT)
              ballPosRef.current.set(0, 0.12 + bounceY, 0.5 + bounceT * 1.8)
              ball.setSpin(2)
            }
          } else {
            const u2 = Math.min(1, pt / 0.9)
            const y = Math.max(0.13, COURT.rimY + 0.04 + 1.0 * u2 - 4.6 * u2 * u2)
            ballPosRef.current.set(a.missX * u2, y, 0.21 + u2 * 2.6)
            ball.setSpin(4)
          }
          ball.setPosition(ballPosRef.current)
          if (pt > 1.3) actionRef.current = { kind: 'free' }
        }
      }
    }

    // ---- LAND ----
    if (actionRef.current.kind === 'land') {
      const a = actionRef.current
      a.t += dt
      const tn = Math.min(1, a.t / a.duration)
      const idle = makeIdlePose(a.facing)
      // Knee dip then recover — absorb hard on contact, ease back up (easeOutCubic)
      // so the landing reads as a real cushioned catch rather than a linear pop.
      const recover = 1 - Math.pow(1 - tn, 3)
      const dipAmount = (1 - recover) * 0.7
      player.setPose({
        ...idle,
        phase: 'land',
        legL: { hip: [-0.30 * dipAmount, 0, 0.05], knee: 0.55 * dipAmount },
        legR: { hip: [-0.30 * dipAmount, 0, -0.05], knee: 0.55 * dipAmount },
        bodyPitch: 0.10 * dipAmount,
      })
      if (a.t >= a.duration) actionRef.current = { kind: 'free' }
    }

    const k = actionRef.current.kind
    if (k !== 'flight' && k !== 'rimhang' && k !== 'shot') {
      player.group.position.set(pos.x, 0, pos.z)
    }

    // ---- NBA 2K-style broadcast camera ----
    const isAir = actionRef.current.kind === 'flight' || actionRef.current.kind === 'rimhang'
    const playerX = playerRef.current.group.position.x
    const playerY = playerRef.current.group.position.y
    const playerZ = playerRef.current.group.position.z

    // Street-ball third-person view that ALWAYS frames both the player and the
    // hoop: the camera tracks the player sideways and dollies out (with a
    // matching height rise) when the player drifts wide or deep, instead of
    // letting them walk off the edge of a fixed shot. On a dunk it swoops
    // down/in for the slam.
    const CAM_Y_DUNK  = 3.20
    const CAM_Z_DUNK  = 7.80
    // Dolly out: stay behind the player (playerZ + margin) and pull back as
    // they move toward the sidelines. 11.0 is the old fixed framing minimum.
    const camDist = Math.max(11.0, playerZ + 3.8, 9.5 + Math.abs(playerX) * 0.9)
    const CAM_Y_FREE = 5.0 * (camDist / 11.0)
    const camFollowX = playerX * 0.55
    const desiredCamPos = new THREE.Vector3(
      isAir ? THREE.MathUtils.clamp(playerX * 0.5, -2, 2) : camFollowX,
      isAir ? CAM_Y_DUNK : CAM_Y_FREE,
      isAir ? CAM_Z_DUNK : camDist,
    )

    // Free roam: aim at a point between the player and the hoop (biased toward
    // the player) so both stay on screen at any court position.
    const camTarget = new THREE.Vector3(
      isAir ? 0 : playerX * 0.5,
      isAir ? COURT.rimY + 0.10 + playerY * 0.10 : 1.15,
      isAir ? COURT.backboardZ + 0.15 : THREE.MathUtils.clamp(playerZ * 0.45, 0.8, 3.4),
    )

    // All camera easing is frame-rate independent so it feels identical on
    // 60Hz and 120Hz displays (the old fixed per-frame factors ran ~2× faster
    // on high-refresh screens, which is a classic source of "off" camera feel).
    camera.position.lerp(desiredCamPos, sm(isAir ? 9 : 5))
    // Slam impact: short decaying camera shake (paired with an FOV punch below)
    if (shakeRef.current > 0.002) {
      const s = shakeRef.current
      camera.position.x += (Math.random() - 0.5) * 0.13 * s
      camera.position.y += (Math.random() - 0.5) * 0.11 * s
      shakeRef.current = s * Math.exp(-7.5 * dt)
    }
    if (!(camera as { _lookTarget?: THREE.Vector3 })._lookTarget) {
      (camera as { _lookTarget?: THREE.Vector3 })._lookTarget = camTarget.clone()
    }
    const lt = (camera as unknown as { _lookTarget: THREE.Vector3 })._lookTarget
    lt.lerp(camTarget, sm(6.5))
    camera.lookAt(lt)
    if ('fov' in camera) {
      const persp = camera as THREE.PerspectiveCamera
      // FOV punch-in on slam impact (shake doubles as the punch envelope)
      const targetFov = (isAir ? 56 : 60) - shakeRef.current * 5
      if (Math.abs(persp.fov - targetFov) > 0.05) {
        persp.fov = THREE.MathUtils.lerp(persp.fov, targetFov, sm(6.5))
        persp.updateProjectionMatrix()
      }
    }
  })

  const [netImpulse, setNetImpulse] = useState(0)
  ;(GameWorld as unknown as { _setNetImpulse?: (n: number) => void })._setNetImpulse = setNetImpulse

  return (
    <>
      <Player3D ref={playerRef} />
      <Ball3D ref={ballRef} />
      <Hoop3D netImpulse={netImpulse} onDecay={setNetImpulse} />
    </>
  )
}

/** External hook: parent calls this to pulse the net. */
export function pulseNet() {
  ;(GameWorld as unknown as { _setNetImpulse?: (n: number) => void })._setNetImpulse?.(1.0)
}
