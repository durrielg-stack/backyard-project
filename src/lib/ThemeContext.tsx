'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { THEME, LIGHT_THEME, SLATE_THEME, type ThemeTokens } from './theme'

type ThemeMode = 'dark' | 'light' | 'slate'

const THEMES: Record<ThemeMode, ThemeTokens> = {
  dark:  THEME,
  light: LIGHT_THEME,
  slate: SLATE_THEME,
}

const CYCLE: ThemeMode[] = ['dark', 'light', 'slate']

interface ThemeContextValue {
  T:      ThemeTokens
  mode:   ThemeMode
  isDark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  T: THEME, mode: 'dark' as ThemeMode, isDark: true, toggle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('bp-theme') as ThemeMode | null
    if ((saved as string) === 'ocean') { setMode('slate'); return }
    if (saved && (CYCLE as string[]).includes(saved)) setMode(saved as ThemeMode)
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
