'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { THEME, LIGHT_THEME, OCEAN_THEME, type ThemeTokens } from './theme'

type ThemeMode = 'dark' | 'light' | 'ocean'

const THEMES: Record<ThemeMode, ThemeTokens> = {
  dark:  THEME,
  light: LIGHT_THEME,
  ocean: OCEAN_THEME,
}

const CYCLE: ThemeMode[] = ['dark', 'light', 'ocean']

interface ThemeContextValue {
  T:      ThemeTokens
  mode:   ThemeMode
  isDark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  T: THEME, mode: 'dark', isDark: true, toggle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('bp-theme') as ThemeMode | null
    if (saved && CYCLE.includes(saved)) setMode(saved)
  }, [])

  function toggle() {
    setMode(current => {
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]
      localStorage.setItem('bp-theme', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ T: THEMES[mode], mode, isDark: mode === 'dark', toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
