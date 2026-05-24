'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { THEME } from '@/lib/theme'
import type { MenuItem } from '@/lib/types'

const T = THEME

// ── DB category → tab group mapping ─────────────────────────────────────────
const GROUPS = [
  { id: 'food',      label: 'Food',      key: '1',
    cats: ['Meals','Pork','Starters','Chicken','Noodles','Seafood'] },
  { id: 'beers',     label: 'Beers',     key: '2',
    cats: ['Beer','Non-Alcohol'] },
  { id: 'cocktails', label: 'Cocktails', key: '3',
    cats: ['Cocktails/Hard'] },
  { id: 'addons',    label: 'Add-Ons',   key: '4',
    cats: ['Extra','Others'] },
  { id: 'others',    label: 'Others',    key: '5',
    cats: ['Cigarettes','Charges'] },
] as const

type GroupId = (typeof GROUPS)[number]['id']

const QUICK_ACTIONS = ['No-mod fire','Comp item','Send to bar','Print prep','Manager void'] as const

// ── Kbd hint chip ─────────────────────────────────────────────────────────────
function Kbd({ children }: { children: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 4px',
      border: `1px solid ${T.line2}`, borderRadius: T.radius,
      fontSize: 10, fontFamily: T.mono, color: T.textMute,
      letterSpacing: 0, lineHeight: 1,
    }}>
      {children}
    </span>
  )
}

// ── Menu card ─────────────────────────────────────────────────────────────────
function MenuCard({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onAdd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left', padding: 16, cursor: 'pointer',
        background:    hover ? T.surface2 : T.surface,
        border:        `1px solid ${hover ? T.line2 : T.line}`,
        color:         T.text, fontFamily: 'inherit',
        borderRadius:  T.radius, position: 'relative',
        display:       'flex', flexDirection: 'column', justifyContent: 'space-between',
        minHeight:     110,
        transform:     hover ? 'translateY(-1px)' : 'translateY(0)',
        transition:    'background 0.12s ease, border-color 0.12s ease, transform 0.1s ease',
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 4 }}>
          {item.name}
        </div>
        {item.description && (
          <div style={{ fontSize: 11, color: T.textMute, lineHeight: 1.4 }}>
            {item.description}
          </div>
        )}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginTop: 12,
      }}>
        <span style={{
          fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.accent,
          fontVariantNumeric: 'tabular-nums',
        }}>
          ₱{item.price.toFixed(2)}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24,
          background: hover ? T.accent : T.chip,
          color:      hover ? T.accentInk : T.textDim,
          borderRadius: T.radius,
          fontSize: 18, lineHeight: 1,
          transition: 'background 0.12s ease, color 0.12s ease',
        }}>
          +
        </span>
      </div>
    </button>
  )
}

// ── MenuPanel ─────────────────────────────────────────────────────────────────
interface MenuPanelProps {
  byCategory: Record<string, MenuItem[]>
  onAdd: (item: MenuItem) => void
  onKeyboardShortcut?: (key: string) => void   // bubble ↵/S/H up to OrderView
}

export default function MenuPanel({ byCategory, onAdd, onKeyboardShortcut }: MenuPanelProps) {
  const [group, setGroup]         = useState<GroupId>('food')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [query, setQuery]         = useState('')
  const searchRef                 = useRef<HTMLInputElement>(null)

  const activeGroup = GROUPS.find(g => g.id === group)!

  // Reset sub-cat when group changes
  useEffect(() => { setActiveCat(null) }, [group])

  // Keyboard shortcuts: 1/2/3 = group, ⌘K = focus search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        // Let ↵/S/H bubble out even from inputs
        if (['Enter','s','h'].includes(e.key.toLowerCase())) onKeyboardShortcut?.(e.key)
        return
      }

      if (e.key === '1') { setGroup('food');      e.preventDefault() }
      if (e.key === '2') { setGroup('beers');     e.preventDefault() }
      if (e.key === '3') { setGroup('cocktails'); e.preventDefault() }
      if (e.key === '4') { setGroup('addons');    e.preventDefault() }
      if (e.key === '5') { setGroup('others');    e.preventDefault() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      // Bubble charge / split / hold
      if (['Enter','s','h','S','H'].includes(e.key)) onKeyboardShortcut?.(e.key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKeyboardShortcut])

  // Items to show
  const groupItems = useCallback(() => {
    const cats = activeCat ? [activeCat] : activeGroup.cats
    const all  = cats.flatMap(c => byCategory[c] ?? [])
    if (!query) return all
    const q = query.toLowerCase()
    return all.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q)
    )
  }, [byCategory, activeGroup, activeCat, query])

  const items = groupItems()

  // Sub-categories present in DB for the active group
  const subCats = activeGroup.cats.filter(c => (byCategory[c]?.length ?? 0) > 0)

  return (
    <div style={{
      borderRight: `1px solid ${T.line}`,
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>

      {/* ── Category tabs + search — 80px ─────────────────────────────── */}
      <div style={{
        height: 80, padding: '0 28px', flexShrink: 0,
        borderBottom: `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {GROUPS.map(g => {
            const active = group === g.id
            return (
              <button key={g.id} onClick={() => setGroup(g.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', cursor: 'pointer', border: 'none',
                background:   active ? T.accent : T.chip,
                color:        active ? T.accentInk : T.text,
                fontFamily:   'inherit', fontSize: 14, fontWeight: 600,
                letterSpacing: '-0.01em', borderRadius: T.radius,
                transition:   'background 0.12s ease',
              }}>
                {g.label}
                <Kbd>{g.key}</Kbd>
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          width: 'clamp(220px, 14.6vw, 360px)', background: T.surface, border: `1px solid ${T.line2}`,
          borderRadius: T.radius, color: T.textDim,
        }}>
          <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="7" cy="7" r="4" />
            <path d="M10 10l3 3" strokeLinecap="round"/>
          </svg>
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search menu…  ⌘K"
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              color: T.text, fontFamily: 'inherit', fontSize: 13,
              flex: 1, width: 0,
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              background: 'none', border: 'none', color: T.textMute,
              cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1,
            }}>×</button>
          )}
        </div>
      </div>

      {/* ── Sub-category chips ─────────────────────────────────────────── */}
      {subCats.length > 1 && (
        <div className="bp-no-scrollbar" style={{
          display: 'flex', gap: 6, padding: '10px 28px',
          borderBottom: `1px solid ${T.line}`, overflowX: 'auto', flexShrink: 0,
        }}>
          <button
            onClick={() => setActiveCat(null)}
            style={{
              padding: '4px 12px', fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
              background: activeCat === null ? T.accent : T.chip,
              color:      activeCat === null ? T.accentInk : T.textDim,
              border: 'none', borderRadius: T.radius, cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'background 0.12s ease',
            }}
          >
            All
          </button>
          {subCats.map(cat => (
            <button key={cat} onClick={() => setActiveCat(cat)} style={{
              padding: '4px 12px', fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
              background: activeCat === cat ? T.accent : T.chip,
              color:      activeCat === cat ? T.accentInk : T.textDim,
              border: 'none', borderRadius: T.radius, cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'background 0.12s ease',
            }}>
              {cat}
              <span style={{
                marginLeft: 5, fontSize: 10, fontFamily: T.mono,
                opacity: 0.6,
              }}>
                {byCategory[cat]?.length ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Item grid ─────────────────────────────────────────────────── */}
      <div className="bp-no-scrollbar" style={{
        flex: 1, overflowY: 'auto', padding: '20px 28px 12px',
      }}>
        {/* Section label */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14,
          color: T.textMute, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          <span>{activeCat ?? activeGroup.label}</span>
          <span style={{ flex: 1, height: 1, background: T.line }} />
          <span style={{ color: T.textDim, fontFamily: T.mono }}>
            {items.length} items
          </span>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        }}>
          {items.map(item => (
            <MenuCard key={item.id} item={item} onAdd={() => onAdd(item)} />
          ))}
          {items.length === 0 && (
            <div style={{
              gridColumn: '1 / -1', padding: '24px 0',
              color: T.textMute, fontSize: 13, fontFamily: T.mono,
            }}>
              {query ? `No results for "${query}"` : 'No items in this category'}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick actions strip ────────────────────────────────────────── */}
      <div style={{
        padding: '12px 18px', flexShrink: 0,
        borderTop: `1px solid ${T.line}`,
        background: T.surface,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: T.textMute, flexShrink: 0,
        }}>
          Quick
        </div>
        {QUICK_ACTIONS.map(label => (
          <button key={label} style={{
            padding: '6px 12px', fontSize: 12, background: 'transparent',
            border: `1px solid ${T.line2}`, color: T.text,
            fontFamily: 'inherit', borderRadius: T.radius, cursor: 'pointer',
            transition: 'background 0.12s ease, border-color 0.12s ease',
          }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
