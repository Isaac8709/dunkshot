import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { ExerciseScene } from './scenes/ExerciseScene'

interface Props {
  animType?: string
}

let instanceCount = 0

export default function ExercisePhaserGame({ animType = 'default' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const idRef = useRef(`exercise-phaser-${++instanceCount}`)

  useEffect(() => {
    const container = containerRef.current
    if (!container || gameRef.current) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 280,
      height: 180,
      transparent: true,
      parent: container,
      scene: [ExerciseScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      input: { keyboard: false, mouse: false, touch: false },
      audio: { noAudio: true },
    }

    const game = new Phaser.Game(config)
    gameRef.current = game

    game.events.on('ready', () => {
      game.scene.start('ExerciseScene', { animType })
    })

    return () => {
      game.destroy(true)
      gameRef.current = null
    }
  }, [])

  // Restart scene when animType changes without remounting
  useEffect(() => {
    const game = gameRef.current
    if (!game) return
    const scene = game.scene.getScene('ExerciseScene') as ExerciseScene | null
    if (scene) {
      scene.scene.restart({ animType })
    }
  }, [animType])

  return (
    <div
      ref={containerRef}
      id={idRef.current}
      style={{ width: 280, height: 180 }}
    />
  )
}
