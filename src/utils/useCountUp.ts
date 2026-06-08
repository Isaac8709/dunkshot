import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from 0 (or from prevValue) up to `value`.
 * Returns the current displayed integer for direct rendering.
 *
 * Uses requestAnimationFrame with an easeOutQuart curve for satisfying
 * deceleration at the end (like a sports broadcast scoreboard ticker).
 */
export function useCountUp(value: number, duration = 900) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    fromRef.current = display
    startRef.current = null

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const t = Math.min(1, elapsed / duration)
      // easeOutQuart
      const eased = 1 - Math.pow(1 - t, 4)
      const next = fromRef.current + (value - fromRef.current) * eased
      setDisplay(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(value)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return Math.round(display)
}
