'use client'

import { useState, useRef, useEffect } from 'react'
import { THEME, statusColor } from '@/lib/theme'
import { getClient } from '@/lib/supabase'
import type { TableWithStatus, CartLine } from '@/lib/types'

type View = 'floor' | 'reports' | 'owner' | { kind: 'order'; tableId: string }

interface NavBarProps {
  view: View
  openTabs: string[]
  tables: TableWithStatus[]
  carts: Map<string, CartLine[]>
  attnCount: number
  now: Date
  onFloor: () => void
  onReports: () => void
  onOwner: () => void
  onOrder: (tableId: string) => void
  onCloseTab: (tableId: string) => void
}

const T = THEME

// ── Icon atoms (SVG inline, currentColor, 1.5px stroke) ─────────────────────
function Icon({ name, size = 16 }: { name: 'bell' | 'plus' | 'close' | 'lock'; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    bell:  <path d="M4.5 11V8a3.5 3.5 0 117 0v3l1 1.5h-9zM7 13.5a1 1 0 002 0" />,
    plus:  <path d="M8 3v10M3 8h10" />,
    close: <path d="M3 3l10 10M13 3L3 13" />,
    lock:  <><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 016 0v2" /></>,
  }
  return (
    <svg
      viewBox="0 0 16 16" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      {paths[name]}
    </svg>
  )
}

// ── Live-pulse dot (used next to brand label) ────────────────────────────────
function PulseDot() {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6 }}>
      <span className="bp-pulse" style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: T.accent,
      }} />
      <span style={{
        position: 'relative', width: 6, height: 6, borderRadius: '50%',
        background: T.accent,
      }} />
    </span>
  )
}

// ── Single tab ───────────────────────────────────────────────────────────────
interface TabProps {
  active: boolean
  onClick: () => void
  label: React.ReactNode
  sub: React.ReactNode
  dot?: 'bad' | 'warn' | null
  dashed?: boolean
  dimmed?: boolean
  onClose?: () => void
}

function NavTab({ active, onClick, label, sub, dot, dashed, dimmed, onClose }: TabProps) {
  const borderColor = dashed ? T.line2 : 'transparent'
  return (
    <div
      onClick={onClick}
      style={{
        minWidth: 96, height: 64, padding: '0 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        justifyContent: 'center', gap: 2,
        cursor: 'pointer', position: 'relative',
        background: active ? T.surface2 : 'transparent',
        borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
        borderLeft: dashed ? `1px dashed ${borderColor}` : 'none',
        borderRight: dashed ? `1px dashed ${borderColor}` : 'none',
        borderTop: dashed ? `1px dashed ${borderColor}` : 'none',
        opacity: dimmed ? 0.6 : 1,
        transition: 'background 0.12s ease',
        flexShrink: 0,
      }}
    >
      {/* Status dot for table tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {dot && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: dot === 'bad' ? T.bad : T.warn,
          }} />
        )}
        <span style={{
          fontSize: 13, fontWeight: active ? 700 : 400, lineHeight: 1,
          color: active ? T.text : T.textDim,
          fontFamily: typeof label === 'string' && /^[TB]\d/.test(label as string)
            ? T.mono : T.sansBody,
        }}>
          {label}
        </span>
        {/* Close button on per-table tabs */}
        {onClose && (
          <span
            onClick={e => { e.stopPropagation(); onClose() }}
            style={{
              marginLeft: 4, color: T.textMute, cursor: 'pointer', lineHeight: 1,
              display: 'flex', alignItems: 'center',
            }}
          >
            <Icon name="close" size={11} />
          </span>
        )}
      </div>
      <span style={{
        fontSize: 10, fontFamily: T.mono, color: T.textMute, lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {sub}
      </span>
    </div>
  )
}

// ── NewTabPicker — creates a temporary walkup table ───────────────────────────
function NewTabPicker({
  tables,
  onOrder,
}: {
  tables: TableWithStatus[]
  onOrder: (tableId: string) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [label,   setLabel]   = useState('')
  const [cap,     setCap]     = useState('2')
  const [saving,  setSaving]  = useState(false)
  const ref        = useRef<HTMLDivElement>(null)
  const tablesRef  = useRef(tables)
  useEffect(() => { tablesRef.current = tables })

  // Set default label only when modal opens — tablesRef avoids re-firing on every tick
  useEffect(() => {
    if (!open) return
    setLabel('Takeout')
    setCap('2')
  }, [open])

  async function create() {
    const trimmed = label.trim()
    if (!trimmed || saving) return
    setSaving(true)

    // Derive ID: W1, W2, … from existing walkup tables
    const existing = tablesRef.current
      .filter(t => t.id.startsWith('W'))
      .map(t => parseInt(t.id.slice(1)) || 0)
    const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1
    const newId = `W${nextNum}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getClient() as any)
      .from('restaurant_tables')
      .insert({
        id:       newId,
        label:    trimmed,
        section:  'walkup',
        capacity: parseInt(cap) || 2,
        status:   'available',
        pos_x:    null,
        pos_y:    null,
      })

    setSaving(false)
    if (!error) {
      setOpen(false)
      onOrder(newId)
    }
  }

  return (
    <>
      {/* NavBar trigger tab */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          minWidth: 80, height: 64, padding: '0 14px',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          justifyContent: 'center', gap: 2,
          cursor: 'pointer',
          background: open ? T.surface2 : 'transparent',
          borderBottom: open ? `2px solid ${T.accent}` : '2px solid transparent',
          borderLeft: `1px dashed ${T.line2}`,
          borderRight: `1px dashed ${T.line2}`,
          borderTop:   `1px dashed ${T.line2}`,
          transition: 'background 0.12s ease',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: open ? T.text : T.textDim }}>
          <Icon name="plus" size={11} />
          New
        </span>
        <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textMute }}>
          Bar / Takeout
        </span>
      </div>

      {/* Fullscreen modal — sits above everything, not clipped by navbar */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            animation: 'bp-fade-in 0.15s ease forwards',
          }}
        >
          <div
            ref={ref}
            style={{
              background: T.surface, border: `1px solid ${T.line2}`,
              borderRadius: T.radiusLg, boxShadow: T.shadowModal,
              width: 360, padding: '32px 32px 28px',
              animation: 'bp-modal-pop 0.22s ease forwards',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 24,
            }}>
              <div style={{
                fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: '-0.01em',
              }}>
                New Temporary Table
              </div>
              <button onClick={() => setOpen(false)} style={{
                background: 'none', border: 'none', color: T.textMute,
                cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
              }}>×</button>
            </div>

            {/* Label */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
                textTransform: 'uppercase', color: T.textMute, marginBottom: 6,
              }}>
                Name / Label
              </div>
              <input
                autoFocus
                value={label}
                onChange={e => setLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setOpen(false) }}
                placeholder="e.g. Walkup 1, Bar Tab, Takeout"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  fontFamily: 'inherit', fontSize: 14,
                  background: T.surface2, border: `1px solid ${T.line2}`,
                  color: T.text, borderRadius: T.radius,
                  padding: '9px 12px', outline: 'none',
                }}
              />
            </div>

            {/* Capacity */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
                textTransform: 'uppercase', color: T.textMute, marginBottom: 6,
              }}>
                Capacity
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['1','2','4','6','8'].map(n => (
                  <button key={n} onClick={() => setCap(n)} style={{
                    flex: 1, padding: '8px 0', fontSize: 13, fontFamily: T.mono, fontWeight: 600,
                    background: cap === n ? T.accent : T.chip,
                    color:      cap === n ? T.accentInk : T.textDim,
                    border:     `1px solid ${cap === n ? T.accent : T.line2}`,
                    borderRadius: T.radius, cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setOpen(false)} style={{
                flex: 1, padding: '10px 0', fontSize: 13,
                fontFamily: 'inherit', fontWeight: 500,
                background: T.chip, color: T.textDim,
                border: `1px solid ${T.line2}`, borderRadius: T.radius, cursor: 'pointer',
              }}>
                Cancel
              </button>
              <button
                onClick={create}
                disabled={saving || !label.trim()}
                style={{
                  flex: 2, padding: '10px 0', fontSize: 14,
                  fontFamily: 'inherit', fontWeight: 700,
                  background: T.accent, color: T.accentInk,
                  border: 'none', borderRadius: T.radius, cursor: 'pointer',
                  opacity: (!label.trim() || saving) ? 0.5 : 1,
                  transition: 'opacity 0.12s ease',
                }}
              >
                {saving ? 'Creating…' : 'Add Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── NavBar ───────────────────────────────────────────────────────────────────
export default function NavBar({
  view, openTabs, tables, carts,
  attnCount, now, onFloor, onReports, onOwner, onOrder, onCloseTab,
}: NavBarProps) {
  const time    = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  // Counts for Floor tab sub-label
  const openCount = tables.filter(t => ['occupied','aging','attention'].includes(t.status)).length
  const attnTabs  = tables.filter(t => t.status === 'attention').length

  const currentTableId = typeof view === 'object' ? view.tableId : null

  // Build table lookup for tabs
  const tableMap = new Map(tables.map(t => [t.id, t]))

  return (
    <div style={{
      height: 64, flexShrink: 0,
      background: T.bg, borderBottom: `1px solid ${T.line}`,
      display: 'flex', alignItems: 'stretch',
      overflow: 'hidden',
    }}>
      {/* ── Brand ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 20px 0 24px', flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, background: T.accent, color: T.accentInk,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13, letterSpacing: '-0.04em', borderRadius: 2,
          flexShrink: 0,
        }}>
          B
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1 }}>
            The Backyard Project
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, marginTop: 3,
            fontSize: 10, color: T.textMute, letterSpacing: '0.1em',
            textTransform: 'uppercase', fontFamily: T.mono,
          }}>
            <PulseDot />
            <span>POS · Floor 1</span>
          </div>
        </div>
      </div>

      {/* ── 1px vertical divider ───────────────────────────────────────────── */}
      <div style={{ width: 1, background: T.line, margin: '12px 0', flexShrink: 0 }} />

      {/* ── Tab strip ─────────────────────────────────────────────────────── */}
      <div className="bp-no-scrollbar" style={{
        display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0,
        overflow: 'hidden', // tabs truncate, not scroll
        gap: 0,
      }}>
        {/* Floor */}
        <NavTab
          active={view === 'floor'}
          onClick={onFloor}
          label="Floor"
          sub={`${openCount} open · ${attnTabs} attn`}
        />

        {/* Reports */}
        <NavTab
          active={view === 'reports'}
          onClick={onReports}
          label="Reports"
          sub="Revenue · Sales"
        />

        {/* Owner */}
        <NavTab
          active={view === 'owner'}
          onClick={onOwner}
          label={
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="lock" size={11} />
              Owner
            </span>
          }
          sub="Full access"
        />

        {/* Per-table open tabs */}
        {openTabs.map(tableId => {
          const t = tableMap.get(tableId)
          if (!t) return null
          const cart    = carts.get(tableId) ?? []
          const total   = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0)
          const dot = t.status === 'attention' ? 'bad' as const
                    : t.status === 'aging'     ? 'warn' as const
                    : null
          return (
            <NavTab
              key={tableId}
              active={currentTableId === tableId}
              onClick={() => onOrder(tableId)}
              label={tableId}
              sub={`$${total.toFixed(0)} · ${t.openMin}m`}
              dot={dot}
              onClose={() => onCloseTab(tableId)}
            />
          )
        })}

        {/* + New — quick table picker */}
        <NewTabPicker tables={tables} onOrder={onOrder} />
      </div>

      {/* ── Right chrome ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 24px', flexShrink: 0,
        fontSize: 13, color: T.textDim,
      }}>
        {/* Bell + attention badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="bell" size={14} />
          {attnCount > 0 && (
            <span style={{
              background: T.bad, color: '#fff',
              fontSize: 10, fontWeight: 600, fontFamily: T.mono,
              padding: '1px 5px', borderRadius: 2,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {attnCount}
            </span>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: T.line }} />

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: T.chip, border: `1px solid ${T.line2}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, color: T.text, flexShrink: 0,
          }}>
            LM
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.text, lineHeight: 1 }}>Lia M.</div>
            <div style={{ fontSize: 10, color: T.textMute, lineHeight: 1, marginTop: 2 }}>· Server + Mgr</div>
          </div>
        </div>

        <div style={{ width: 1, height: 20, background: T.line }} />

        {/* Clock */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: T.mono, fontSize: 13, color: T.text, lineHeight: 1,
            fontVariantNumeric: 'tabular-nums', fontWeight: 500,
          }}>
            {time}
          </div>
          <div style={{
            fontFamily: T.mono, fontSize: 10, color: T.textMute, lineHeight: 1, marginTop: 2,
          }}>
            {dateStr}
          </div>
        </div>
      </div>
    </div>
  )
}
