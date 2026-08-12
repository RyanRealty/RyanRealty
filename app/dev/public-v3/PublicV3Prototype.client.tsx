'use client'

/**
 * The moving half of the P6 prototype. Every motion here encodes a state change the
 * visitor caused or the data performed (the rule from PUBLIC_UI.md section 5). Under
 * prefers-reduced-motion every sequence resolves instantly to its finished state, so the
 * page still sells without movement.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/format/date'
import './public-v3.css'

type Pulse = {
  activeCount: number | null
  medianListPrice: number | null
  monthsOfSupply: number | null
  medianDaysToPending: number | null
  soldCount30d: number | null
  updatedAt: string | null
}

type Tile = {
  listingKey: string
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  street: string
  city: string | null
  photoUrl: string | null
  dom: number | null
  lat: number | null
  lng: number | null
}

/**
 * Real geography, not decoration. Pins are placed by normalizing each home's own
 * coordinates into the frame. A map whose pins are arithmetic on an array index
 * implies a spatial claim the data never made (CLAUDE.md section 0).
 */
function placePins(tiles: Tile[]) {
  const located = tiles.filter((t) => t.lat != null && t.lng != null)
  if (located.length === 0) return []
  const lats = located.map((t) => t.lat as number)
  const lngs = located.map((t) => t.lng as number)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const span = (v: number, lo: number, hi: number) => (hi - lo < 1e-9 ? 0.5 : (v - lo) / (hi - lo))
  // Inset so a pin never clips the frame at 390.
  return located.map((t) => ({
    tile: t,
    leftPct: 14 + span(t.lng as number, minLng, maxLng) * 72,
    topPct: 86 - span(t.lat as number, minLat, maxLat) * 68,
  }))
}

const NA = 'not available'

const money = (n: number | null) =>
  n == null ? NA : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/** Counts to the real value. Reduced motion lands on it immediately. */
function CountUp({ value, format }: { value: number | null; format: (n: number | null) => string }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState<number | null>(value)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (value == null || reduced) {
      setShown(value)
      return
    }
    let raf = 0
    const start = performance.now()
    const dur = 900
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(value * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, reduced])
  // Hand the RAW value to the formatter and let each formatter decide its own rounding.
  // Rounding here first published 3.6 months of supply as "4.0" — a wrong number, and
  // 4.0 is the seller/balanced threshold itself (CLAUDE.md section 0).
  return (
    <span ref={ref} className="v3-num">
      {format(shown)}
    </span>
  )
}

const VALUE_CTA = 'Get your home’s value'

/** The locked destination set. Every nav word is a real door, so the nodes form a graph. */
const NAV = [
  { label: 'Homes', href: '/dev/public-v3/homes' },
  { label: 'Places', href: '/dev/public-v3/places' },
  { label: 'Market', href: '/dev/public-v3' },
  { label: 'Sell', href: '/dev/public-v3/sell' },
  { label: 'About', href: '/about' },
]

export function PublicV3Prototype({ place, pulse, tiles }: { place: string; pulse: Pulse | null; tiles: Tile[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [address, setAddress] = useState('')

  // Verdict must match the number the visitor SEES (CLAUDE.md section 0: <=4 seller's,
  // 4-6 balanced, >=6 buyer's). Derive it from the rounded display value, never the raw
  // one, or 4.04 prints as "4.0" beside "balanced market".
  const mosRaw = pulse?.monthsOfSupply ?? null
  const mos = mosRaw == null ? null : Math.round(mosRaw * 10) / 10
  const pins = placePins(tiles)
  const verdict = mos == null ? null : mos <= 4 ? "seller's market" : mos < 6 ? 'balanced market' : "buyer's market"

  return (
    <main className="v3-root">
      <header className="v3-chrome">
        <span className="v3-mark">Ryan Realty</span>
        <nav className="v3-nav" aria-label="Destinations">
          {NAV.map((d) => (
            <Link
              key={d.label}
              href={d.href}
              className={d.label === 'Market' ? 'v3-nav-item is-here' : 'v3-nav-item'}
            >
              {d.label}
            </Link>
          ))}
        </nav>
        <Link href="/dev/public-v3/sell" className="v3-cta-chip">
          {VALUE_CTA}
        </Link>
      </header>

      {/* PATTERN 1: INSTRUMENT. The answer, big, before any invitation. */}
      <section className="v3-instrument" aria-labelledby="v3-verdict">
        <p className="v3-eyebrow">
          {place}
          {pulse?.updatedAt ? ` · updated ${formatDate(pulse.updatedAt)}` : ''}
        </p>
        <h1 id="v3-verdict" className="v3-display">
          {verdict ? `${place} is a ${verdict}` : `${place} market`}
        </h1>
        <div className="v3-figures">
          <div className="v3-figure">
            <CountUp value={pulse?.medianListPrice ?? null} format={money} />
            <span className="v3-label">median list price</span>
          </div>
          <div className="v3-figure">
            <CountUp
              value={pulse?.activeCount ?? null}
              format={(n) => (n == null ? NA : Math.round(n).toLocaleString())}
            />
            <span className="v3-label">homes for sale</span>
          </div>
          <div className="v3-figure">
            <CountUp value={mos} format={(n) => (n == null ? NA : n.toFixed(1))} />
            <span className="v3-label">months of supply</span>
          </div>
          <div className="v3-figure">
            <CountUp
              value={pulse?.medianDaysToPending ?? null}
              format={(n) => (n == null ? NA : String(Math.round(n)))}
            />
            <span className="v3-label">median days to pending</span>
          </div>
        </div>
        <p className="v3-source">Source: live MLS, {place} single-family, refreshed with each sync.</p>
      </section>

      {/* PATTERN 2: FIELD. Inventory as a spatial surface, hover binds both ways. */}
      <section className="v3-field" aria-label="Homes for sale">
        <div className="v3-field-map" aria-hidden>
          <div className="v3-map-grid" />
          {pins.map(({ tile: t, leftPct, topPct }) => (
            <span
              key={t.listingKey}
              className={activeKey === t.listingKey ? 'v3-pin is-active' : 'v3-pin'}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            >
              {t.price ? `$${Math.round(t.price / 1000)}K` : NA}
            </span>
          ))}
        </div>
        <ul className="v3-field-list">
          {tiles.map((t) => (
            <li key={t.listingKey}>
              <Link
                href={`/listing/${t.listingKey}`}
                className={activeKey === t.listingKey ? 'v3-row is-active' : 'v3-row'}
                onMouseEnter={() => setActiveKey(t.listingKey)}
                onFocus={() => setActiveKey(t.listingKey)}
              >
                <span className="v3-row-price">{money(t.price)}</span>
                <span className="v3-row-addr">{t.street || 'Address withheld'}</span>
                <span className="v3-row-meta">
                  {[t.beds && `${t.beds} bd`, t.baths && `${t.baths} ba`, t.sqft && `${t.sqft.toLocaleString()} sqft`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
            </li>
          ))}
          {tiles.length === 0 && <li className="v3-empty">No active listings returned by the DAL right now.</li>}
        </ul>
      </section>

      {/* PATTERN 5: SHEET. One question at a time. */}
      <section className="v3-sheet" aria-label="Home valuation">
        <h2 className="v3-h2">What is your home worth?</h2>
        {step === 0 ? (
          <div className="v3-step">
            <label className="v3-field-label" htmlFor="v3-addr">
              Property address
            </label>
            <input
              id="v3-addr"
              className="v3-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, Bend OR"
            />
            <button type="button" className="v3-btn" onClick={() => address.trim() && setStep(1)}>
              Continue
            </button>
            <p className="v3-source">A written valuation with the comps behind it, within 24 hours.</p>
          </div>
        ) : (
          <div className="v3-step">
            <p className="v3-step-echo">{address}</p>
            <label className="v3-field-label" htmlFor="v3-email">
              Where should we send it?
            </label>
            <input id="v3-email" className="v3-input" placeholder="you@email.com" type="email" />
            <button type="button" className="v3-btn">
              Send my valuation
            </button>
            <button type="button" className="v3-link" onClick={() => setStep(0)}>
              Back
            </button>
          </div>
        )}
      </section>

      {/* PATTERN 6: QUIET. Near-zero weight, carries the outbound edges. */}
      <section className="v3-quiet" aria-label="Related">
        {[
          ['Bend neighborhoods', '/cities/bend'],
          ['Market reports', '/housing-market'],
          ['How selling works', '/sell'],
          ['Open houses this week', '/open-houses'],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="v3-quiet-row">
            {label}
          </Link>
        ))}
      </section>
    </main>
  )
}
