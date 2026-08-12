'use client'

/**
 * The moving half of the P6 prototype. Every motion here encodes a state change the
 * visitor caused or the data performed (the rule from PUBLIC_UI.md section 5). Under
 * prefers-reduced-motion every sequence resolves instantly to its finished state, so the
 * page still sells without movement.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
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
  return (
    <span ref={ref} className="v3-num">
      {format(shown == null ? null : Math.round(shown))}
    </span>
  )
}

const VALUE_CTA = 'Get your home’s value'

export function PublicV3Prototype({ place, pulse, tiles }: { place: string; pulse: Pulse | null; tiles: Tile[] }) {
  const reduced = useReducedMotion()
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [address, setAddress] = useState('')

  // Verdict must match the number the visitor SEES (CLAUDE.md section 0: <=4 seller's,
  // 4-6 balanced, >=6 buyer's). Derive it from the rounded display value, never the raw
  // one, or 4.04 prints as "4.0" beside "balanced market".
  const mosRaw = pulse?.monthsOfSupply ?? null
  const mos = mosRaw == null ? null : Math.round(mosRaw * 10) / 10
  const verdict = mos == null ? null : mos <= 4 ? "seller's market" : mos < 6 ? 'balanced market' : "buyer's market"

  return (
    <main className="v3-root">
      <header className="v3-chrome">
        <span className="v3-mark">Ryan Realty</span>
        <nav className="v3-nav" aria-label="Destinations">
          {['Homes', 'Places', 'Market', 'Sell', 'About'].map((d) => (
            <span key={d} className={d === 'Market' ? 'v3-nav-item is-here' : 'v3-nav-item'}>
              {d}
            </span>
          ))}
        </nav>
        <span className="v3-cta-chip">{VALUE_CTA}</span>
      </header>

      {/* PATTERN 1: INSTRUMENT. The answer, big, before any invitation. */}
      <section className="v3-instrument" aria-labelledby="v3-verdict">
        <p className="v3-eyebrow">
          {place}
          {pulse?.updatedAt
            ? ` · updated ${new Date(pulse.updatedAt).toLocaleDateString('en-US', {
                timeZone: 'America/Los_Angeles',
              })}`
            : ''}
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
            <CountUp value={pulse?.activeCount ?? null} format={(n) => (n == null ? NA : n.toLocaleString())} />
            <span className="v3-label">homes for sale</span>
          </div>
          <div className="v3-figure">
            <CountUp value={mos} format={(n) => (n == null ? NA : n.toFixed(1))} />
            <span className="v3-label">months of supply</span>
          </div>
          <div className="v3-figure">
            <CountUp value={pulse?.medianDaysToPending ?? null} format={(n) => (n == null ? NA : String(n))} />
            <span className="v3-label">median days to pending</span>
          </div>
        </div>
        <p className="v3-source">Source: live MLS, {place} single-family, refreshed with each sync.</p>
      </section>

      {/* PATTERN 2: FIELD. Inventory as a spatial surface, hover binds both ways. */}
      <section className="v3-field" aria-label="Homes for sale">
        <div className="v3-field-map" aria-hidden>
          <div className="v3-map-grid" />
          {tiles.map((t, i) => (
            <button
              key={t.listingKey}
              type="button"
              className={activeKey === t.listingKey ? 'v3-pin is-active' : 'v3-pin'}
              style={{ left: `${12 + ((i * 37) % 76)}%`, top: `${18 + ((i * 23) % 62)}%` }}
              onMouseEnter={() => setActiveKey(t.listingKey)}
              onFocus={() => setActiveKey(t.listingKey)}
              tabIndex={-1}
            >
              {t.price ? `$${Math.round(t.price / 1000)}K` : NA}
            </button>
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

      {/* PATTERN 3: LEDGER. Scannable rows, every row a door. */}
      <section className="v3-ledger" aria-label="Recent activity">
        <h2 className="v3-h2">What just changed</h2>
        {tiles.slice(0, 4).map((t) => (
          <Link key={t.listingKey} href={`/listing/${t.listingKey}`} className="v3-ledger-row">
            <span className="v3-ledger-when">{t.dom == null ? 'new' : `${t.dom} days on market`}</span>
            <span className="v3-ledger-what">{t.street || 'Listing'}</span>
            <span className="v3-ledger-num">{money(t.price)}</span>
          </Link>
        ))}
      </section>

      {/* PATTERN 4: STAGE. Owned media, one line, one action. */}
      <section className="v3-stage" aria-label="Central Oregon">
        <video
          className="v3-stage-video"
          src="/videos/hero-optimized.mp4"
          autoPlay={!reduced}
          muted
          loop
          playsInline
          poster="/videos/cities/bend.jpg"
        />
        <div className="v3-stage-copy">
          <h2 className="v3-display v3-on-media">Every home in Central Oregon, one place.</h2>
          <span className="v3-btn">Browse homes</span>
        </div>
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
        <p className="v3-source">
          Prototype: real DAL data, six locked patterns, reduced motion honored{reduced ? ' (active now)' : ''}.
        </p>
      </section>
    </main>
  )
}
