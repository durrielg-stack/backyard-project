'use client'

import { useState } from 'react'
import { THEME, statusColor, statusLabel } from '@/lib/theme'
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
export function PanelHd({ title, badge, action }: {
  title: React.ReactNode; badge?: React.ReactNode; action?: React.ReactNode
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
          fontFamily: T.mono, fontSize: 11, color: T.textDim,
          background: T.chip, padding: '2px 8px', borderRadius: 2,
        }}>{badge}</span>
      )}
      <div style={{ flex: 1 }} />
      {action}
    </div>
  )
}

// ── KPI strip (100px, 6 equal columns) ───────────────────────────────────────
function KpiStrip({ tables }: { tables: TableWithStatus[] }) {
  const open     = tables.filter(t => ['occupied','aging','attention'].includes(t.status)).length
  const reserved = tables.filter(t => t.status === 'reserved').length
  const attn     = tables.filter(t => t.status === 'attention').length

  const kpis = [
    { label: 'Revenue · Today',  value: '—',                    note: 'tap Reports for detail', noteColor: T.textDim },
    { label: 'Open Tables',      value: `${open}/${tables.length}`, note: `${reserved} reserved`, noteColor: T.textDim },
    { label: 'Avg. Order',       value: '—',                    note: '—', noteColor: T.textDim },
    { label: 'Staff on Floor',   value: '—',                    note: '4 svr · 2 bar · 1 expo', noteColor: T.textDim },
    { label: 'Covers',           value: '—',                    note: `${attn} need attention`, noteColor: attn > 0 ? T.bad : T.textDim },
    { label: 'Avg. Turn Time',   value: '—',                    note: '—', noteColor: T.textDim },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
      height: 100, borderBottom: `1px solid ${T.line}`, flexShrink: 0,
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
            fontSize: i === 0 ? 32 : 26, fontWeight: 700,
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
  table, onClick,
}: {
  table: TableWithStatus
  onClick: () => void
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
      {/* Top row: number + status dot */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 17, fontWeight: 700, fontFamily: T.mono, letterSpacing: '-0.01em',
          color: T.text,
        }}>{table.id}</span>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0,
          marginTop: 3,
        }} />
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
              ${table.checkTotal.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </button>
  )
}

// ── Floor panel (left 1280px) ─────────────────────────────────────────────────
function FloorPanel({
  tables, tickets,
  layout, setLayout,
  onOpenTable,
}: {
  tables:      TableWithStatus[]
  tickets:     KdsTicket[]
  layout:      'grid' | 'floor'
  setLayout:   (l: 'grid' | 'floor') => void
  onOpenTable: (id: string) => void
}) {
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

        <div style={{ flex: 1 }} />

        {/* Grid / Floor toggle */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['grid', 'floor'] as const).map(mode => (
            <button key={mode} onClick={() => setLayout(mode)} style={{
              padding: '5px 12px', fontSize: 12, fontFamily: 'inherit',
              background: layout === mode ? T.accent : T.chip,
              color:      layout === mode ? T.accentInk : T.textDim,
              border:     `1px solid ${layout === mode ? T.accent : T.line2}`,
              borderRadius: T.radius, cursor: 'pointer',
              fontWeight: layout === mode ? 600 : 400,
              transition: 'background 0.12s ease',
            }}>
              {mode === 'grid' ? 'Grid' : 'Floor'}
            </button>
          ))}
        </div>
      </div>

      {/* Body — grid scrolls, floor plan fills */}
      {layout === 'grid' ? (
        <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            {tables.map(t => (
              <TableCard key={t.id} table={t} onClick={() => onOpenTable(t.id)} />
            ))}
          </div>
        </div>
      ) : (
        <FloorPlan tables={tables} tickets={tickets} onOpenTable={onOpenTable} />
      )}
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
  const [layout, setLayout] = useState<'grid' | 'floor'>('grid')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <KpiStrip tables={tables} />

      {/* Body: 1280px left | 1px divider | right rail */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1280px 1px 1fr' }}>
        <FloorPanel
          tables={tables} tickets={tickets}
          layout={layout} setLayout={setLayout}
          onOpenTable={onOpenTable}
        />
        <div style={{ background: T.line }} />
        {/* Right rail: KDS (1fr) + divider + Inventory (280px) */}
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1px 280px', minHeight: 0 }}>
          <KdsPanel tickets={tickets} tick={tick} onBump={onBump} />
          <div style={{ background: T.line }} />
          <InventoryPanel />
        </div>
      </div>
    </div>
  )
}
