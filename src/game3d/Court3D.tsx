import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Real-scale half court (meters).
 *   Width:  15.24 m (NBA)
 *   Length: 14.0 m (we render half-court + a little behind the hoop)
 *   Hoop center: (0, 3.05, 0)  rim radius 0.2286
 *   3-pt arc radius: 7.24 m
 *   FT line: 5.79 m from backboard
 */
export const COURT = {
  width: 15.24,
  length: 14.0,
  rimY: 3.05,
  rimRadius: 0.229,
  backboardX: 0,           // backboard plane at z = -1.2 from hoop center? we place hoop at z=0, backboard behind it
  backboardZ: -0.225,      // backboard sits ~22.5cm behind rim center (real spec)
  backboardWidth: 1.82,
  backboardHeight: 1.07,
  freeThrowZ: 4.6,         // FT line z (player side is +z)
  threePtRadius: 7.24,
}

export function Court3D() {
  // Wood floor: striped planks via a procedural canvas texture
  const woodTexture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512; c.height = 512
    const g = c.getContext('2d')!
    // base wood gradient
    const grd = g.createLinearGradient(0, 0, 0, 512)
    grd.addColorStop(0, '#C97A3D')
    grd.addColorStop(0.5, '#D98E4B')
    grd.addColorStop(1, '#B6682E')
    g.fillStyle = grd
    g.fillRect(0, 0, 512, 512)
    // plank lines
    g.strokeStyle = 'rgba(60,30,10,0.45)'
    g.lineWidth = 1
    for (let y = 0; y < 512; y += 32) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke()
    }
    // grain noise
    g.globalAlpha = 0.08
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = Math.random() > 0.5 ? '#000' : '#fff'
      g.fillRect(Math.random()*512, Math.random()*512, 1, Math.random()*8)
    }
    g.globalAlpha = 1
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(6, 6)
    tex.anisotropy = 8
    return tex
  }, [])

  // Court line geometry — paint, key, FT circle, 3pt arc, half-court line
  const lines = useMemo(() => {
    const arr: JSX.Element[] = []
    const lineY = 0.011
    const lineMat = <meshBasicMaterial color="#FFFFFF" />

    // 3-point arc (player half: z >= 0)
    const arcPts: THREE.Vector3[] = []
    const r = COURT.threePtRadius
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI  // 0..pi covers far semicircle (z>=0)
      arcPts.push(new THREE.Vector3(Math.cos(t) * r, lineY, Math.sin(t) * r))
    }
    arr.push(
      <line key="arc">
        <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints(arcPts)} />
        <lineBasicMaterial attach="material" color="#FFFFFF" linewidth={2} />
      </line>
    )

    // Key (paint area): NBA 4.9m wide, 5.79m from backboard to FT line
    const keyW = 4.9; const keyL = COURT.freeThrowZ
    arr.push(
      <mesh key="key" position={[0, lineY, keyL / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[keyW, keyL]} />
        <meshBasicMaterial color="#A23E18" transparent opacity={0.55} />
      </mesh>
    )
    // Key outline
    const keyOutline: THREE.Vector3[] = [
      new THREE.Vector3(-keyW/2, lineY+0.001, 0),
      new THREE.Vector3(-keyW/2, lineY+0.001, keyL),
      new THREE.Vector3( keyW/2, lineY+0.001, keyL),
      new THREE.Vector3( keyW/2, lineY+0.001, 0),
      new THREE.Vector3(-keyW/2, lineY+0.001, 0),
    ]
    arr.push(
      <line key="keyOutline">
        <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints(keyOutline)} />
        <lineBasicMaterial attach="material" color="#FFFFFF" />
      </line>
    )

    // FT circle
    const ftPts: THREE.Vector3[] = []
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2
      ftPts.push(new THREE.Vector3(Math.cos(t) * 1.8, lineY+0.001, keyL + Math.sin(t) * 1.8))
    }
    arr.push(
      <line key="ftcircle">
        <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints(ftPts)} />
        <lineBasicMaterial attach="material" color="#FFFFFF" />
      </line>
    )

    // Restricted area (1.25m arc under rim)
    const raPts: THREE.Vector3[] = []
    for (let i = 0; i <= 32; i++) {
      const t = (i / 32) * Math.PI
      raPts.push(new THREE.Vector3(Math.cos(t) * 1.25, lineY+0.001, Math.sin(t) * 1.25))
    }
    arr.push(
      <line key="ra">
        <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints(raPts)} />
        <lineBasicMaterial attach="material" color="#FFFFFF" />
      </line>
    )

    // Baseline (z=-1) and sidelines
    const baseline: THREE.Vector3[] = [
      new THREE.Vector3(-COURT.width/2, lineY, -1),
      new THREE.Vector3( COURT.width/2, lineY, -1),
    ]
    arr.push(
      <line key="baseline">
        <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints(baseline)} />
        <lineBasicMaterial attach="material" color="#FFFFFF" />
      </line>
    )

    void lineMat
    return arr
  }, [])

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, COURT.length / 2 - 1]} receiveShadow>
        <planeGeometry args={[COURT.width + 4, COURT.length + 2]} />
        <meshStandardMaterial map={woodTexture} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Out-of-bounds dark border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, COURT.length / 2 - 1]}>
        <planeGeometry args={[COURT.width + 12, COURT.length + 10]} />
        <meshStandardMaterial color="#0A0F1A" roughness={1} />
      </mesh>

      {lines}
    </group>
  )
}
