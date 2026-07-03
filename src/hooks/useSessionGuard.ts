'use client'

import { useEffect } from 'react'
import { getClient } from '@/lib/supabase'

// Local "logged in" state (bp_staff / bp_waiter / bp_kitchen in localStorage) persists
// independently of the actual Supabase Auth session, so a session that goes stale
// (expired/revoked refresh token) previously left the app rendering as "signed in"
// while every RLS-gated query silently returned empty rows.
//
// This keeps the local flag honest: clears it and forces the caller back to its
// login screen the moment the real session is missing or drops out.
export function useSessionGuard(storageKey: string, onInvalid: () => void) {
  useEffect(() => {
    const sb = getClient()

    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        localStorage.removeItem(storageKey)
        onInvalid()
      }
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (!session && event !== 'INITIAL_SESSION') {
        localStorage.removeItem(storageKey)
        onInvalid()
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
