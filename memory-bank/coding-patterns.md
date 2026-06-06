# Coding Patterns

## Theme Usage

Always get colors from the theme hook, never hardcode hex values:

```tsx
const { T } = useTheme()
// T.accent, T.ok, T.warn, T.bad, T.info, T.text, T.textDim, T.textMute
// T.bg, T.surface, T.surface2, T.surface3
// T.line, T.line2
// T.chip, T.chipBd
// T.radius ('2px'), T.radiusLg ('4px')
// T.mono, T.sansHead, T.sansBody
```

Key semantic colors:
- `T.ok` = green (success, paid, available)
- `T.warn` = amber (attention, note, aging)
- `T.bad` = red (error, void, late)
- `T.info` = `#38BDF8` sky blue (takeout indicator, informational)
- `T.accent` = teal (primary brand color)

## Alpha Variants

Use hex alpha suffix for transparent backgrounds/borders:
```tsx
background: `${T.info}12`   // 7% opacity
border: `1px solid ${T.info}88`  // 53% opacity
background: `${T.bad}0E`    // 6% opacity (very subtle)
background: `${T.warn}18`   // 9% opacity
```

## Layout Convention

All layout is inline `style` props — never Tailwind classes for component layout:

```tsx
<div style={{
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '10px 16px',
  background: T.surface,
  borderRadius: T.radius,
}}>
```

## Scrollable Containers

### Vertical scroll
```tsx
<div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
```
`minHeight: 0` is required inside flex columns or the container won't scroll.

### Horizontal scroll (KPI strips, tab strips)
```tsx
<div
  className="bp-no-scrollbar"
  style={{ overflowX: 'auto', display: 'flex', gap: 8 }}
>
```
Or use the `.bp-scroll-x` class which also sets correct `touchAction` for mobile.

**Never condition `overflowX` on `isMobile`** — phones in landscape are ≥768px so the breakpoint flips false.

## Mobile Waiter Scroll Pattern

All waiter view components must re-apply body scroll on orientation change:

```tsx
useEffect(() => {
  function enableScroll() {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
  }
  enableScroll()
  window.addEventListener('resize', enableScroll)
  return () => {
    window.removeEventListener('resize', enableScroll)
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
  }
}, [])
```

## Optimistic Updates Pattern

`useOrder` uses optimistic local state with DB rollback on error:

```tsx
// 1. Apply optimistic change
setLines(prev => prev.map(l => l.lineId === lineId ? { ...l, qty: newQty } : l))

// 2. Write to DB
const { error } = await sb.from('order_items').update({ qty: newQty }).eq('id', line.dbId)

// 3. Rollback on error
if (error) { setError(error.message); fetchAll() }
```

## Takeout Toggle Button Pattern

```tsx
<button
  onClick={e => {
    e.stopPropagation()
    onSetOrderType(line.lineId, line.orderType === 'dine_in' ? 'takeout' : 'dine_in')
  }}
  style={{
    padding: '4px 12px', fontSize: 12, fontWeight: 700,
    letterSpacing: '0.05em', textTransform: 'uppercase',
    border: `1px solid ${line.orderType === 'takeout' ? T.info + '88' : T.line2}`,
    background: line.orderType === 'takeout' ? T.info + '20' : 'transparent',
    color: line.orderType === 'takeout' ? T.info : T.textMute,
    borderRadius: 4, cursor: 'pointer', flexShrink: 0,
    transition: 'all 0.12s ease',
  }}
>
  {line.orderType === 'takeout' ? 'Takeout' : 'Dine-In'}
</button>
```

## KDS Takeout Visual Treatment

```tsx
const isTakeout = ticket.orderType === 'takeout'
// Row: blue left border + subtle blue tint
borderLeft: isTakeout ? `3px solid ${T.info}` : '3px solid transparent',
background: isTakeout ? `${T.info}10` : 'transparent',
// Card: blue border + tinted bg
const cardBg = isTakeout ? `${T.info}12` : T.surface
const cardBorder = isUrgent ? urgentColor : isTakeout ? T.info : T.line
```

## Chrome Android `visualViewport` Fix

For fixed-position elements that need to track Chrome's navbar show/hide:

```tsx
// Bottom bar that tracks visual viewport
const ref = useRef<HTMLDivElement>(null)
useEffect(() => {
  const vv = window.visualViewport
  if (!vv) return
  const update = () => {
    if (!ref.current) return
    const gap = Math.max(0, window.innerHeight - vv.height)
    ref.current.style.bottom = `${gap}px`
  }
  vv.addEventListener('resize', update)
  update()
  return () => vv.removeEventListener('resize', update)
}, [])
```

For a top bar that should appear on scroll (with Chrome's brief scroll dip handled via hysteresis):

```tsx
let isSolid = false
const on = () => {
  const y = window.scrollY
  if (!isSolid && y > 360) { isSolid = true; setSolid(true) }
  else if (isSolid && y < 200) { isSolid = false; setSolid(false) }
}
window.addEventListener('scroll', on, { passive: true })
window.visualViewport?.addEventListener('resize', on)
```

## Date + Timezone Pattern

```tsx
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

// Get Manila midnight for a given Date
function manilaDay(d: Date): string {
  const manila = new Date(d.getTime() + MANILA_OFFSET_MS)
  return manila.toISOString().slice(0, 10) // 'YYYY-MM-DD'
}
```

## Dropdown Escaping Overflow

Dropdowns inside `overflow: hidden` containers must be rendered via React portal to escape clipping:

```tsx
import { createPortal } from 'react-dom'
// render dropdown inside createPortal(jsx, document.body)
```

## SSR Guard

Every app shell that uses Supabase or browser APIs:

```tsx
// src/app/ClientApp.tsx
import dynamic from 'next/dynamic'
const POSApp = dynamic(() => import('./POSApp'), { ssr: false })
export default function ClientApp() { return <POSApp /> }
```

## Design Constants

- `radius: '2px'` — do not change; this is the design spec
- `radiusLg: '4px'` — for slightly rounded elements
- Table sort order: T → A → B → OT
- `COORD_MAX = 640` for floor plan coordinate normalization
