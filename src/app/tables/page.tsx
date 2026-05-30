'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getClient } from '@/lib/supabase'

type PublicStatus = 'available' | 'occupied' | 'reserved'

interface TableRow {
  id:     string
  status: string
}

function mapStatus(raw: string): PublicStatus {
  if (raw === 'reserved') return 'reserved'
  if (raw === 'available') return 'available'
  return 'occupied'
}

const STATUS_LABEL: Record<PublicStatus, string> = {
  available: 'Available',
  occupied:  'Occupied',
  reserved:  'Reserved',
}

const STATUS_COLOR: Record<PublicStatus, { bg: string; text: string; dot: string }> = {
  available: { bg: '#0f2d1a', text: '#4ade80', dot: '#22c55e' },
  occupied:  { bg: '#2d1010', text: '#f87171', dot: '#ef4444' },
  reserved:  { bg: '#2d2010', text: '#fbbf24', dot: '#f59e0b' },
}

export default function TablesPage() {
  const [tables, setTables] = useState<TableRow[]>([])
  const [now,    setNow]    = useState(new Date())

  useEffect(() => {
    const sb = getClient()

    // Initial load
    sb.from('restaurant_tables')
      .select('id, status')
      .order('id')
      .then(({ data }) => setTables(data ?? []))

    // Realtime subscription
    const channel = sb
      .channel('public-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
        sb.from('restaurant_tables').select('id, status').order('id')
          .then(({ data }) => setTables(data ?? []))
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const available = tables.filter(t => mapStatus(t.status) === 'available').length
  const total     = tables.length

  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
  const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0a0a0a',
      color: '#f5f5f5',
      fontFamily: "'Inter', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 72,
        borderBottom: '1px solid #1f1f1f',
        background: '#0a0a0a',
        position: 'sticky', top: 0, zIndex: 10,
        flexShrink: 0,
      }}>
        <Image
          src="/logo-white.png"
          alt="The Backyard Project"
          width={120}
          height={48}
          style={{ objectFit: 'contain', objectPosition: 'left center' }}
          priority
        />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, color: '#f5f5f5', letterSpacing: '-0.02em' }}>
            {timeStr}
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>{dateStr}</div>
        </div>
      </header>

      {/* Summary */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 32px 0',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>
            Table Availability
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: available > 0 ? '#4ade80' : '#f87171', letterSpacing: '-0.02em' }}>
            {available} <span style={{ fontSize: 16, color: '#555', fontWeight: 400 }}>of {total} available</span>
          </div>
        </div>

        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
            boxShadow: '0 0 0 0 #22c55e44',
            animation: 'pulse 2s ease-out infinite',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 11, color: '#555', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}>Live</span>
        </div>
      </div>

      {/* Grid */}
      <main style={{
        flex: 1,
        padding: '24px 32px 40px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 16,
        alignContent: 'start',
      }}>
        {tables.map(t => {
          const status = mapStatus(t.status)
          const c      = STATUS_COLOR[status]
          return (
            <div key={t.id} style={{
              background: c.bg,
              border: `1px solid ${c.dot}33`,
              borderRadius: 12,
              aspectRatio: '1 / 1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: c.dot,
                boxShadow: `0 0 8px ${c.dot}88`,
                display: 'block',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 13, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: c.text,
              }}>
                {STATUS_LABEL[status]}
              </span>
            </div>
          )
        })}
      </main>

      {/* Legend */}
      <footer style={{
        padding: '0 32px 32px',
        display: 'flex', gap: 24, justifyContent: 'center',
        flexShrink: 0,
      }}>
        {(['available', 'occupied', 'reserved'] as PublicStatus[]).map(s => {
          const c = STATUS_COLOR[s]
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, display: 'block', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>{STATUS_LABEL[s]}</span>
            </div>
          )
        })}
      </footer>

      <style>{`
        @keyframes pulse {
          0%   { box-shadow: 0 0 0 0 #22c55e66; }
          70%  { box-shadow: 0 0 0 8px #22c55e00; }
          100% { box-shadow: 0 0 0 0 #22c55e00; }
        }
      `}</style>
    </div>
  )
}
