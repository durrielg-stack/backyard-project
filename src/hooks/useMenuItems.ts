'use client'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase'
import type { MenuItem } from '@/lib/types'

// Returns all available menu items, grouped by category
export function useMenuItems() {
  const [items, setItems]   = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    const sb = getClient()

    async function load() {
      const { data, error } = await sb
        .from('menu_items')
        .select('*')
        .eq('is_available', true)
        .order('sort_order')

      if (error) {
        setError(error.message)
      } else {
        setItems(data ?? [])
      }
      setLoading(false)
    }

    load()
  }, [])

  // Group by category for the menu panel tabs
  const byCategory = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const key = item.category
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  // Map by id for quick lookup in cart
  const byId = items.reduce<Record<string, MenuItem>>((acc, item) => {
    acc[item.id] = item
    return acc
  }, {})

  return { items, byCategory, byId, loading, error }
}
