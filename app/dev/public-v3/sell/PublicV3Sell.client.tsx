'use client'

/**
 * P6 VISUAL PROTOTYPE, SELL NODE (the moving half).
 *
 * Destination job: decide whether and how to sell, and get the real number.
 * Pattern order, per the locked per-destination opening (Sell -> Stage then Sheet):
 *
 *   Stage (owned video)  ->  Sheet (valuation spine)  ->  Instrument (Bend figures)
 *   ->  Sheet (the one plan)  ->  Quiet (exit rail)
 *
 * Four of the six patterns, no two adjacent alike, one primary action per viewport.
 * Every motion below encodes a state change the visitor caused or the data performed
 * (PUBLIC_UI.md section 5). Under prefers-reduced-motion each one resolves instantly.
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

const NA = 'not available'

const money = (n: number | null) =>
  n == null ? NA : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const count = (n: number | null) => (n == null ? NA : Math.round(n).toLocaleString())

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
  // Raw value to the formatter: rounding here published 3.6 months of supply as 4.0.
  return <span className="v3-num">{format(shown)}</span>
}

const VALUE_CTA = 'Get your home’s value'

/**
 * The 3% list. Every line is copied from the Enhanced column of
 * components/site/sell/SellPlanComparison.client.tsx, which is the current product
 * truth. Elite-only items (home warranty, stager in the home, pre-listing inspection,
 * paid social, Bend Magazine) are absent because they are not part of this plan, and
 * the one-broker line is absent by Matt's kill. No tier is named, no rate is compared.
 */
const PLAN_GROUPS: { title: string; items: string[] }[] = [
  {
    title: 'Pricing and the transaction',
    items: [
      'Written valuation with the comps behind your price',
      'Independent transaction coordinator through close',
      'A written report every week: showings, traffic, feedback',
      'Post-sale support for your next move',
    ],
  },
  {
    title: 'Where your home shows up',
    items: [
      'Central Oregon MLS',
      'Zillow, Redfin, Trulia and the national feeds',
      'Its own page on ryan-realty.com',
      'Vetted lender, title, mover and contractor network',
    ],
  },
  {
    title: 'Photography and media',
    items: [
      'Professional photography',
      '3D walkthrough tour',
      'Aerial drone video',
      'Cinematic video walkthrough',
      'Yard sign with a QR code to the listing',
    ],
  },
  {
    title: 'Getting buyers through the door',
    items: [
      'Staging consult using your own furnishings',
      'Virtual staging for vacant rooms',
      'Open houses on a set cadence',
      'Broker tour for local agents',
    ],
  },
  {
    title: 'Marketing reach',
    items: [
      'Organic posts on @ryanrealtybend',
      'Short-form video on Reels and TikTok',
      'Email to 300 nearby homeowners',
      'Printed mailers to 200 neighbors',
      'Direct outreach to thousands of local agents',
      'Outreach to 50 top agents in Portland, Seattle, LA and SF',
    ],
  },
  {
    title: 'While you are away',
    items: [
      'Remote-owner care: mail, snow, plant watering, security checks',
      'Move-out and deep-cleaning coordination',
    ],
  },
]

export function PublicV3Sell({ place, pulse }: { place: string; pulse: Pulse | null }) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [openPlan, setOpenPlan] = useState(false)
  const addrRef = useRef<HTMLInputElement>(null)

  // The verdict must match the number the visitor SEES (CLAUDE.md section 0:
  // <=4 seller's, 4-6 balanced, >=6 buyer's). Derive it from the rounded display
  // value, never the raw one, or 4.04 prints as "4.0" beside "balanced market".
  const mosRaw = pulse?.monthsOfSupply ?? null
  const mos = mosRaw == null ? null : Math.round(mosRaw * 10) / 10
  const verdict = mos == null ? null : mos <= 4 ? 'a seller’s market' : mos < 6 ? 'a balanced market' : 'a buyer’s market'

  const focusAddress = () => {
    const el = document.getElementById('v3-sell-spine')
    if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    setStep(0)
    window.setTimeout(() => addrRef.current?.focus(), reduced ? 0 : 420)
  }

  return (
    <main className="v3-root v3-sell-root">
      <header className="v3-chrome">
        <span className="v3-mark">Ryan Realty</span>
        <nav className="v3-nav" aria-label="Destinations">
          {['Homes', 'Places', 'Market', 'Sell', 'About'].map((d) => (
            <span key={d} className={d === 'Sell' ? 'v3-nav-item is-here' : 'v3-nav-item'}>
              {d}
            </span>
          ))}
        </nav>
        <span className="v3-cta-chip">{VALUE_CTA}</span>
      </header>

      {/* PATTERN 4: STAGE. Owned media, one line, one action. Sized so the first
          question of the spine below sits just under the fold on 390. */}
      <section className="v3-stage v3-sell-stage" aria-label="Selling in Central Oregon">
        <video
          className="v3-stage-video"
          src="/videos/hero-optimized.mp4"
          autoPlay={!reduced}
          muted
          loop
          playsInline
          poster="/videos/cities/bend.jpg"
        />
        <div className="v3-stage-scrim" aria-hidden />
        <div className="v3-stage-copy">
          <p className="v3-eyebrow v3-on-media-eyebrow">Selling in {place}</p>
          <h1 className="v3-display v3-on-media">A written valuation of your home, in 24 hours.</h1>
          <button type="button" className="v3-btn" onClick={focusAddress}>
            Start with your address
          </button>
        </div>
      </section>

      {/* PATTERN 5: SHEET. The valuation spine, one question at a time on 390. */}
      <section className="v3-sheet v3-sell-anchor" id="v3-sell-spine" aria-label="Request a valuation">
        {step === 0 && (
          <div className="v3-step">
            <label className="v3-field-label" htmlFor="v3-sell-addr">
              Which home
            </label>
            <input
              id="v3-sell-addr"
              ref={addrRef}
              className="v3-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, Bend OR"
              autoComplete="street-address"
            />
            <button type="button" className="v3-btn" onClick={() => address.trim() && setStep(1)}>
              Continue
            </button>
            <p className="v3-source">
              Free, and it takes no listing agreement. You get the price and the sales behind it.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="v3-step">
            <p className="v3-step-echo">{address}</p>
            <label className="v3-field-label" htmlFor="v3-sell-email">
              Where to send it
            </label>
            <input
              id="v3-sell-email"
              className="v3-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
            />
            <button type="button" className="v3-btn" onClick={() => email.trim() && setStep(2)}>
              Request the valuation
            </button>
            <button type="button" className="v3-link" onClick={() => setStep(0)}>
              Back
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="v3-step">
            <p className="v3-step-echo">{address}</p>
            <h2 className="v3-h2">A broker writes it and sends it within 24 hours.</h2>
            <p className="v3-sell-lede">
              The valuation comes as a written document. It carries the price, the range around it, and
              the sales it rests on, so you can check the reasoning yourself. Weekends included.
            </p>
            <button type="button" className="v3-link" onClick={() => setStep(0)}>
              Start over
            </button>
            
          </div>
        )}
      </section>

      {/* PATTERN 1: INSTRUMENT. What the seller is selling into, answered big. */}
      <section className="v3-instrument v3-sell-band" aria-labelledby="v3-sell-verdict">
        <p className="v3-eyebrow">
          {place} today
          {pulse?.refreshedAt ? ` · updated ${formatDate(pulse.refreshedAt)}` : ''}
        </p>
        <h2 id="v3-sell-verdict" className="v3-display">
          {verdict ? `${place} is ${verdict}.` : `${place} market data is not available right now.`}
        </h2>
        {pulse ? (
          <>
            <div className="v3-figures v3-figures-5">
              <div className="v3-figure">
                <CountUp value={mos} format={(n) => (n == null ? NA : n.toFixed(1))} />
                <span className="v3-label">months of supply</span>
              </div>
              <div className="v3-figure">
                <CountUp value={pulse.medianListPrice} format={money} />
                <span className="v3-label">median list price</span>
              </div>
              <div className="v3-figure">
                <CountUp value={pulse.activeCount} format={count} />
                <span className="v3-label">homes for sale</span>
              </div>
              <div className="v3-figure">
                <CountUp value={pulse.medianDaysToPending} format={count} />
                <span className="v3-label">median days to pending</span>
              </div>
              <div className="v3-figure">
                <CountUp value={pulse.closedLast30Days} format={count} />
                <span className="v3-label">closed in the last 30 days</span>
              </div>
            </div>
            <p className="v3-source">
              Source: live MLS, {place} single-family homes. Months of supply at or below four is a
              seller’s market, four to six is balanced, six or more is a buyer’s market.
            </p>
          </>
        ) : (
          <p className="v3-source">
            The market cache returned no row for {place} single-family homes, so no figure is shown here.
          </p>
        )}
      </section>

      {/* PATTERN 5: SHEET. Plan detail is a working surface, not a matrix. One plan,
          one rate, and the full list behind a disclosure the visitor opens. */}
      <section className="v3-sell-plan" aria-labelledby="v3-sell-plan-h">
        <h2 id="v3-sell-plan-h" className="v3-h2">
          One plan.
        </h2>
        <div className="v3-sell-rate">
          <span className="v3-sell-rate-num">3%</span>
          <span className="v3-label">of the sale price</span>
        </div>
        <p className="v3-sell-lede">
          The photography, the drone and cinematic video, the 3D tour, the MLS and the national feeds,
          the mailers and the open houses, the transaction coordinator, and a written report every week
          you are on the market. Nothing on the list below is an upgrade.
        </p>
        <button
          type="button"
          className="v3-disclosure"
          aria-expanded={openPlan}
          aria-controls="v3-sell-plan-list"
          onClick={() => setOpenPlan((v) => !v)}
        >
          {openPlan ? 'Close the list' : 'See everything included'}
        </button>
        {/* Always in the DOM so aria-controls resolves and the list is real markup,
            hidden until the visitor opens it. The rise runs on the display change. */}
        <div className="v3-sell-groups" id="v3-sell-plan-list" hidden={!openPlan}>
          {PLAN_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="v3-sell-group-title">{g.title}</p>
              <ul className="v3-sell-list">
                {g.items.map((it) => (
                  <li key={it} className="v3-sell-item">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="v3-sell-cta">
          <button type="button" className="v3-btn" onClick={focusAddress}>
            Start with your address
          </button>
        </div>
      </section>

      {/* PATTERN 6: QUIET. Hairline rows carrying the outbound edges. */}
      <section className="v3-quiet" aria-label="Related">
        {[
          ['Homes for sale in Bend', '/cities/bend'],
          ['The Bend market report', '/housing-market'],
          ['How months of supply is measured', '/months-of-supply'],
          ['What clients wrote', '/reviews'],
          ['Reach a broker', '/contact'],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="v3-quiet-row">
            {label}
          </Link>
        ))}
        <p className="v3-source">

          {reduced ? ' (active now)' : ''}.
        </p>
      </section>
    </main>
  )
}
