'use client'

import { useTheme } from '@/lib/ThemeContext'
import {
  ViewMode, localDateStr, weekBounds, navigateDay, navigateWeek, navigateMonth,
  todayLabel, MONTH_NAMES, parseLocalDate, currentShiftDate,
} from '@/lib/dateNav'

interface DateRangeNavProps {
  mode:      ViewMode
  // today mode
  date:      string
  // week mode
  weekRef:   Date
  // month mode
  month:     number
  year:      number
  onModeChange: (m: ViewMode) => void
  onDateChange: (d: string) => void
  onWeekChange: (ref: Date) => void
  onMonthChange: (year: number, month: number) => void
}

export default function DateRangeNav({
  mode, date, weekRef, month, year,
  onModeChange, onDateChange, onWeekChange, onMonthChange,
}: DateRangeNavProps) {
  const { T } = useTheme()

  const btnBase: React.CSSProperties = {
    padding: '5px 14px', fontSize: 12, fontFamily: 'inherit',
    border: `1px solid ${T.line2}`, borderRadius: T.radius,
    cursor: 'pointer', lineHeight: 1,
  }
  const activeBtn: React.CSSProperties = { ...btnBase, background: T.accent, color: T.accentInk, borderColor: T.accent, fontWeight: 600 }
  const inactiveBtn: React.CSSProperties = { ...btnBase, background: T.chip, color: T.textDim, fontWeight: 400 }

  const navBtn: React.CSSProperties = {
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: T.chip, border: `1px solid ${T.line2}`, borderRadius: T.radius,
    cursor: 'pointer', color: T.textDim, fontSize: 14, lineHeight: 1, flexShrink: 0,
  }

  function handlePrev() {
    if (mode === 'today') onDateChange(navigateDay(date, -1))
    else if (mode === 'week') onWeekChange(navigateWeek(weekRef, -1))
    else {
      const { year: y, month: m } = navigateMonth(year, month, -1)
      onMonthChange(y, m)
    }
  }

  function handleNext() {
    if (mode === 'today') onDateChange(navigateDay(date, 1))
    else if (mode === 'week') onWeekChange(navigateWeek(weekRef, 1))
    else {
      const { year: y, month: m } = navigateMonth(year, month, 1)
      onMonthChange(y, m)
    }
  }

  // Center label / picker
  function CenterControl() {
    if (mode === 'today') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={date}
            onChange={e => e.target.value && onDateChange(e.target.value)}
            style={{
              padding: '4px 8px', fontSize: 12, fontFamily: T.mono,
              background: T.surface2, color: T.text,
              border: `1px solid ${T.line2}`, borderRadius: T.radius,
              outline: 'none', cursor: 'pointer',
            }}
          />
          {date !== localDateStr(new Date()) && (
            <button
              onClick={() => onDateChange(localDateStr(new Date()))}
              style={{ ...inactiveBtn, padding: '3px 8px', fontSize: 11 }}
            >
              Today
            </button>
          )}
        </div>
      )
    }

    if (mode === 'week') {
      const { label, start: weekStartISO } = weekBounds(weekRef)
      const weekStartStr = localDateStr(new Date(weekStartISO))
      const todayWeekStr = localDateStr(new Date(weekBounds(new Date()).start))
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={weekStartStr}
            title={label}
            onChange={e => e.target.value && onWeekChange(parseLocalDate(e.target.value))}
            style={{
              padding: '4px 8px', fontSize: 12, fontFamily: T.mono,
              background: T.surface2, color: T.text,
              border: `1px solid ${T.line2}`, borderRadius: T.radius,
              outline: 'none', cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textDim, whiteSpace: 'nowrap' }}>{label}</span>
          {weekStartStr !== todayWeekStr && (
            <button
              onClick={() => onWeekChange(new Date())}
              style={{ ...inactiveBtn, padding: '3px 8px', fontSize: 11 }}
            >
              This Week
            </button>
          )}
        </div>
      )
    }

    // month
    const todayDate = new Date()
    const isCurrentMonth = year === todayDate.getFullYear() && month === todayDate.getMonth()
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <select
          value={month}
          onChange={e => onMonthChange(year, parseInt(e.target.value))}
          style={{
            padding: '4px 8px', fontSize: 12, fontFamily: T.mono,
            background: T.surface2, color: T.text,
            border: `1px solid ${T.line2}`, borderRadius: T.radius,
            outline: 'none', cursor: 'pointer',
          }}
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i}>{name}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={e => onMonthChange(parseInt(e.target.value), month)}
          style={{
            padding: '4px 8px', fontSize: 12, fontFamily: T.mono,
            background: T.surface2, color: T.text,
            border: `1px solid ${T.line2}`, borderRadius: T.radius,
            outline: 'none', cursor: 'pointer',
          }}
        >
          {[todayDate.getFullYear() - 1, todayDate.getFullYear()].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {!isCurrentMonth && (
          <button
            onClick={() => onMonthChange(todayDate.getFullYear(), todayDate.getMonth())}
            style={{ ...inactiveBtn, padding: '3px 8px', fontSize: 11 }}
          >
            This Month
          </button>
        )}
      </div>
    )
  }

  // Jump to today's week / month when switching modes
  function handleModeChange(m: ViewMode) {
    const now = new Date()
    if (m === 'today') onDateChange(localDateStr(now))
    else if (m === 'week') onWeekChange(now)
    else onMonthChange(now.getFullYear(), now.getMonth())
    onModeChange(m)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Mode pills */}
      <div style={{ display: 'flex', gap: 2 }}>
        {(['today', 'week', 'month'] as ViewMode[]).map(m => (
          <button key={m} onClick={() => handleModeChange(m)}
            style={mode === m ? activeBtn : inactiveBtn}>
            {m === 'today' ? 'Today' : m === 'week' ? 'Week' : 'Month'}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: T.line2 }} />

      {/* Prev / center / next */}
      <button onClick={handlePrev} style={navBtn}>‹</button>
      <CenterControl />
      <button onClick={handleNext} style={navBtn}>›</button>
    </div>
  )
}

// ── Hook: manage all date nav state in one place ──────────────────────────────
export function useDateNav() {
  const now = new Date()
  const [mode,    setMode]    = useState<ViewMode>('today')
  const [date,    setDate]    = useState(currentShiftDate())
  const [weekRef, setWeekRef] = useState<Date>(now)
  const [month,   setMonth]   = useState(now.getMonth())
  const [year,    setYear]    = useState(now.getFullYear())

  return { mode, setMode, date, setDate, weekRef, setWeekRef, month, year, setMonth: (y: number, m: number) => { setYear(y); setMonth(m) } }
}

// useState import needed in this file
import { useState } from 'react'
