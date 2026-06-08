import { ReactNode, useRef, MouseEvent, TouchEvent, useState } from 'react'

interface Props {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  intensity?: number   // 0..1 — how strongly the card tilts (default 0.6)
  onClick?: () => void
}

/**
 * A card that tilts in 3D toward the cursor (parallax).
 * Falls back gracefully on touch devices (no tilt, but tap still fires).
 */
export default function TiltCard({
  children, className = '', style, intensity = 0.6, onClick,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState('perspective(900px) rotateX(0deg) rotateY(0deg)')

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const cx = (e.clientX - r.left) / r.width  - 0.5  // -0.5..0.5
    const cy = (e.clientY - r.top)  / r.height - 0.5
    const ry =  cx * 16 * intensity              // rotateY
    const rx = -cy * 12 * intensity              // rotateX
    setTransform(`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`)

    // Light follow
    ref.current.style.setProperty('--lx', `${(cx + 0.5) * 100}%`)
    ref.current.style.setProperty('--ly', `${(cy + 0.5) * 100}%`)
  }

  const onLeave = () => {
    setTransform('perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)')
  }

  const onTouchStart = (_e: TouchEvent<HTMLDivElement>) => {
    setTransform('perspective(900px) rotateX(0deg) rotateY(0deg) scale(0.97)')
  }
  const onTouchEnd = () => onLeave()

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      className={`tilt-card ${className}`}
      style={{
        transform,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)',
        willChange: 'transform',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
