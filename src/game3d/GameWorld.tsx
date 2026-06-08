import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { COURT } from './Court3D'
import { Player3D, type PlayerHandle, type PlayerPose } from './Player3D'
import { Ball3D, type BallHandle } from './Ball3D'
import { Hoop3D } from './Hoop3D'
import { pickDunkFromKeys, resolveShot } from './dunkCatalog'
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
  | { kind: 'prep'; spec: DunkSpec; from: THREE.Vector3; t: number; duration: number; targetXZ: THREE.Vector3 }
  | { kind: 'flight'; spec: DunkSpec; from: THREE.Vector3; to: THREE.Vector3; t: number; duration: number; result: ReturnType<typeof resolveShot> | null }
  | { kind: 'land'; t: number; duration: number; pose: PlayerPose }

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
  const ballHeldRef = useRef(true)
  const ballPosRef = useRef(new THREE.Vector3())
  const dribblePhaseRef = useRef(0)
  const unlockedSetRef = useRef(new Set(unlockedDunkIds))
  unlockedSetRef.current = new Set(unlockedDunkIds)

  // Always keep basic_two
  useEffect(() => { unlockedSetRef.current.add('basic_two') }, [])

  useFrame((_, dt) => {
    const player = playerRef.current
    const ball = ballRef.current
    if (!player || !ball) return

    const action = actionRef.current
    const pos = playerPosRef.current

    // ---- Handle shoot trigger ----
    if (shootTrigger !== lastShootTriggerRef.current && action.kind === 'free') {
      lastShootTriggerRef.current = shootTrigger
      const mods = new Set<string>()
      for (const k of heldKeys) if (k !== 'SPACE') mods.add(k)
      const spec = pickDunkFromKeys(mods, unlockedSetRef.current)
      const rimXZ = new THREE.Vector3(0, 0, 0)
      const dist = pos.clone().setY(0).distanceTo(rimXZ)
      // For dunk attempt, player needs to be roughly within maxDistance.
      // We launch a flight arc from current pos toward rim approach point.
      const approachZ = Math.max(0.3, dist > spec.maxDistance ? 1.2 : 0.3 + Math.random() * 0.4)
      const targetXZ = new THREE.Vector3(0, 0, approachZ)
      actionRef.current = {
        kind: 'prep', spec, from: pos.clone(), t: 0,
        duration: 0.25, targetXZ,
      }
      // Halt running
      velRef.current.set(0, 0, 0)
    }

    // ---- Free movement ----
    if (actionRef.current.kind === 'free') {
      const moveSpeed = 6.0
      const v = velRef.current.set(0, 0, 0)
      // WORLD: -z is toward hoop. Up arrow / W = forward = toward hoop = -z
      if (heldKeys.has('ArrowUp') || heldKeys.has('FWD')) v.z -= 1
      if (heldKeys.has('ArrowDown') || heldKeys.has('BACK')) v.z += 1
      if (heldKeys.has('ArrowLeft') || heldKeys.has('LEFT')) v.x -= 1
      if (heldKeys.has('ArrowRight') || heldKeys.has('RIGHT')) v.x += 1
      if (v.lengthSq() > 0) {
        v.normalize().multiplyScalar(moveSpeed)
        pos.x += v.x * dt
        pos.z += v.z * dt
        // clamp to court
        pos.x = THREE.MathUtils.clamp(pos.x, -COURT.width / 2 + 0.5, COURT.width / 2 - 0.5)
        pos.z = THREE.MathUtils.clamp(pos.z, -0.5, COURT.length - 1)
        // face direction of movement, but if going forward keep facing hoop
        const angle = Math.atan2(-v.x, -v.z) // facing in -v
        facingRef.current = THREE.MathUtils.lerp(facingRef.current, angle, 0.2)
        strideRef.current += dt * 1.5
        player.setPose({
          phase: 'run', airT: 0, bodyYaw: 0, armReach: 0, armWindup: 0,
          dunkHand: 'R', betweenLegs: false, facing: facingRef.current, stride: strideRef.current,
        })
      } else {
        player.setPose({
          phase: 'idle', airT: 0, bodyYaw: 0, armReach: 0, armWindup: 0.05,
          dunkHand: 'R', betweenLegs: false, facing: facingRef.current, stride: 0,
        })
      }
      // Dribble ball next to player
      dribblePhaseRef.current += dt * 4
      const bounceY = Math.abs(Math.sin(dribblePhaseRef.current * Math.PI)) * 0.85
      const sideOffset = new THREE.Vector3(0.35, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRef.current)
      ballPosRef.current.set(pos.x + sideOffset.x, 0.12 + bounceY, pos.z + sideOffset.z)
      ball.setPosition(ballPosRef.current)
      ball.setSpin(2.0)
    }

    // ---- PREP phase: squat + lean toward rim ----
    if (actionRef.current.kind === 'prep') {
      const a = actionRef.current
      a.t += dt
      const tn = Math.min(1, a.t / a.duration)
      // Move slightly toward target during prep
      pos.lerpVectors(a.from, a.targetXZ.clone().setY(0), tn * 0.3)
      const dx = -a.targetXZ.x + a.from.x
      const dz = a.targetXZ.z - a.from.z
      facingRef.current = Math.atan2(-(a.targetXZ.x - a.from.x), -(a.targetXZ.z - a.from.z))
      void dx; void dz
      player.setPose({
        phase: 'prep', airT: 0, bodyYaw: 0,
        armReach: 0, armWindup: a.spec.armWindup * tn,
        dunkHand: a.spec.twoHand ? 'BOTH' : 'R',
        betweenLegs: false, facing: facingRef.current, stride: 0,
      })
      // ball stays in hand during prep
      ballHeldRef.current = true
      player.getHandWorldPos(a.spec.twoHand ? 'R' : 'R', ballPosRef.current)
      ball.setPosition(ballPosRef.current)
      ball.setSpin(0)
      if (tn >= 1) {
        // Decide outcome and start flight
        const distance = a.from.clone().setY(0).distanceTo(new THREE.Vector3(0, 0, 0))
        const timingError = Math.random() * 0.5 // TODO: real timing from SPACE release
        const result = resolveShot({ distance, spec: a.spec, timingError })
        actionRef.current = {
          kind: 'flight', spec: a.spec,
          from: pos.clone(),
          to: new THREE.Vector3(0, COURT.rimY, a.spec.rimSide === -1 ? -0.15 : 0.15),
          t: 0,
          duration: a.spec.airTime,
          result,
        }
      }
    }

    // ---- FLIGHT phase: parabolic jump → REAL RIM GRAB (slow-mo) → descent ----
    if (actionRef.current.kind === 'flight') {
      const a = actionRef.current
      // Slow-motion window: 0.42 < tn < 0.72 (the rim-grab moment)
      const tnRaw = a.t / a.duration
      const inGrab = tnRaw > 0.42 && tnRaw < 0.72
      const timeScale = inGrab ? 0.28 : 1.0
      a.t += dt * timeScale
      const tn = Math.min(1, a.t / a.duration)

      // --- Hop & approach: player's HAND must end up AT the rim ring ---
      // Rim center at (0, rimY=3.05, 0). Grab point for forward dunks: just above and forward of rim.
      // Player body is ~1.80m tall, fully-extended hand reaches ~0.95m above head (root+1.65).
      // So to put hand at rim, root.y at apex ≈ rimY - 1.65 + slamClearance.
      const slamClearance = 0.15 + a.spec.difficulty * 0.04   // higher tier = more hang time above
      const apexRootY = COURT.rimY - 1.65 + slamClearance      // ≈ 1.50–1.85m vertical leap
      // Position of player FEET during grab — front of rim for forward, behind rim for reverse
      const grabX = a.spec.id === 'three_sixty' ? 0 : (a.spec.twoHand ? 0 : 0.15)
      void grabX
      const grabZ = a.spec.rimSide === -1 ? -0.55 : 0.55   // reverse: behind rim, normal: front
      const grabPos = new THREE.Vector3(0, 0, grabZ)

      // Arc trajectory: from launch position → grab position → descent
      // Split into ascent (tn 0..0.5) and descent (tn 0.5..1.0)
      let rootX: number, rootY: number, rootZ: number
      if (tn < 0.5) {
        const u = tn / 0.5               // 0..1 ascent
        const ease = u * u * (3 - 2 * u) // smoothstep
        rootX = THREE.MathUtils.lerp(a.from.x, grabPos.x, ease)
        rootZ = THREE.MathUtils.lerp(a.from.z, grabPos.z, ease)
        rootY = apexRootY * Math.sin(u * Math.PI * 0.5)  // accelerating climb
      } else {
        const u = (tn - 0.5) / 0.5       // 0..1 descent
        const ease = u * u
        // Land slightly past rim in direction of motion (or back for reverse)
        const landZ = a.spec.rimSide === -1 ? grabPos.z - 1.0 : grabPos.z - 0.4
        rootX = THREE.MathUtils.lerp(grabPos.x, grabPos.x + (a.from.x > 0 ? -0.3 : 0.3), ease)
        rootZ = THREE.MathUtils.lerp(grabPos.z, landZ, ease)
        rootY = apexRootY * (1 - ease)
      }
      pos.x = rootX
      pos.z = rootZ
      player.group.position.set(rootX, rootY, rootZ)

      // Facing — for reverse, face away from hoop (toward +z) so back is to backboard
      const desiredFacing = a.spec.rimSide === -1
        ? 0                                      // face +z (away from hoop)
        : Math.atan2(-(grabPos.x - a.from.x), -(grabPos.z - a.from.z))
      facingRef.current = THREE.MathUtils.lerp(facingRef.current, desiredFacing, 0.25)

      // Body yaw spin (360, windmill, etc.) — spin during ascent and grab
      const spinProgress = tn < 0.7 ? tn / 0.7 : 1
      const bodyYaw = a.spec.spin * spinProgress * Math.PI * 2

      // Arm reach: fully extended during grab window
      const armReach = inGrab ? 1.0 : (tn < 0.42 ? tn / 0.42 : (1 - (tn - 0.72) / 0.28) * 0.6)
      const armWindup = tn < 0.2 ? a.spec.armWindup * (1 - tn / 0.2) : 0

      // Phase tag for Player3D — explicit 'apex' during grab for proper pose
      const phase: PlayerPose['phase'] = tn < 0.18 ? 'launch'
                                       : tn < 0.78 ? 'apex'
                                       : 'land'

      player.setPose({
        phase, airT: tn, bodyYaw,
        armReach, armWindup,
        dunkHand: a.spec.twoHand ? 'BOTH' : 'R',
        betweenLegs: a.spec.id === 'between_legs' && tn > 0.40 && tn < 0.65,
        facing: facingRef.current,
        stride: 0,
      })

      // --- Ball trajectory ---
      // Before grab: ball in hand (cocked back during windmill, etc.)
      // During grab (tn 0.42–0.55): ball slammed DOWN through rim
      // After grab (tn 0.55–0.72): ball drops through net
      // After release (tn > 0.72): ball bounces away
      if (tn < 0.42) {
        // Ball follows hand
        const handTarget = new THREE.Vector3()
        player.getHandWorldPos(a.spec.twoHand ? 'R' : 'R', handTarget)
        ball.setPosition(handTarget)
        ball.setSpin(a.spec.spin * 3 + 1.5)
      } else if (tn < 0.55) {
        // SLAM: ball goes from hand (above rim) → through rim center
        const slamT = (tn - 0.42) / 0.13
        const handY = COURT.rimY + 0.45
        ballPosRef.current.set(
          THREE.MathUtils.lerp(0, 0, slamT),
          THREE.MathUtils.lerp(handY, COURT.rimY - 0.05, slamT),
          THREE.MathUtils.lerp(grabZ * 0.3, 0, slamT),
        )
        ball.setPosition(ballPosRef.current)
        ball.setSpin(6)
        // Trigger net impulse exactly when ball passes through (once)
        if (slamT > 0.5 && !(a as any)._netPulsed) {
          ;(a as any)._netPulsed = true
          if (a.result && a.result.tier !== 'miss') onNetImpulse()
        }
      } else if (tn < 0.72) {
        // Ball drops through net
        const dropT = (tn - 0.55) / 0.17
        ballPosRef.current.set(0, COURT.rimY - 0.05 - dropT * 0.6, 0)
        ball.setPosition(ballPosRef.current)
        ball.setSpin(4)
      } else {
        // Ball bounces away on court
        const bounceT = (tn - 0.72) / 0.28
        const bounceY = Math.abs(Math.sin(bounceT * Math.PI * 1.5)) * 0.6 * (1 - bounceT)
        ballPosRef.current.set(0, 0.12 + bounceY, grabZ + bounceT * 1.8)
        ball.setPosition(ballPosRef.current)
        ball.setSpin(3)
      }

      if (tn >= 1) {
        const res = a.result!
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
        onDunkEvent({ spec: a.spec, tier: res.tier, points: res.points, grade: res.grade, distance: a.from.distanceTo(new THREE.Vector3()), feedback })
        player.group.position.set(pos.x, 0, pos.z)
        actionRef.current = { kind: 'land', t: 0, duration: 0.30, pose: {
          phase: 'land', airT: 0, bodyYaw: 0, armReach: 0.15, armWindup: 0,
          dunkHand: 'R', betweenLegs: false, facing: facingRef.current, stride: 0,
        }}
        ballHeldRef.current = true   // reset for next possession
      }
    }

    // ---- LAND phase ----
    if (actionRef.current.kind === 'land') {
      const a = actionRef.current
      a.t += dt
      player.setPose(a.pose)
      if (a.t >= a.duration) actionRef.current = { kind: 'free' }
    }

    // Update player root position when not in flight
    if (actionRef.current.kind !== 'flight') {
      player.group.position.set(pos.x, 0, pos.z)
    }

    // ---- NBA 2K-style 3rd-person broadcast camera ----
    // The previous "1st person eye-level" attempt felt claustrophobic because
    // the camera was AT character height (1.65m) and only 6.8m back, so the
    // character's back filled half the frame and the rim looked tiny far away.
    //
    // Real basketball broadcast/2K-cam:
    //   - Camera HIGH (3.2m, above the player's head, BELOW the rim 3.05m+net)
    //   - Camera FAR (10.5m back from court center)
    //   - Slight side-angle (x offset 1.5m) for 3/4 view — not pure rear
    //   - lookAt: rim height (2.6m, between player chest and rim) so both
    //     character AND rim sit in the frame
    //   - On dunk: pull in and lift for cinematic close-up
    const isAir = actionRef.current.kind === 'flight'
    const playerX = playerRef.current.group.position.x
    const playerY = playerRef.current.group.position.y

    // ---- Camera X follows player softly (camera leads slightly so player is in 1/3 rule) ----
    const camFollowX = THREE.MathUtils.clamp(playerX * 0.50, -2.0, 2.0)
    const targetX = THREE.MathUtils.clamp(playerX * 0.40, -1.6, 1.6)

    // ---- CAMERA POSITION (3/4 broadcast - middle ground) ----
    // Previous attempts:
    //   1) y=1.65 z=6.8 → felt 1st-person, character's back blocked view
    //   2) y=3.2 z=10.5 → way too far, char+rim only 0.4% of frame
    // Sweet spot: slightly above head (2.4m), close enough to see detail (7.5m),
    // wider FOV (58°) so vertical reach captures both player legs AND rim top
    const CAM_Y_FREE  = 2.40   // 0.7m above head 1.7m, 0.65m BELOW rim 3.05m
    const CAM_Y_DUNK  = 2.20   // dip slightly so we look UP at rim from below
    const CAM_Z_FREE  = 7.50   // close enough that player is 25% of vertical frame
    const CAM_Z_DUNK  = 5.50   // pull in further for cinematic dunk
    const CAM_X_OFFSET = 0.0   // pure rear for now
    const desiredCamPos = new THREE.Vector3(
      camFollowX + CAM_X_OFFSET,
      isAir ? CAM_Y_DUNK : CAM_Y_FREE,
      isAir ? CAM_Z_DUNK : CAM_Z_FREE,
    )

    // ---- CAMERA LOOK TARGET ----
    //   Free play → lookAt y=2.7 (just above player head, just below rim).
    //     Camera at 2.4m looking at 2.7m means tilting UP slightly →
    //     rim sits in upper 1/3, player fills middle/lower
    //   Dunk → look up at rim center (underside reveal)
    const camTarget = new THREE.Vector3(
      isAir ? 0 : targetX,
      isAir ? COURT.rimY + 0.10 + playerY * 0.10 : 2.70,
      isAir ? COURT.backboardZ + 0.15 : 0.0,
    )

    camera.position.lerp(desiredCamPos, isAir ? 0.14 : 0.08)
    if (!(camera as any)._lookTarget) (camera as any)._lookTarget = camTarget.clone()
    const lt = (camera as any)._lookTarget as THREE.Vector3
    lt.lerp(camTarget, 0.10)
    camera.lookAt(lt)
    if ('fov' in camera) {
      const persp = camera as THREE.PerspectiveCamera
      // FOV: 58° free play (wider so rim+player both fit), 50° dunk (compressed cinematic)
      const targetFov = isAir ? 50 : 58
      if (Math.abs(persp.fov - targetFov) > 0.05) {
        persp.fov = THREE.MathUtils.lerp(persp.fov, targetFov, 0.10)
        persp.updateProjectionMatrix()
      }
    }
  })

  // Net impulse for hoop
  const [netImpulse, setNetImpulse] = useState(0)
  // expose impulse setter via callback prop hack:
  ;(GameWorld as any)._setNetImpulse = setNetImpulse

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
  ;(GameWorld as any)._setNetImpulse?.(1.0)
}
