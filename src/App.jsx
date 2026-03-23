// — APP ROOT

import { useState, useEffect } from 'react'
import { ThemeProvider } from './theme'
import SplashScreen from './screens/SplashScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import SignInScreen from './screens/SignInScreen'
import HomeScreen from './screens/HomeScreen'
import GridScreen from './screens/GridScreen'
import UpgradeScreen from './screens/UpgradeScreen'
import { onAuthChange } from './auth'

const SCREENS = {
  SPLASH: 'splash',
  ONBOARDING: 'onboarding',
  SIGNIN: 'signin',
  HOME: 'home',
  GRID: 'grid',
  UPGRADE: 'upgrade'
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SPLASH)
  const [currentSheet, setCurrentSheet] = useState(null)
  const [isFirstLaunch, setIsFirstLaunch] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const launched = localStorage.getItem('onyx-launched')
    if (!launched) {
      setIsFirstLaunch(true)
      localStorage.setItem('onyx-launched', 'true')
    }
  }, [])

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = onAuthChange((user) => {
      setUser(user)
      if (user && (screen === SCREENS.SIGNIN || screen === SCREENS.SPLASH)) {
        setScreen(SCREENS.HOME)
      }
    })
    return () => subscription.unsubscribe()
  }, [screen])

  function handleSplashDone() {
    if (isFirstLaunch) {
      setScreen(SCREENS.ONBOARDING)
    } else if (user) {
      setScreen(SCREENS.HOME)
    } else {
      setScreen(SCREENS.SIGNIN)
    }
  }

  function handleOnboardingDone() {
    setScreen(SCREENS.SIGNIN)
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
      {screen === SCREENS.SIGNIN && (
        <SignInScreen />
      )}
      {screen === SCREENS.HOME && user && (
        <HomeScreen
          user={user}
          onOpenSheet={handleOpenSheet}
          onUpgrade={handleUpgrade}
        />
      )}
      {screen === SCREENS.GRID && currentSheet && (
        <GridScreen
          sheet={currentSheet}
          user={user}
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
