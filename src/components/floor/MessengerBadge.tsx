'use client'

import { useEffect, useState, useCallback } from 'react'
import { THEME } from '@/lib/theme'
import { getClient } from '@/lib/supabase'

const T = THEME

const FB_INBOX_URL = 'https://www.facebook.com/messages/t'

export default function MessengerBadge() {
  const [unread, setUnread] = useState(0)

  const fetchUnread = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (getClient() as any)
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'messenger')
      .eq('read', false)
    setUnread(count ?? 0)
  }, [])

  // Initial load
  useEffect(() => { fetchUnread() }, [fetchUnread])

  // Realtime subscription
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getClient() as any
    const channel = sb
      .channel('notifications-badge')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: 'type=eq.messenger',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (_payload: any) => {
        setUnread(n => n + 1)
      })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [])

  const markReadAndOpen = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getClient() as any)
      .from('notifications')
      .update({ read: true })
      .eq('type', 'messenger')
      .eq('read', false)
    setUnread(0)
    window.open(FB_INBOX_URL, '_blank', 'noopener')
  }

  const hasNew = unread > 0

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 200,
    }}>
      {/* Pulse ring — only when unread */}
      {hasNew && (
        <div style={{
          position: 'absolute', inset: -6,
          borderRadius: '50%',
          border: `2px solid ${T.accent}`,
          animation: 'bp-attn 1.4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      <button
        onClick={markReadAndOpen}
        title={hasNew ? `${unread} new message${unread > 1 ? 's' : ''} on Facebook` : 'Facebook Messages'}
        style={{
          width: 52, height: 52, borderRadius: '50%',
          background: hasNew ? T.accent : T.surface2,
          border: `2px solid ${hasNew ? T.accent : T.line2}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: hasNew ? `0 0 0 4px ${T.accent}33` : '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'background 0.2s, box-shadow 0.2s',
          position: 'relative',
        }}
      >
        {/* Messenger icon (simplified) */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2C6.477 2 2 6.145 2 11.25c0 2.862 1.346 5.42 3.474 7.14V22l3.168-1.742A10.7 10.7 0 0 0 12 20.5c5.523 0 10-4.145 10-9.25S17.523 2 12 2Z"
            fill={hasNew ? T.accentInk : T.textDim}
          />
          <path
            d="M6.5 13.5 10 9.5l3.5 3.5 3-3.5"
            stroke={hasNew ? `${T.accentInk}88` : T.surface}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>

        {/* Unread count badge */}
        {hasNew && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18, borderRadius: 9,
            background: T.bad, color: '#fff',
            fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', lineHeight: 1,
            border: `2px solid ${T.bg}`,
          }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </button>
    </div>
  )
}
