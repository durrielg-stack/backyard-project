// Single canonical token set for The Backyard Project POS.
// Dark-only by default. Light theme added as opt-in.
// Every value here is signed-off in the design README. Do not soften.

export interface Theme {
  bg: string; surface: string; surface2: string; surface3: string
  line: string; line2: string
  text: string; textDim: string; textMute: string
  accent: string; accentInk: string
  ok: string; warn: string; bad: string; info: string
  chip: string; chipBd: string
  sansHead: string; sansBody: string; mono: string
  radius: string; radiusLg: string
  shadow: string; shadowModal: string
}

export type ThemeTokens = Theme

export const THEME: Theme = {
  bg:        '#0F1115',
  surface:   '#1A1D24',
  surface2:  '#262B36',
  surface3:  '#343A46',

  line:      '#343A46',
  line2:     '#3E4554',

  text:      '#E5E7EB',
  textDim:   '#9CA3AF',
  textMute:  '#6B7280',

  accent:    '#5EEAD4',
  accentInk: '#0F1115',

  ok:        '#34D399',
  warn:      '#FBBF24',
  bad:       '#F87171',
  info:      '#38BDF8',

  chip:      'rgba(94,234,212,0.08)',
  chipBd:    'rgba(94,234,212,0.14)',

  sansHead: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  sansBody: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  mono:     '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',

  radius:   '2px',
  radiusLg: '4px',

  shadow:      '0 1px 0 rgba(94,234,212,0.04) inset, 0 8px 24px rgba(0,0,0,0.5)',
  shadowModal: '0 30px 90px rgba(0,0,0,0.6)',
}

export const LIGHT_THEME: Theme = {
  bg:        '#F5F5F2',
  surface:   '#FFFFFF',
  surface2:  '#F0F0EC',
  surface3:  '#E8E8E4',
  line:      '#DDDDD8',
  line2:     '#CCCCCA',
  text:      '#18181A',
  textDim:   '#48484E',
  textMute:  '#888892',
  accent:    '#2C6E49',
  accentInk: '#FFFFFF',
  ok:        '#2C6E49',
  warn:      '#C07A00',
  bad:       '#C0392B',
  info:      '#2563EB',
  chip:      '#EBEBEA',
  chipBd:    'rgba(0,0,0,0.10)',
  sansHead: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  sansBody: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  mono:     '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  radius:   '2px',
  radiusLg: '4px',
  shadow:      '0 1px 0 rgba(0,0,0,0.04) inset, 0 8px 24px rgba(0,0,0,0.12)',
  shadowModal: '0 30px 90px rgba(0,0,0,0.25)',
}

export const SLATE_THEME: Theme = {
  bg:        '#111827',   // Deep Slate
  surface:   '#1F2937',   // Soft Charcoal
  surface2:  '#374151',   // Muted Slate / Card
  surface3:  '#4B5563',

  line:      '#2D3748',
  line2:     '#374151',

  text:      '#F3F4F6',   // Soft White
  textDim:   '#9CA3AF',   // Cool Gray
  textMute:  '#6B7280',

  accent:    '#3B82F6',   // Electric Blue
  accentInk: '#F3F4F6',

  ok:        '#10B981',   // Mint Green
  warn:      '#F59E0B',   // Amber
  bad:       '#EF4444',   // Soft Red
  info:      '#22D3EE',   // Cyan Glow

  chip:      'rgba(59,130,246,0.10)',
  chipBd:    'rgba(59,130,246,0.16)',

  sansHead: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  sansBody: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  mono:     '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',

  radius:   '2px',
  radiusLg: '4px',

  shadow:      '0 1px 0 rgba(59,130,246,0.06) inset, 0 8px 24px rgba(0,0,0,0.4)',
  shadowModal: '0 30px 90px rgba(0,0,0,0.55)',
}

// Status color helper — used by table cards, nav dots, ticket headers
export type TableStatus = 'available' | 'occupied' | 'aging' | 'attention' | 'reserved'

export function statusColor(status: TableStatus): string {
  switch (status) {
    case 'available':  return THEME.textMute
    case 'occupied':   return THEME.accent
    case 'aging':      return THEME.warn
    case 'attention':  return THEME.bad
    case 'reserved':   return THEME.info
  }
}

export function statusLabel(status: TableStatus): string {
  switch (status) {
    case 'available':  return 'Available'
    case 'occupied':   return 'Occupied'
    case 'aging':      return 'Aging'
    case 'attention':  return 'Needs Attention'
    case 'reserved':   return 'Reserved'
  }
}
