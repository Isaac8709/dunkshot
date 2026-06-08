import { ReactNode } from 'react'

interface Props {
  screenKey: string
  children: ReactNode
}

/**
 * Wraps screens with an enter animation on every `screenKey` change.
 * The `key` prop forces React to unmount/remount the inner container,
 * which re-runs the CSS `screen-enter` keyframe (slide + fade + scale).
 */
export default function ScreenTransition({ screenKey, children }: Props) {
  return (
    <div
      key={screenKey}
      className="w-full h-full screen-enter"
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </div>
  )
}
