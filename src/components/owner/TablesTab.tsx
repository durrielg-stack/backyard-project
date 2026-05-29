'use client'

import { useTheme } from '@/lib/ThemeContext'
import { useState, useCallback, useEffect } from 'react'
import { getClient } from '@/lib/supabase'
import { SectionHd, fmtPeso } from './ownerShared'
import type { TableWithStatus } from '@/lib/types'

interface TableRow {
  id:       string
  label:    string
  section:  string
  capacity: number
  status:   string
}

export default function TablesTab({
  liveTableStatuses,
}: { liveTableStatuses: TableWithStatus[] }) {
  const { T } = useTheme()
  const [tables,  setTables]  = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)

  const fetchTables = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (getClient() as any).from('restaurant_tables').select('id, label, section, capacity, status').order('id')
    setTables(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTables() }, [fetchTables])

  const merged = tables.map(t => {
    const live = liveTableStatuses.find(l => l.id === t.id)
    return { ...t, status: live?.status ?? t.status, openMin: live?.openMin ?? 0, checkTotal: live?.checkTotal ?? 0 }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getClient() as any

  async function setReserved(tableId: string, reserve: boolean) {
    setWorking(tableId)
    await sb.from('restaurant_tables').update({ status: reserve ? 'reserved' : 'available' }).eq('id', tableId)
    await fetchTables()
    setWorking(null)
  }

  async function forceClose(tableId: string) {
    setWorking(tableId)
    const { data: orders } = await sb.from('orders').select('id').eq('table_id', tableId).eq('status', 'open')
    for (const o of (orders ?? [])) {
      await sb.from('orders').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', o.id)
    }
    await sb.from('restaurant_tables').update({ status: 'available' }).eq('id', tableId)
    await fetchTables()
    setWorking(null)
  }

  const statusColor: Record<string, string> = {
    available: T.ok, occupied: T.accent, aging: T.warn,
    attention: T.bad, reserved: T.info,
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <SectionHd title="Tables" badge={`${tables.length} total`} />
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontFamily: T.mono, fontSize: 12 }}>Loading…</div>
      ) : (
        <div className="bp-no-scrollbar" style={{ flex: 1, overflowY: 'auto', touchAction: 'pan-y' }}>
          <div className="bp-no-scrollbar" style={{ overflowX: 'auto', touchAction: 'pan-x' }}>
          <div style={{ minWidth: 700 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '64px 1fr 80px 60px 80px 1fr 220px',
            padding: '0 24px', height: 36, alignItems: 'center',
            borderBottom: `1px solid ${T.line}`, background: T.surface2, flexShrink: 0,
          }}>
            {['Table','Section','Seats','Status','Open','Check','Actions'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMute }}>{h}</span>
            ))}
          </div>

          {merged.map((t, i) => {
            const sc = statusColor[t.status] ?? T.textDim
            const isWorking = working === t.id
            return (
              <div key={t.id} style={{
                display: 'grid', gridTemplateColumns: '64px 1fr 80px 60px 80px 1fr 220px',
                padding: '0 24px', height: 48, alignItems: 'center',
                borderBottom: `1px solid ${T.line}`,
                background: i % 2 === 0 ? 'transparent' : T.surface,
                opacity: isWorking ? 0.5 : 1,
              }}>
                <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: T.text }}>{t.label}</span>
                <span style={{ fontSize: 12, color: T.textDim }}>{t.section}</span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim }}>{t.capacity}</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: sc }}>
                  {t.status}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute, fontVariantNumeric: 'tabular-nums' }}>
                  {(t as any).openMin > 0 ? `${(t as any).openMin}m` : '—'}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim, fontVariantNumeric: 'tabular-nums' }}>
                  {(t as any).checkTotal > 0 ? fmtPeso((t as any).checkTotal) : '—'}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {t.status === 'reserved' ? (
                    <button onClick={() => setReserved(t.id, false)} disabled={isWorking} style={{
                      padding: '4px 10px', fontSize: 11, fontFamily: 'inherit',
                      background: `${T.info}18`, border: `1px solid ${T.info}44`,
                      color: T.info, borderRadius: T.radius, cursor: 'pointer',
                    }}>
                      Clear Reserve
                    </button>
                  ) : t.status === 'available' ? (
                    <button onClick={() => setReserved(t.id, true)} disabled={isWorking} style={{
                      padding: '4px 10px', fontSize: 11, fontFamily: 'inherit',
                      background: T.chip, border: `1px solid ${T.line2}`,
                      color: T.textDim, borderRadius: T.radius, cursor: 'pointer',
                    }}>
                      Reserve
                    </button>
                  ) : null}

                  {['occupied','aging','attention'].includes(t.status) && (
                    <button onClick={() => forceClose(t.id)} disabled={isWorking} style={{
                      padding: '4px 10px', fontSize: 11, fontFamily: 'inherit',
                      background: `${T.bad}18`, border: `1px solid ${T.bad}44`,
                      color: T.bad, borderRadius: T.radius, cursor: 'pointer',
                    }}>
                      Force Close
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          </div>
          </div>
        </div>
      )}
    </div>
  )
}
