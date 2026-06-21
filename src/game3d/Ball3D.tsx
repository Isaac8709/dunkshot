import { useMemo, forwardRef, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export interface BallHandle {
  group: THREE.Group
  setPosition: (v: THREE.Vector3) => void
  setSpin: (rps: number) => void
}

/** Basketball with painted seams. */
export const Ball3D = forwardRef<BallHandle, {}>(function Ball3D(_, ref) {
  const root = useRef<THREE.Group>(null!)
  const mesh = useRef<THREE.Mesh>(null!)
  const spinRef = useRef(0)
  // Target position fed by the game loop; the rendered position eases toward it.
  const targetPos = useRef(new THREE.Vector3())
  const hasTarget = useRef(false)

  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512; c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = '#D9682A'
    g.fillRect(0, 0, 512, 256)
    // noise dimples
    g.globalAlpha = 0.08
    for (let i = 0; i < 2000; i++) {
      g.fillStyle = Math.random() > 0.5 ? '#000' : '#fff'
      g.beginPath()
      g.arc(Math.random()*512, Math.random()*256, Math.random()*1.5, 0, Math.PI*2)
      g.fill()
    }
    g.globalAlpha = 1
    // seams
    g.strokeStyle = '#1A0A05'
    g.lineWidth = 3
    // horizontal seam (around equator)
    g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke()
    // vertical seam
    g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 256); g.stroke()
    // curved seams (left & right halves)
    g.beginPath(); g.moveTo(128, 0); g.quadraticCurveTo(64, 128, 128, 256); g.stroke()
    g.beginPath(); g.moveTo(384, 0); g.quadraticCurveTo(448, 128, 384, 256); g.stroke()
    const t = new THREE.CanvasTexture(c)
    t.anisotropy = 4
    return t
  }, [])

  useImperativeHandle(ref, () => ({
    group: root.current,
    setPosition(v) {
      targetPos.current.copy(v)
      // First placement (or a big intentional jump, e.g. the ball being reset
      // to bounce away) should snap, not streak across the court.
      if (!hasTarget.current) {
        hasTarget.current = true
        root.current?.position.copy(v)
      }
    },
    setSpin(rps) { spinRef.current = rps },
  }))

  useFrame((_, dt) => {
    if (root.current && hasTarget.current) {
      const p = root.current.position
      const d = p.distanceTo(targetPos.current)
      // Small moves (a hand-to-hand handoff, ball following the dunking hand)
      // get eased so they don't pop. Large jumps (drop→bounce reset, a fresh
      // possession) snap so the ball never smears through the air.
      if (d > 0.7) {
        p.copy(targetPos.current)
      } else {
        p.lerp(targetPos.current, 1 - Math.exp(-32 * dt))
      }
    }
    if (mesh.current) {
      mesh.current.rotation.x += spinRef.current * dt * Math.PI * 2
      mesh.current.rotation.z += spinRef.current * dt * Math.PI * 1.4
    }
  })

  return (
    <group ref={root}>
      <mesh ref={mesh} castShadow>
        <sphereGeometry args={[0.12, 24, 18]} />
        <meshStandardMaterial map={tex} roughness={0.85} metalness={0.0} />
      </mesh>
    </group>
  )
})
