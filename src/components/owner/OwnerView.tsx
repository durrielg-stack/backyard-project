'use client'

import { useState } from 'react'
import { THEME } from '@/lib/theme'
import type { TableWithStatus } from '@/lib/types'
import { fmtDate } from './ownerShared'
import ReportsTab      from './ReportsTab'
import BudgetTab       from './BudgetTab'
import SavingsTab      from './SavingsTab'
import TablesTab       from './TablesTab'
import MenuTab         from './MenuTab'
import InventoryTab    from './InventoryTab'
import OwnerExpensesTab from './OwnerExpensesTab'

const T = THEME

type OwnerTab = 'reports' | 'budget' | 'savings' | 'tables' | 'menu' | 'inventory' | 'expenses'

const TABS: { id: OwnerTab; label: string }[] = [
  { id: 'reports',   label: 'Reports'   },
  { id: 'budget',    label: 'Budget'    },
  { id: 'savings',   label: 'Savings'   },
  { id: 'tables',    label: 'Tables'    },
  { id: 'menu',      label: 'Menu'      },
  { id: 'inventory', label: 'Inventory' },
  { id: 'expenses',  label: 'Expenses'  },
]

interface OwnerViewProps {
  tables: TableWithStatus[]
}

export default function OwnerView({ tables }: OwnerViewProps) {
  const [tab, setTab] = useState<OwnerTab>('reports')
  const today = new Date()

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.surface }}>

      <div style={{
        height: 52, padding: '0 24px', flexShrink: 0,
        background: T.bg, borderBottom: `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: T.accent,
        }}>
          <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
            <rect x="3" y="7" width="10" height="7" rx="1" />
            <path d="M5 7V5a3 3 0 016 0v2" />
          </svg>
          Owner
        </div>

        <div style={{ width: 1, height: 20, background: T.line2 }} />

        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMute }}>
          {fmtDate(today)}
        </span>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '5px 16px', fontSize: 12, fontFamily: 'inherit', fontWeight: tab === t.id ? 700 : 400,
              background: tab === t.id ? T.surface2 : 'transparent',
              color:      tab === t.id ? T.text : T.textDim,
              border:     `1px solid ${tab === t.id ? T.line2 : 'transparent'}`,
              borderRadius: T.radius, cursor: 'pointer',
              borderBottom: tab === t.id ? `2px solid ${T.accent}` : `2px solid transparent`,
              transition: 'background 0.12s ease',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'reports'   && <ReportsTab />}
        {tab === 'budget'    && <BudgetTab />}
        {tab === 'savings'   && <SavingsTab />}
        {tab === 'tables'    && <TablesTab liveTableStatuses={tables} />}
        {tab === 'menu'      && <MenuTab />}
        {tab === 'inventory' && <InventoryTab />}
        {tab === 'expenses'  && <OwnerExpensesTab />}
      </div>
    </div>
  )
}
