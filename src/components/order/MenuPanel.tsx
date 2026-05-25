'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import type { MenuItem } from '@/lib/types'


// ── DB category → tab group mapping ─────────────────────────────────────────
const GROUPS = [
  { id: 'food',    label: 'Food',    key: '1',
    cats: ['Meals','Pork','Starters','Chicken','Noodles','Seafood'] },
  { id: 'drinks',  label: 'Drinks',  key: '2',
    cats: ['Beer','Cocktails','Hard Drinks','Palit Bote','Non-Alcohol'] },
  { id: 'addons',  label: 'Add-Ons', key: '3',
    cats: ['Extra','Others'] },
  { id: 'others',  label: 'Others',  key: '4',
    cats: ['Cigarettes','Charges'] },
] as const

type GroupId = (typeof GROUPS)[number]['id']

// ── Kbd hint chip ─────────────────────────────────────────────────────────────
function Kbd({ children }: { children: string }) {
  const { T } = useTheme()
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
  const { T } = useTheme()
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
        minHeight:     90,
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
  byCategory:          Record<string, MenuItem[]>
  onAdd:               (item: MenuItem) => void
  onKeyboardShortcut?: (key: string) => void
}

export default function MenuPanel({ byCategory, onAdd, onKeyboardShortcut }: MenuPanelProps) {
  const { T } = useTheme()
  const [group, setGroup]         = useState<GroupId>('food')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [query, setQuery]         = useState('')
  const searchRef                 = useRef<HTMLInputElement>(null)
  const bp = useBreakpoint()
  const isMobile  = bp === 'mobile'
  const isTablet  = bp === 'tablet'

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

      if (e.key === '1') { setGroup('food');    e.preventDefault() }
      if (e.key === '2') { setGroup('drinks');  e.preventDefault() }
      if (e.key === '3') { setGroup('addons');  e.preventDefault() }
      if (e.key === '4') { setGroup('others');  e.preventDefault() }
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
    if (query) {
      const q   = query.toLowerCase()
      const all = Object.values(byCategory).flat()
      return all.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      )
    }
    const cats = activeCat ? [activeCat] : activeGroup.cats
    return cats.flatMap(c => byCategory[c] ?? [])
  }, [byCategory, activeGroup, activeCat, query])

  const items = groupItems()

  // Sub-categories present in DB for the active group
  const subCats = activeGroup.cats.filter(c => (byCategory[c]?.length ?? 0) > 0)

  return (
    <div style={{
      borderRight: `1px solid ${T.line}`,
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>

      {/* ── Category tabs + search ─────────────────────────────────────── */}
      <div style={{
        minHeight: isMobile ? 'auto' : 80, padding: isMobile ? '10px 14px' : '0 28px',
        flexShrink: 0, borderBottom: `1px solid ${T.line}`,
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 8 : 18,
      }}>
        <div className="bp-no-scrollbar" style={{ display: 'flex', gap: 4, overflowX: 'auto', flexShrink: 0 }}>
          {GROUPS.map(g => {
            const active = group === g.id
            return (
              <button key={g.id} onClick={() => setGroup(g.id)} style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8,
                padding: isMobile ? '8px 12px' : '10px 18px', cursor: 'pointer', border: 'none',
                background:   active ? T.accent : T.chip,
                color:        active ? T.accentInk : T.text,
                fontFamily:   'inherit', fontSize: isMobile ? 13 : 14, fontWeight: 600,
                letterSpacing: '-0.01em', borderRadius: T.radius,
                transition:   'background 0.12s ease', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {g.label}
                {!isMobile && <Kbd>{g.key}</Kbd>}
              </button>
            )
          })}
        </div>

        {!isMobile && <div style={{ flex: 1 }} />}

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          width: isMobile ? '100%' : 'clamp(220px, 14.6vw, 360px)',
          boxSizing: 'border-box',
          background: T.surface, border: `1px solid ${T.line2}`,
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
            placeholder={isMobile ? 'Search menu…' : 'Search menu…  ⌘K'}
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
          display: 'flex', gap: 6, padding: isMobile ? '8px 14px' : '10px 28px',
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
        flex: 1, overflowY: 'auto', padding: isMobile ? '14px 14px 80px' : '20px 28px 12px',
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
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? 8 : 12,
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

    </div>
  )
}
