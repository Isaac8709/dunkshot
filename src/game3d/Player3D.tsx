import { useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export interface PlayerHandle {
  group: THREE.Group
  setPose: (pose: PlayerPose) => void
  getHandWorldPos: (hand: 'L' | 'R', target: THREE.Vector3) => THREE.Vector3
}

export interface PlayerPose {
  phase: 'idle' | 'run' | 'prep' | 'launch' | 'apex' | 'land'
  airT: number
  bodyYaw: number
  armReach: number
  armWindup: number
  dunkHand: 'L' | 'R' | 'BOTH'
  betweenLegs: boolean
  facing: number
  stride: number
}

interface Player3DProps {
  jerseyColor?: string
  shortsColor?: string
  skinColor?: string
}

/**
 * Smooth-shaded humanoid built from capsules + spheres.
 * Rounded silhouette, soft normals, no boxy "computer-made" look.
 */
export const Player3D = forwardRef<PlayerHandle, Player3DProps>(function Player3D(
  { jerseyColor = '#FF4D1F', shortsColor = '#FFFFFF', skinColor = '#D9A074' },
  ref,
) {
  const root = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Group>(null!)
  const head = useRef<THREE.Group>(null!)
  const armL = useRef<THREE.Group>(null!)
  const armR = useRef<THREE.Group>(null!)
  const handL = useRef<THREE.Object3D>(null!)
  const handR = useRef<THREE.Object3D>(null!)
  const legL = useRef<THREE.Group>(null!)
  const legR = useRef<THREE.Group>(null!)

  const poseRef = useRef<PlayerPose>({
    phase: 'idle', airT: 0, bodyYaw: 0, armReach: 0, armWindup: 0,
    dunkHand: 'R', betweenLegs: false, facing: 0, stride: 0,
  })

  useImperativeHandle(ref, () => ({
    group: root.current,
    setPose(p) { poseRef.current = p },
    getHandWorldPos(hand, target) {
      const o = hand === 'L' ? handL.current : handR.current
      o?.getWorldPosition(target)
      return target
    },
  }))

  useFrame(() => {
    const p = poseRef.current
    if (!body.current) return

    body.current.rotation.y = p.facing + p.bodyYaw

    let kneeBend = 0
    let bodyDip = 0
    if (p.phase === 'prep') { kneeBend = 1.0; bodyDip = -0.25 }
    else if (p.phase === 'launch') { kneeBend = 0.3; bodyDip = 0 }
    else if (p.phase === 'apex' || p.phase === 'land') { kneeBend = 0.1; bodyDip = 0 }
    else if (p.phase === 'run') {
      const s = Math.sin(p.stride * Math.PI * 2)
      legL.current.rotation.x = s * 0.6
      legR.current.rotation.x = -s * 0.6
      armL.current.rotation.x = -s * 0.4
      armR.current.rotation.x = s * 0.4
      kneeBend = 0.15
    }

    if (p.phase !== 'run') {
      legL.current.rotation.x = kneeBend * 0.6
      legR.current.rotation.x = kneeBend * 0.6
    }

    body.current.position.y = 0.95 + bodyDip

    if (p.phase === 'apex') {
      const tuck = p.betweenLegs ? 1.0 : 0.4
      legL.current.rotation.x = -1.2 * tuck
      legR.current.rotation.x = -1.2 * tuck
      body.current.position.y = 0.95 + 0.05
    }

    const reachAngle = -Math.PI * 0.95 * p.armReach
    const windupAngle = Math.PI * 0.75 * p.armWindup

    if (p.dunkHand === 'BOTH') {
      armL.current.rotation.x = reachAngle - windupAngle * 0.3
      armR.current.rotation.x = reachAngle - windupAngle * 0.3
      armL.current.rotation.z = 0.1
      armR.current.rotation.z = -0.1
    } else if (p.dunkHand === 'R') {
      armR.current.rotation.x = reachAngle - windupAngle
      armR.current.rotation.z = -0.1 - p.armWindup * 0.4
      armL.current.rotation.x = p.phase === 'apex' ? -0.8 : (p.phase === 'run' ? armL.current.rotation.x : 0.1)
      armL.current.rotation.z = 0.2
    } else {
      armL.current.rotation.x = reachAngle - windupAngle
      armL.current.rotation.z = 0.1 + p.armWindup * 0.4
      armR.current.rotation.x = p.phase === 'apex' ? -0.8 : (p.phase === 'run' ? armR.current.rotation.x : 0.1)
      armR.current.rotation.z = -0.2
    }

    head.current.rotation.x = p.phase === 'apex' ? -0.3 : 0
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
        {/* Torso — capsule for smooth shoulders/waist */}
        <mesh castShadow position={[0, 0.05, 0]}>
          <capsuleGeometry args={[0.22, 0.32, 8, 16]} />
          {jerseyMat}
        </mesh>
        {/* Chest highlight (jersey number area) */}
        <mesh position={[0, 0.10, 0.20]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.8} />
        </mesh>

        {/* Neck */}
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.08, 12]} />
          {skinMat}
        </mesh>

        {/* Shorts — slightly flared cylinder */}
        <mesh position={[0, -0.30, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.22, 0.28, 18]} />
          {shortsMat}
        </mesh>
        {/* Hip blend */}
        <mesh position={[0, -0.15, 0]}>
          <sphereGeometry args={[0.23, 18, 14]} />
          {shortsMat}
        </mesh>

        {/* Head */}
        <group ref={head} position={[0, 0.50, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.135, 22, 22]} />
            {skinMat}
          </mesh>
          {/* Hair cap — half sphere */}
          <mesh position={[0, 0.03, -0.01]} rotation={[0.1, 0, 0]}>
            <sphereGeometry args={[0.142, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            {hairMat}
          </mesh>
          {/* Eyes — small smooth spheres */}
          <mesh position={[-0.045, 0.01, 0.115]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshBasicMaterial color="#0A0A0A" />
          </mesh>
          <mesh position={[0.045, 0.01, 0.115]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshBasicMaterial color="#0A0A0A" />
          </mesh>
          {/* Nose hint */}
          <mesh position={[0, -0.02, 0.128]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            {skinMat}
          </mesh>
        </group>

        {/* Left arm — pivot at shoulder, capsule for smooth limb */}
        <group ref={armL} position={[-0.26, 0.18, 0]}>
          {/* Shoulder cap */}
          <mesh position={[0, -0.02, 0]}>
            <sphereGeometry args={[0.085, 16, 16]} />
            {skinMat}
          </mesh>
          {/* Upper + lower arm in one capsule */}
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.42, 6, 12]} />
            {skinMat}
          </mesh>
          {/* Hand — sphere */}
          <mesh ref={handL as React.MutableRefObject<THREE.Mesh>} position={[0, -0.52, 0]} castShadow>
            <sphereGeometry args={[0.072, 14, 14]} />
            {skinMat}
          </mesh>
        </group>

        {/* Right arm */}
        <group ref={armR} position={[0.26, 0.18, 0]}>
          <mesh position={[0, -0.02, 0]}>
            <sphereGeometry args={[0.085, 16, 16]} />
            {skinMat}
          </mesh>
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.42, 6, 12]} />
            {skinMat}
          </mesh>
          <mesh ref={handR as React.MutableRefObject<THREE.Mesh>} position={[0, -0.52, 0]} castShadow>
            <sphereGeometry args={[0.072, 14, 14]} />
            {skinMat}
          </mesh>
        </group>

        {/* Left leg */}
        <group ref={legL} position={[-0.10, -0.45, 0]}>
          {/* Thigh + calf capsule */}
          <mesh position={[0, -0.30, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.52, 6, 12]} />
            {skinMat}
          </mesh>
          {/* Knee bump */}
          <mesh position={[0, -0.28, 0.03]}>
            <sphereGeometry args={[0.075, 14, 14]} />
            {skinMat}
          </mesh>
          {/* Shoe — rounded box (use sphere stretched) */}
          <group position={[0, -0.64, 0.04]}>
            <mesh castShadow scale={[1, 0.55, 1.6]}>
              <sphereGeometry args={[0.085, 18, 14]} />
              {shoeMat}
            </mesh>
            {/* sole stripe */}
            <mesh position={[0, -0.04, 0]} scale={[1, 0.18, 1.6]}>
              <sphereGeometry args={[0.085, 18, 10]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
            </mesh>
          </group>
        </group>

        {/* Right leg */}
        <group ref={legR} position={[0.10, -0.45, 0]}>
          <mesh position={[0, -0.30, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.52, 6, 12]} />
            {skinMat}
          </mesh>
          <mesh position={[0, -0.28, 0.03]}>
            <sphereGeometry args={[0.075, 14, 14]} />
            {skinMat}
          </mesh>
          <group position={[0, -0.64, 0.04]}>
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

      {/* Soft shadow blob (extra under-character grounding) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.42, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.32} />
      </mesh>
    </group>
  )
})
