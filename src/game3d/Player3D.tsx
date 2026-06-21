import { useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export interface PlayerHandle {
  group: THREE.Group
  setPose: (pose: PlayerPose) => void
  getHandWorldPos: (hand: 'L' | 'R', target: THREE.Vector3) => THREE.Vector3
  /** Returns world position between the hips (useful for between-legs ball routing) */
  getCrotchWorldPos: (target: THREE.Vector3) => THREE.Vector3
}

/**
 * Full-body pose. Every dunk choreography writes into this struct each frame.
 *
 * Arms/legs are TWO-segment rigs:
 *   - shoulder/hip has 3-axis rotation [x, y, z]  (Euler XYZ)
 *   - elbow/knee is a single hinge angle (positive = bent)
 *
 * This lets us actually distinguish dunks visually:
 *   - windmill needs shoulder z swinging through ±π
 *   - tomahawk needs shoulder x ≈ -2.3rad (arm cocked behind head) + straight elbow snap
 *   - between-legs needs hips opening (hip[2] ±0.6) while knees bend
 *   - 360 needs body yaw to spin while arms swap which one is the dunk hand
 *   - reverse needs body to face away (yaw = π) and head to tilt back
 */
export interface PlayerPose {
  phase: 'idle' | 'run' | 'prep' | 'launch' | 'apex' | 'land'
  airT: number
  bodyYaw: number
  bodyPitch: number
  bodyRoll: number
  facing: number
  stride: number
  armL: { shoulder: [number, number, number]; elbow: number }
  armR: { shoulder: [number, number, number]; elbow: number }
  legL: { hip: [number, number, number]; knee: number }
  legR: { hip: [number, number, number]; knee: number }
  headPitch: number
  headYaw: number
  ballHand: 'L' | 'R' | 'BOTH' | 'NONE'
  betweenLegs: boolean
}

interface Player3DProps {
  jerseyColor?: string
  shortsColor?: string
  skinColor?: string
}

export function makeIdlePose(facing = Math.PI): PlayerPose {
  return {
    phase: 'idle', airT: 0,
    bodyYaw: 0, bodyPitch: 0, bodyRoll: 0,
    facing, stride: 0,
    armL: { shoulder: [0.05, 0, 0.15], elbow: 0.25 },
    armR: { shoulder: [0.05, 0, -0.15], elbow: 0.25 },
    legL: { hip: [0, 0, 0], knee: 0 },
    legR: { hip: [0, 0, 0], knee: 0 },
    headPitch: 0, headYaw: 0,
    ballHand: 'R', betweenLegs: false,
  }
}

export const Player3D = forwardRef<PlayerHandle, Player3DProps>(function Player3D(
  { jerseyColor = '#FF4D1F', shortsColor = '#FFFFFF', skinColor = '#D9A074' },
  ref,
) {
  const root = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Group>(null!)
  const head = useRef<THREE.Group>(null!)
  const shoulderL = useRef<THREE.Group>(null!)
  const shoulderR = useRef<THREE.Group>(null!)
  const elbowL = useRef<THREE.Group>(null!)
  const elbowR = useRef<THREE.Group>(null!)
  const handL = useRef<THREE.Object3D>(null!)
  const handR = useRef<THREE.Object3D>(null!)
  const hipL = useRef<THREE.Group>(null!)
  const hipR = useRef<THREE.Group>(null!)
  const kneeL = useRef<THREE.Group>(null!)
  const kneeR = useRef<THREE.Group>(null!)
  const crotchRef = useRef<THREE.Object3D>(null!)

  const poseRef = useRef<PlayerPose>(makeIdlePose())

  // ---- Smoothing state ----------------------------------------------------
  // Every joint is eased toward its target with frame-rate-independent
  // exponential damping. This rounds off the hard cuts that used to happen at
  // every phase boundary (free→prep→flight→land) and at the slow-mo edges,
  // which is what made the animation read as "snappy / robotic".
  //
  // `cur` holds the CURRENTLY DISPLAYED scalar for each animated channel.
  // We snap it to the idle pose on first frame so there's no ease-in at spawn.
  const cur = useRef({
    bRotX: 0, bRotY: Math.PI, bRotZ: 0, bPosY: 0.95,
    sLx: 0.05, sLy: 0, sLz: 0.15, eL: 0.25,
    sRx: 0.05, sRy: 0, sRz: -0.15, eR: 0.25,
    hLx: 0, hLy: 0, hLz: 0, kL: 0,
    hRx: 0, hRy: 0, hRz: 0, kR: 0,
    hdX: 0, hdY: 0,
  })
  const initialized = useRef(false)

  useImperativeHandle(ref, () => ({
    group: root.current,
    setPose(p) { poseRef.current = p },
    getHandWorldPos(hand, target) {
      const o = hand === 'L' ? handL.current : handR.current
      o?.getWorldPosition(target)
      return target
    },
    getCrotchWorldPos(target) {
      crotchRef.current?.getWorldPosition(target)
      return target
    },
  }))

  useFrame((_, dt) => {
    const p = poseRef.current
    if (!body.current) return

    // ---- Build the TARGET pose (numbers only) ----------------------------
    // Body rotation: yaw from facing+choreography, pitch=lean fwd/back, roll=tilt
    let tBodyRotY = p.facing + p.bodyYaw
    let tBodyRotX = p.bodyPitch
    let tBodyRotZ = p.bodyRoll

    // Squat / hop / land dip
    let bodyDip = 0
    if (p.phase === 'prep') bodyDip = -0.28
    else if (p.phase === 'land') bodyDip = -0.12
    let tBodyPosY = 0.95 + bodyDip

    let tSL: [number, number, number] = p.armL.shoulder
    let tSR: [number, number, number] = p.armR.shoulder
    let tEL = p.armL.elbow
    let tER = p.armR.elbow
    let tHL: [number, number, number] = p.legL.hip
    let tHR: [number, number, number] = p.legR.hip
    let tKL = p.legL.knee
    let tKR = p.legR.knee

    // Running gait — sample sine for stride, overrides limb targets
    if (p.phase === 'run' && p.stride !== 0) {
      const s = Math.sin(p.stride * Math.PI * 2)
      tHL = [s * 0.6, 0, 0]
      tHR = [-s * 0.6, 0, 0]
      tKL = Math.max(0, -s * 0.5)
      tKR = Math.max(0, s * 0.5)
      tSL = [-s * 0.4, 0, 0.15]
      tSR = [s * 0.4, 0, -0.15]
      tEL = 0.5
      tER = 0.5
    }

    // ---- Frame-rate-independent exponential damping ----------------------
    // a = 1 - e^(-rate*dt). Higher rate = snappier. ~26 ≈ 38ms time constant:
    // fast enough to read every keyframe of a 0.5–0.9s dunk, slow enough to
    // erase the sub-frame discontinuities at phase changes.
    const c = cur.current
    if (!initialized.current) {
      // First frame: snap straight to target, no ease-in.
      initialized.current = true
      c.bRotX = tBodyRotX; c.bRotY = tBodyRotY; c.bRotZ = tBodyRotZ; c.bPosY = tBodyPosY
      c.sLx = tSL[0]; c.sLy = tSL[1]; c.sLz = tSL[2]; c.eL = tEL
      c.sRx = tSR[0]; c.sRy = tSR[1]; c.sRz = tSR[2]; c.eR = tER
      c.hLx = tHL[0]; c.hLy = tHL[1]; c.hLz = tHL[2]; c.kL = tKL
      c.hRx = tHR[0]; c.hRy = tHR[1]; c.hRz = tHR[2]; c.kR = tKR
      c.hdX = p.headPitch; c.hdY = p.headYaw
    }
    const LIMB = 1 - Math.exp(-26 * dt)   // arms / legs / head
    const BODY = 1 - Math.exp(-30 * dt)   // torso position+rotation (a touch snappier)
    const k = (a: number, b: number, t: number) => a + (b - a) * t

    c.bRotX = k(c.bRotX, tBodyRotX, BODY)
    c.bRotY = k(c.bRotY, tBodyRotY, BODY)
    c.bRotZ = k(c.bRotZ, tBodyRotZ, BODY)
    c.bPosY = k(c.bPosY, tBodyPosY, BODY)
    c.sLx = k(c.sLx, tSL[0], LIMB); c.sLy = k(c.sLy, tSL[1], LIMB); c.sLz = k(c.sLz, tSL[2], LIMB); c.eL = k(c.eL, tEL, LIMB)
    c.sRx = k(c.sRx, tSR[0], LIMB); c.sRy = k(c.sRy, tSR[1], LIMB); c.sRz = k(c.sRz, tSR[2], LIMB); c.eR = k(c.eR, tER, LIMB)
    c.hLx = k(c.hLx, tHL[0], LIMB); c.hLy = k(c.hLy, tHL[1], LIMB); c.hLz = k(c.hLz, tHL[2], LIMB); c.kL = k(c.kL, tKL, LIMB)
    c.hRx = k(c.hRx, tHR[0], LIMB); c.hRy = k(c.hRy, tHR[1], LIMB); c.hRz = k(c.hRz, tHR[2], LIMB); c.kR = k(c.kR, tKR, LIMB)
    c.hdX = k(c.hdX, p.headPitch, LIMB); c.hdY = k(c.hdY, p.headYaw, LIMB)

    // ---- Apply the (smoothed) current pose -------------------------------
    body.current.rotation.order = 'YXZ'
    body.current.rotation.set(c.bRotX, c.bRotY, c.bRotZ)
    body.current.position.y = c.bPosY

    shoulderL.current.rotation.set(c.sLx, c.sLy, c.sLz)
    shoulderR.current.rotation.set(c.sRx, c.sRy, c.sRz)
    elbowL.current.rotation.x = c.eL
    elbowR.current.rotation.x = c.eR

    hipL.current.rotation.set(c.hLx, c.hLy, c.hLz)
    hipR.current.rotation.set(c.hRx, c.hRy, c.hRz)
    kneeL.current.rotation.x = c.kL
    kneeR.current.rotation.x = c.kR

    head.current.rotation.x = c.hdX
    head.current.rotation.y = c.hdY
  })

  // Shared smooth materials
  const skinMat = <meshStandardMaterial color={skinColor} roughness={0.55} metalness={0.02} />
  const jerseyMat = <meshStandardMaterial color={jerseyColor} roughness={0.62} metalness={0.05} />
  const shortsMat = <meshStandardMaterial color={shortsColor} roughness={0.7} metalness={0.04} />
  const shoeMat = <meshStandardMaterial color="#0A0A0A" roughness={0.35} metalness={0.15} />
  const hairMat = <meshStandardMaterial color="#1A1A1A" roughness={0.85} />

  return (
    <group ref={root}>
      <group ref={body} position={[0, 0.95, 0]}>
        {/* Torso */}
        <mesh castShadow position={[0, 0.05, 0]}>
          <capsuleGeometry args={[0.22, 0.32, 8, 16]} />
          {jerseyMat}
        </mesh>
        {/* Chest highlight */}
        <mesh position={[0, 0.10, 0.20]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.8} />
        </mesh>
        {/* Neck */}
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.08, 12]} />
          {skinMat}
        </mesh>
        {/* Shorts */}
        <mesh position={[0, -0.30, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.22, 0.28, 18]} />
          {shortsMat}
        </mesh>
        <mesh position={[0, -0.15, 0]}>
          <sphereGeometry args={[0.23, 18, 14]} />
          {shortsMat}
        </mesh>

        {/* Crotch reference (for between-legs ball routing) */}
        <object3D ref={crotchRef} position={[0, -0.42, 0]} />

        {/* Head */}
        <group ref={head} position={[0, 0.50, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.135, 22, 22]} />
            {skinMat}
          </mesh>
          <mesh position={[0, 0.03, -0.01]} rotation={[0.1, 0, 0]}>
            <sphereGeometry args={[0.142, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            {hairMat}
          </mesh>
          <mesh position={[-0.045, 0.01, 0.115]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshBasicMaterial color="#0A0A0A" />
          </mesh>
          <mesh position={[0.045, 0.01, 0.115]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshBasicMaterial color="#0A0A0A" />
          </mesh>
          <mesh position={[0, -0.02, 0.128]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            {skinMat}
          </mesh>
        </group>

        {/* LEFT ARM — shoulder group + elbow group + hand */}
        <group ref={shoulderL} position={[-0.26, 0.18, 0]}>
          {/* Shoulder cap */}
          <mesh position={[0, -0.02, 0]}>
            <sphereGeometry args={[0.085, 16, 16]} />
            {skinMat}
          </mesh>
          {/* Upper arm (capsule, pointing down from shoulder) */}
          <mesh position={[0, -0.13, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.18, 6, 12]} />
            {skinMat}
          </mesh>
          {/* Elbow pivot at end of upper arm */}
          <group ref={elbowL} position={[0, -0.26, 0]}>
            {/* Elbow joint sphere */}
            <mesh>
              <sphereGeometry args={[0.057, 12, 12]} />
              {skinMat}
            </mesh>
            {/* Forearm (capsule down from elbow) */}
            <mesh position={[0, -0.13, 0]} castShadow>
              <capsuleGeometry args={[0.05, 0.18, 6, 12]} />
              {skinMat}
            </mesh>
            {/* Hand */}
            <mesh ref={handL as React.MutableRefObject<THREE.Mesh>} position={[0, -0.27, 0]} castShadow>
              <sphereGeometry args={[0.072, 14, 14]} />
              {skinMat}
            </mesh>
          </group>
        </group>

        {/* RIGHT ARM */}
        <group ref={shoulderR} position={[0.26, 0.18, 0]}>
          <mesh position={[0, -0.02, 0]}>
            <sphereGeometry args={[0.085, 16, 16]} />
            {skinMat}
          </mesh>
          <mesh position={[0, -0.13, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.18, 6, 12]} />
            {skinMat}
          </mesh>
          <group ref={elbowR} position={[0, -0.26, 0]}>
            <mesh>
              <sphereGeometry args={[0.057, 12, 12]} />
              {skinMat}
            </mesh>
            <mesh position={[0, -0.13, 0]} castShadow>
              <capsuleGeometry args={[0.05, 0.18, 6, 12]} />
              {skinMat}
            </mesh>
            <mesh ref={handR as React.MutableRefObject<THREE.Mesh>} position={[0, -0.27, 0]} castShadow>
              <sphereGeometry args={[0.072, 14, 14]} />
              {skinMat}
            </mesh>
          </group>
        </group>

        {/* LEFT LEG — hip group + knee group + shoe */}
        <group ref={hipL} position={[-0.10, -0.45, 0]}>
          {/* Thigh */}
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.077, 0.22, 6, 12]} />
            {skinMat}
          </mesh>
          {/* Knee pivot */}
          <group ref={kneeL} position={[0, -0.30, 0]}>
            <mesh position={[0, 0, 0.02]}>
              <sphereGeometry args={[0.075, 14, 14]} />
              {skinMat}
            </mesh>
            {/* Calf */}
            <mesh position={[0, -0.16, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.22, 6, 12]} />
              {skinMat}
            </mesh>
            {/* Shoe */}
            <group position={[0, -0.34, 0.04]}>
              <mesh castShadow scale={[1, 0.55, 1.6]}>
                <sphereGeometry args={[0.085, 18, 14]} />
                {shoeMat}
              </mesh>
              <mesh position={[0, -0.04, 0]} scale={[1, 0.18, 1.6]}>
                <sphereGeometry args={[0.085, 18, 10]} />
                <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
              </mesh>
            </group>
          </group>
        </group>

        {/* RIGHT LEG */}
        <group ref={hipR} position={[0.10, -0.45, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.077, 0.22, 6, 12]} />
            {skinMat}
          </mesh>
          <group ref={kneeR} position={[0, -0.30, 0]}>
            <mesh position={[0, 0, 0.02]}>
              <sphereGeometry args={[0.075, 14, 14]} />
              {skinMat}
            </mesh>
            <mesh position={[0, -0.16, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.22, 6, 12]} />
              {skinMat}
            </mesh>
            <group position={[0, -0.34, 0.04]}>
              <mesh castShadow scale={[1, 0.55, 1.6]}>
                <sphereGeometry args={[0.085, 18, 14]} />
                {shoeMat}
              </mesh>
              <mesh position={[0, -0.04, 0]} scale={[1, 0.18, 1.6]}>
                <sphereGeometry args={[0.085, 18, 10]} />
                <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* Ground shadow blob */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.42, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.32} />
      </mesh>
    </group>
  )
})
