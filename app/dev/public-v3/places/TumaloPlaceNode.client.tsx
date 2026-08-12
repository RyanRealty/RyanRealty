'use client'

/**
 * The moving half of the Places node. Every motion encodes a state change the visitor
 * caused or the data performed (PUBLIC_UI.md section 5): the map pin and its row bind both
 * ways on hover and focus, the Instrument figures settle to their real values once, and the
 * place chip on each exit nudges toward its destination to show the context travels. Under
 * prefers-reduced-motion every one of those resolves instantly to its finished state.
 *
 * Pattern order: Field, Instrument, Ledger, Quiet.
 * One primary action in the body (the Field browse button). Everything else is a door.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/format/date'
import '../public-v3.css'

type Pulse = {
  activeCount: number | null
  medianListPrice: number | null
  monthsOfSupply: number | null
  medianDaysToPending: number | null
  closedLast30Days: number | null
  refreshedAt: string | null
}

type Tile = {
  listingKey: string
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  street: string
  city: string | null
  subdivision: string | null
  postalCode: string | null
  lat: number | null
  lng: number | null
  dom: number | null
}

type Sale = {
  listingKey: string
  street: string
  subdivision: string | null
  closePrice: number | null
  closeDate: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
}

type Bounds = { west: number; south: number; east: number; north: number }

const NA = 'not available'
const VALUE_CTA = 'Get your home’s value'

const money = (n: number | null) =>
  n == null ? NA : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/**
 * Pin label. Real coordinates cluster, so the label has to stay short or neighboring pins
 * collide and the widest ones clip the map edge. Millions carry one decimal, everything
 * else rounds to thousands. Both are the price, shortened, never a different number.
 */
const pinPrice = (n: number | null) =>
  n == null ? NA : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`

/**
 * MLS close dates arrive as a calendar day stored at midnight UTC. Formatting that instant
 * in Pacific moves it back one day, so a March 30 closing prints as March 29. Normalize to
 * noon UTC first, then hand it to the canonical formatter. Verified against the live rows:
 * 2026-03-30T00:00:00+00:00 renders "Mar 29, 2026" raw and "Mar 30, 2026" normalized.
 */
const closeDay = (iso: string | null) => (iso ? formatDate(`${iso.slice(0, 10)}T12:00:00Z`) : NA)

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

/**
 * Settles to the real value once. Reduced motion lands on it immediately.
 *
 * The raw eased number goes to the formatter. An earlier version rounded to an integer
 * first, which printed months of supply 3.6 as "4.0" beside a source line reading 3.6, and
 * 4.0 is the seller/balanced threshold itself. Rounding is each formatter's decision.
 */
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
      {format(shown)}
    </span>
  )
}

export function TumaloPlaceNode({
  place,
  parentCity,
  bounds,
  placePulse,
  cityKeyedTileCount,
  parentPulse,
  windowCount,
  tiles,
  subdivisions,
  subdivisionActiveCount,
  sales,
}: {
  place: string
  parentCity: string
  bounds: Bounds
  placePulse: Pulse | null
  cityKeyedTileCount: number
  parentPulse: Pulse | null
  windowCount: number
  tiles: Tile[]
  subdivisions: string[]
  subdivisionActiveCount: number
  sales: Sale[]
}) {
  const reduced = useReducedMotion()
  const [activeKey, setActiveKey] = useState<string | null>(null)

  // The verdict must match the number on screen (CLAUDE.md section 0: at or under 4 is a
  // seller's market, 4 to 6 balanced, 6 and over a buyer's market). Derive it from the
  // ROUNDED display value, never the raw one, or 4.04 prints as 4.0 beside "balanced".
  const mosRaw = parentPulse?.monthsOfSupply ?? null
  const mos = mosRaw == null ? null : Math.round(mosRaw * 10) / 10
  const verdict = mos == null ? null : mos <= 4 ? 'seller’s market' : mos < 6 ? 'balanced market' : 'buyer’s market'

  // Pin placement is the real coordinate mapped into the same window the query used, so
  // the map and the count describe one another.
  const pinPos = (t: Tile) => {
    if (t.lat == null || t.lng == null) return null
    const left = ((t.lng - bounds.west) / (bounds.east - bounds.west)) * 100
    const top = ((bounds.north - t.lat) / (bounds.north - bounds.south)) * 100
    return { left: `${Math.min(88, Math.max(12, left))}%`, top: `${Math.min(92, Math.max(8, top))}%` }
  }

  const exits: Array<{ label: string; href: string; note: string }> = [
    { label: parentCity, href: `/cities/${parentCity.toLowerCase()}`, note: 'the city node' },
    {
      label: `Homes for sale in ${parentCity}`,
      href: `/homes-for-sale/${parentCity.toLowerCase()}`,
      note: 'the browse system',
    },
    {
      label: 'Tumalo Heights in browse',
      href: `/homes-for-sale/${parentCity.toLowerCase()}/tumalo-heights`,
      note: `${subdivisionActiveCount} active`,
    },
    { label: 'Central Oregon market', href: '/housing-market', note: 'the market node' },
  ]

  return (
    <main className="v3-root">
      <header className="v3-chrome">
        <span className="v3-mark">Ryan Realty</span>
        <nav className="v3-nav" aria-label="Destinations">
          {['Homes', 'Places', 'Market', 'Sell', 'About'].map((d) => (
            <span key={d} className={d === 'Places' ? 'v3-nav-item is-here' : 'v3-nav-item'}>
              {d}
            </span>
          ))}
        </nav>
        <span className="v3-cta-chip">{VALUE_CTA}</span>
      </header>

      {/* PATTERN 2: FIELD, opening. The locked Places opening is Instrument then Field.
          Tumalo has no verdict to open with, so the Field leads and the honest state of
          the missing instrument is stated before the inventory, not buried under it. */}
      <section className="v3-place-field" aria-labelledby="v3-place-name">
        <div className="v3-place-head">
          <p className="v3-eyebrow">Places · Central Oregon</p>
          <h1 id="v3-place-name" className="v3-display">
            {place}
          </h1>
          <p className="v3-place-note">
            {placePulse
              ? `The MLS carries no ${place} city, so nothing files under one. The market row keyed to ${place} reports ${placePulse.activeCount ?? 0} active listings, no median price, and no months of supply. A ${place} verdict would be an invention, so this page does not print one.`
              : `No market row is keyed to ${place} at all, so there is no ${place} verdict to print.`}
          </p>
          <p className="v3-place-note">
            {`A city-shaped query for ${place} listings returns ${cityKeyedTileCount}. ${place} addresses list under ${parentCity}. What follows is the ${windowCount} active listings inside a coordinate window drawn around ${place}, the ${parentCity} market those records file into, and the recent closings in the MLS subdivisions carrying the ${place} name.`}
          </p>
        </div>

        <div className="v3-field">
          <div className="v3-field-map" aria-hidden>
            <div className="v3-map-grid" />
            {tiles.map((t) => {
              const pos = pinPos(t)
              if (!pos) return null
              // A span, not a button: the map is aria-hidden and the pin is never a
              // keyboard target, so a raw interactive primitive would be a control that
              // announces nothing. The door for this listing is its row, which is a link.
              return (
                <span
                  key={t.listingKey}
                  className={activeKey === t.listingKey ? 'v3-pin is-active' : 'v3-pin'}
                  style={pos}
                  onMouseEnter={() => setActiveKey(t.listingKey)}
                  onMouseLeave={() => setActiveKey(null)}
                >
                  {pinPrice(t.price)}
                </span>
              )
            })}
          </div>
          <ul className="v3-field-list">
            {tiles.map((t) => (
              <li key={t.listingKey}>
                <Link
                  href={`/listing/${t.listingKey}`}
                  className={activeKey === t.listingKey ? 'v3-row is-active' : 'v3-row'}
                  onMouseEnter={() => setActiveKey(t.listingKey)}
                  onMouseLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(t.listingKey)}
                  onBlur={() => setActiveKey(null)}
                >
                  <span className="v3-row-price">{money(t.price)}</span>
                  <span className="v3-row-addr">{t.street || 'Address withheld'}</span>
                  <span className="v3-row-meta">
                    {[
                      t.beds && `${t.beds} bd`,
                      t.baths && `${t.baths} ba`,
                      t.sqft && `${t.sqft.toLocaleString()} sqft`,
                      t.city,
                      t.postalCode,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
            {tiles.length === 0 && (
              <li className="v3-empty">The window query returned no active listings right now.</li>
            )}
          </ul>
        </div>

        <div className="v3-place-head">
          <div className="v3-place-cta">
            <Link href={`/homes-for-sale/${parentCity.toLowerCase()}`} className="v3-btn">
              {`Browse every ${parentCity} listing`}
            </Link>
          </div>
          <p className="v3-source">
            {`Source: listing_tile_mv through the DAL, active statuses only, bounded by latitude ${bounds.south} to ${bounds.north} and longitude ${bounds.west} to ${bounds.east}. ${windowCount} is the count inside that window, not a count inside a ${place} boundary. ${tiles.length} of them are drawn above.`}
          </p>
        </div>
      </section>

      {/* PATTERN 1: INSTRUMENT. The answer big, for the market that actually holds
          Tumalo's records. Labeled as Bend's own figures throughout: publishing them
          under a Tumalo headline is the misattribution section 0 forbids. */}
      <section className="v3-instrument" aria-labelledby="v3-parent-verdict">
        <p className="v3-eyebrow">
          {`The market ${place} files into`}
          {parentPulse?.refreshedAt ? ` · updated ${formatDate(parentPulse.refreshedAt)}` : ''}
        </p>
        <h2 id="v3-parent-verdict" className="v3-display">
          {verdict ? `${parentCity} is a ${verdict}` : `${parentCity} market`}
        </h2>
        <div className="v3-figures">
          <div className="v3-figure">
            <CountUp value={parentPulse?.medianListPrice ?? null} format={money} />
            <span className="v3-label">{`${parentCity} median list price`}</span>
          </div>
          <div className="v3-figure">
            <CountUp
              value={parentPulse?.activeCount ?? null}
              format={(n) => (n == null ? NA : Math.round(n).toLocaleString())}
            />
            <span className="v3-label">{`${parentCity} homes for sale`}</span>
          </div>
          <div className="v3-figure">
            <CountUp value={mos} format={(n) => (n == null ? NA : n.toFixed(1))} />
            <span className="v3-label">months of supply</span>
          </div>
          <div className="v3-figure">
            <CountUp
              value={parentPulse?.medianDaysToPending ?? null}
              format={(n) => (n == null ? NA : String(Math.round(n)))}
            />
            <span className="v3-label">median days to pending</span>
          </div>
        </div>
        <p className="v3-source">
          {`Source: market_pulse_live, geo_type city, geo_slug ${parentCity.toLowerCase()}, property type A, single family. Months of supply ${mos == null ? NA : mos.toFixed(1)} read against the thresholds at 4 and 6. The ${place} row in the same view reports ${placePulse?.activeCount ?? 0} active and ${placePulse?.closedLast30Days ?? 0} closings in the last 30 days.`}
        </p>
      </section>

      {/* PATTERN 3: LEDGER. Real closings, every row a door. */}
      <section className="v3-ledger" aria-label={`Recent sales in the ${place} subdivisions`}>
        <h2 className="v3-h2">{`Recent sales in the ${place} subdivisions`}</h2>
        <p className="v3-source">
          {`${subdivisions.join(', ')}. ${subdivisionActiveCount} active listings across the three right now, so the last closings are what there is to read.`}
        </p>
        {sales.map((s) => (
          <Link key={s.listingKey} href={`/listing/${s.listingKey}`} className="v3-ledger-row">
            <span className="v3-ledger-when">
              {`Closed ${closeDay(s.closeDate)} · ${s.subdivision ?? 'subdivision not recorded'}`}
            </span>
            <span className="v3-ledger-what">
              {s.street || 'Listing'}
              <span className="v3-ledger-sub">
                {[s.beds && `${s.beds} bd`, s.baths && `${s.baths} ba`, s.sqft && `${s.sqft.toLocaleString()} sqft`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <span className="v3-ledger-num">{money(s.closePrice)}</span>
          </Link>
        ))}
        {sales.length === 0 && (
          <p className="v3-empty">No closings are recorded in those subdivisions.</p>
        )}
      </section>

      {/* PATTERN 6: QUIET. Hairline rows carrying the outbound edges. The place chip on
          each row nudges toward its destination on hover and focus: the continuity
          requirement made visible, that place context carries across the edge. */}
      <section className="v3-quiet" aria-label="Where to go next">
        {exits.map((e) => (
          <Link key={e.href} href={e.href} className="v3-place-exit">
            <span className="v3-place-exit-label">{e.label}</span>
            <span className="v3-place-exit-note">{e.note}</span>
            <span className="v3-place-chip">{place}</span>
          </Link>
        ))}
        <p className="v3-source">

        </p>
      </section>
    </main>
  )
}
