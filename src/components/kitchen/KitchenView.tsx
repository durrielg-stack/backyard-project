'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { useTickets } from '@/hooks/useTickets'
import type { KdsTicket } from '@/lib/types'

interface Session { userId: string; name: string }

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// One expanded unit card per physical item ordered
interface KitchenCard extends KdsTicket {
  cardKey: string
}

// ── Confirm Screen ─────────────────────────────────────────────────────────────

function ConfirmScreen({
  card, onBack, onConfirm, confirming,
}: {
  card: KitchenCard
  onBack: () => void
  onConfirm: () => void
  confirming: boolean
}) {
  const { T } = useTheme()
  const color   = card.status === 'late' ? T.bad : card.status === 'aging' ? T.warn : T.ok
  const isUrgent = card.status === 'late' || card.status === 'aging'
  const badge    = card.status === 'late' ? 'LATE' : card.status === 'aging' ? 'AGING' : 'FIRING'

  return (
    <div style={{ height: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: `1px solid ${T.line}`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.text }}>
          Mark as Served?
        </span>
      </div>

      {/* Card preview */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
        <div style={{
          width: '100%', maxWidth: 380,
          background: T.surface,
          border: `2px solid ${color}`,
          borderRadius: 10,
          padding: '28px 24px',
          ...(isUrgent ? { animation: 'bp-attn 1.4s ease-in-out infinite' } : {}),
        }}>
          {/* Table + elapsed */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 14, fontWeight: 700, fontFamily: T.mono, color: T.text,
                background: T.chip, padding: '5px 14px', borderRadius: T.radius,
                letterSpacing: '0.04em',
              }}>
                {card.tableId}
              </span>
              {card.orderType === 'takeout' && (
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: T.info,
                  background: `${T.info}20`, border: `1px solid ${T.info}55`,
                  padding: '2px 7px', borderRadius: 3,
                }}>
                  Takeout
                </span>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: T.mono, fontSize: 26, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {fmtElapsed(card.elapsedSec)}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color, marginTop: 2 }}>
                {badge}
              </div>
            </div>
          </div>

          {/* Item name + qty */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>
              {card.itemName}
            </div>
            {card.qty > 1 && (
              <span style={{
                fontSize: 16, fontWeight: 700,
                background: T.accent + '22', color: T.accent,
                border: `1px solid ${T.accent}44`,
                padding: '2px 8px', borderRadius: 4, flexShrink: 0,
              }}>
                ×{card.qty}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: T.textMute }}>
            {card.server}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '16px 20px 28px', display: 'flex', gap: 12, flexShrink: 0 }}>
        <button
          onClick={onBack}
          disabled={confirming}
          style={{
            flex: 1, height: 60, fontSize: 15, fontFamily: 'inherit', fontWeight: 700,
            background: T.chip, color: T.textDim, border: `1px solid ${T.line2}`,
            borderRadius: T.radius, cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          onClick={onConfirm}
          disabled={confirming}
          style={{
            flex: 2, height: 60, fontSize: 15, fontFamily: 'inherit', fontWeight: 700,
            background: T.ok, color: '#fff', border: 'none',
            borderRadius: T.radius, cursor: 'pointer',
            opacity: confirming ? 0.6 : 1,
            transition: 'opacity 0.1s',
          }}
        >
          {confirming ? 'Saving…' : '✓ Confirm Served'}
        </button>
      </div>

    </div>
  )
}

// ── KitchenView ────────────────────────────────────────────────────────────────

type Screen = { kind: 'list' } | { kind: 'confirm'; card: KitchenCard }

export default function KitchenView({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const { T } = useTheme()
  const [tick, setTick] = useState(0)
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const [confirming, setConfirming] = useState(false)

  const { tickets, bump } = useTickets(tick)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Kitchen station only — qty already merged in useTickets
  const cards: KitchenCard[] = tickets
    .filter(t => t.station === 'kitchen')
    .map(t => ({ ...t, cardKey: t.id }))

  const handleConfirm = useCallback(async (card: KitchenCard) => {
    setConfirming(true)
    await bump(card.itemIds)
    setConfirming(false)
    setScreen({ kind: 'list' })
  }, [bump])

  if (screen.kind === 'confirm') {
    return (
      <ConfirmScreen
        card={screen.card}
        onBack={() => setScreen({ kind: 'list' })}
        onConfirm={() => handleConfirm(screen.card)}
        confirming={confirming}
      />
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          height: 52, padding: '0 16px', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 10,
          background: T.bg, borderBottom: `1px solid ${T.line}`,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>
            Kitchen
          </span>
          {cards.length > 0 && (
            <span style={{
              fontFamily: T.mono, fontSize: 12, fontWeight: 600,
              color: T.accent, background: `${T.accent}18`,
              border: `1px solid ${T.accent}44`,
              padding: '2px 8px', borderRadius: T.radius,
            }}>
              {cards.length}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {/* Staff name */}
          <span style={{ fontSize: 11, color: T.textMute }}>{session.name}</span>
          {/* Live pulse dot */}
          <span style={{ fontSize: 10, color: T.textMute, fontFamily: T.mono }}>live</span>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: T.ok,
            animation: 'bp-attn 2s ease-in-out infinite',
          }} />
          {/* Sign out */}
          <button
            onClick={onSignOut}
            style={{
              marginLeft: 4, padding: '4px 10px', fontSize: 11, fontFamily: 'inherit',
              background: 'transparent', border: `1px solid ${T.line2}`,
              color: T.textMute, borderRadius: T.radius, cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>

        {/* Card list */}
        <div
          className="bp-no-scrollbar"
          style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {cards.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: '35%' }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.ok }}>All clear</div>
              <div style={{ fontSize: 12, color: T.textMute, fontFamily: T.mono }}>No pending kitchen orders</div>
            </div>
          ) : (
            cards.map(card => {
              const color    = card.status === 'late' ? T.bad : card.status === 'aging' ? T.warn : T.ok
              const isUrgent = card.status === 'late' || card.status === 'aging'
              const badge    = card.status === 'late' ? 'LATE' : card.status === 'aging' ? 'AGING' : 'FIRING'

              const isTakeout = card.orderType === 'takeout'
              const cardBg     = isTakeout ? `${T.info}12` : T.surface
              const cardBorder = isUrgent ? color : isTakeout ? T.info : T.line

              return (
                <div
                  key={card.cardKey}
                  style={{
                    background: cardBg,
                    border: `2px solid ${cardBorder}`,
                    borderRadius: 10,
                    padding: '16px 16px 14px',
                    ...(isUrgent ? { animation: 'bp-attn 1.4s ease-in-out infinite' } : {}),
                  }}
                >
                  {/* Table + elapsed */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 700, fontFamily: T.mono, color: T.text,
                        background: T.chip, padding: '4px 12px', borderRadius: T.radius,
                      }}>
                        {card.tableId}
                      </span>
                      {isTakeout && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: T.info,
                          background: `${T.info}20`, border: `1px solid ${T.info}55`,
                          padding: '2px 7px', borderRadius: 3,
                        }}>
                          Takeout
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color }}>
                        {badge}
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                        {fmtElapsed(card.elapsedSec)}
                      </span>
                    </div>
                  </div>

                  {/* Item name + qty */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>
                      {card.itemName}
                    </div>
                    {card.qty > 1 && (
                      <span style={{
                        fontSize: 14, fontWeight: 700,
                        background: T.accent + '22', color: T.accent,
                        border: `1px solid ${T.accent}44`,
                        padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                      }}>
                        ×{card.qty}
                      </span>
                    )}
                  </div>

                  {/* Served button — large tap target */}
                  <button
                    onClick={() => setScreen({ kind: 'confirm', card })}
                    style={{
                      width: '100%', height: 50, fontSize: 13, fontFamily: 'inherit',
                      fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                      background: 'transparent', color: T.textDim,
                      border: `1px solid ${T.line2}`, borderRadius: T.radius,
                      cursor: 'pointer',
                    }}
                  >
                    Served
                  </button>
                </div>
              )
            })
          )}
        </div>

    </div>
  )
}
