// ── APP ROOT ──────────────────────────────────────────────
// Handles routing between screens
// Manages first launch detection
// Wraps everything in ThemeProvider

import { useState, useEffect } from 'react'
import { ThemeProvider } from './theme'
import SplashScreen from './screens/SplashScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import HomeScreen from './screens/HomeScreen'
import GridScreen from './screens/GridScreen'
import UpgradeScreen from './screens/UpgradeScreen'

const SCREENS = {
  SPLASH: 'splash',
  ONBOARDING: 'onboarding',
  HOME: 'home',
  GRID: 'grid',
  UPGRADE: 'upgrade'
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SPLASH)
  const [currentSheet, setCurrentSheet] = useState(null)
  const [isFirstLaunch, setIsFirstLaunch] = useState(false)

  useEffect(() => {
    // Check if this is the first time the app has been opened
    const launched = localStorage.getItem('onyx-launched')
    if (!launched) {
      setIsFirstLaunch(true)
      localStorage.setItem('onyx-launched', 'true')
    }
  }, [])

  function handleSplashDone() {
    if (isFirstLaunch) {
      setScreen(SCREENS.ONBOARDING)
    } else {
      setScreen(SCREENS.HOME)
    }
  }

  function handleOnboardingDone() {
    setScreen(SCREENS.HOME)
  }

  function handleOpenSheet(sheet) {
    setCurrentSheet(sheet)
    setScreen(SCREENS.GRID)
  }

  function handleBackToHome() {
    setCurrentSheet(null)
    setScreen(SCREENS.HOME)
  }

  function handleUpgrade() {
    setScreen(SCREENS.UPGRADE)
  }

  function handleBackFromUpgrade() {
    if (currentSheet) {
      setScreen(SCREENS.GRID)
    } else {
      setScreen(SCREENS.HOME)
    }
  }

  return (
    <ThemeProvider>
      {screen === SCREENS.SPLASH && (
        <SplashScreen onDone={handleSplashDone} />
      )}

      {screen === SCREENS.ONBOARDING && (
        <OnboardingScreen onDone={handleOnboardingDone} />
      )}

      {screen === SCREENS.HOME && (
        <HomeScreen
          onOpenSheet={handleOpenSheet}
          onUpgrade={handleUpgrade}
        />
      )}

      {screen === SCREENS.GRID && currentSheet && (
        <GridScreen
          sheet={currentSheet}
          onBack={handleBackToHome}
          onUpgrade={handleUpgrade}
        />
      )}

      {screen === SCREENS.UPGRADE && (
        <UpgradeScreen onBack={handleBackFromUpgrade} />
      )}
    </ThemeProvider>
  )
}