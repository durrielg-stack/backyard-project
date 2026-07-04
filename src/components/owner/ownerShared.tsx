'use client'

import { useTheme } from '@/lib/ThemeContext'

// ── Shared types ──────────────────────────────────────────────────────────────
export interface RevenueBar { label: string; value: number; isPeak: boolean }
export interface CategoryBreakdown { category: string; gross: number; cost: number; net: number }
export interface MultiBar { label: string; gross: number; cost: number; expenses: number }

// ── Helpers ───────────────────────────────────────────────────────────────────
export const DAY_ABBR   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
export const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function makePeak(bars: Omit<RevenueBar,'isPeak'>[]): RevenueBar[] {
  const max = Math.max(...bars.map(b => b.value), 0.01)
  return bars.map(b => ({ ...b, isPeak: b.value === max && b.value > 0 }))
}

export function fmtPeso(v: number) {
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtDate(d: Date) {
  return `${DAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
}

// ── SectionHd ─────────────────────────────────────────────────────────────────
export function SectionHd({ title, badge, action }: { title: string; badge?: React.ReactNode; action?: React.ReactNode }) {
  const { T } = useTheme()
  return (
    <div style={{
      height: 48, padding: '0 24px', flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: `1px solid ${T.line}`,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: T.textMute,
      }}>
        {title}
      </span>
      {badge != null && (
        <span style={{
          fontFamily: T.mono, fontSize: 12, fontWeight: 600,
          color: T.accent, background: `${T.accent}18`,
          border: `1px solid ${T.accent}44`,
          padding: '2px 8px', borderRadius: T.radius,
        }}>
          {badge}
        </span>
      )}
      <div style={{ flex: 1 }} />
      {action}
    </div>
  )
}

// ── SearchBox ─────────────────────────────────────────────────────────────────
export function SearchBox({ value, onChange, placeholder = 'Search…' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const { T } = useTheme()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
      background: T.surface, border: `1px solid ${value ? T.accent : T.line2}`,
      borderRadius: T.radius, color: T.textDim, width: 200, flexShrink: 0,
      boxSizing: 'border-box',
    }}>
      <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="7" cy="7" r="4" />
        <path d="M10 10l3 3" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ border: 'none', outline: 'none', background: 'transparent', color: T.text, fontFamily: 'inherit', fontSize: 12, flex: 1, width: 0 }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{ background: 'none', border: 'none', color: T.textMute, cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
      )}
    </div>
  )
}

// ── Pill ──────────────────────────────────────────────────────────────────────
export function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { T } = useTheme()
  return (
    <button onClick={onClick} style={{
      padding: '4px 14px', fontSize: 12, fontFamily: 'inherit',
      background: active ? T.accent : T.chip,
      color:      active ? T.accentInk : T.textDim,
      border:     `1px solid ${active ? T.accent : T.line2}`,
      borderRadius: T.radius, cursor: 'pointer',
      fontWeight: active ? 600 : 400,
      transition: 'background 0.12s ease',
    }}>
      {label}
    </button>
  )
}

// ── BarChart ──────────────────────────────────────────────────────────────────
export function BarChart({ bars, height = 200 }: { bars: RevenueBar[]; height?: number }) {
  const { T } = useTheme()
  if (bars.length === 0) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.textMute, fontFamily: T.mono, fontSize: 12,
      }}>
        No data
      </div>
    )
  }
  const maxVal = Math.max(...bars.map(b => b.value), 1)
  return (
    <div style={{ height, padding: '12px 24px 0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {[0.25, 0.5, 0.75, 1.0].map(pct => (
          <div key={pct} style={{
            position: 'absolute', left: 0, right: 0,
            top: `${(1 - pct) * 100}%`,
            borderTop: `1px solid ${T.line}`,
            pointerEvents: 'none',
          }}>
            <span style={{
              position: 'absolute', right: 0, transform: 'translateY(-100%)',
              fontSize: 9, fontFamily: T.mono, color: T.textMute,
              fontVariantNumeric: 'tabular-nums', paddingBottom: 1,
            }}>
              {(maxVal * pct) >= 1000
                ? `${((maxVal * pct) / 1000).toFixed(1)}k`
                : (maxVal * pct).toFixed(0)}
            </span>
          </div>
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${bars.length}, 1fr)`,
          alignItems: 'flex-end',
        }}>
          {bars.map(bar => {
            const h = maxVal > 0 ? (bar.value / maxVal) * 100 : 0
            return (
              <div key={bar.label} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-end', height: '100%',
              }}>
                {bar.value > 0 && (
                  <div style={{
                    fontFamily: T.mono, fontSize: 8, fontWeight: 600,
                    color: bar.isPeak ? T.accent : T.textMute,
                    marginBottom: 2, whiteSpace: 'nowrap',
                  }}>
                    {bar.value >= 1000 ? `${(bar.value / 1000).toFixed(1)}k` : bar.value.toFixed(0)}
                  </div>
                )}
                <div style={{
                  width: '70%', height: h > 0 ? `${h}%` : 2,
                  background: bar.isPeak ? T.accent : `${T.accent}44`,
                  borderRadius: `${T.radius} ${T.radius} 0 0`,
                  minHeight: bar.value > 0 ? 4 : 2,
                  transition: 'height 0.4s ease',
                }} />
              </div>
            )
          })}
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${bars.length}, 1fr)`,
        marginTop: 4, paddingBottom: 8,
      }}>
        {bars.map((bar, i) => (
          <div key={bar.label} style={{
            textAlign: 'center', fontFamily: T.mono, fontSize: 8, color: T.textMute,
            visibility: (bars.length > 14 && i % 2 !== 0) ? 'hidden' : 'visible',
          }}>
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── HBarChart ─────────────────────────────────────────────────────────────────
export function HBarChart({ data, color }: { data: { category: string; value: number; sub?: string }[]; color: string }) {
  const { T } = useTheme()
  if (data.length === 0) {
    return <div style={{ padding: '24px', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>No data</div>
  }
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ padding: '8px 0' }}>
      {data.map(d => (
        <div key={d.category} style={{ padding: '5px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 130, fontSize: 11, color: T.text, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.category}
          </div>
          <div style={{ flex: 1, height: 18, background: T.line2, borderRadius: T.radius, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${(d.value / max) * 100}%`,
              background: color, borderRadius: T.radius,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ width: 96, fontFamily: T.mono, fontSize: 11, color: T.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textAlign: 'right' }}>
            {fmtPeso(d.value)}
          </div>
          {d.sub && (
            <div style={{ width: 64, fontFamily: T.mono, fontSize: 10, color: T.textMute, flexShrink: 0 }}>
              {d.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── GroupedBarChart ───────────────────────────────────────────────────────────
export function GroupedBarChart({ bars, height = 220, mode = 'bar' }: { bars: MultiBar[]; height?: number; mode?: 'bar' | 'line' }) {
  const { T } = useTheme()
  if (bars.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>No data</div>
  }
  const SERIES = [
    { key: 'gross',    color: T.info    },
    { key: 'cost',     color: T.textDim },
    { key: 'net',      color: T.ok      },
    { key: 'expenses', color: T.bad     },
  ] as const
  const allVals = bars.flatMap(b => [b.gross, b.cost, Math.max(0, b.gross - b.cost), b.expenses])
  const maxVal  = Math.max(...allVals, 1)

  return (
    <div style={{ height, padding: '10px 24px 0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 14, paddingBottom: 6, flexShrink: 0 }}>
        {(['Gross','Cost','Net','Expenses'] as const).map((lbl, i) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: mode === 'line' ? 16 : 8,
              height: mode === 'line' ? 2 : 8,
              borderRadius: 1, background: SERIES[i].color,
            }} />
            <span style={{ fontSize: 9, color: T.textMute, fontFamily: T.mono, letterSpacing: '0.06em' }}>{lbl}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {[0.25, 0.5, 0.75, 1.0].map(pct => (
          <div key={pct} style={{ position: 'absolute', left: 0, right: 0, top: `${(1-pct)*100}%`, borderTop: `1px solid ${T.line}`, pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', right: 0, transform: 'translateY(-100%)', fontSize: 9, fontFamily: T.mono, color: T.textMute, paddingBottom: 1 }}>
              {(maxVal*pct) >= 1000 ? `${((maxVal*pct)/1000).toFixed(1)}k` : (maxVal*pct).toFixed(0)}
            </span>
          </div>
        ))}

        {mode === 'bar' ? (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${bars.length}, 1fr)`, alignItems: 'flex-end' }}>
            {bars.map(bar => {
              const vals = [bar.gross, bar.cost, Math.max(0, bar.gross - bar.cost), bar.expenses]
              return (
                <div key={bar.label} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '100%', gap: 1 }}>
                  {SERIES.map((s, si) => {
                    const v = vals[si]
                    const h = maxVal > 0 ? (v / maxVal) * 100 : 0
                    return (
                      <div key={s.key} style={{
                        width: '20%', height: h > 0 ? `${h}%` : 2,
                        background: s.color, borderRadius: `${T.radius} ${T.radius} 0 0`,
                        minHeight: v > 0 ? 3 : 2, opacity: v > 0 ? 1 : 0.2, transition: 'height 0.4s ease',
                      }} />
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            {SERIES.map((s, si) => {
              const vals = bars.map(b => {
                const row = [b.gross, b.cost, Math.max(0, b.gross - b.cost), b.expenses]
                return row[si]
              })
              const points = vals.map((v, i) => {
                const x = bars.length > 1 ? (i / (bars.length - 1)) * 100 : 50
                const y = 100 - (maxVal > 0 ? (v / maxVal) * 96 : 0)
                return `${x.toFixed(2)},${y.toFixed(2)}`
              }).join(' ')
              return (
                <g key={s.key}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.9}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )
            })}
          </svg>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bars.length}, 1fr)`, marginTop: 4, paddingBottom: 8 }}>
        {bars.map((bar, i) => (
          <div key={bar.label} style={{ textAlign: 'center', fontFamily: T.mono, fontSize: 8, color: T.textMute, visibility: (bars.length > 14 && i % 2 !== 0) ? 'hidden' : 'visible' }}>
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  )
}
