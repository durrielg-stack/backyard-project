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
  // Backgrounds
  bg:        '#0B0B0D',   // near-black with cool tint — page background
  surface:   '#131316',   // raised panels
  surface2:  '#1A1A1F',   // higher elevation — hovered card, active tab
  surface3:  '#222228',   // highest elevation

  // Borders
  line:      '#23232A',   // hairline, 1px
  line2:     '#2E2E36',   // stronger — chip outlines, inputs

  // Text
  text:      '#F4F4F2',   // primary
  textDim:   '#9B9BA3',   // secondary
  textMute:  '#6B6B72',   // tertiary / labels / mono metadata

  // Brand accent — neon green. WCAG AA verified on bg/surface/surface2.
  accent:    '#39FF8B',
  accentInk: '#0B0B0D',   // foreground on accent fills — always near-black

  // Semantic
  ok:        '#5BE49B',   // open / firing / healthy KDS
  warn:      '#FFC857',   // aging (>6:00), low stock pre-critical
  bad:       '#FF6B6B',   // attention (>10:00), critical stock, void
  info:      '#6EA8FE',   // reserved table status

  // Surface chips
  chip:      'rgba(255,255,255,0.06)',
  chipBd:    'rgba(255,255,255,0.08)',

  // Typography
  sansHead: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  sansBody: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  mono:     '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',

  // Shape
  radius:   '2px',   // almost square — do not increase
  radiusLg: '4px',

  // Shadows — avoid on panels; only for modals
  shadow:      '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.4)',
  shadowModal: '0 30px 90px rgba(0,0,0,0.55)',
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

export const OCEAN_THEME: Theme = {
  // Palette: #345DA7 · #3B8AC4 · #4BB4DE · #EFDBCB
  bg:        '#1C3154',   // deep navy
  surface:   '#243D6B',   // raised panels
  surface2:  '#2D4D80',   // higher elevation
  surface3:  '#345DA7',   // palette deep blue

  line:      '#3A5590',
  line2:     '#4A6598',

  text:      '#EFDBCB',   // warm cream
  textDim:   '#D4BFA6',
  textMute:  '#9A8470',

  accent:    '#4BB4DE',   // palette light blue
  accentInk: '#1C3154',

  ok:        '#56C4A0',   // teal
  warn:      '#E8A87C',   // warm amber (cream family)
  bad:       '#E06060',   // coral red
  info:      '#3B8AC4',   // palette medium blue

  chip:      'rgba(75,180,222,0.10)',
  chipBd:    'rgba(75,180,222,0.16)',

  sansHead: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  sansBody: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  mono:     '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',

  radius:   '2px',
  radiusLg: '4px',

  shadow:      '0 1px 0 rgba(75,180,222,0.06) inset, 0 8px 24px rgba(0,0,0,0.4)',
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
