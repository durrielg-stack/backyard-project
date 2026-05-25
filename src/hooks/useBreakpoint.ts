'use client'

import { useEffect, useState } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

function measure(): Breakpoint {
  const w = window.innerWidth
  return w < 768 ? 'mobile' : w < 1200 ? 'tablet' : 'desktop'
}

export function useBreakpoint(): Breakpoint {
  // null on server/first render to avoid SSR hydration mismatch
  const [bp, setBp] = useState<Breakpoint | null>(null)

  useEffect(() => {
    setBp(measure())
    function onResize() { setBp(measure()) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return bp ?? 'desktop'
}
