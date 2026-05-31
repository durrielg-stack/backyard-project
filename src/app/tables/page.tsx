'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getClient } from '@/lib/supabase'
import '@/styles/availability.css'

/* ---- constants ---- */
const MAPS_URL = 'https://maps.app.goo.gl/vnQ1G3cDfj7hPQEQ6'

const HOURS: [string, string][] = [
  ['Mon', '4 PM – 12 MN'], ['Tue', 'Closed'], ['Wed', '4 PM – 12 MN'],
  ['Thu', '4 PM – 12 MN'], ['Fri', '4 PM – 12 MN'], ['Sat', '4 PM – 12 MN'], ['Sun', '4 PM – 12 MN'],
]

const BUSY_HOURS: [string, number][] = [
  ['4p', 25], ['5p', 40], ['6p', 58], ['7p', 74], ['8p', 88], ['9p', 96], ['10p', 82], ['11p', 60], ['12m', 38],
]

/* ---- types ---- */
type Status = 'av' | 'oc' | 'rs' | 'cl'
interface TableRow { id: string; status: string }

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
  headline: string; wait: string; updated: string;
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
  let headline = ''
  if (!open) headline = 'Closed today — we open at 4 PM'
  else if (free >= 10) headline = 'Plenty of room — walk right in'
  else if (free >= 6) headline = 'Filling up nicely'
  else if (free >= 1) headline = 'Almost full — come soon'
  else headline = "We're at capacity tonight"
  let wait = ''
  if (!open) wait = '—'
  else if (free >= 10) wait = 'No wait'
  else if (free >= 4) wait = '~10 min'
  else if (free >= 1) wait = '~25 min'
  else wait = '30 min+'
  return { open, free, total, occPct, tone, headline, wait, updated: relTime(updatedAt) }
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
          <img src="/byp-logo.png" alt="The Backyard Project" />
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
function Hero({ summary }: { summary: Summary }) {
  return (
    <section className="byp-hero" id="top">
      <div className="byp-hero-glow" />
      <div className="byp-hero-grid">
        <div className="byp-hero-copy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="byp-hero-logo" src="/byp-logo.png" alt="The Backyard Project · bar + kitchen" />
          <div className="byp-eyebrow">Live table availability</div>
          <h1 className="byp-hero-title">
            Check who&rsquo;s<br/>got a table<span className="byp-amp"> — right now</span>
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
          <SummaryCard summary={summary} />
          <BusyMeter openNow={summary.open} />
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   SUMMARY CARD
   ============================================================ */
function SummaryCard({ summary }: { summary: Summary }) {
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
        <div className="byp-sum-headline">{summary.headline}</div>
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

function TableTile({ id, status }: { id: string; status: Status }) {
  return (
    <div
      className={'byp-tile ' + status}
      tabIndex={0}
      aria-label={`Table ${id}, ${STATUS_LABEL[status]}`}
    >
      <div className="byp-tile-top">
        <span className="byp-tile-no">{id}</span>
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

function TablesSection({ tables }: { tables: { id: string; status: Status }[] }) {
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
        {tables.map(t => <TableTile key={t.id} id={t.id} status={t.status} />)}
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
          <iframe
            src="https://www.google.com/maps?q=Mabini+St+Ext,+Mu%C3%B1oz,+3119+Nueva+Ecija,+Philippines&output=embed&z=16"
            title="The Backyard Project location"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
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
  const onZoom = useCallback((src: string) => setZoom(src), [])
  const onClose = useCallback(() => setZoom(null), [])

  /* Supabase realtime */
  useEffect(() => {
    const sb = getClient()
    const sortById = (rows: TableRow[]) =>
      [...rows].sort((a, b) => parseInt(a.id.replace(/\D/g, ''), 10) - parseInt(b.id.replace(/\D/g, ''), 10))

    sb.from('restaurant_tables').select('id, status')
      .then(({ data }) => { setRawTables(sortById(data ?? [])); setUpdatedAt(Date.now()) })
    const ch = sb.channel('public-tables-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
        sb.from('restaurant_tables').select('id, status')
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

  const closed = isClosedNow(now)

  const tables = useMemo(() =>
    rawTables.map((row) => ({
      id: row.id,
      status: (closed ? 'cl' : mapStatus(row.status)) as Status,
    })),
    [rawTables, closed]
  )

  const summary = useMemo(
    () => deriveSummary(tables, closed, updatedAt),
    [tables, closed, updatedAt]
  )

  return (
    <div className="byp-page">
      <SiteHeader summary={summary} />
      <Hero summary={summary} />

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
