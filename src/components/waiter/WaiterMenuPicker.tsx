'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { useMenuItems } from '@/hooks/useMenuItems'
import { useOrder } from '@/hooks/useOrder'
import type { MenuItem } from '@/lib/types'

const GROUPS = [
  { id: 'all',    label: 'All',     cats: null },
  { id: 'food',   label: 'Food',    cats: ['Meals','Pork','Starters','Chicken','Noodles','Seafood'] },
  { id: 'drinks', label: 'Drinks',  cats: ['Beer','Cocktails','Hard Drinks','Palit Bote','Non-Alcohol'] },
  { id: 'addons', label: 'Add-Ons', cats: ['Extra','Others'] },
  { id: 'others', label: 'Others',  cats: ['Cigarettes','Charges'] },
] as const

type GroupId = (typeof GROUPS)[number]['id']

interface Props {
  tableId: string
  waiterName: string
  onBack: () => void
  onSent: () => void
}

interface PendingItem { item: MenuItem; qty: number }

function fmtPeso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function WaiterMenuPicker({ tableId, waiterName, onBack, onSent }: Props) {
  const { T, mode, toggle }   = useTheme()
  const { items, loading }    = useMenuItems()
  const { addItem }           = useOrder(tableId, waiterName)

  const [query, setQuery]       = useState('')
  const [group, setGroup]       = useState<GroupId>('all')
  const [pending, setPending]   = useState<Map<string, PendingItem>>(new Map())
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)

  useEffect(() => {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  const pendingList = Array.from(pending.values())
  const pendingTotal = pendingList.reduce((s, p) => s + p.item.price * p.qty, 0)
  const pendingCount = pendingList.reduce((s, p) => s + p.qty, 0)

  const filtered = useMemo(() => {
    const g = GROUPS.find(g => g.id === group)
    return items.filter(item => {
      const matchCat  = !g?.cats || g.cats.some(c => item.category === c || item.category2 === c || item.category3 === c)
      const matchQ    = !query || item.name.toLowerCase().includes(query.toLowerCase())
      return matchCat && matchQ
    })
  }, [items, group, query])

  function adjustQty(item: MenuItem, delta: number) {
    setPending(prev => {
      const next = new Map(prev)
      const cur  = next.get(item.id)
      const newQty = (cur?.qty ?? 0) + delta
      if (newQty <= 0) {
        next.delete(item.id)
      } else {
        next.set(item.id, { item, qty: newQty })
      }
      return next
    })
  }

  async function handleConfirm() {
    setSending(true)
    for (const { item, qty } of pendingList) {
      await addItem(item, qty)
    }
    setSending(false)
    setSent(true)
    setTimeout(() => {
      setSent(false)
      onSent()
    }, 1800)
  }

  // ── Order Sent overlay ─────────────────────────────────────────────────────
  if (sent) return (
    <div style={{
      background: T.bg, height: '100dvh', fontFamily: T.sansBody,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: `${T.ok}18`, border: `2px solid ${T.ok}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 30, color: T.ok,
      }}>✓</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Order Sent!</div>
      <div style={{ fontSize: 13, color: T.textMute, textAlign: 'center' }}>
        Items added to {tableId}.<br />Returning to order…
      </div>
    </div>
  )

  return (
    <div className="bp-waiter-root" style={{
      background: T.bg, height: '100dvh', fontFamily: T.sansBody,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        background: T.surface, borderBottom: `1px solid ${T.line}`,
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          disabled={sending}
          style={{
            background: 'none', border: 'none', cursor: sending ? 'default' : 'pointer',
            color: sending ? T.textMute : T.info, fontSize: 14, fontFamily: 'inherit', padding: '4px 0',
          }}
        >
          ← Order
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Add Items</div>
        <button
          onClick={toggle}
          style={{
            background: T.surface2, border: `1px solid ${T.line2}`,
            borderRadius: T.radiusLg, padding: '6px 10px',
            color: T.textDim, fontSize: 15, cursor: 'pointer', lineHeight: 1,
          }}
        >
          {mode === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="🔍 Search menu…"
          style={{
            width: '100%', padding: '10px 14px', fontSize: 14, boxSizing: 'border-box',
            background: T.surface, border: `1px solid ${T.line2}`,
            color: T.text, borderRadius: T.radius, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>

      {/* Category tabs */}
      <div className="bp-scroll-x bp-no-scrollbar" style={{
        display: 'flex', gap: 6, padding: '10px 16px',
        overflowX: 'auto', flexShrink: 0,
      }}>
        {GROUPS.map(g => (
          <button
            key={g.id}
            onClick={() => setGroup(g.id)}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600,
              borderRadius: 99, whiteSpace: 'nowrap', cursor: 'pointer',
              fontFamily: 'inherit',
              background: group === g.id ? T.accent : T.surface,
              color:      group === g.id ? T.accentInk : T.textDim,
              border:     `1px solid ${group === g.id ? T.accent : T.line2}`,
              transition: 'all 0.1s',
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div className="bp-scroll-y" style={{
        flex: 1, overflowY: 'auto', padding: '0 16px',
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 10, alignContent: 'start', paddingBottom: 80,
      }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', color: T.textMute, fontSize: 13, fontFamily: T.mono, textAlign: 'center', padding: '32px 0' }}>
            Loading menu…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ gridColumn: '1/-1', color: T.textMute, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
            No items found
          </div>
        ) : filtered.map(item => {
          const p = pending.get(item.id)
          const qty = p?.qty ?? 0
          const selected = qty > 0

          return (
            <div
              key={item.id}
              style={{
                background: selected ? `${T.accent}12` : T.surface,
                border: `1px solid ${selected ? T.accent : T.line}`,
                borderRadius: T.radiusLg, padding: '12px 10px',
                display: 'flex', flexDirection: 'column',
                transition: 'border-color 0.1s, background 0.1s',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.3, marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.info }}>{fmtPeso(item.price)}</div>
              </div>
              {/* Qty controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                {selected ? (
                  <>
                    <button
                      onClick={() => adjustQty(item, -1)}
                      style={{
                        width: 28, height: 28, borderRadius: T.radius,
                        background: T.surface2, border: `1px solid ${T.line2}`,
                        color: T.text, fontSize: 16, cursor: 'pointer', lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >−</button>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.text, minWidth: 20, textAlign: 'center' }}>
                      {qty}
                    </span>
                    <button
                      onClick={() => adjustQty(item, 1)}
                      style={{
                        width: 28, height: 28, borderRadius: T.radius,
                        background: T.accent, border: 'none',
                        color: T.accentInk, fontSize: 16, cursor: 'pointer', lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >+</button>
                  </>
                ) : (
                  <button
                    onClick={() => adjustQty(item, 1)}
                    style={{
                      width: '100%', padding: '5px 0', borderRadius: T.radius,
                      background: T.surface2, border: `1px solid ${T.line2}`,
                      color: T.textDim, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Cart bar */}
      {pendingCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: T.surface, borderTop: `1px solid ${T.line}`,
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 12, color: T.textMute }}>{pendingCount} item{pendingCount !== 1 ? 's' : ''}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ok }}>{fmtPeso(pendingTotal)}</div>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            style={{
              flex: 1, maxWidth: 200, padding: '12px 16px',
              background: T.accent, color: T.accentInk,
              border: 'none', borderRadius: T.radius,
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Review Order →
          </button>
        </div>
      )}

      {/* Confirm bottom sheet */}
      {showConfirm && (
        <div
          onClick={() => !sending && setShowConfirm(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-end', zIndex: 100,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.surface, borderRadius: '16px 16px 0 0',
              borderTop: `1px solid ${T.line2}`,
              padding: '20px 20px 32px',
              width: '100%', maxHeight: '70dvh', overflowY: 'auto', overscrollBehavior: 'contain',
            }}
          >
            <div style={{ width: 36, height: 4, background: T.line2, borderRadius: 99, margin: '0 auto 18px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>
              Send this order to {tableId}?
            </div>

            {pendingList.map(({ item, qty }) => (
              <div key={item.id} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: `1px solid ${T.line}`,
                fontSize: 14, color: T.textDim,
              }}>
                <span style={{ color: T.text }}>{item.name}</span>
                <span>×{qty} · {fmtPeso(item.price * qty)}</span>
              </div>
            ))}

            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '12px 0 20px',
              fontSize: 14, fontWeight: 700, color: T.text,
              borderTop: `1px solid ${T.line}`, marginTop: 4,
            }}>
              <span>Adding to order</span>
              <span style={{ color: T.ok }}>{fmtPeso(pendingTotal)}</span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={sending}
                style={{
                  flex: 1, padding: '14px', fontSize: 14, fontWeight: 600,
                  background: T.surface2, border: `1px solid ${T.line2}`,
                  color: T.textDim, borderRadius: T.radius,
                  cursor: sending ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={sending}
                style={{
                  flex: 2, padding: '14px', fontSize: 14, fontWeight: 700,
                  background: sending ? T.surface2 : T.ok,
                  color: sending ? T.textMute : '#fff',
                  border: 'none', borderRadius: T.radius,
                  cursor: sending ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {sending ? 'Sending…' : 'Yes, Send Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
