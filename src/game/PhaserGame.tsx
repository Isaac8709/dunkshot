import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { CourtScene, type DunkFeedback } from './scenes/CourtScene'

interface PhaserGameProps {
  unlockedDunkIds: string[]
  onScoreUpdate: (score: number, combo: number) => void
  onDunkPerformed: (dunkId: string) => void
  onDunkFeedback?: (feedback: DunkFeedback) => void
  onKeysChange?: (keys: string[]) => void
  onTimerUpdate?: (secondsLeft: number) => void
  onGameOver?: (score: number, stats: { dunks: number; maxCombo: number; perfects: number }) => void
  timeAttack?: boolean
}

export default function PhaserGame({ unlockedDunkIds, onScoreUpdate, onDunkPerformed, onDunkFeedback, onKeysChange, onTimerUpdate, onGameOver, timeAttack }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<CourtScene | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const container = containerRef.current
    const w = container.clientWidth
    const h = container.clientHeight

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: w,
      height: h,
      backgroundColor: '#0A0A1A',
      parent: container,
      scene: [CourtScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: w,
        height: h,
      },
      input: {
        keyboard: true,
        mouse: true,
        touch: true,
      },
      // Don't auto-pause the game when the tab loses focus / hides.
      // This keeps tween chains progressing even in background tabs
      // (which Chrome can otherwise throttle RAF to ~1Hz).
      autoFocus: true,
      disableContextMenu: false,
      fps: { forceSetTimeOut: true, target: 60 },
    }

    const game = new Phaser.Game(config)
    gameRef.current = game
    ;(window as any).__GAME = game

    // Use a polling approach — scene needs to be fully booted before we wire callbacks.
    // The 'ready' event isn't always reliable across Phaser versions.
    const wireUp = () => {
      const scene = game.scene.getScene('CourtScene') as CourtScene | null
      if (!scene || !scene.sys || !scene.sys.isActive()) {
        setTimeout(wireUp, 30)
        return
      }
      sceneRef.current = scene
      scene.unlockedDunkIds = unlockedDunkIds
      scene.updateDunkUnlocks()
      scene.onScoreUpdate = onScoreUpdate
      scene.onDunkPerformed = onDunkPerformed
      if (onDunkFeedback) scene.onDunkFeedback = onDunkFeedback
      if (onKeysChange) scene.onKeysChange = onKeysChange
      if (onTimerUpdate) scene.onTimerUpdate = onTimerUpdate
      if (onGameOver) scene.onGameOver = onGameOver
      scene.timeAttack = !!timeAttack
      scene.startTimeAttack()
      ;(window as any).__SCENE = scene
    }
    wireUp()

    return () => {
      game.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.unlockedDunkIds = unlockedDunkIds
      sceneRef.current.updateDunkUnlocks()
      sceneRef.current.showControls()
    }
  }, [unlockedDunkIds])

  return (
    <div
      ref={containerRef}
      id="phaser-game"
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    />
  )
}
