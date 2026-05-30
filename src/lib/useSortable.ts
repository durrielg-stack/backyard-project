import { useState, useMemo } from 'react'

type Dir = 'asc' | 'desc'

export function useSortable<T>(rows: T[], defaultKey: keyof T, defaultDir: Dir = 'asc') {
  const [key, setKey] = useState<keyof T>(defaultKey)
  const [dir, setDir] = useState<Dir>(defaultDir)

  function toggle(k: keyof T) {
    if (k === key) setDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setKey(k); setDir('asc') }
  }

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = a[key], bv = b[key]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return dir === 'asc' ? cmp : -cmp
  }), [rows, key, dir])

  function icon(k: keyof T): string {
    if (k !== key) return '↕'
    return dir === 'asc' ? '↑' : '↓'
  }

  return { sortKey: key, sortDir: dir, toggle, sorted, icon }
}
