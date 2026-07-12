/**
 * SellMarketContext — "Beyond the Zestimate" live pricing-insight module for
 * /sell.
 *
 * THE POINT (Matt, 2026-07-11): a Zestimate is one automated number from a
 * model that never walked the home. A broker prices on live local signals that
 * an online estimate does not surface: how close homes actually close to list,
 * the real price per square foot on closed sales, who is paying cash, what
 * sellers are giving in concessions, and where the leverage sits. This section
 * puts those signals on the page, live, so the seller sees the insight they
 * cannot get on Zillow.
 *
 * DATA ACCURACY (CLAUDE.md §0): every figure is pulled live from the DAL and
 * renders ONLY when the value is present. Nothing is invented, estimated, or
 * hand-typed. Sources:
 *   - getCityMarketDetail (market_stats_cache, closed-sales aggregates):
 *     avgSaleToListRatio, medianPricePerSqft, cashPurchasePct,
 *     medianConcessionsAmount, medianDom, periodEnd, methodologyVersion.
 *   - getMarketPulse (market_pulse_live, current inventory): activeCount,
 *     monthsOfSupply, medianDaysToPending.
 * If no live signal is available the panel collapses to a factual, non-numeric
 * trust line (never a fabricated number).
 *
 * Formatting matches components/site/MarketDetailStats.tsx: sale-to-list is a
 * decimal (0.974 -> 97.4%), $/sqft is an integer, cash share is a plain percent.
 *
 * Design-token colors only. Server-renderable (no client fabrication of live
 * numbers). The LIVE indicator is a decorative CSS pulse.
 */

import type { MarketPulse, MarketDetail } from '@/lib/data'
import { formatDate } from '@/lib/format/date'
import {
  Body,
  Container,
  CTAButton,
  Eyebrow,
  H2,
  Price,
  Section,
  Stack,
  TabularNumber,
  TextLink,
} from '@/components/site/primitives'

const VALUATION_HREF = '/lp/seller-home-value'

function mosVerdict(mos: number): string {
  if (mos <= 4) return "a seller's market"
  if (mos < 6) return 'a balanced market'
  return "a buyer's market"
}

function periodLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  // UTC on purpose: a '2026-07-01' period start must label "July 2026", not
  // drift a calendar day west in Pacific time. day:undefined drops the helper's
  // default day-of-month for a month-year label.
  return formatDate(d, { month: 'long', day: undefined, year: 'numeric', timeZone: 'UTC' })
}

type Signal = {
  key: string
  value: React.ReactNode
  label: string
  why: string
}

type Props = {
  pulse: MarketPulse | null
  detail?: MarketDetail | null
}

export function SellMarketContext({ pulse, detail }: Props) {
  const signals: Signal[] = []

  // Sale-to-list — the single clearest read on whether a price is right.
  if (detail?.avgSaleToListRatio != null && Number.isFinite(detail.avgSaleToListRatio)) {
    signals.push({
      key: 'stl',
      value: (
        <>
          <TabularNumber value={detail.avgSaleToListRatio * 100} fractionDigits={1} />%
        </>
      ),
      label: 'Close-to-list',
      why: 'What homes actually sell for against asking. An estimate cannot tell you the room to negotiate.',
    })
  }

  // Price per square foot on closed sales — the anchor a Zestimate flattens.
  if (detail?.medianPricePerSqft != null && Number.isFinite(detail.medianPricePerSqft)) {
    signals.push({
      key: 'ppsf',
      value: (
        <>
          $<TabularNumber value={Math.round(detail.medianPricePerSqft)} fractionDigits={0} />
        </>
      ),
      label: 'Median $/sq ft',
      why: 'On closed sales, not a model. Condition and finishes move this, and a Zestimate never saw yours.',
    })
  }

  // Cash-buyer share — invisible on a listing site.
  if (detail?.cashPurchasePct != null && Number.isFinite(detail.cashPurchasePct)) {
    signals.push({
      key: 'cash',
      value: (
        <>
          <TabularNumber value={detail.cashPurchasePct} fractionDigits={0} />%
        </>
      ),
      label: 'Paid in cash',
      why: 'Cash buyers change what an offer is worth. No online estimate factors it in.',
    })
  }

  // Median concessions — real dollars sellers give, never shown on Zillow.
  if (detail?.medianConcessionsAmount != null && detail.medianConcessionsAmount > 0) {
    signals.push({
      key: 'concessions',
      value: <Price value={detail.medianConcessionsAmount} />,
      label: 'Median concession',
      why: 'What sellers are crediting buyers right now. It comes straight off your net.',
    })
  }

  // Months of supply + leverage verdict.
  const mosRaw = typeof pulse?.monthsOfSupply === 'number' ? pulse.monthsOfSupply : null
  if (mosRaw != null) {
    signals.push({
      key: 'mos',
      value: (
        <>
          <TabularNumber value={Math.round(mosRaw * 10) / 10} fractionDigits={1} />
          <span className="text-primary-foreground/60"> mo</span>
        </>
      ),
      label: 'Months of supply',
      why: `Where the leverage sits. Right now that is ${mosVerdict(mosRaw)}.`,
    })
  }

  // Homes competing for the same buyer this week.
  if (typeof pulse?.activeCount === 'number' && pulse.activeCount > 0) {
    signals.push({
      key: 'active',
      value: <TabularNumber value={pulse.activeCount} fractionDigits={0} />,
      label: 'Homes competing now',
      why: 'This week’s active competition. An estimate weighs stale comps, not what buyers see today.',
    })
  }

  const hasSignals = signals.length > 0
  const shown = signals.slice(0, 6)
  const period = periodLabel(detail?.periodEnd ?? pulse?.refreshedAt)

  const BLIND_SPOTS = [
    { t: 'Your kitchen', d: 'It never walked your home or saw the remodel.' },
    { t: 'This week’s buyers', d: 'It weighs old comps, not who is shopping now.' },
    { t: 'Timing', d: 'Season and rate moves shift the number month to month.' },
    { t: 'The terms', d: 'Concessions and contingencies decide what you net.' },
  ]

  return (
    <Section id="pricing-insight" padding="default" tone="default" divider>
      <Container>
        <Stack gap="tight" className="mb-8 max-w-2xl">
          <Eyebrow>Beyond the Zestimate</Eyebrow>
          <H2>A Zestimate is one number. We price on the signals it cannot see.</H2>
          <Body size="large" tone="muted" className="mt-1 leading-relaxed">
            An automated estimate never walked your home, never weighed this
            week’s buyers, and hands you a single guess. Here is the live read
            a broker actually prices on, pulled from the Central Oregon MLS.
          </Body>
        </Stack>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* What it cannot see */}
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              What an online estimate cannot see
            </p>
            <ul className="mt-4 flex flex-col divide-y divide-border rounded-[14px] border border-border bg-muted">
              {BLIND_SPOTS.map((b) => (
                <li key={b.t} className="flex gap-3 p-4">
                  <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" fill="none">
                    <circle cx="10" cy="10" r="9" className="fill-muted-foreground/10" />
                    <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{b.t}</span>
                    <span className="block text-sm leading-snug text-muted-foreground">{b.d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* The live read */}
          <div className="lg:col-span-3">
            {hasSignals ? (
              <div className="overflow-hidden rounded-[14px] bg-primary text-primary-foreground">
                <div className="flex items-center justify-between gap-3 border-b border-primary-foreground/15 px-6 py-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/80">
                    The Bend read, right now
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-60 motion-safe:animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-foreground" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/80">Live</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  {shown.map((s, i) => (
                    <div
                      key={s.key}
                      className={`border-primary-foreground/15 p-6 ${i % 2 === 0 ? 'sm:border-r' : ''} ${i >= 2 ? 'border-t' : 'sm:border-t-0'} ${i >= 1 ? 'border-t' : ''}`}
                    >
                      <div className="font-display text-4xl leading-none tabular-nums text-primary-foreground">
                        {s.value}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-primary-foreground">{s.label}</div>
                      <div className="mt-1 text-sm leading-snug text-primary-foreground/70">{s.why}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-primary-foreground/15 px-6 py-3 text-xs text-primary-foreground/60">
                  Central Oregon MLS{period ? ` · closed sales through ${period}` : ''}. Area medians, refreshed on a schedule. Your CMA is your home’s exact number.
                </div>
              </div>
            ) : (
              <div className="rounded-[14px] border border-border bg-card p-6">
                <Body size="default" tone="muted" className="leading-relaxed">
                  We track the Central Oregon market in real time so your list
                  price is based on what buyers are paying today, not a model of
                  what sold six months ago. A broker builds your number from the
                  live comps and shows you every one.
                </Body>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <CTAButton href={VALUATION_HREF} tone="primary" size="md">
            Get your address-specific read
          </CTAButton>
          <TextLink href="/housing-market" tone="primary" underline="on-hover">
            See the full Central Oregon market data
          </TextLink>
        </div>
      </Container>
    </Section>
  )
}
