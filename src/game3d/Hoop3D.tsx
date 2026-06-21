import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { COURT } from './Court3D'

interface Hoop3DProps {
  /** 0..1 net flutter intensity (set briefly on score) */
  netImpulse: number
  /** call to decay impulse from parent — or we self-decay via useFrame */
  onDecay?: (next: number) => void
}

/**
 * NBA-spec hoop with real hardware:
 *   - Tempered glass backboard with white frame + shooter's square
 *   - Orange L-bracket mounting arm
 *   - Orange breakaway rim with 12 net-attachment hooks
 *   - 12-strand nylon net using tube geometry (visible from distance)
 *   - Shock cord visible on breakaway hinge
 */
export function Hoop3D({ netImpulse, onDecay }: Hoop3DProps) {
  // Glass backboard — slightly tinted, semi-transparent
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#B8DDF5',
    metalness: 0,
    roughness: 0.05,
    transmission: 0.55,
    thickness: 0.04,
    transparent: true,
    opacity: 0.55,
    ior: 1.4,
  }), [])

  // ---------- Net as TUBE strands (visible from camera distance) ----------
  const NET_STRANDS = 14
  const NET_RINGS = 7
  const NET_DROP = 0.46          // longer net hang (NBA spec ~46 cm)
  const TAPER = 0.28             // tapers inward toward bottom
  const STRAND_RADIUS = 0.0075   // thicker tube — reads clearly from low angle

  // Build strand geometries (one strand = N tube segments curving down)
  const netGeometries = useMemo(() => {
    const geoms: THREE.TubeGeometry[] = []
    for (let s = 0; s < NET_STRANDS; s++) {
      const angle = (s / NET_STRANDS) * Math.PI * 2
      const pts: THREE.Vector3[] = []
      for (let r = 0; r <= NET_RINGS; r++) {
        const t = r / NET_RINGS
        const radius = COURT.rimRadius * (1 - t * TAPER)
        const y = -t * NET_DROP
        pts.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius))
      }
      const curve = new THREE.CatmullRomCurve3(pts)
      geoms.push(new THREE.TubeGeometry(curve, 12, STRAND_RADIUS, 5, false))
    }
    return geoms
  }, [])

  // Build horizontal hoop rings of the net (also visible)
  const netRingGeometries = useMemo(() => {
    const geoms: THREE.TorusGeometry[] = []
    for (let r = 1; r <= NET_RINGS; r++) {
      const t = r / NET_RINGS
      const radius = COURT.rimRadius * (1 - t * TAPER)
      geoms.push(new THREE.TorusGeometry(radius, STRAND_RADIUS * 0.8, 4, NET_STRANDS))
    }
    return geoms
  }, [])

  // ---------- Rim with 12 net-hook tabs ----------
  const hookPositions = useMemo(() => {
    const arr: { x: number; z: number; angle: number }[] = []
    for (let i = 0; i < NET_STRANDS; i++) {
      const a = (i / NET_STRANDS) * Math.PI * 2
      arr.push({
        x: Math.cos(a) * COURT.rimRadius,
        z: Math.sin(a) * COURT.rimRadius,
        angle: a,
      })
    }
    return arr
  }, [])

  // Animation refs
  const netGroupRef = useRef<THREE.Group>(null!)
  const rimRef = useRef<THREE.Mesh>(null!)
  const backboardRef = useRef<THREE.Mesh>(null!)
  const decayRef = useRef(netImpulse)
  decayRef.current = netImpulse

  useFrame((_, dt) => {
    if (decayRef.current > 0.001) {
      decayRef.current = Math.max(0, decayRef.current - dt * 2.2)
      onDecay?.(decayRef.current)
    }
    const flutter = decayRef.current
    const t = performance.now() * 0.001

    if (netGroupRef.current) {
      // net swings on impulse
      netGroupRef.current.rotation.x = Math.sin(t * 14) * 0.10 * flutter
      netGroupRef.current.rotation.z = Math.cos(t * 13) * 0.10 * flutter
      netGroupRef.current.scale.y = 1 + Math.sin(t * 22) * 0.20 * flutter
    }
    if (rimRef.current) {
      // breakaway rim hinge: tilts down on dunk impact
      rimRef.current.rotation.x = -Math.max(0, Math.sin(t * 18)) * 0.18 * flutter
      rimRef.current.position.y = COURT.rimY - 0.04 * flutter
    }
    if (backboardRef.current) {
      // backboard shakes
      backboardRef.current.position.x = Math.sin(t * 26) * 0.012 * flutter
      backboardRef.current.position.y = COURT.rimY + 0.35 + Math.cos(t * 24) * 0.008 * flutter
    }
  })

  // Hardware colors
  const orange = '#FF5A1F'
  const orangeEmissive = '#FF3008'
  const metal = '#1C2230'
  const netColor = '#F8F8F8'

  return (
    <group position={[0, 0, 0]}>
      {/* ─── Stanchion (the steel pole holding everything) ─── */}
      {/* Base plate on floor */}
      <mesh position={[0, 0.06, COURT.backboardZ - 1.3]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.65, 0.12, 24]} />
        <meshStandardMaterial color={metal} metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Vertical pole */}
      <mesh position={[0, COURT.rimY * 0.55, COURT.backboardZ - 1.3]} castShadow>
        <cylinderGeometry args={[0.10, 0.13, COURT.rimY * 1.1, 16]} />
        <meshStandardMaterial color={metal} metalness={0.75} roughness={0.30} />
      </mesh>
      {/* Diagonal brace from pole to backboard top */}
      <mesh
        position={[0, COURT.rimY + 0.55, COURT.backboardZ - 0.55]}
        rotation={[Math.PI * 0.18, 0, 0]}
        castShadow
      >
        <boxGeometry args={[0.10, 1.10, 0.12]} />
        <meshStandardMaterial color={metal} metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Horizontal arm to backboard (the "extension arm") */}
      <mesh position={[0, COURT.rimY + 0.25, COURT.backboardZ - 0.55]} castShadow>
        <boxGeometry args={[0.16, 0.12, 1.1]} />
        <meshStandardMaterial color={metal} metalness={0.7} roughness={0.35} />
      </mesh>

      {/* ─── Backboard (tempered glass) ─── */}
      <mesh
        ref={backboardRef}
        position={[0, COURT.rimY + 0.35, COURT.backboardZ]}
        castShadow
      >
        <boxGeometry args={[COURT.backboardWidth, COURT.backboardHeight, 0.05]} />
        <primitive object={glassMat} attach="material" />
      </mesh>
      {/* Backboard padding strip (orange foam at bottom edge) */}
      <mesh position={[0, COURT.rimY + 0.35 - COURT.backboardHeight / 2 + 0.03, COURT.backboardZ]} castShadow>
        <boxGeometry args={[COURT.backboardWidth, 0.06, 0.08]} />
        <meshStandardMaterial color="#222" roughness={0.9} />
      </mesh>
      {/* White backboard frame (border) — built from 4 thin boxes for clarity */}
      {[
        { pos: [0, COURT.backboardHeight / 2 - 0.025, 0.028] as [number, number, number], size: [COURT.backboardWidth, 0.05, 0.012] as [number, number, number] },
        { pos: [0, -COURT.backboardHeight / 2 + 0.025, 0.028] as [number, number, number], size: [COURT.backboardWidth, 0.05, 0.012] as [number, number, number] },
        { pos: [-COURT.backboardWidth / 2 + 0.025, 0, 0.028] as [number, number, number], size: [0.05, COURT.backboardHeight, 0.012] as [number, number, number] },
        { pos: [COURT.backboardWidth / 2 - 0.025, 0, 0.028] as [number, number, number], size: [0.05, COURT.backboardHeight, 0.012] as [number, number, number] },
      ].map((s, i) => (
        <mesh key={`bf${i}`} position={[s.pos[0], COURT.rimY + 0.35 + s.pos[1], COURT.backboardZ + s.pos[2]]}>
          <boxGeometry args={s.size} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.1} />
        </mesh>
      ))}
      {/* Shooter's square (the small white rectangle above rim) */}
      {[
        { pos: [0, 0.42, 0] as [number, number, number], size: [0.59, 0.04, 0.012] as [number, number, number] }, // top
        { pos: [0, 0.02, 0] as [number, number, number], size: [0.59, 0.04, 0.012] as [number, number, number] }, // bottom
        { pos: [-0.275, 0.22, 0] as [number, number, number], size: [0.04, 0.40, 0.012] as [number, number, number] }, // left
        { pos: [0.275, 0.22, 0] as [number, number, number], size: [0.04, 0.40, 0.012] as [number, number, number] }, // right
      ].map((s, i) => (
        <mesh key={`sq${i}`} position={[s.pos[0], COURT.rimY + s.pos[1] - 0.05, COURT.backboardZ + 0.029]}>
          <boxGeometry args={s.size} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.15} />
        </mesh>
      ))}

      {/* ─── Rim mounting bracket (orange L-plate) ─── */}
      <mesh position={[0, COURT.rimY, COURT.backboardZ + 0.06]} castShadow>
        <boxGeometry args={[0.20, 0.12, 0.20]} />
        <meshStandardMaterial color={orange} metalness={0.4} roughness={0.45} emissive={orangeEmissive} emissiveIntensity={0.1} />
      </mesh>
      {/* Breakaway hinge cylinder visible behind rim */}
      <mesh
        position={[0, COURT.rimY + 0.005, COURT.backboardZ + 0.18]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.025, 0.025, 0.16, 12]} />
        <meshStandardMaterial color="#0E0E14" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Two small spring posts visible behind rim */}
      <mesh position={[-0.07, COURT.rimY - 0.05, COURT.backboardZ + 0.18]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.06, 8]} />
        <meshStandardMaterial color="#0A0A0A" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.07, COURT.rimY - 0.05, COURT.backboardZ + 0.18]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.06, 8]} />
        <meshStandardMaterial color="#0A0A0A" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ─── RIM (thick orange torus + 14 net hooks) ─── */}
      <group ref={rimRef as unknown as React.MutableRefObject<THREE.Group>} position={[0, COURT.rimY, 0]}>
        {/* Rim ring — NBA spec 5/8" diameter steel = ~16 mm radius, but visually
            beefed to 30 mm so it reads cleanly from a 9.5m back-view angle.
            Torus is rotated +90° about X so the ring lies FLAT (horizontal,
            opening up) like a real hoop — three.js builds a torus in the XY
            plane by default, i.e. standing vertically. */}
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[COURT.rimRadius, 0.030, 20, 64]} />
          <meshStandardMaterial
            color={orange}
            metalness={0.60}
            roughness={0.28}
            emissive={orangeEmissive}
            emissiveIntensity={0.40}
          />
        </mesh>
        {/* Inner highlight torus (catches rim-light from arena spots) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[COURT.rimRadius, 0.014, 12, 48]} />
          <meshStandardMaterial color="#FFB070" emissive="#FF7030" emissiveIntensity={0.55} />
        </mesh>
        {/* 14 net-attachment hooks (white tabs hanging just below rim) */}
        {hookPositions.map((h, i) => (
          <mesh
            key={`hook${i}`}
            position={[h.x, -0.028, h.z]}
            rotation={[0, -h.angle, 0]}
            castShadow
          >
            <boxGeometry args={[0.018, 0.055, 0.024]} />
            <meshStandardMaterial color="#E8E8E8" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* ─── NET (tube strands + horizontal rings — visible from distance) ─── */}
      <group ref={netGroupRef} position={[0, COURT.rimY - 0.025, 0]}>
        {netGeometries.map((g, i) => (
          <mesh key={`strand${i}`} geometry={g}>
            <meshStandardMaterial
              color={netColor}
              roughness={0.85}
              emissive="#404040"
              emissiveIntensity={0.05}
              transparent
              opacity={0.95}
            />
          </mesh>
        ))}
        {netRingGeometries.map((g, i) => (
          <mesh
            key={`netring${i}`}
            geometry={g}
            position={[0, -((i + 1) / NET_RINGS) * NET_DROP, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial color={netColor} roughness={0.85} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
