'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getClient } from '@/lib/supabase'
import '@/styles/availability.css'

/* ---- constants ---- */
const MAPS_URL = 'https://www.google.com/maps/place/The+Backyard+Project+bar+%2B+kitchen/@15.7143202,120.9070077,20z/data=!4m6!3m5!1s0x3390d716a59781c3:0xb8eb7c82149b36a3!8m2!3d15.7141421!4d120.9063941!16s%2Fg%2F11gmy07jmv'

/* ---- message pools ---- */
type AvailState =
  | 'tuesday' | 'wednesday_early' | 'closed_night' | 'regular_closed'
  | 'opening_soon' | 'opening_very_soon'
  | 'open_plenty' | 'open_filling' | 'open_almost' | 'open_full'
  | 'closing_soon'

const MSG: Record<AvailState, string[]> = {
  regular_closed: [
    'Status: Offline. Scheduled restart at 4 PM.',
    'Running pre-service diagnostics. See you at 4 PM.',
    'The lights are off, but the plans are forming.',
    'No active sessions. Gates open at 4 PM.',
    'Our chairs are still in sleep mode.',
    'The bar is closed. Anticipation remains open.',
    'Gathering ingredients and good intentions.',
    'Service is paused. Excitement is loading.',
    "We are preparing tonight's stories.",
    'Nothing to see here yet. Check back later.',
    "The plot hasn't started.",
    "We are currently in our 'five more minutes' era.",
    'The vibes are still loading.',
    'Too early for bad decisions.',
    'The group chat is still asleep.',
    'Currently unavailable for core memories.',
    'We open at 4 PM. Patience is character development.',
    'Not open yet. We checked.',
  ],
  opening_soon: [
    'Warming up. Gates open at 4 PM.',
    'The countdown has officially begun.',
    'Systems are coming online.',
    'Final checks in progress.',
    'The first drink is getting closer.',
    'Opening routines initiated.',
    "We're awake. Just not open yet.",
    'Preparations are in full swing.',
    'The clock is finally working in your favor.',
    'See you in a little while.',
    'Getting ready to be your next stop.',
    'The vibes are starting to give.',
    "It's giving opening soon.",
    'Preparations are looking suspiciously complete.',
    'The countdown is no longer theoretical.',
    "We can almost hear the first 'isang bucket nga.'",
    'Almost time.',
    'The evening is slowly unlocking.',
    'The staff is moving with purpose.',
    'Your after-work plans are loading.',
  ],
  opening_very_soon: [
    'Almost there. Opening at 4 PM.',
    'Final approach. Stand by.',
    'The bar is moments from going live.',
    'Last call before first call.',
    'Gates open shortly.',
    'We can hear the ice already.',
    'T minus less than an hour.',
    'You picked a good time to check.',
    'We are literally almost there.',
    'If you leave now, your timing will be impressive.',
    'The chairs have been briefed.',
    'The first round is within reach.',
    'This is your sign.',
    'Not saying you should head over now, but...',
    'Doors open in less than an hour.',
    'The waiting is almost over.',
    "Plot twist: we're opening soon.",
    "We can feel the Friday energy, even when it's not Friday.",
  ],
  open_plenty: [
    'Plenty of room. Walk right in.',
    'No queue. No waiting. Just good times.',
    'Tables available and ready.',
    'Peak comfort levels detected.',
    'Your future table is waiting.',
    'Green across the board.',
    'Room to spare tonight.',
    'Capacity is looking healthy.',
    'The odds are in your favor.',
    'Pick almost any seat you like.',
    'Plenty of room. Bring the whole group.',
    'Zero stress. Maximum vibes.',
    'Pick a table. Almost any table.',
    "We're comfortably available.",
    'Plenty of space for spontaneous plans.',
    'No hunting for seats tonight.',
    'Walk in like you own the place.',
    'Tables are ready when you are.',
    'We saved a spot. Not officially, but still.',
  ],
  open_filling: [
    'Filling up nicely.',
    'Good crowd, plenty of space.',
    'Things are getting lively.',
    'The night is finding its rhythm.',
    'Busy enough to be fun.',
    'Activity levels are rising.',
    'Momentum is building.',
    'The atmosphere is warming up.',
    'Tables are moving steadily.',
    'A good night is in progress.',
    'The crowd understood the assignment.',
    'Good energy. Good company. Good timing.',
    'Things are getting interesting.',
    'Busy, but not stressful.',
    'The atmosphere is doing its thing.',
    'The vibes have arrived.',
    'Looking lively tonight.',
    'People are making solid life choices.',
    'Just the right amount of busy.',
  ],
  open_almost: [
    'Almost full. Come soon.',
    'Availability is running low.',
    'Last few tables remaining.',
    'Capacity approaching maximum.',
    'Time is becoming a factor.',
    'You might want to head over now.',
    'Inventory: tables running low.',
    'The window is closing.',
    'The crowd got the memo.',
    'Opportunities remain, but not many.',
    "You're cutting it close.",
    'Last few tables standing.',
    'This is not a drill.',
    "If you're thinking about it, stop thinking.",
    'The clock is not on your side.',
    'Few seats. Many hopefuls.',
    'Main character timing required.',
    "You're in the final stretch.",
  ],
  open_full: [
    "We're at capacity tonight.",
    'All tables are currently occupied.',
    'Full house.',
    'Every seat has a story tonight.',
    'Capacity reached.',
    'The crowd beat you to it.',
    'Standing room for optimism only.',
    "Mission successful. We're full.",
    'No vacancies detected.',
    'Every table is currently spoken for.',
    'Everyone had the same idea.',
    'The function is packed.',
    'No tables left. Only dreams.',
    'We are officially booked and busy.',
    'The crowd won this round.',
    'Every table understood the assignment.',
    "We're packed tonight.",
  ],
  closing_soon: [
    'Final hour in progress.',
    'The night is winding down.',
    'Closing sequence initiated.',
    'One more round before midnight.',
    'The clock is starting to win.',
    "Final boarding for tonight's good decisions.",
    'Service ending soon.',
    "You've caught the last chapter.",
    'Last call energy.',
    'The night is entering its final chapter.',
    'One more round and a good story.',
    'Final hour unlocked.',
    "We're wrapping things up soon.",
    "Last chance to make tonight's memories.",
    'Closing time is approaching.',
    'The playlist is nearing the end.',
    "Time flies when you're having fun.",
  ],
  closed_night: [
    "That's a wrap for tonight.",
    'Service complete. See you tomorrow at 4 PM.',
    'The lights are off until tomorrow.',
    'Mission accomplished. Returning tomorrow.',
    "Tonight's stories have been archived.",
    'The bar has logged off for the night.',
    'Thanks for a great evening.',
    'See you after a little maintenance and sleep.',
    "Today's session has ended.",
    'We survived another night. Back at 4 PM.',
    "That's all for tonight, folks.",
    'The memories have been saved successfully.',
    'The vibes have clocked out.',
    'Session ended successfully.',
    'The lights are off. The stories remain.',
    'Thanks for spending your night with us.',
    'See you tomorrow for round two.',
    'Time to recharge.',
    'We are now accepting sleep.',
  ],
  tuesday: [
    'Tuesdays are reserved for maintenance and mischief.',
    'Closed today. Even the bar deserves a day off.',
    'Tuesday mode activated.',
    'Scheduled weekly recharge in progress.',
    'Our one day of responsible behavior.',
    'Closed for maintenance, planning, and snacks.',
    'Tuesdays keep the rest of the week running.',
    'Systems offline for routine updates.',
    'Today is our weekly intermission.',
    "We'll be back tomorrow at 4 PM.",
    'Tuesdays are for maintenance and main character recovery.',
    'Closed today. Even legends need rest days.',
    'Taking our weekly cooldown.',
    'Tuesday is our factory reset.',
    'No vibes today. See you tomorrow.',
    'Recharging for the rest of the week.',
    "Today's agenda: rest.",
    'We are closed, but emotionally available.',
    'Tuesdays keep the magic working.',
  ],
  wednesday_early: [
    "Tuesday just ended. We'll be back at 4 PM.",
    'Maintenance complete. Opening later today.',
    'Fresh week loading. Doors open at 4 PM.',
    'Tuesday has been successfully uninstalled.',
    'The reboot is complete. See you at 4 PM.',
    "Wednesday is online, but we're not open yet.",
    'One step closer to opening time.',
    'The day has started. Service begins at 4 PM.',
    'Recovery from Tuesday in progress.',
    'See you later today for a fresh start.',
    'Tuesday has left the chat.',
    'Fresh week, fresh start.',
    'We survived Tuesday.',
    'The reset is complete.',
    'Wednesday just dropped.',
    'Back in business later today.',
    'Tuesday has overstayed its welcome.',
    'The comeback begins at 4 PM.',
    'Recovery complete. Opening later.',
    'The weekly reset was successful.',
  ],
}

function getAvailState(now: Date, isOpen: boolean, free: number): AvailState {
  const manila = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
  const day  = manila.getDay()
  const hour = manila.getHours()
  if (day === 2) return 'tuesday'
  if (day === 3 && hour < 16) return 'wednesday_early'
  if (!isOpen) {
    if (hour < 5)  return 'closed_night'
    if (hour < 14) return 'regular_closed'
    if (hour < 15) return 'opening_soon'
    return 'opening_very_soon'
  }
  if (hour >= 23) return 'closing_soon'
  if (free === 0) return 'open_full'
  if (free <= 5)  return 'open_almost'
  if (free <= 9)  return 'open_filling'
  return 'open_plenty'
}

const HOURS: [string, string][] = [
  ['Mon', '4 PM – 12 MN'], ['Tue', 'Closed'], ['Wed', '4 PM – 12 MN'],
  ['Thu', '4 PM – 12 MN'], ['Fri', '4 PM – 12 MN'], ['Sat', '4 PM – 12 MN'], ['Sun', '4 PM – 12 MN'],
]

const BUSY_HOURS: [string, number][] = [
  ['4p', 25], ['5p', 40], ['6p', 58], ['7p', 74], ['8p', 88], ['9p', 96], ['10p', 82], ['11p', 60], ['12m', 38],
]

/* ---- types ---- */
type Status = 'av' | 'oc' | 'rs' | 'cl'
interface TableRow { id: string; label: string; status: string }

/* ---- helpers ---- */
function mapStatus(raw: string): Exclude<Status, 'cl'> {
  if (raw === 'reserved') return 'rs'
  if (raw === 'available') return 'av'
  return 'oc'
}

function isClosedNow(date: Date): boolean {
  const manila = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
  if (manila.getDay() === 2) return true
  if (manila.getHours() < 16) return true
  return false
}

function relTime(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.round(s / 60)} min ago`
}

interface Summary {
  open: boolean; free: number; total: number; occPct: number;
  tone: 'open' | 'busy' | 'almost' | 'full' | 'closed';
  wait: string; updated: string;
}

function deriveSummary(tables: { status: Status }[], closed: boolean, updatedAt: number): Summary {
  const open = !closed
  const free = tables.filter(t => t.status === 'av').length
  const total = tables.filter(t => t.status !== 'cl').length || tables.length
  const occPct = total > 0 ? Math.round(((total - free) / total) * 100) : 0
  let tone: Summary['tone'] = 'open'
  if (!open) tone = 'closed'
  else if (free === 0) tone = 'full'
  else if (free <= 3) tone = 'almost'
  else if (free <= 8) tone = 'busy'
  let wait = ''
  if (!open) wait = '--'
  else if (free >= 10) wait = 'No wait'
  else if (free >= 4) wait = '~10 min'
  else if (free >= 1) wait = '~25 min'
  else wait = '30 min+'
  return { open, free, total, occPct, tone, wait, updated: relTime(updatedAt) }
}

/* ============================================================
   ICONS
   ============================================================ */
function IcPin(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
    <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/>
    <circle cx="12" cy="10" r="2.5"/>
  </svg>
}
function IcPhone(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...p}>
    <path d="M6.5 4h3l1.4 4-1.9 1.4a12 12 0 0 0 5.6 5.6L16 13l4 1.4v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z"/>
  </svg>
}
function IcClock(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
    <circle cx="12" cy="12" r="8.5"/>
    <path d="M12 7.5V12l3 2" strokeLinecap="round"/>
  </svg>
}
function IcArrow(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
}
function IcNav(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...p}>
    <path d="M3 11l18-8-8 18-2.2-7.8L3 11Z"/>
  </svg>
}
function IcZoom(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" {...p}>
    <circle cx="10.5" cy="10.5" r="6"/>
    <path d="M15 15l5 5M10.5 8v5M8 10.5h5"/>
  </svg>
}
function IcIg(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>
  </svg>
}
function IcFb(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" {...p}>
    <path d="M14.5 8.5H16V5.7h-2.2c-2 0-3.3 1.2-3.3 3.3v1.7H8.3v2.8h2.2V21h2.9v-7.5h2.2l.4-2.8h-2.6V9.3c0-.6.3-.8.9-.8Z" fill="currentColor"/>
  </svg>
}

/* ============================================================
   SITE HEADER
   ============================================================ */
function SiteHeader({ summary }: { summary: Summary }) {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const on = () => {
      const past = window.scrollY > 360
      setSolid(past)
      document.documentElement.classList.toggle('byp-hero-past', past)
    }
    window.addEventListener('scroll', on, { passive: true }); on()
    return () => {
      window.removeEventListener('scroll', on)
      document.documentElement.classList.remove('byp-hero-past')
    }
  }, [])
  return (
    <header className={'byp-header' + (solid ? ' is-solid' : '')}>
      <div className="byp-header-inner">
        <a className="byp-header-logo" href="#top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/byp-logo-topbar.png" alt="The Backyard Project" />
        </a>
        <a className={'byp-head-pill st-' + summary.tone} href="#tables">
          <span className="byp-dot" style={{ color: 'currentColor' }} />
          {summary.open
            ? <><b>{summary.free}</b>&nbsp;tables free</>
            : <>We&rsquo;re closed</>}
        </a>
      </div>
    </header>
  )
}

/* ============================================================
   HERO
   ============================================================ */
function Hero({ summary, currentMsg }: { summary: Summary; currentMsg: string }) {
  return (
    <section className="byp-hero" id="top">
      <div className="byp-hero-glow" />
      <div className="byp-hero-grid">
        <div className="byp-hero-copy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="byp-hero-logo" src="/byp-logo.png" alt="The Backyard Project · bar + kitchen" />
          <div className="byp-eyebrow">Live table availability</div>
          <h1 className="byp-hero-title">
            Check who&rsquo;s<br/>got a table<br/><span className="byp-amp">right now</span>
          </h1>
          <p className="byp-hero-sub">
            Real-time seating at The Backyard Project. We refresh the floor every few seconds, so you know before you go.
          </p>
          <div className="byp-hero-status">
            <span className={'byp-op-pill ' + (summary.open ? 'is-open' : 'is-closed')}>
              <span className="byp-dot" style={{ color: 'currentColor' }} />
              {summary.open ? 'Open now' : 'Closed'}
            </span>
            <span className="byp-op-meta">
              <IcClock width={15} height={15} />
              {summary.open ? 'Closes 12 MN tonight' : 'Opens 4 PM'}
            </span>
          </div>
        </div>
        <div className="byp-hero-cards">
          <SummaryCard summary={summary} message={currentMsg} />
          <BusyMeter openNow={summary.open} />
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   SUMMARY CARD
   ============================================================ */
function SummaryCard({ summary, message }: { summary: Summary; message: string }) {
  return (
    <div className={'byp-sum-card st-' + summary.tone}>
      <div className="byp-sum-left">
        <div className="byp-sum-eyebrow">
          <span className="byp-dot" style={{ color: 'currentColor' }} />
          <span className="byp-eyebrow" style={{ color: 'inherit' }}>Live availability</span>
        </div>
        {summary.open ? (
          <div className="byp-sum-number-row">
            <span className="byp-sum-number">{summary.free}</span>
            <span className="byp-sum-unit">{summary.free === 1 ? 'table' : 'tables'}<br/>available</span>
          </div>
        ) : (
          <div className="byp-sum-number-row">
            <span className="byp-sum-number is-closed">Closed</span>
          </div>
        )}
        <div className="byp-sum-headline">{message}</div>
      </div>
      <div className="byp-sum-right">
        <div className="byp-sum-stat">
          <div className="byp-sum-stat-k">Wait time</div>
          <div className="byp-sum-stat-v">{summary.wait}</div>
        </div>
        <div className="byp-sum-divider" />
        <div className="byp-sum-stat">
          <div className="byp-sum-stat-k">Occupancy</div>
          <div className="byp-occ-bar"><span style={{ width: summary.occPct + '%' }} /></div>
          <div className="byp-sum-stat-v sm">{summary.occPct}% full</div>
        </div>
        <div className="byp-sum-divider" />
        <div className="byp-sum-stat">
          <div className="byp-sum-stat-k">Updated</div>
          <div className="byp-sum-stat-v sm">{summary.updated}</div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   BUSY METER
   ============================================================ */
function BusyMeter({ openNow }: { openNow: boolean }) {
  const manilaHour = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
  ).getHours()
  // Map hour to BUSY_HOURS index (4p=4,5p=5,...,12m=0)
  const hourToIdx: Record<number, number> = { 16: 0, 17: 1, 18: 2, 19: 3, 20: 4, 21: 5, 22: 6, 23: 7, 0: 8 }
  const activeIdx = openNow ? (hourToIdx[manilaHour] ?? -1) : -1
  return (
    <div className="byp-busy-card">
      <div className="byp-busy-head">
        <span className="byp-eyebrow">Tonight&rsquo;s vibe</span>
        <span className="byp-busy-now">{openNow ? 'Busiest around 9 PM' : 'Opens at 4 PM'}</span>
      </div>
      <div className="byp-busy-bars">
        {BUSY_HOURS.map(([h, v], i) => (
          <div key={h} className={'byp-busy-col' + (i === activeIdx ? ' is-now' : '')}>
            <div className="byp-busy-bar" style={{ height: v + '%' }} />
            <span className="byp-busy-lbl">{h}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   TABLE GRID
   ============================================================ */
const STATUS_LABEL: Record<Status, string> = { av: 'Open', oc: 'Taken', rs: 'Reserved', cl: 'Closed' }

function TableTile({ label, status }: { label: string; status: Status }) {
  return (
    <div
      className={'byp-tile ' + status}
      tabIndex={0}
      aria-label={`Table ${label}, ${STATUS_LABEL[status]}`}
    >
      <div className="byp-tile-top">
        <span className="byp-tile-no">{label}</span>
        <span className="byp-tile-led" />
      </div>
      <div className="byp-tile-status">{STATUS_LABEL[status]}</div>
    </div>
  )
}

function Legend() {
  return (
    <div className="byp-legend">
      {(['av', 'oc', 'rs', 'cl'] as Status[]).map(s => (
        <span className="byp-legend-chip" key={s}>
          <span className={'byp-led ' + s} />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  )
}

function TablesSection({ tables }: { tables: { id: string; label: string; status: Status }[] }) {
  return (
    <section className="byp-block byp-shell" id="tables">
      <div className="byp-block-head">
        <div>
          <div className="byp-eyebrow">The floor</div>
          <h2 className="byp-block-title">Every table, live</h2>
        </div>
        <Legend />
      </div>
      <div className="byp-tables-grid">
        {tables.map(t => <TableTile key={t.id} label={t.label} status={t.status} />)}
      </div>
    </section>
  )
}

/* ============================================================
   MENU
   ============================================================ */
function MenuSection({ onZoom }: { onZoom: (src: string) => void }) {
  return (
    <section className="byp-block byp-shell" id="menu">
      <div className="byp-block-head">
        <div>
          <div className="byp-eyebrow">From the kitchen &amp; bar</div>
          <h2 className="byp-block-title">The menu</h2>
        </div>
        <a className="byp-ghost-btn" href="/menu-food.jpg" target="_blank" rel="noreferrer">
          Open full menu <IcArrow width={16} height={16} />
        </a>
      </div>
      <div className="byp-menu-rail">
        <figure className="byp-menu-page" onClick={() => onZoom('/menu-food.jpg')} role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onZoom('/menu-food.jpg')} aria-label="View food menu">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/menu-food.jpg" alt="Food menu" />
          <figcaption><span>Food</span><IcZoom width={16} height={16} /></figcaption>
        </figure>
        <figure className="byp-menu-page" onClick={() => onZoom('/menu-drinks.jpg')} role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onZoom('/menu-drinks.jpg')} aria-label="View drinks menu">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/menu-drinks.jpg" alt="Drinks menu" />
          <figcaption><span>Drinks</span><IcZoom width={16} height={16} /></figcaption>
        </figure>
      </div>
      <p className="byp-rail-hint">Swipe to flip pages · tap a page to zoom</p>
    </section>
  )
}

/* ============================================================
   HOURS
   ============================================================ */
function HoursSection({ openNow }: { openNow: boolean }) {
  const todayIdx = (new Date().getDay() + 6) % 7 // Mon=0
  return (
    <section className="byp-block byp-shell" id="hours">
      <div className="byp-hours-card">
        <div className="byp-hours-left">
          <div className="byp-eyebrow">Opening hours</div>
          <h2 className="byp-block-title">Open daily<br/>from 4&nbsp;PM</h2>
          <p className="byp-hours-note">
            We pour until midnight, seven nights a week — except Tuesdays, when the backyard rests.
          </p>
          <span className={'byp-op-pill ' + (openNow ? 'is-open' : 'is-closed')}>
            <span className="byp-dot" style={{ color: 'currentColor' }} />
            {openNow ? 'Open now' : 'Closed'}
          </span>
          <p className="byp-tz-note">All times Manila (GMT+8)</p>
        </div>
        <ul className="byp-hours-list">
          {HOURS.map(([day, hrs], i) => (
            <li key={day} className={(i === todayIdx ? 'is-today ' : '') + (hrs === 'Closed' ? 'is-closed' : '')}>
              <span className="byp-hd-day">{day}{i === todayIdx && <em>Today</em>}</span>
              <span className="byp-hd-hrs">{hrs}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ============================================================
   GALLERY
   ============================================================ */
function GallerySection() {
  return (
    <section className="byp-block byp-shell" id="gallery">
      <div className="byp-block-head">
        <div>
          <div className="byp-eyebrow">The space</div>
          <h2 className="byp-block-title">A backyard after dark</h2>
        </div>
      </div>
      <div className="byp-gallery-grid">
        <div className="byp-gal byp-gal-tall">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero.jpg" alt="The Backyard Project" />
        </div>
        {[
          { src: '/gallery-string-lights.jpg', alt: 'String lights and drinks at The Backyard Project' },
          { src: '/gallery-cocktails.jpg', alt: 'Signature cocktails at The Backyard Project' },
          { src: '/gallery-kitchen.jpg', alt: 'Fresh food from the kitchen' },
          { src: '/gallery-sunset.jpg', alt: 'The backyard at sunset' },
        ].map(({ src, alt }) => (
          <div className="byp-gal" key={src}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} />
          </div>
        ))}
      </div>
    </section>
  )
}

/* ============================================================
   LOCATION
   ============================================================ */
function LocationSection() {
  return (
    <section className="byp-block byp-shell" id="visit">
      <div className="byp-visit-grid">
        <div className="byp-visit-info">
          <div className="byp-eyebrow">Find us</div>
          <h2 className="byp-block-title">Come hang in<br/>the backyard</h2>
          <ul className="byp-visit-list">
            <li>
              <span className="byp-vi-ic"><IcPin width={20} height={20} /></span>
              <span>
                <b>The Backyard Project · bar + kitchen</b><br/>
                <span className="byp-vi-dim">Mabini St Ext, Muñoz, 3119 Nueva Ecija</span>
              </span>
            </li>
            <li>
              <span className="byp-vi-ic"><IcClock width={20} height={20} /></span>
              <span>
                Open daily 4 PM – 12 MN<br/>
                <span className="byp-vi-dim">Closed Tuesdays</span>
              </span>
            </li>
            <li>
              <span className="byp-vi-ic"><IcPhone width={20} height={20} /></span>
              <span className="byp-vi-dim">+63 905 309 4216</span>
            </li>
          </ul>
          <div className="byp-visit-actions">
            <a className="byp-primary-btn" href={MAPS_URL} target="_blank" rel="noreferrer">
              <IcNav width={18} height={18} /> Get directions
            </a>
            <div className="byp-socials">
              <a href="https://www.instagram.com/thebackyardprojectph" target="_blank" rel="noreferrer"
                aria-label="Instagram" className="byp-soc">
                <IcIg width={20} height={20} />
              </a>
              <a href="https://www.facebook.com/thebackyardprojectph" target="_blank" rel="noreferrer"
                aria-label="Facebook" className="byp-soc">
                <IcFb width={20} height={20} />
              </a>
            </div>
          </div>
        </div>
        <div className="byp-visit-map">
          <a href={MAPS_URL} target="_blank" rel="noreferrer" className="byp-map-img-link">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stylized-map.png" alt="Map to The Backyard Project" className="byp-map-img" />
          </a>
          <a className="byp-map-cta" href={MAPS_URL} target="_blank" rel="noreferrer">
            Open in Google Maps <IcArrow width={14} height={14} />
          </a>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   FOOTER
   ============================================================ */
function SiteFooter() {
  return (
    <footer className="byp-footer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="byp-foot-logo" src="/byp-logo.png" alt="" />
      <p>Live availability updates automatically — no need to call ahead.</p>
      <p className="byp-fine">© {new Date().getFullYear()} The Backyard Project · bar + kitchen</p>
    </footer>
  )
}

/* ============================================================
   MOBILE CTA
   ============================================================ */
function MobileCTA({ summary }: { summary: Summary }) {
  return (
    <div className="byp-mobile-cta">
      <div className={'byp-mcta-status st-' + summary.tone}>
        <span className="byp-dot" style={{ color: 'currentColor' }} />
        {summary.open ? <><b>{summary.free}</b>&nbsp;free</> : 'Closed'}
      </div>
      <a className="byp-primary-btn" href={MAPS_URL} target="_blank" rel="noreferrer">
        <IcNav width={17} height={17} /> Get directions
      </a>
    </div>
  )
}

/* ============================================================
   LIGHTBOX
   ============================================================ */
function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [src, onClose])
  if (!src) return null
  return (
    <div className="byp-lightbox" onClick={onClose}>
      <button className="byp-lb-close" aria-label="Close" onClick={onClose}>✕</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Menu" onClick={e => e.stopPropagation()} />
    </div>
  )
}

/* ============================================================
   ROOT PAGE
   ============================================================ */
export default function TablesPage() {
  const [rawTables, setRawTables] = useState<TableRow[]>([])
  const [updatedAt, setUpdatedAt] = useState(Date.now())
  const [now, setNow] = useState(new Date())
  const [zoom, setZoom] = useState<string | null>(null)
  const [msgTick, setMsgTick] = useState(() => Math.floor(Math.random() * 100))
  const onZoom = useCallback((src: string) => setZoom(src), [])
  const onClose = useCallback(() => setZoom(null), [])

  /* Supabase realtime */
  useEffect(() => {
    const sb = getClient()
    const PREFIX_ORDER: Record<string, number> = { T: 0, B: 1, OT: 2, W: 3 }
    const sortById = (rows: TableRow[]) =>
      [...rows].sort((a, b) => {
        const [, ap, an] = a.id.match(/^([A-Za-z]+)(\d+)$/) ?? ['', a.id, '0']
        const [, bp, bn] = b.id.match(/^([A-Za-z]+)(\d+)$/) ?? ['', b.id, '0']
        const ao = PREFIX_ORDER[ap] ?? 99
        const bo = PREFIX_ORDER[bp] ?? 99
        return ao !== bo ? ao - bo : parseInt(an, 10) - parseInt(bn, 10)
      })

    sb.from('restaurant_tables').select('id, label, status')
      .then(({ data }) => { setRawTables(sortById(data ?? [])); setUpdatedAt(Date.now()) })
    const ch = sb.channel('public-tables-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
        sb.from('restaurant_tables').select('id, label, status')
          .then(({ data }) => { setRawTables(sortById(data ?? [])); setUpdatedAt(Date.now()) })
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [])

  /* 1-second ticker for relative time */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  /* 90-second ticker for rotating messages */
  useEffect(() => {
    const id = setInterval(() => setMsgTick(t => t + 1), 90_000)
    return () => clearInterval(id)
  }, [])

  const closed = isClosedNow(now)

  const tables = useMemo(() =>
    rawTables.map((row) => ({
      id: row.id,
      label: row.label,
      status: (closed ? 'cl' : mapStatus(row.status)) as Status,
    })),
    [rawTables, closed]
  )

  const summary = useMemo(
    () => deriveSummary(tables, closed, updatedAt),
    [tables, closed, updatedAt]
  )

  const currentMsg = useMemo(() => {
    const state = getAvailState(now, summary.open, summary.free)
    const pool = MSG[state]
    return pool[msgTick % pool.length]
  }, [now, summary.open, summary.free, msgTick])

  return (
    <div className="byp-page">
      <SiteHeader summary={summary} />
      <Hero summary={summary} currentMsg={currentMsg} />

      <TablesSection tables={tables} />
      <MenuSection onZoom={onZoom} />
      <HoursSection openNow={summary.open} />
      <GallerySection />
      <LocationSection />
      <SiteFooter />

      <MobileCTA summary={summary} />
      <Lightbox src={zoom} onClose={onClose} />
    </div>
  )
}
