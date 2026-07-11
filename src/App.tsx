import { useEffect } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { audioManager } from '@/utils/audio'
import ScreenTransition from '@/components/ScreenTransition'
import SplashScreen from '@/screens/SplashScreen'
import SetupScreen from '@/screens/SetupScreen'
import MainMenuScreen from '@/screens/MainMenuScreen'
import GameScreen from '@/screens/GameScreen'
import TacticsScreen from '@/screens/TacticsScreen'
import TrainingScreen from '@/screens/TrainingScreen'
import ProgressScreen from '@/screens/ProgressScreen'
import DunkDictScreen from '@/screens/DunkDictScreen'
import CommunityScreen from '@/screens/CommunityScreen'

export default function App() {
  const { screen, loadFromStorage } = useGameStore()

  useEffect(() => {
    loadFromStorage()
  }, [])

  // Start BGM whenever we leave the splash screen.
  // audioManager.unlock() is called from SplashScreen's tap handler.
  useEffect(() => {
    if (screen !== 'splash') {
      audioManager.playBgm()
    }
  }, [screen])

  return (
    <div className="app-stage">
      {/* Phone frame wrapper — full-width on mobile, centered phone-card on desktop.
          The `transform` here also creates a new containing block, so child screens
          using `position: fixed; inset: 0` get bounded to this wrapper instead of
          escaping to the full viewport. */}
      <div className="app-frame arena-bg">
        <ScreenTransition screenKey={screen}>
          {screen === 'splash'    && <SplashScreen />}
          {screen === 'setup'     && <SetupScreen />}
          {screen === 'menu'      && <MainMenuScreen />}
          {screen === 'game'      && <GameScreen />}
          {screen === 'tactics'   && <TacticsScreen />}
          {screen === 'training'  && <TrainingScreen />}
          {screen === 'progress'  && <ProgressScreen />}
          {screen === 'dunks'     && <DunkDictScreen />}
          {screen === 'community' && <CommunityScreen />}
        </ScreenTransition>
      </div>
    </div>
  )
}
