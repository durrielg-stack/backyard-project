'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { THEME, LIGHT_THEME, type ThemeTokens } from './theme'

interface ThemeContextValue {
  T: ThemeTokens
  isDark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  T: THEME, isDark: true, toggle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('bp-theme')
    if (saved === 'light') setIsDark(false)
  }, [])

  function toggle() {
    setIsDark(d => {
      localStorage.setItem('bp-theme', d ? 'light' : 'dark')
      return !d
    })
  }

  return (
    <ThemeContext.Provider value={{ T: isDark ? THEME : LIGHT_THEME, isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
