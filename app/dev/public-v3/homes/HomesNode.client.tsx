'use client'

/**
 * HOMES node of the P6 prototype. The destination job is "show me the homes,
 * live, filterable, on a map", so the page opens on the Field pattern: real
 * inventory, mapped by its real coordinates, bound both ways to the list.
 *
 * The browse system's curated intents are MODES inside this one node, not
 * separate pages (the locked IA folds them in). Each mode filters the same
 * loaded set and says plainly what it shows, so the count under the heading is
 * always honest to what is on screen.
 *
 * Motion rules from design_system/public/PUBLIC_UI.md section 5: the count
 * counts to its new value when the mode changes, the pins travel to the new
 * bounding box of the visible set, and a row and its pin highlight together.
 * Nothing moves that is not a state change the visitor caused. Under
 * prefers-reduced-motion the count lands immediately and the shared stylesheet
 * collapses every transition, so the node resolves instantly.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import '../public-v3.css'

export type HomeTile = {
  listingKey: string
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  street: string
  city: string | null
  lat: number | null
  lng: number | null
  dom: number | null
  priceDropCount: number | null
  /** Pre-formatted on the server through formatDate, e.g. "Sat, Aug 15 at 11 AM". */
  openHouse: string | null
}

type ModeId = 'all' | 'open' | 'cuts'

const NA = 'not available'

const money = (n: number | null) =>
  n == null
    ? NA
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/**
 * Pin labels are the same figure as the row, shortened to fit the pin. Rounding
 * that would change the number a visitor reads is not allowed, so anything at a
 * million or over reads in millions to one decimal instead of a four-digit "K".
 */
const pinLabel = (n: number | null) => {
  if (n == null) return NA
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  return `$${Math.round(n / 1000)}K`
}

const VALUE_CTA = 'Get your home’s value'

const MODES: { id: ModeId; label: string; shows: string }[] = [
  {
    id: 'all',
    label: 'All homes',
    shows: 'Every active Bend listing loaded into this view, most recently updated first.',
  },
  {
    id: 'open',
    label: 'Open houses',
    shows: 'Only the homes with an open house on the calendar in the next 14 days.',
  },
  {
    id: 'cuts',
    label: 'Price cuts',
    shows: 'Only the homes whose list price has come down at least once since they were listed.',
  },
]

function matchesMode(t: HomeTile, mode: ModeId): boolean {
  if (mode === 'open') return t.openHouse != null
  if (mode === 'cuts') return (t.priceDropCount ?? 0) > 0
  return true
}

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
 * Counts from the previous value to the new one. Reduced motion lands at once.
 *
 * The count is a FIGURE, so it may never disagree with the set beside it. A
 * frame loop is not a guarantee: a tab that is not compositing never gets a
 * requestAnimationFrame callback, and a counter written only from inside that
 * loop then strands the old number on screen next to the new list. A timer
 * lands the true value whether or not a single frame ever arrives.
 */
function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    from.current = value
    if (reduced || start === value) {
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const dur = 400
    const land = setTimeout(() => setShown(value), dur + 120)
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(start + (value - start) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else clearTimeout(land)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(land)
    }
  }, [value, reduced])
  return <span className="v3-num v3h-num">{shown.toLocaleString()}</span>
}

/**
 * Places a pin from its real coordinates inside the bounding box of whatever is
 * visible. When the mode changes the box changes, so the pins travel. That
 * travel is the state change, not decoration.
 */
function usePinBox(visible: HomeTile[]) {
  return useMemo(() => {
    const geo = visible.filter((t) => t.lat != null && t.lng != null)
    if (geo.length === 0) return { placed: [] as { t: HomeTile; left: number; top: number }[], missing: visible.length }
    const lats = geo.map((t) => t.lat as number)
    const lngs = geo.map((t) => t.lng as number)
    const south = Math.min(...lats)
    const north = Math.max(...lats)
    const west = Math.min(...lngs)
    const east = Math.max(...lngs)
    const spanLat = north - south || 0.01
    const spanLng = east - west || 0.01
    const placed = geo.map((t) => ({
      t,
      left: 10 + (((t.lng as number) - west) / spanLng) * 80,
      top: 10 + ((north - (t.lat as number)) / spanLat) * 80,
    }))
    return { placed, missing: visible.length - geo.length }
  }, [visible])
}

export function HomesNode({
  place,
  tiles,
  sourceLine,
}: {
  place: string
  tiles: HomeTile[]
  sourceLine: string
}) {
  const [mode, setMode] = useState<ModeId>('all')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)
  const reduced = useReducedMotion()

  const visible = useMemo(() => tiles.filter((t) => matchesMode(t, mode)), [tiles, mode])
  const { placed, missing } = usePinBox(visible)
  const current = MODES.find((m) => m.id === mode) ?? MODES[0]

  // Ledger source: the same loaded set, ordered by time on market. Rows with no
  // reported days on market are left out rather than guessed at.
  const longest = useMemo(
    () =>
      tiles
        .filter((t) => t.dom != null)
        .sort((a, b) => (b.dom as number) - (a.dom as number))
        .slice(0, 5),
    [tiles],
  )

  return (
    <main className="v3-root">
      <header className="v3-chrome">
        <span className="v3-mark">Ryan Realty</span>
        <nav className="v3-nav" aria-label="Destinations">
          {['Homes', 'Places', 'Market', 'Sell', 'About'].map((d) => (
            <span key={d} className={d === 'Homes' ? 'v3-nav-item is-here' : 'v3-nav-item'}>
              {d}
            </span>
          ))}
        </nav>
        <span className="v3-cta-chip">{VALUE_CTA}</span>
      </header>

      {/* PATTERN 2: FIELD. The node opens on inventory, mapped and listed, bound
          both ways. The modes are the browse system folded into one surface. */}
      <section className="v3h-field-section" aria-labelledby="v3h-title">
        <div className="v3h-head">
          <p className="v3-eyebrow">
            <Link href="/cities/bend" className="v3h-place">
              {place}
            </Link>
            {' · homes for sale'}
          </p>
          <h1 id="v3h-title" className="v3-display v3h-title">
            {place} homes, live
          </h1>
          <p className="v3h-count">
            <CountUp value={visible.length} />
            <span className="v3-label">
              {visible.length === 1 ? 'home in view' : 'homes in view'}
              {mode === 'all' ? '' : ` of ${tiles.length} loaded`}
            </span>
          </p>

          <div className="v3h-modes" role="group" aria-label="Browse modes">
            {MODES.map((m) => {
              const n = tiles.filter((t) => matchesMode(t, m.id)).length
              return (
                <button
                  key={m.id}
                  type="button"
                  className={m.id === mode ? 'v3h-mode is-on' : 'v3h-mode'}
                  aria-pressed={m.id === mode}
                  onClick={() => {
                    setMode(m.id)
                    setActiveKey(null)
                  }}
                >
                  {m.label} <span className="v3h-mode-n">{n}</span>
                </button>
              )
            })}
          </div>
          <p className="v3h-note">{current.shows}</p>
        </div>

        <div className="v3-field">
          <div className="v3h-mapwrap">
          <div className="v3-field-map" aria-hidden>
            <div className="v3-map-grid" />
            {placed.map(({ t, left, top }) => (
              <button
                key={t.listingKey}
                type="button"
                className={activeKey === t.listingKey ? 'v3-pin v3h-pin is-active' : 'v3-pin v3h-pin'}
                style={{ left: `${left}%`, top: `${top}%` }}
                onMouseEnter={() => setActiveKey(t.listingKey)}
                tabIndex={-1}
              >
                <span className="v3h-pin-label">{pinLabel(t.price)}</span>
              </button>
            ))}
          </div>
            <p className="v3-source v3h-maplegend">
              Each dot is one of the homes in view, at the coordinates the MLS reports for it.
            </p>
          </div>

          <div className="v3h-listwrap">
            <ul className="v3-field-list v3h-set" key={mode}>
              {visible.map((t) => (
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
                      {[
                        t.beds != null && `${t.beds} bd`,
                        t.baths != null && `${t.baths} ba`,
                        t.sqft != null && `${t.sqft.toLocaleString()} sqft`,
                        t.dom != null && `${t.dom} days on market`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {t.openHouse && <span className="v3h-badge">Open {t.openHouse}</span>}
                    {(t.priceDropCount ?? 0) > 0 && (
                      <span className="v3h-badge">
                        {t.priceDropCount === 1 ? '1 price cut' : `${t.priceDropCount} price cuts`}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
              {visible.length === 0 && (
                <li className="v3-empty">
                  None of the {tiles.length} homes loaded here match this mode right now.
                </li>
              )}
            </ul>
            {missing > 0 && (
              <p className="v3-source">
                {missing} of these homes has no coordinate in the feed, so it is listed but not pinned.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* PATTERN 3: LEDGER. Same set, ordered by time on market. Every row a door. */}
      <section className="v3-ledger" aria-label="Longest on market">
        <h2 className="v3-h2">Longest on market</h2>
        <p className="v3h-note">
          The same loaded homes, ordered by days on market. Homes with no reported count are left out.
        </p>
        {longest.map((t) => (
          <Link key={t.listingKey} href={`/listing/${t.listingKey}`} className="v3-ledger-row">
            <span className="v3-ledger-when">{t.dom} days on market</span>
            <span className="v3-ledger-what">{t.street || 'Listing'}</span>
            <span className="v3-ledger-num">{money(t.price)}</span>
          </Link>
        ))}
        {longest.length === 0 && (
          <p className="v3-source">No home in this set reports a days-on-market count.</p>
        )}
      </section>

      {/* PATTERN 5: SHEET. One question. The search being saved is stated above it. */}
      <section className="v3-sheet" aria-label="Save this search">
        <h2 className="v3-h2">Save this search</h2>
        {saved ? (
          <div className="v3h-saved">
            <p className="v3-row-price">Saved to {email}</p>
            <p className="v3-source">
              Prototype only. Nothing was sent and no address was stored.
            </p>
            <button type="button" className="v3-link" onClick={() => setSaved(false)}>
              Change the address
            </button>
          </div>
        ) : (
          <div className="v3-step">
            <p className="v3-step-echo">
              {place}, active listings, {current.label.toLowerCase()}. {visible.length} homes today.
            </p>
            <label className="v3-field-label" htmlFor="v3h-email">
              Email address
            </label>
            <input
              id="v3h-email"
              className="v3-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="button"
              className="v3-btn"
              onClick={() => {
                if (email.trim()) setSaved(true)
              }}
            >
              Save this search
            </button>
            <p className="v3-source">New matches reach you the morning after they hit the MLS.</p>
          </div>
        )}
      </section>

      {/* PATTERN 6: QUIET. Hairline rows carrying the outbound edges. */}
      <section className="v3-quiet" aria-label="Related">
        {[
          ['Open houses this week', '/open-houses'],
          ['Bend neighborhoods', '/cities/bend'],
          ['What the Bend market is doing', '/housing-market'],
          ['How selling works', '/sell'],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="v3-quiet-row">
            {label}
          </Link>
        ))}
        <p className="v3-source">
          {sourceLine} Patterns on this node: Field, Ledger, Sheet, Quiet. Reduced motion honored
          {reduced ? ' (active now)' : ''}.
        </p>
      </section>
    </main>
  )
}
