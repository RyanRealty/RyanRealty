'use client'
/**
 * V3 PLACE AFFORDABILITY. The calculator that runs BOTH ways, ending in the
 * search at the number it solved. Site queue SITE-07.
 *
 * ─── WHY THIS IS NOT A MORTGAGE WIDGET ──────────────────────────────────────
 *
 * Every listing site ships price-in / payment-out. A buyer does not walk around
 * with a price in their head; they walk around with a monthly number, and the
 * question they actually ask is "what does four thousand a month buy in Bend?"
 * That half — payment in, price out — is the half nobody ships, and it is the
 * half this section opens on. Both dials drive; moving either solves the other.
 *
 * It opens pre-filled at THIS place's published median asking price, so the
 * first thing a visitor sees is their own market rather than an empty form, and
 * it ends on the one control that matters: the search at the ceiling it solved.
 *
 * ─── SECTION 0, WHICH DECIDES MOST OF THE DESIGN ────────────────────────────
 *
 * THE RATE IS A MEASURED FIGURE WHEN WE HAVE ONE, AND AN ASSUMPTION WHEN WE DO
 * NOT, AND THE COPY SAYS WHICH. `getLiveMortgageRate()` reads
 * market_history_weekly (national/us, mortgage_rate_30yr, written every Monday
 * from Freddie Mac PMMS), so the rate ships with its own week stamp and its own
 * source. When that series is dark the field falls back to the env default in
 * lib/mortgage.ts, which has no source at all — and then the label says it is
 * an assumption the visitor sets. It never says "today's rate" either way,
 * because on the fallback path that would be a published market fact nobody
 * measured.
 *
 * THE FINANCING MIX IS A FACT ABOUT OTHER PEOPLE'S CLOSED SALES. It seeds which
 * mode this opens on and it draws as its own figure. It is never turned into a
 * down payment: "27.8% of sales closed cash" does not mean "put 27.8% down",
 * and writing that sentence would be narrative overriding data.
 *
 * THE CEILING ROUNDS DOWN. `lib/finance/affordability.ts` owns that, and the
 * reason is the button: it promises "homes under $X", and the search on the
 * other side of the click has to be able to keep the promise.
 *
 * ─── WHAT MOVES, AND WHY ────────────────────────────────────────────────────
 *
 * Every bar in the drawing is bound to a dial the visitor is holding, so the
 * motion IS the reading (PUBLIC_UI section 5). Nothing here animates on load,
 * nothing counts up, and the figures never animate while they compute.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { trackEvent, readRrSessionId } from '@/lib/tracking'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthlyPayment } from '@/lib/mortgage'
import {
  monthlyAtPrice,
  solveCash,
  solveFromMonthly,
  solveFromPrice,
  withMaxPrice,
  type AffordabilityTerms,
} from '@/lib/finance/affordability'
import { V3_ROOT_CLASS, V3Button, V3Eyebrow, V3Heading, V3SourceDisclosure } from './atoms'
import { V3Drawing } from './V3Drawing.client'
import {
  affordabilityAnswerLine,
  affordabilityClaim,
  affordabilityFigures,
  affordabilitySearchLabel,
  type AffordabilityMixSlice,
  type AffordabilityMode,
} from './V3PlaceAffordability.view'
import './tokens.css'
import './V3PlaceAffordability.css'

/** How long a dial has to sit still before the interaction is reported. */
export const V3_AFFORD_TRACK_DEBOUNCE_MS = 600

/** The terms a visitor may set. Down payment stops short of 100 — that is cash. */
const DOWN_CHOICES = [0, 3.5, 5, 10, 20] as const
const TERM_CHOICES = [15, 30] as const
const RATE_MIN = 0
const RATE_MAX = 12

export type V3PlaceAffordabilityRate = {
  /** Annual 30-year fixed as a percent, e.g. 6.71. */
  pct: number
  /** The week the figure was published — its vintage. Already formatted. */
  weekLabel: string
  /** Provenance, already worded ("Freddie Mac 30-year fixed"). */
  sourceName: string
}

export type V3PlaceAffordabilityProps = {
  id?: string
  className?: string
  /** "Bend · What it costs" */
  eyebrow: string
  /** The section H2. */
  heading: string
  placeName: string
  /** The route slug, for the analytics payload only. Never rendered. */
  placeSlug: string
  /** city or neighborhood — the grain, for the analytics payload only. */
  grain: 'city' | 'neighborhood'
  /** This place's published median asking price. Null withholds the comparison. */
  medianListPrice: number | null
  /** The section-0 trace behind that median. */
  medianSource: string
  /** A measured, dated rate. Null means we publish none and the visitor sets one. */
  rate: V3PlaceAffordabilityRate | null
  /** The starting rate when `rate` is null — an assumption, labelled as one. */
  fallbackRatePct: number
  /** The local financing mix, biggest share first. */
  mix: readonly AffordabilityMixSlice[]
  mixSource: string
  /** Share of closed sales that were cash, 0 to 1. Seeds the opening mode only. */
  cashShare: number | null
  /** The page's OWN homes link. The ceiling is appended to it, never invented. */
  browseHref: string
  /** The price slider's declared domain, in dollars. */
  priceMin: number
  priceMax: number
  priceStep: number
  /** Where the calculator opens. Server-computed so the first paint is the answer. */
  openingPrice: number
  openingMode: AffordabilityMode
}

function parseMoney(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) && n > 0 ? n : null
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export function V3PlaceAffordability(props: V3PlaceAffordabilityProps) {
  const {
    id,
    className,
    eyebrow,
    heading,
    placeName,
    placeSlug,
    grain,
    medianListPrice,
    medianSource,
    rate,
    fallbackRatePct,
    mix,
    mixSource,
    cashShare,
    browseHref,
    priceMin,
    priceMax,
    priceStep,
    openingPrice,
    openingMode,
  } = props

  const uid = useId()
  const offersCash = mix.length > 0 || cashShare != null

  const [mode, setMode] = useState<AffordabilityMode>(openingMode)
  const [price, setPrice] = useState<number>(openingPrice)
  const [ratePct, setRatePct] = useState<number>(rate?.pct ?? fallbackRatePct)
  const [downPct, setDownPct] = useState<number>(20)
  const [termYears, setTermYears] = useState<number>(30)
  /** Held only while a field has focus, so typing "8" does not become $8. */
  const [priceDraft, setPriceDraft] = useState<string | null>(null)
  const [monthlyDraft, setMonthlyDraft] = useState<string | null>(null)

  const terms: AffordabilityTerms = useMemo(
    () => ({ interestRatePercent: ratePct, downPaymentPct: downPct, loanTermYears: termYears }),
    [ratePct, downPct, termYears],
  )

  const solved = useMemo(
    () => (mode === 'cash' ? solveCash(price) : solveFromPrice(price, terms)),
    [mode, price, terms],
  )

  const medianMonthly = useMemo(
    () => (medianListPrice == null ? null : monthlyAtPrice(medianListPrice, terms)),
    [medianListPrice, terms],
  )

  /* The visitor id is READ ONCE, in an effect, and held in a ref. Reading the
     session id from render or from an inline handler touches localStorage
     during the render pass, which is a hydration hazard the gate refuses
     (ci:hydration-safety, impure-helper). The ref is what both events read. */
  const vid = useRef<string | undefined>(undefined)
  useEffect(() => {
    vid.current = readRrSessionId()
  }, [])

  /* A mount is not a use (site queue SITE-07). The event fires only after a dial
     has actually moved, and only once the visitor has stopped moving it. */
  const touched = useRef(false)
  useEffect(() => {
    if (!touched.current || !solved) return
    const t = window.setTimeout(() => {
      trackEvent('calculator_used', {
        calculator: 'place_affordability',
        place_slug: placeSlug,
        place_grain: grain,
        mode,
        ceiling: solved.ceiling,
        monthly: Math.round(solved.ceilingMonthly),
        rate_pct: ratePct,
        down_pct: downPct,
        term_years: termYears,
        rate_is_published: rate != null,
        rr_vid: vid.current,
      })
    }, V3_AFFORD_TRACK_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [solved, mode, placeSlug, grain, ratePct, downPct, termYears, rate])

  const touch = useCallback(() => {
    touched.current = true
  }, [])

  const setPriceFrom = useCallback(
    (next: number) => {
      touch()
      setPrice(clamp(Math.round(next), 1_000, 100_000_000))
    },
    [touch],
  )

  const setMonthlyFrom = useCallback(
    (next: number) => {
      touch()
      const answer = solveFromMonthly(next, terms)
      if (answer) setPrice(answer.price)
    },
    [terms, touch],
  )

  if (!solved) return null

  const searchHref = withMaxPrice(browseHref, solved.ceiling)
  const searchLabel = affordabilitySearchLabel(placeName, solved.ceiling)
  const claim = affordabilityClaim({ placeName, medianListPrice, medianMonthly, mode })
  const answerLine = affordabilityAnswerLine({ placeName, mode, solved })

  const termsSource =
    mode === 'cash'
      ? 'No loan, so no interest and no term.'
      : `${downPct}% down, ${ratePct}%, ${termYears} years.`

  const figures = affordabilityFigures({
    placeName,
    mode,
    solved,
    medianListPrice,
    medianMonthly,
    medianSource,
    termsSource,
    mix,
    mixSource,
  })

  const rateNote = rate
    ? `${rate.pct}% is the ${rate.sourceName} for the week of ${rate.weekLabel}. Put your own quote in if you have one.`
    : 'We have no measured rate to show you this week, so this one is an assumption you set. Put in the rate you have actually been quoted.'

  const monthlyValue = monthlyDraft ?? formatMonthlyPayment(solved.ceilingMonthly)
  const priceValue = priceDraft ?? formatPriceExact(solved.ceiling)
  const sliderPrice = clamp(solved.ceiling, priceMin, priceMax)
  const sliderMonthlyMin = Math.round(monthlyAtPrice(priceMin, terms) ?? 0)
  const sliderMonthlyMax = Math.round(monthlyAtPrice(priceMax, terms) ?? 0)
  const sliderMonthly = clamp(Math.round(solved.ceilingMonthly), sliderMonthlyMin, sliderMonthlyMax)

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-afford', className)}
      aria-labelledby={`${uid}-h`}
    >
      <div className="v3-afford__head">
        <V3Eyebrow>{eyebrow}</V3Eyebrow>
        <V3Heading level={2} id={`${uid}-h`}>
          {heading}
        </V3Heading>
        <p className="v3-afford__claim">{claim}</p>
      </div>

      <div className="v3-afford__body">
        <div className="v3-afford__solve">
          {offersCash ? (
            <div className="v3-afford__modes" role="group" aria-label="How you are paying">
              {(['financed', 'cash'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={cn('v3-afford__mode', mode === m && 'is-on')}
                  aria-pressed={mode === m}
                  onClick={() => {
                    touch()
                    setMode(m)
                    setMonthlyDraft(null)
                  }}
                >
                  {m === 'financed' ? 'With a loan' : 'All cash'}
                </button>
              ))}
            </div>
          ) : null}

          {mode === 'financed' ? (
            <div className="v3-afford__dial">
              <label className="v3-afford__dial-head" htmlFor={`${uid}-monthly`}>
                <span className="v3-afford__dial-name">What you can pay a month</span>
                <input
                  id={`${uid}-monthly`}
                  className="v3-afford__field"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={monthlyValue}
                  onFocus={(e) => setMonthlyDraft(e.currentTarget.value)}
                  onChange={(e) => {
                    setMonthlyDraft(e.target.value)
                    const parsed = parseMoney(e.target.value)
                    if (parsed != null) setMonthlyFrom(parsed)
                  }}
                  onBlur={() => setMonthlyDraft(null)}
                />
              </label>
              <input
                className="v3-afford__range"
                type="range"
                min={sliderMonthlyMin}
                max={sliderMonthlyMax}
                step={25}
                value={sliderMonthly}
                aria-label={`What you can pay a month in ${placeName}`}
                aria-valuetext={`${formatMonthlyPayment(sliderMonthly)} a month`}
                onChange={(e) => {
                  setMonthlyDraft(null)
                  setMonthlyFrom(Number(e.target.value))
                }}
              />
              <p className="v3-afford__dial-note">
                Principal and interest only. Taxes, insurance and any HOA sit on top.
              </p>
            </div>
          ) : null}

          <div className="v3-afford__dial">
            <label className="v3-afford__dial-head" htmlFor={`${uid}-price`}>
              <span className="v3-afford__dial-name">
                {mode === 'cash' ? 'What you can pay in cash' : 'What the house costs'}
              </span>
              <input
                id={`${uid}-price`}
                className="v3-afford__field"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={priceValue}
                onFocus={(e) => setPriceDraft(e.currentTarget.value)}
                onChange={(e) => {
                  setPriceDraft(e.target.value)
                  const parsed = parseMoney(e.target.value)
                  if (parsed != null) setPriceFrom(parsed)
                }}
                onBlur={() => setPriceDraft(null)}
              />
            </label>
            <input
              className="v3-afford__range"
              type="range"
              min={priceMin}
              max={priceMax}
              step={priceStep}
              value={sliderPrice}
              aria-label={`What the house costs in ${placeName}`}
              aria-valuetext={formatPriceExact(sliderPrice)}
              onChange={(e) => {
                setPriceDraft(null)
                setPriceFrom(Number(e.target.value))
              }}
            />
            <p className="v3-afford__dial-note">
              {mode === 'cash'
                ? 'No loan, so the whole number is yours to bring.'
                : `Between ${formatPriceExact(priceMin)} and ${formatPriceExact(priceMax)} on the slider. Type any number in the box.`}
            </p>
          </div>

          {mode === 'financed' ? (
            <details className="v3-afford__terms">
              <summary className="v3-afford__terms-summary">The assumptions behind that</summary>
              <div className="v3-afford__terms-body">
                {/* A plain div with role=group, not a fieldset: Chrome does not
                    lay a <legend> out as a flex item, so a flex fieldset puts
                    the label on the chip row instead of above it. */}
                <div className="v3-afford__choices" role="group" aria-label="Down payment">
                  <p className="v3-afford__choices-name">Down payment</p>
                  <div className="v3-afford__chiprow">
                    {DOWN_CHOICES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={cn('v3-afford__chip', downPct === d && 'is-on')}
                        aria-pressed={downPct === d}
                        onClick={() => {
                          touch()
                          setDownPct(d)
                          setMonthlyDraft(null)
                        }}
                      >
                        {d}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="v3-afford__choices" role="group" aria-label="Length of the loan">
                  <p className="v3-afford__choices-name">Length of the loan</p>
                  <div className="v3-afford__chiprow">
                    {TERM_CHOICES.map((y) => (
                      <button
                        key={y}
                        type="button"
                        className={cn('v3-afford__chip', termYears === y && 'is-on')}
                        aria-pressed={termYears === y}
                        onClick={() => {
                          touch()
                          setTermYears(y)
                          setMonthlyDraft(null)
                        }}
                      >
                        {y} years
                      </button>
                    ))}
                  </div>
                </div>

                <div className="v3-afford__dial v3-afford__dial--rate">
                  <label className="v3-afford__dial-head" htmlFor={`${uid}-rate`}>
                    <span className="v3-afford__dial-name">Interest rate</span>
                    {/* The unit sits beside the box, not inside the label: a
                        bare "6.71" in a field next to two dollar fields reads
                        as a number with no unit at a glance. */}
                    <span className="v3-afford__rate-row">
                      <input
                        id={`${uid}-rate`}
                        className="v3-afford__field v3-afford__field--rate"
                        type="number"
                        inputMode="decimal"
                        min={RATE_MIN}
                        max={RATE_MAX}
                        step={0.01}
                        value={ratePct}
                        onChange={(e) => {
                          touch()
                          const next = Number(e.target.value)
                          if (Number.isFinite(next)) setRatePct(clamp(next, RATE_MIN, RATE_MAX))
                          setMonthlyDraft(null)
                        }}
                      />
                      <span className="v3-afford__unit" aria-hidden="true">
                        %
                      </span>
                    </span>
                  </label>
                  <input
                    className="v3-afford__range"
                    type="range"
                    min={RATE_MIN}
                    max={RATE_MAX}
                    step={0.05}
                    value={ratePct}
                    aria-label="Interest rate"
                    aria-valuetext={`${ratePct} percent`}
                    onChange={(e) => {
                      touch()
                      setRatePct(Number(e.target.value))
                      setMonthlyDraft(null)
                    }}
                  />
                  <p className="v3-afford__dial-note">{rateNote}</p>
                </div>
              </div>
            </details>
          ) : null}
        </div>

        <div className="v3-afford__answer">
          <p className="v3-afford__answer-line" aria-live="polite">
            {answerLine}
          </p>

          {figures.length > 0 ? (
            <V3Drawing
              figures={figures}
              label={`What your number reaches in ${placeName}`}
              className="v3-afford__drawing"
            />
          ) : null}

          <div
            className="v3-afford__go"
            onClick={() =>
              trackEvent('calculator_interact', {
                calculator: 'place_affordability',
                action: 'see_homes_under_ceiling',
                place_slug: placeSlug,
                place_grain: grain,
                mode,
                ceiling: solved.ceiling,
                monthly: Math.round(solved.ceilingMonthly),
                destination: searchHref,
                rr_vid: vid.current,
              })
            }
          >
            <V3Button href={searchHref} variant="primary" prefetch={false}>
              {searchLabel}
            </V3Button>
          </div>

          <V3SourceDisclosure
            className="v3-afford__source"
            source={`Your own numbers, run through the payment math this site uses everywhere (lib/mortgage.ts): ${termsSource} ${
              rate
                ? `The starting rate is the ${rate.sourceName} published for the week of ${rate.weekLabel}, read from market_history_weekly.`
                : 'The starting rate is not a measured figure — we publish none this week — so it is an assumption you set.'
            } ${medianSource} Nothing here is a loan offer or an approval.`}
          />
        </div>
      </div>
    </section>
  )
}
