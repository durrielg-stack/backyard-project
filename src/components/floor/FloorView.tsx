'use client'

import { useState, useEffect, useRef } from 'react'
import { THEME, statusColor, statusLabel } from '@/lib/theme'
import { getClient } from '@/lib/supabase'
import type { TableWithStatus, KdsTicket } from '@/lib/types'
import KdsPanel       from './KdsPanel'
import InventoryPanel from './InventoryPanel'

const T = THEME

// ── Coordinate space the seeded pos_x/pos_y values are mapped against ────────
// Raw DB values range 80–500. We normalise against 640 so tables land at
// 12.5%–78% within the container, leaving natural margins on all sides.
const COORD_MAX = 640

// ── Kitchen Pass strip (right edge of floor plan) ─────────────────────────────
function KitchenPass({ readyCount }: { readyCount: number }) {
  return (
    <div style={{
      width: 56, flexShrink: 0,
      background: T.surface2, borderLeft: `1px solid ${T.line2}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '16px 0', gap: 12, userSelect: 'none',
    }}>
      {/* Rotated label */}
      <div style={{
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: T.textMute,
        marginTop: 8,
      }}>
        Kitchen Pass
      </div>

      {/* Pass window */}
      <div style={{
        width: 32, height: 32, borderRadius: T.radius,
        background: readyCount > 0 ? `${T.ok}22` : T.chip,
        border: `1px solid ${readyCount > 0 ? T.ok : T.line2}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease',
      }}>
        {readyCount > 0 && (
          <span style={{
            fontFamily: T.mono, fontSize: 13, fontWeight: 700,
            color: T.ok, lineHeight: 1,
          }}>
            {readyCount}
          </span>
        )}
      </div>

      {readyCount > 0 && (
        <span style={{
          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: T.ok,
        }}>
          Ready
        </span>
      )}
    </div>
  )
}

// ── Individual table pin (positioned absolutely on the floor plan) ─────────────
function TablePin({
  table, hovered, onEnter, onLeave, onClick,
}: {
  table:    TableWithStatus
  hovered:  boolean
  onEnter:  () => void
  onLeave:  () => void
  onClick:  () => void
}) {
  const isBar   = table.section === 'bar'
  const color   = statusColor(table.status)
  const isAttn  = table.status === 'attention'
  const isActive = ['occupied','aging','attention'].includes(table.status)

  const left = `${((table.pos_x ?? 0) / COORD_MAX) * 100}%`
  const top  = `${((table.pos_y ?? 0) / COORD_MAX) * 100}%`

  const SIZE = isBar ? 52 : 64

  return (
    <button
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={isAttn ? 'bp-attn' : ''}
      style={{
        position:  'absolute',
        left, top,
        transform: `translate(-50%, -50%) scale(${hovered ? 1.06 : 1})`,
        width:  SIZE, height: SIZE,
        borderRadius: isBar ? '50%' : T.radius,
        background: hovered ? T.surface2 : T.surface,
        border: `2px solid ${color}`,
        // Thinner full border for non-active states
        boxShadow: isActive ? `inset 3px 0 0 ${color}` : 'none',
        cursor: 'pointer', fontFamily: 'inherit', color: T.text,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 0, gap: 1,
        transition: 'transform 0.1s ease, background 0.12s ease, border-color 0.12s ease',
        zIndex: isAttn ? 2 : hovered ? 3 : 1,
      }}
    >
      {/* Table ID */}
      <span style={{
        fontFamily: T.mono, fontSize: 11, fontWeight: 700,
        color: isActive ? color : T.textDim,
        letterSpacing: '-0.01em', lineHeight: 1,
      }}>
        {table.id}
      </span>

      {/* Status dot */}
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />

      {/* Check total (if occupied) */}
      {isActive && table.checkTotal > 0 && (
        <span style={{
          fontFamily: T.mono, fontSize: 9, fontWeight: 600,
          color, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        }}>
          ₱{table.checkTotal >= 1000
            ? `${(table.checkTotal / 1000).toFixed(1)}k`
            : table.checkTotal.toFixed(0)}
        </span>
      )}
    </button>
  )
}

// ── Floor plan view ────────────────────────────────────────────────────────────
function FloorPlan({
  tables, tickets, onOpenTable,
}: {
  tables:      TableWithStatus[]
  tickets:     KdsTicket[]
  onOpenTable: (id: string) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Tables that have a valid position (all seeded tables should)
  const pinTables = tables.filter(t => t.pos_x != null && t.pos_y != null)

  // Count KDS items with status 'ready' for the Kitchen Pass indicator
  const readyCount = tickets.filter(t => t.status === 'firing' && t.elapsedSec < 60).length

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

      {/* ── Floor area ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* SVG dot grid background */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="fp-dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="0.5" cy="0.5" r="1" fill={T.line2} opacity={0.6} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#fp-dots)`} />
        </svg>

        {/* Section label watermark */}
        <div style={{
          position: 'absolute', top: 16, left: 20,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: T.textMute, opacity: 0.5,
          pointerEvents: 'none',
        }}>
          Main · Section 1
        </div>

        {/* Table pins */}
        {pinTables.map(table => (
          <TablePin
            key={table.id}
            table={table}
            hovered={hoveredId === table.id}
            onEnter={() => setHoveredId(table.id)}
            onLeave={() => setHoveredId(null)}
            onClick={() => onOpenTable(table.id)}
          />
        ))}

        {/* Empty state for unpositioned tables */}
        {pinTables.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.textMute, fontFamily: T.mono, fontSize: 12,
          }}>
            No floor coordinates — set pos_x/pos_y on tables
          </div>
        )}
      </div>

      {/* ── Kitchen Pass strip ────────────────────────────────────────── */}
      <KitchenPass readyCount={readyCount} />
    </div>
  )
}

// ── Section header reused across panels ──────────────────────────────────────
export function PanelHd({ title, badge, badgeColor, action }: {
  title: React.ReactNode; badge?: React.ReactNode; badgeColor?: string; action?: React.ReactNode
}) {
  return (
    <div style={{
      height: 46, padding: '0 20px', borderBottom: `1px solid ${T.line}`,
      display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: T.text,
      }}>{title}</span>
      {badge && (
        <span style={{
          fontFamily: T.mono, fontSize: 11,
          color: badgeColor ?? T.textDim,
          background: badgeColor ? `${badgeColor}18` : T.chip,
          padding: '2px 8px', borderRadius: 2,
        }}>{badge}</span>
      )}
      <div style={{ flex: 1 }} />
      {action}
    </div>
  )
}

// ── KPI strip (100px, 6 equal columns) ───────────────────────────────────────
function KpiStrip({ tables, tickets }: { tables: TableWithStatus[]; tickets: KdsTicket[] }) {
  const [todayRev,  setTodayRev]  = useState(0)
  const [txCount,   setTxCount]   = useState(0)
  const [avgTurnMin, setAvgTurnMin] = useState<number | null>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function refresh() {
      const sb = getClient() as any
      const todayStart = new Date(); todayStart.setHours(0,0,0,0)

      // Revenue = sum of non-voided order item sales from today's orders
      const { data: todayOrders } = await sb
        .from('orders').select('id')
        .gte('opened_at', todayStart.toISOString())
      const todayOIds = (todayOrders ?? []).map((o: any) => o.id)
      let gross = 0
      let txCount = 0
      if (todayOIds.length > 0) {
        const { data: lines } = await sb
          .from('order_items').select('qty, unit_price')
          .in('order_id', todayOIds)
          .neq('status', 'voided')
        for (const r of (lines ?? [])) gross += r.qty * r.unit_price
        txCount = todayOIds.length
      }
      setTodayRev(gross)
      setTxCount(txCount)

      const { data: orders } = await sb
        .from('orders').select('opened_at, closed_at')
        .eq('status', 'closed')
        .gte('opened_at', todayStart.toISOString())
        .not('closed_at', 'is', null)
      const os = orders ?? []
      if (os.length > 0) {
        const totalMin = os.reduce((s: number, o: any) =>
          s + (new Date(o.closed_at).getTime() - new Date(o.opened_at).getTime()) / 60000, 0)
        setAvgTurnMin(Math.round(totalMin / os.length))
      }
    }
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [])

  const open     = tables.filter(t => ['occupied','aging','attention'].includes(t.status)).length
  const reserved = tables.filter(t => t.status === 'reserved').length
  const attn     = tables.filter(t => t.status === 'attention').length

  // Unbilled = sum of live cart totals on all open tables
  const unbilled = tables
    .filter(t => ['occupied','aging','attention'].includes(t.status))
    .reduce((s, t) => s + (t.checkTotal ?? 0), 0)

  const fmtPeso = (v: number) => v >= 1000
    ? `₱${(v / 1000).toFixed(1)}k`
    : `₱${v.toFixed(0)}`

  const projected = todayRev + unbilled

  const kpis = [
    { label: 'Projected · Today', value: fmtPeso(projected),
      note: unbilled > 0 ? `+${fmtPeso(unbilled)} unbilled` : 'no open tabs',
      noteColor: unbilled > 0 ? T.accent : T.textDim },
    { label: 'Revenue · Today',   value: todayRev > 0 ? fmtPeso(todayRev) : '₱0',
      note: `${txCount} txn today`, noteColor: T.textDim },
    { label: 'Occupied',          value: `${open}/${tables.length}`,
      note: `${reserved} reserved`, noteColor: T.textDim },
    { label: 'Avg. Order',        value: txCount > 0 ? fmtPeso(todayRev / txCount) : '—',
      note: 'today', noteColor: T.textDim },
    { label: 'KDS Open',          value: `${tickets.length}`,
      note: tickets.length > 0 ? `${tickets.filter(t => t.elapsedSec > 360).length} aging` : 'all clear',
      noteColor: tickets.filter(t => t.elapsedSec > 360).length > 0 ? T.warn : T.textDim },
    { label: 'Avg. Turn Time',    value: avgTurnMin != null ? `${avgTurnMin}m` : '—',
      note: 'closed orders today', noteColor: T.textDim },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
      height: 'clamp(80px, 9.3vh, 120px)', borderBottom: `1px solid ${T.line}`, flexShrink: 0,
    }}>
      {kpis.map((k, i) => (
        <div key={k.label} style={{
          padding: '16px 24px',
          borderRight: i < 5 ? `1px solid ${T.line}` : 'none',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: T.textMute,
          }}>{k.label}</div>
          <div style={{
            fontSize: i <= 1 ? 28 : 24, fontWeight: 700,
            fontFamily: T.mono, letterSpacing: '-0.02em',
            color: T.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>{k.value}</div>
          <div style={{ fontSize: 11, color: k.noteColor, fontWeight: 500 }}>{k.note}</div>
        </div>
      ))}
    </div>
  )
}

// ── Table grid card ───────────────────────────────────────────────────────────
function TableCard({
  table, onClick, onRemove,
}: {
  table:    TableWithStatus
  onClick:  () => void
  onRemove?: () => void
}) {
  const color     = statusColor(table.status)
  const isAttn    = table.status === 'attention'
  const isActive  = ['occupied','aging','attention'].includes(table.status)

  return (
    <button
      onClick={onClick}
      className={isAttn ? 'bp-attn' : ''}
      style={{
        textAlign: 'left', padding: 12, cursor: 'pointer',
        background: T.surface, fontFamily: 'inherit', color: T.text,
        border: `1px solid ${color}26`,   // statusColor at ~15% alpha
        borderLeft: `4px solid ${color}`,  // 4px left stripe — the status tell
        borderRadius: T.radius,
        display: 'flex', flexDirection: 'column', gap: 4,
        minHeight: 96, position: 'relative',
        transition: 'background 0.12s ease, transform 0.1s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.surface2; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.surface;  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
    >
      {/* Top row: label + status dot + optional remove */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 17, fontWeight: 700, fontFamily: T.mono, letterSpacing: '-0.01em',
          color: T.text,
        }}>{table.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0,
            marginTop: 3,
          }} />
          {onRemove && (
            <button
              onClick={e => { e.stopPropagation(); onRemove() }}
              title="Remove temporary table"
              style={{
                width: 18, height: 18, borderRadius: T.radius,
                background: `${T.bad}22`, border: `1px solid ${T.bad}44`,
                color: T.bad, cursor: 'pointer', fontSize: 12, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, flexShrink: 0,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Status label */}
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color,
      }}>
        {statusLabel(table.status)}
      </div>

      {/* Foot row: time + check total */}
      {isActive && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 'auto',
        }}>
          <span style={{
            fontSize: 11, fontFamily: T.mono, color: T.textMute,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {table.openMin}m
          </span>
          {table.checkTotal > 0 && (
            <span style={{
              fontSize: 13, fontWeight: 600, fontFamily: T.mono,
              color, fontVariantNumeric: 'tabular-nums',
            }}>
              ₱{table.checkTotal.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </button>
  )
}

// ── New table card + modal ────────────────────────────────────────────────────
function NewTableCard({ tables, onOrder }: { tables: TableWithStatus[]; onOrder: (id: string) => void }) {
  const [open,   setOpen]   = useState(false)
  const [label,  setLabel]  = useState('')
  const [cap,    setCap]    = useState('2')
  const [saving, setSaving] = useState(false)
  const tablesRef = useRef(tables)
  useEffect(() => { tablesRef.current = tables })

  useEffect(() => {
    if (!open) return
    setLabel('Takeout')
    setCap('2')
  }, [open])

  async function create() {
    const trimmed = label.trim()
    if (!trimmed || saving) return
    setSaving(true)
    const existing = tablesRef.current
      .filter(t => t.id.startsWith('W'))
      .map(t => parseInt(t.id.slice(1)) || 0)
    const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getClient() as any).from('restaurant_tables').insert({
      id: `W${nextNum}`, label: trimmed, section: 'walkup',
      capacity: parseInt(cap) || 2, status: 'available', pos_x: null, pos_y: null,
    })
    setSaving(false)
    if (!error) { setOpen(false); onOrder(`W${nextNum}`) }
  }

  return (
    <>
      {/* Card */}
      <button
        onClick={() => setOpen(true)}
        style={{
          textAlign: 'left', padding: 12, cursor: 'pointer',
          background: 'transparent', fontFamily: 'inherit', color: T.textMute,
          border: `1px dashed ${T.line2}`,
          borderRadius: T.radius,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 6,
          minHeight: 96,
          transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = T.surface2
          el.style.borderColor = T.accent
          el.style.color = T.accent
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'transparent'
          el.style.borderColor = T.line2
          el.style.color = T.textMute
        }}
      >
        <svg viewBox="0 0 16 16" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <path d="M8 3v10M3 8h10" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          New Table
        </span>
      </button>

      {/* Modal */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            animation: 'bp-fade-in 0.15s ease forwards',
          }}
        >
          <div style={{
            background: T.surface, border: `1px solid ${T.line2}`,
            borderRadius: T.radiusLg, boxShadow: T.shadowModal,
            width: 360, padding: '32px 32px 28px',
            animation: 'bp-modal-pop 0.22s ease forwards',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>New Temporary Table</div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: T.textMute, cursor: 'pointer', fontSize: 18, padding: 4 }}>×</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 6 }}>Name / Label</div>
              <input
                autoFocus value={label} onChange={e => setLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setOpen(false) }}
                placeholder="e.g. Takeout, Bar Tab"
                style={{
                  width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14,
                  background: T.surface2, border: `1px solid ${T.line2}`,
                  color: T.text, borderRadius: T.radius, padding: '9px 12px', outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textMute, marginBottom: 6 }}>Capacity</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['1','2','4','6','8'].map(n => (
                  <button key={n} onClick={() => setCap(n)} style={{
                    flex: 1, padding: '8px 0', fontSize: 13, fontFamily: T.mono, fontWeight: 600,
                    background: cap === n ? T.accent : T.chip,
                    color:      cap === n ? T.accentInk : T.textDim,
                    border:     `1px solid ${cap === n ? T.accent : T.line2}`,
                    borderRadius: T.radius, cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setOpen(false)} style={{
                flex: 1, padding: '10px 0', fontSize: 13, fontFamily: 'inherit',
                background: T.chip, color: T.textDim,
                border: `1px solid ${T.line2}`, borderRadius: T.radius, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={create} disabled={saving || !label.trim()} style={{
                flex: 2, padding: '10px 0', fontSize: 14, fontFamily: 'inherit', fontWeight: 700,
                background: T.accent, color: T.accentInk,
                border: 'none', borderRadius: T.radius, cursor: 'pointer',
                opacity: (!label.trim() || saving) ? 0.5 : 1,
              }}>{saving ? 'Creating…' : 'Add Table'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Floor panel (left 1280px) ─────────────────────────────────────────────────
function FloorPanel({
  tables, tickets,
  onOpenTable,
}: {
  tables:      TableWithStatus[]
  tickets:     KdsTicket[]
  onOpenTable: (id: string) => void
}) {
  async function removeWalkup(tableId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getClient() as any).from('restaurant_tables').delete().eq('id', tableId)
  }

  const counts = {
    available: tables.filter(t => t.status === 'available').length,
    occupied:  tables.filter(t => t.status === 'occupied').length,
    aging:     tables.filter(t => t.status === 'aging').length,
    attention: tables.filter(t => t.status === 'attention').length,
    reserved:  tables.filter(t => t.status === 'reserved').length,
  }

  const legendItems: [string, string][] = [
    ['Available',       T.textMute],
    ['Occupied',        T.accent],
    ['Aging',           T.warn],
    ['Needs Attention', T.bad],
    ['Reserved',        T.info],
  ]
  const legendCounts = [counts.available, counts.occupied, counts.aging, counts.attention, counts.reserved]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {/* Panel header */}
      <div style={{
        height: 46, padding: '0 20px', borderBottom: `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: T.text,
        }}>
          <span style={{ color: T.accent, marginRight: 8 }}>▸</span>Floor · Section 1
        </span>
        <span style={{
          fontFamily: T.mono, fontSize: 11, color: T.textDim,
          background: T.chip, padding: '2px 8px', borderRadius: 2,
        }}>
          {tables.length} tables
        </span>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 8 }}>
          {legendItems.map(([label, color], i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 10, color: T.textMute, fontFamily: T.mono }}>
                {label} {legendCounts[i]}
              </span>
            </div>
          ))}
        </div>

      </div>

      {/* Body — grid view */}
      <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {tables.map(t => (
            <TableCard
              key={t.id}
              table={t}
              onClick={() => onOpenTable(t.id)}
              onRemove={t.id.startsWith('W') ? () => removeWalkup(t.id) : undefined}
            />
          ))}
          <NewTableCard tables={tables} onOrder={onOpenTable} />
        </div>
      </div>
    </div>
  )
}

// ── FloorView root ────────────────────────────────────────────────────────────
export default function FloorView({
  tables, tickets, tick, onOpenTable, onBump,
}: {
  tables: TableWithStatus[]
  tickets: KdsTicket[]
  tick: number
  onOpenTable: (id: string) => void
  onBump: (orderId: number, station: 'kitchen' | 'bar') => void
}) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <KpiStrip tables={tables} tickets={tickets} />

      {/* Body: 2fr left | 1px divider | 1fr right rail */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 1px minmax(0, 1fr)' }}>
        <FloorPanel
          tables={tables} tickets={tickets}
          onOpenTable={onOpenTable}
        />
        <div style={{ background: T.line }} />
        {/* Right rail: KDS (1fr) + divider + Inventory (clamp) */}
        <div style={{ display: 'grid', gridTemplateRows: `1fr 1px clamp(200px, 26vh, 360px)`, minHeight: 0 }}>
          <KdsPanel tickets={tickets} tick={tick} onBump={onBump} />
          <div style={{ background: T.line }} />
          <InventoryPanel />
        </div>
      </div>
    </div>
  )
}
