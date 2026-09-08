/**
 * Web + print chapters for market-area density. Our look. Our number.
 */

import { cleanText, dec, escapeHtml, int, propertyIntelligenceBlock, usd } from '@/lib/cma/render-blocks'
import { clientAreaLabel, clientSourceLine } from '@/lib/cma/client-facing'
import { formatMonthsOfSupply, monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'
import {
  askOutcomeBarsPhoneSvg,
  askOutcomeBarsSvg,
  monthsOfSupplyBarsPhoneSvg,
  monthsOfSupplyBarsSvg,
  daysToOfferPhoneSvg,
  daysToOfferSvg,
  medianCloseCaption,
  medianCloseLinePhoneSvg,
  medianCloseLineSvg,
  offerTimingCurvePhoneSvg,
  offerTimingCurveSvg,
  type AskOutcome,
  type AskOutcomeGroup,
  type DaysRow,
  type OfferTiming,
} from '@/lib/cma/market-charts'
import { subjectDomDays, subjectListingFailed } from '@/lib/cma/comp-matrix'
import type { CmaMarketArea, CmaSoldBand, CmaStatusBucket } from '@/lib/cma/market-status'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaSiteData } from '@/lib/cma/county'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'

export type MarketChapterArgs = {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  extras?: { marketArea?: CmaMarketArea | null } | null
  site?: CmaSiteData | null
  /**
   * The recommend. Required to decide whether the 90-day band is this
   * subject's product at all (P3) — without it the band prints beside a
   * number it contradicts.
   */
  pricing?: Pick<CmaPricing, 'recommended'> | null
}

const esc = escapeHtml

/** "Redmond" → "Redmond's"; "Three Rivers" → "Three Rivers'". */
function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`
}

function money(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  return usd(Math.round(n))
}

function tileMeta(b: CmaStatusBucket): string {
  const bits = [
    money(b.median),
    b.medianPpsf != null ? `${usd(Math.round(b.medianPpsf))}/sf` : null,
    b.medianDom != null && b.medianDom > 0 ? `${int(Math.round(b.medianDom))} days` : null,
  ].filter(Boolean)
  return bits.join(' · ')
}

function statusBoards(area: CmaMarketArea): string {
  const selected = area.selected
  if (!selected || selected.count <= 0) return ''
  const others = [area.active, area.pending, area.expired, area.closed].filter(
    (b): b is CmaStatusBucket => Boolean(b && b.count > 0),
  )
  const tiles = others
    .map(
      (b) => `<div class="status-tile">
        <div class="status-tile-n">${int(b.count)}</div>
        <div class="status-tile-l">${esc(b.label)}</div>
        ${tileMeta(b) ? `<div class="status-tile-m">${esc(tileMeta(b))}</div>` : ''}
      </div>`,
    )
    .join('')
  return `<div class="status-hero">
      <div class="status-hero-n">${int(selected.count)}</div>
      <div class="status-hero-l">${esc(selected.label)}</div>
    </div>
    ${tiles ? `<div class="status-tiles">${tiles}</div>` : ''}`
}

export function renderStatusGridHtml(
  area: CmaMarketArea | null | undefined,
  city?: string | null,
): string {
  if (!area) return ''
  const boards = statusBoards(area)
  if (!boards) return ''
  const label = clientAreaLabel(area.label, city)
  return `${boards}<p class="small">${esc(
    clientSourceLine(area.source, label ? `Similar homes in ${label}.` : 'Similar homes in this market area.', {
      city,
    }),
  )}</p>`
}

/**
 * Is the 90-day band this subject's product?
 *
 * P3, Matt 2026-09-07: the immersive printed "$458,500 median sold, 4 closed
 * in 90 days, $455,000 to $515,000" one scroll away from a $389,000
 * recommend, with no sentence reconciling them. The band is built on beds, not
 * on living area, so on a small house in a subdivision of larger ones it
 * describes a different product. CmaSoldBand carries no square footage, so
 * there is no honest reconciling sentence to write from what is stored — under
 * CLAUDE.md §0 the block comes out instead of shipping the contradiction.
 *
 * Kept when the recommend falls inside the band the seller is being shown, and
 * the band's median is within 20% of it. Both figures are stored, neither is
 * recomputed here.
 */
export function soldBandFitsRecommend(
  band: CmaSoldBand | null | undefined,
  recommended: number | null | undefined,
): boolean {
  if (!band || band.count < 3) return false
  if (recommended == null || !(recommended > 0)) return false
  if (band.low != null && band.high != null && (recommended < band.low || recommended > band.high)) {
    return false
  }
  if (band.median != null && band.median > 0) {
    const ratio = band.median / recommended
    if (ratio > 1.2 || ratio < 1 / 1.2) return false
  }
  return true
}

export function renderSold90Html(
  area: CmaMarketArea | null | undefined,
  city?: string | null,
): string {
  const s = area?.sold90
  if (!s || s.count < 3) return ''
  return `<div class="sold-hero">
    <div class="sold-hero-n">${money(s.median) ?? ''}</div>
    <div class="sold-hero-l">median sold</div>
  </div>
  <div class="stat2">
    <div class="st"><div class="st-n">${int(s.count)}</div><div class="st-l">closed in 90 days</div></div>
    <div class="st"><div class="st-n">${money(s.low) ?? ''} to ${money(s.high) ?? ''}</div><div class="st-l">${esc(s.bedsLabel)} band</div></div>
  </div>
  <p class="small">${esc(
    clientSourceLine(s.source, 'Closed sales in this market area over the last 90 days.', { city }),
  )}</p>`
}

/**
 * The city, in four plain sentences and one drawing.
 *
 * tasteReview 2026-09-07: this was the banned KPI grid, verbatim — "3.9 /
 * months of supply", "97.8% / sold price to original ask" — a number, a
 * percentage and methodology jargon, with no sentence saying what any of it
 * means, beside a $532,311 median that contradicted the recommendation three
 * screens up. TASTE.md names both defects: "a row of percent tiles" and "MOS
 * is two bars (homes for sale vs a month of sales), not a tile that says 3.9".
 *
 * So every figure now sits INSIDE a sentence a reader who does not sell houses
 * can act on, months of supply is drawn as the two counts it is a ratio of,
 * and the median-close line runs on a rounded axis so a flat market looks flat.
 * The city median itself is reconciled against this house one paragraph above
 * (`cityMedianReconciliationHtml`), which is where it belongs.
 *
 * Every label says what its number is, and two of them used to lie about it:
 *
 * - `medianDom` is `market_stats_cache.median_dom`, the median of
 *   `listings.days_to_pending` (on-market date to pending). It is the days a
 *   seller waited for an accepted offer, not "days on market", and CLAUDE.md
 *   §7 bans publishing a list-to-close figure under that name.
 * - `saleToListRatio` carries `median_sale_to_original_list` from the pace
 *   read, not sale to the final ask. A seller who cut twice reads "sold to
 *   list" as the last ask, which is a different and better-looking number.
 */
export function renderInventoryBoardHtml(market: CmaMarketContext | null | undefined): string {
  if (!market) return ''
  const place = cleanText(market.geoLabel) ?? 'this market'
  const mos = market.monthsOfSupply
  const verdict = mos != null ? monthsOfSupplyVerdict(mos) : null
  const trend = market.trend ?? []
  const chart = medianCloseLineSvg(trend)
  const chartPhone = medianCloseLinePhoneSvg(trend)
  const chartHtml = chart
    ? `<div class="szn median-wide" data-anim="chart">${chart}</div>${
        chartPhone ? `<div class="szn median-phone" data-anim="chart">${chartPhone}</div>` : ''
      }${medianCloseCaption(trend)}`
    : ''

  // The monthly pace the PUBLISHED months-of-supply figure was divided by.
  // Never recomputed from a different denominator: the bars have to reproduce
  // the number printed beside them (CLAUDE.md §0).
  const active = market.activeCount
  const perMonth =
    mos != null && mos > 0 && active != null && active > 0 ? active / mos : null
  const barsWide =
    perMonth != null && active != null
      ? monthsOfSupplyBarsSvg({ activeCount: active, perMonth, place })
      : ''
  const barsPhone =
    perMonth != null && active != null
      ? monthsOfSupplyBarsPhoneSvg({ activeCount: active, perMonth, place })
      : ''
  const barsHtml = barsWide
    ? `<div class="szn mos-wide">${barsWide}</div>${
        barsPhone ? `<div class="szn mos-phone">${barsPhone}</div>` : ''
      }`
    : ''

  const sentences: string[] = []
  if (mos != null && active != null && perMonth != null && verdict) {
    sentences.push(
      `${int(active)} homes are for sale in ${place} right now, and about ${int(
        Math.round(perMonth),
      )} sell in a typical month. At that pace it would take ${formatMonthsOfSupply(
        mos,
      )} months to sell what is listed, which is ${verdict.label.toLowerCase()} territory.`,
    )
  } else if (mos != null && verdict) {
    // The degraded branch, when the active count or the pace is missing. It
    // still may not print the trade term: "months of supply" as a bare label
    // is the jargon the taste review named.
    sentences.push(
      `At the pace homes are selling in ${place} it would take ${formatMonthsOfSupply(
        mos,
      )} months to sell what is listed, which is ${verdict.label.toLowerCase()} territory.`,
    )
  }
  // NO THIRD SOLD-TO-FIRST-ASK FIGURE. `saleToListRatio` is the pace read's
  // median_sale_to_original_list; chapter 2b prints the same idea per group
  // off the 12-month local read, and chapter 3's method prints the share the
  // price itself was carried to. On 19968 those were 97.0 and 93.5 percent,
  // both captioned "of the price they first asked", four screens apart. The
  // two that are load-bearing stay; this one goes (CLAUDE.md §0).
  // The SAME median chapter 2b draws, when the row carries it. Two figures for
  // "half had an offer inside N days" — 25 off the 12-month single-family read
  // and 26 off market_stats_cache — printed three screens apart is a §0
  // failure whichever is right, and only the offer-timing block ships with a
  // source trace beside it.
  const offerMedian = readOfferTiming(market)?.medianDays ?? market.medianDom
  if (offerMedian != null && offerMedian > 0) {
    sentences.push(
      // "Half of them" sat after a sentence whose subject is the homes FOR
      // SALE; this median is over the homes that sold.
      `Half of the homes that sold had an accepted offer inside ${int(
        offerMedian,
      )} days; the other half waited longer.`,
    )
  }
  if (chart) {
    sentences.push(
      `The line below is what a home in ${place} closed at, month by month, over the last year.`,
    )
  }
  const prose = sentences.length
    ? `<p class="chart-read">${esc(sentences.join(' '))}</p>`
    : ''
  return [prose, barsHtml, chartHtml].filter(Boolean).join('\n  ')
}

export function adjustedCloseRange(
  comps: readonly CmaAdjustedComp[] | null | undefined,
): { low: number; high: number; adjustments: string } | null {
  const priced = (comps ?? []).map((c) => c.adjustedPrice).filter((n) => Number.isFinite(n) && n > 0)
  if (priced.length < 2) return null
  const kinds: string[] = []
  if ((comps ?? []).some((c) => (c.sizeAdjustment ?? 0) !== 0)) kinds.push('size')
  if ((comps ?? []).some((c) => (c.timeAdjustment ?? 0) !== 0)) kinds.push('date')
  if ((comps ?? []).some((c) => (c.storyAdjustment ?? 0) !== 0)) kinds.push('style')
  const adjustments =
    kinds.length === 0
      ? ''
      : kinds.length === 1
        ? kinds[0]!
        : `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}`
  return { low: Math.min(...priced), high: Math.max(...priced), adjustments }
}



/**
 * How fast homes like yours went. One days axis, one named row per kept sale
 * at the days it waited for an offer, and the subject's own listing at the
 * days it waited and never got one.
 *
 * P4, Matt 2026-09-07: this is the "what happens when it is overpriced" chart.
 * It replaces a twelve-month ledger of one-to-three new listings and a row of
 * dashes, which answered nothing a seller asks.
 *
 * The city's median rides the same axis as a hairline tick. It was left off
 * on the stated ground that the market figure is list-to-close (CLAUDE.md §7)
 * and two measures never share an axis. That reason was wrong:
 * `market.medianDom` is `market_stats_cache.median_dom`, the median of
 * `listings.days_to_pending`, and a comp's `daysToOffer` reads the same column
 * (lib/cma/comps.ts:131). One measure, one axis. The tick renders only when
 * the figure is on `render_args`; nothing here is recomputed or filled.
 */
export function renderDaysToOfferHtml(
  a: Pick<MarketChapterArgs, 'subject' | 'comps' | 'market'>,
): string {
  const rows: DaysRow[] = a.comps
    .map((c, i) =>
      c.daysToOffer != null && c.daysToOffer >= 0
        ? {
            label: `${i + 1}. ${c.address}`,
            days: c.daysToOffer,
            subject: false,
            valueLabel: `${int(c.daysToOffer)} ${c.daysToOffer === 1 ? 'day' : 'days'}`,
          }
        : null,
    )
    .filter((r): r is DaysRow => r != null)
  if (rows.length < 3) return ''
  const slowest = Math.max(...rows.map((r) => r.days))
  // The subject's bar is "days it waited and never got an offer". That figure
  // exists only for a listing that actually failed — on a house that sold, the
  // same arithmetic is the age of the sale, not time on market.
  const subjectDays = subjectListingFailed(a.subject) ? subjectDomDays(a.subject) : null
  if (subjectDays != null && subjectDays > 0) {
    rows.push({
      label: a.subject.streetAddress,
      days: subjectDays,
      subject: true,
      valueLabel: `${int(subjectDays)} days, no offer`,
    })
  }
  const marketMedian =
    a.market?.medianDom != null && Number.isFinite(a.market.medianDom) && a.market.medianDom > 0
      ? Math.round(a.market.medianDom)
      : null
  const marketPlace = cleanText(a.market?.geoLabel) ?? cleanText(a.subject.city)
  const tick =
    marketMedian != null && marketPlace
      ? { days: marketMedian, label: `${marketPlace} median ${int(marketMedian)} days` }
      : null
  const svg = daysToOfferSvg(rows, 'How fast homes like yours went', tick)
  if (!svg) return ''
  const reading = [
    `Every sale below had an offer inside ${int(slowest)} days.`,
    tick ? `${possessive(marketPlace!)} median is ${int(marketMedian!)}.` : null,
    subjectDays != null && subjectDays > 0
      ? `Yours sat ${int(subjectDays)} days and never got one.`
      : null,
  ]
    .filter(Boolean)
    .join(' ')
  // Two layouts of one graphic, exactly one ever visible: the wide strip on
  // paper and at reading width, the drawn-to-fit one below 700px. F8 — the
  // wide strip in a pan box put the subject's own bar label, the punchline of
  // the chart, outside the visible width of a box nobody scrolls.
  const phone = daysToOfferPhoneSvg(rows, 'How fast homes like yours went', tick)
  return `<div class="szn days-wide">${svg}</div>
  ${phone ? `<div class="szn days-phone">${phone}</div>` : ''}
  <p class="chart-read">${esc(reading)}</p>`
}

export function renderPhotoSetHtml(a: Pick<MarketChapterArgs, 'subject' | 'comps'>): string {
  const urls = [
    a.subject.photoUrl,
    ...a.comps.map((c) => c.photoUrl),
  ].filter((u): u is string => Boolean(u && u.trim()))
  const unique = [...new Set(urls)].slice(0, 12)
  if (unique.length === 0) return ''
  const tiles = unique
    .map((src, i) => {
      const lead = i === 0 ? ' photo-lead' : ''
      const eager = i < 4 ? 'eager' : 'lazy'
      return `<figure class="photo-tile${lead}"><img src="${esc(src)}" alt="${i === 0 ? esc(a.subject.streetAddress) : 'Comparable sale'}" loading="${eager}" referrerpolicy="no-referrer"/></figure>`
    })
    .join('')
  return `<div class="photo-set">${tiles}</div>`
}

export function immersiveMarketChapters(a: MarketChapterArgs): string {
  const area = a.extras?.marketArea
  const status = renderStatusGridHtml(area, a.subject.city)
  const sold90 = renderSold90Html(area, a.subject.city)
  const areaLabel = clientAreaLabel(area?.label, a.subject.city)
  const inventory = renderInventoryBoardHtml(a.market)
  const facts = propertyIntelligenceBlock(a.site)
  const parts: string[] = []
  if (status && areaLabel) {
    parts.push(`<section class="sc sc-cream" id="status-grid">
      <div class="in wide">
        <div class="kick r">This market</div>
        <h2 class="h r">${esc(areaLabel!)}</h2>
        <div class="r">${status}</div>
      </div>
    </section>`)
  }
  if (sold90) {
    parts.push(`<section class="sc sc-cream" id="sold-90">
      <div class="in">
        <div class="kick r">Last 90 days</div>
        <h2 class="h r">What ${esc(area!.sold90!.bedsLabel)} homes sold for</h2>
        <div class="r">${sold90}</div>
      </div>
    </section>`)
  }
  if (inventory) {
    parts.push(`<section class="sc sc-cream" id="inventory">
      <div class="in">
        <div class="kick r">${esc(a.market?.geoLabel ?? a.subject.city)}</div>
        <h2 class="h r">How fast this market is moving</h2>
        <div class="r">${inventory}</div>
      </div>
    </section>`)
  }
  if (facts) {
    parts.push(`<section class="sc sc-cream" id="property-facts">
      <div class="in">
        <div class="kick r">The parcel</div>
        <h2 class="h r">Facts, flood, and site</h2>
        <div class="r facts-block">${facts}</div>
      </div>
    </section>`)
  }
  return parts.join('\n')
}

export function printMarketAreaPages(a: MarketChapterArgs): CmaPageDef[] {
  const area = a.extras?.marketArea
  const pages: CmaPageDef[] = []
  const status = renderStatusGridHtml(area, a.subject.city)
  const areaLabel = clientAreaLabel(area?.label, a.subject.city)
  if (status && area && areaLabel) {
    pages.push({
      meta: `${esc(a.subject.streetAddress)} · Market area`,
      toc: 'This market',
      body: `<h2 class="section">${esc(areaLabel)}</h2>
      ${status}`,
    })
  }
  const sold90 = renderSold90Html(area, a.subject.city)
  if (sold90 && area?.sold90) {
    pages.push({
      meta: `${esc(a.subject.streetAddress)} · 90-day solds`,
      toc: 'Last 90 days',
      body: `<h2 class="section">What ${esc(area.sold90.bedsLabel)} homes sold for</h2>${sold90}`,
    })
  }
  const inventory = renderInventoryBoardHtml(a.market)
  if (inventory) {
    pages.push({
      meta: `${esc(a.subject.streetAddress)} · Inventory`,
      toc: 'How fast this market is moving',
      body: `<h2 class="section">How fast this market is moving</h2>${inventory}`,
    })
  }
  const photos = renderPhotoSetHtml(a)
  if (photos) {
    pages.push({
      meta: `${esc(a.subject.streetAddress)} · Photos`,
      toc: a.subject.streetAddress,
      body: `<h2 class="section">${esc(a.subject.streetAddress)}</h2>${photos}`,
    })
  }
  return pages
}

/**
 * The wider market body, shared by the letter chapter and the immersive scene
 * so the two documents can never disagree about what this market is.
 *
 * The 90-day band renders only when it is this subject's product
 * (soldBandFitsRecommend). The month ledger of new listings is gone: P4
 * replaced it with the days-to-offer chart, which answers a question a seller
 * actually has.
 */
export function widerMarketBodyHtml(
  a: MarketChapterArgs,
  headingTag: 'h3' | 'sub',
): string {
  const area = a.extras?.marketArea
  const sub = (text: string) =>
    headingTag === 'h3'
      ? `<h3 class="subhead">${esc(text)}</h3>`
      : `<h3 class="sub r">${esc(text)}</h3>`
  const fits = soldBandFitsRecommend(area?.sold90, a.pricing?.recommended ?? null)
  const sold90 = fits ? renderSold90Html(area, a.subject.city) : ''
  const inventory = renderInventoryBoardHtml(a.market)
  const chunks: string[] = []
  if (sold90 && area?.sold90) {
    chunks.push(
      `<div id="sold-90">${sub(`What ${area.sold90.bedsLabel} homes sold for`)}${sold90}</div>`,
    )
  }
  if (inventory) {
    chunks.push(`<div id="inventory">${sub('How fast this market is moving')}${inventory}</div>`)
  }
  return chunks.join('\n')
}

/** Wider market scene: 90-day sold when it is this product, then the board. */
export function immersiveWiderMarketChapters(a: MarketChapterArgs): string {
  const body = widerMarketBodyHtml(a, 'sub')
  if (!body) return ''
  return `<section class="sc sc-cream" id="this-market">
      <div class="in">
        <div class="kick r">${esc(a.market?.geoLabel ?? a.subject.city)}</div>
        <h2 class="h r">This market</h2>
        <div class="r">${body}</div>
      </div>
    </section>`
}

export function printWiderMarketPages(a: MarketChapterArgs): CmaPageDef[] {
  const body = widerMarketBodyHtml(a, 'h3')
  if (!body) return []
  return [
    {
      meta: `${esc(a.subject.streetAddress)} · This market`,
      toc: 'This market',
      body: `<h2 class="section">This market</h2>\n${body}`,
    },
  ]
}

// ── Chapter 2: priced right sells, priced high sits ─────────────────────────
// docs/plans/CMA_REIMAGINED_2026-09-07.md chapter 2. Both figures are computed
// at BUILD in lib/pricing through the DAL and stored on `render_args.market`.
// Nothing below computes a statistic — it validates the stored shape and draws
// it, and when the shape is absent the chapter argues the same claim from the
// sales already printed in this document.

/** Minimum sales behind a published group. Below it the graphic is omitted. */
export const CHAPTER2_MIN_N = 30

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * `render_args.market.offerTiming`, validated.
 *
 * The field arrives as JSON off a database row, so it is read defensively:
 * a partial or malformed block draws nothing rather than a broken axis.
 * Typed on the renderer side (lib/cma/market-charts.ts) rather than on
 * CmaMarketContext so the build stream that writes it owns that type alone.
 */
export function readOfferTiming(market: CmaMarketContext | null | undefined): OfferTiming | null {
  const raw = (market as unknown as { offerTiming?: unknown } | null)?.offerTiming
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const n = num(o.n)
  const city = typeof o.city === 'string' ? o.city.trim() : ''
  const windowMonths = num(o.windowMonths) ?? 12
  if (!city || n == null || n < CHAPTER2_MIN_N) return null
  const points = Array.isArray(o.points)
    ? o.points
        .map((p) => {
          const days = num((p as Record<string, unknown>)?.days)
          const pct = num((p as Record<string, unknown>)?.pct)
          return days != null && pct != null ? { days, pct } : null
        })
        .filter((p): p is { days: number; pct: number } => p != null)
    : []
  if (points.length < 3) return null
  return { city, windowMonths, n, points, medianDays: num(o.medianDays) }
}

/** `render_args.market.askOutcome`, validated. Every group needs CHAPTER2_MIN_N. */
export function readAskOutcome(market: CmaMarketContext | null | undefined): AskOutcome | null {
  const raw = (market as unknown as { askOutcome?: unknown } | null)?.askOutcome
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const city = typeof o.city === 'string' ? o.city.trim() : ''
  if (!city || !Array.isArray(o.groups)) return null
  const keys: AskOutcomeGroup['key'][] = ['sold-no-cut', 'sold-after-cut', 'did-not-sell']
  const groups = o.groups
    .map((g) => {
      const r = g as Record<string, unknown>
      const key = keys.find((k) => k === r.key)
      const n = num(r.n)
      const medianDays = num(r.medianDays)
      if (!key || n == null || medianDays == null) return null
      const group: AskOutcomeGroup = {
        key,
        n,
        medianDays,
        medianCutPct: num(r.medianCutPct),
        medianSoldToOriginalAskPct: num(r.medianSoldToOriginalAskPct),
        soldToOriginalAskN: num(r.soldToOriginalAskN),
      }
      return group
    })
    .filter((g): g is AskOutcomeGroup => g != null)
  // One thin group makes the comparison a lie, so the whole graphic goes.
  if (groups.length < 2 || groups.some((g) => g.n < CHAPTER2_MIN_N)) return null
  return { city, windowMonths: num(o.windowMonths) ?? 12, groups }
}

/**
 * What the build says about a figure it did not publish.
 *
 * The blueprint's rule for chapter 2 is that a figure under the minimum count
 * is "omitted and the chapter says the count was too small". The build already
 * writes that sentence — `reason` on the block is a MEASURED outcome ("14 sales
 * in Sisters in the last 12 months carried a days-to-offer value. That is under
 * the 30 needed to publish a timing curve"), not a narration of which query
 * missed. So it is printed as written when the block exists and carries one,
 * and nothing is said when the row predates the contract entirely.
 */
export function statWithheldReason(block: unknown): string | null {
  if (!block || typeof block !== 'object') return null
  const reason = (block as { reason?: unknown }).reason
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null
}

/** The §0 trace, at seller grain: what was counted, where, over how long. */
function chapter2SourceLine(city: string, windowMonths: number, n: number | null): string {
  const period = windowMonths === 12 ? 'the last 12 months' : `the last ${int(windowMonths)} months`
  const count = n != null ? `${int(n)} closed sales. ` : ''
  return `${count}Single-family sales in ${city} over ${period}, from the Oregon Data Share MLS.`
}

/**
 * ONE source line for chapter 2b's three graphics.
 *
 * They all read the same city over the same window from the same MLS, and
 * each printed its own trace, so the chapter shipped as eyebrow → heading →
 * figure → sentence → source, three times inside itself. That is the
 * stacked-section shape TASTE.md names as our tell. The counts still say what
 * each of them is, because two of these groups are closed sales and one is
 * listings that came off without one.
 */
export function chapter2bSourceLine(a: {
  market: CmaMarketContext | null
}): string {
  const timing = readOfferTiming(a.market)
  const outcome = readAskOutcome(a.market)
  const table = readAskRealization(a.market)
  const city = timing?.city ?? outcome?.city ?? table?.city ?? null
  if (!city) return ''
  const windowMonths = timing?.windowMonths ?? outcome?.windowMonths ?? table?.windowMonths ?? 12
  const period = windowMonths === 12 ? 'the last 12 months' : `the last ${int(windowMonths)} months`
  // NO AGGREGATE COUNT. The three figures are measured over three different
  // sets — sales with a recorded time to offer, sales grouped by what the
  // first price did, and sales bucketed by weeks — so one total under all
  // three invites a reader to add the table up and find it does not match
  // (2,079 against 2,087 on 19968). Every figure prints its own count where it
  // is drawn: the bars carry "375 listings" per row, the table carries a Sales
  // column, and the curve names its own in its reading.
  const tableNote = table
    ? ' Each row of the table is the median close over the price that listing first asked, across the sales in that row.'
    : ''
  return `Single-family listings in ${city} over ${period}, from the Oregon Data Share MLS. Each figure above counts the listings it draws.${tableNote}`
}

/** 2a. When homes like yours get their offer. */
export function renderOfferTimingHtml(a: {
  market: CmaMarketContext | null
  subject: CmaSubject
  /** Inside the composed spread: no heading of its own, no source line. */
  bare?: boolean
}): string {
  const raw = (a.market as unknown as { offerTiming?: unknown } | null)?.offerTiming
  const timing = readOfferTiming(a.market)
  if (!timing) {
    const withheld = statWithheldReason(raw)
    return withheld
      ? `${a.bare ? '' : '<h3 class="subhead">When homes like yours get their offer</h3>'}
  <p class="chart-read">${esc(withheld)}</p>`
      : ''
  }
  const subjectDays = subjectListingFailed(a.subject) ? subjectDomDays(a.subject) : null
  const wide = offerTimingCurveSvg(timing, subjectDays)
  if (!wide) return ''
  const phone = offerTimingCurvePhoneSvg(timing, subjectDays)
  // The figures the curve DRAWS, to one decimal, in the order it draws them.
  // "Nine in ten inside 180" was a fraction fitted to a 95.6 percent point,
  // and the blueprint's own note on this curve is that its last point is not
  // 100 — so the sentence states the shares, not a rounded fraction of them.
  const ninety = timing.points.find((p) => p.days === 90) ?? null
  const last = timing.points[timing.points.length - 1] ?? null
  const reading = [
    timing.medianDays != null && timing.medianDays > 0
      ? `Half of the ${int(timing.n)} homes that sold in ${timing.city} had an offer inside ${int(
          timing.medianDays,
        )} days.`
      : null,
    ninety ? `${ninety.pct.toFixed(1)} percent had one inside 90 days.` : null,
    last && (!ninety || last.days !== ninety.days)
      ? `By day ${int(last.days)}, ${last.pct.toFixed(1)} percent did.`
      : null,
    subjectDays != null && subjectDays > 0 ? `Yours went ${int(subjectDays)} days without one.` : null,
  ]
    .filter(Boolean)
    .join(' ')
  return `<h3 class="subhead">When homes like yours get their offer</h3>
  <div class="szn timing-wide">${wide}</div>
  ${phone ? `<div class="szn timing-phone">${phone}</div>` : ''}
  ${reading ? `<p class="chart-read">${esc(reading)}</p>` : ''}
  ${a.bare ? '' : `<p class="small">${esc(chapter2SourceLine(timing.city, timing.windowMonths, timing.n))}</p>`}`
}

/** 2b. The first price decides the days. */
export function renderAskOutcomeHtml(a: {
  market: CmaMarketContext | null
  subject: CmaSubject
  /** Inside the composed spread: no source line of its own. */
  bare?: boolean
}): string {
  const raw = (a.market as unknown as { askOutcome?: unknown } | null)?.askOutcome
  const outcome = readAskOutcome(a.market)
  if (!outcome) {
    const withheld = statWithheldReason(raw)
    return withheld
      ? `<h3 class="subhead">The first price decides the days</h3>
  <p class="chart-read">${esc(withheld)}</p>`
      : ''
  }
  const mine: AskOutcomeGroup['key'] | null = subjectListingFailed(a.subject) ? 'did-not-sell' : null
  const wide = askOutcomeBarsSvg(outcome, mine)
  if (!wide) return ''
  const phone = askOutcomeBarsPhoneSvg(outcome, mine)
  const by = (k: AskOutcomeGroup['key']) => outcome.groups.find((g) => g.key === k) ?? null
  const noCut = by('sold-no-cut')
  const cut = by('sold-after-cut')
  const dead = by('did-not-sell')
  // Each clause names a figure drawn beside it. "Launched at the right price"
  // and "never cut enough" were the renderer's opinion of three measured
  // groups, and the groups are defined by what the price DID, not by whether
  // it was right (§0 — narrative follows the data, never the other way).
  const share = (g: AskOutcomeGroup | null): string =>
    g?.medianSoldToOriginalAskPct != null && g.medianSoldToOriginalAskPct > 0
      ? `, and closed at ${g.medianSoldToOriginalAskPct.toFixed(1)} percent of what they first asked`
      : ''
  const reading = [
    noCut
      ? `Homes that sold without ever cutting their price took a median of ${int(noCut.medianDays)} days${share(noCut)}.`
      : null,
    cut
      ? `Homes that cut took ${int(cut.medianDays)} days${
          cut.medianCutPct != null && cut.medianCutPct > 0
            ? `, gave up a median ${cut.medianCutPct.toFixed(1)} percent`
            : ''
        }${share(cut)}.`
      : null,
    dead
      ? `Homes that came off unsold had been on the market a median ${int(dead.medianDays)} days.`
      : null,
  ]
    .filter(Boolean)
    .join(' ')
  return `<h3 class="subhead">The first price decides the days</h3>
  <div class="szn outcome-wide">${wide}</div>
  ${phone ? `<div class="szn outcome-phone">${phone}</div>` : ''}
  ${reading ? `<p class="chart-read">${esc(reading)}</p>` : ''}
  ${a.bare ? '' : `<p class="small">${esc(askOutcomeSourceLine(outcome))}</p>`}`
}

/**
 * The §0 trace for the three-group bars.
 *
 * It cannot reuse `chapter2SourceLine`: two of these groups are closed sales
 * and the third is listings that came off without one, so a single "N closed
 * sales" figure over the total would be false. The counts are named for what
 * each of them is.
 */
function askOutcomeSourceLine(outcome: AskOutcome): string {
  const period =
    outcome.windowMonths === 12 ? 'the last 12 months' : `the last ${int(outcome.windowMonths)} months`
  const sold = outcome.groups
    .filter((g) => g.key !== 'did-not-sell')
    .reduce((sum, g) => sum + g.n, 0)
  const failed = outcome.groups.find((g) => g.key === 'did-not-sell')?.n ?? 0
  const counts = [
    sold > 0 ? `${int(sold)} single-family ${sold === 1 ? 'sale' : 'sales'}` : null,
    failed > 0 ? `${int(failed)} that came off without one` : null,
  ]
    .filter(Boolean)
    .join(' and ')
  return `${counts ? `${counts}. ` : ''}${outcome.city} over ${period}, from the Oregon Data Share MLS.`
}



// ── Chapter 2b's centrepiece: what the original ask actually realized ───────
// Research item 4. Every "% of list by weeks on market" table in circulation
// traces to a secondary citation of NAR that no primary source confirms
// (docs/research/cma-professional-practice-2026-09-07.md §4), so this one is
// computed on Central Oregon rows at build and printed with its own count per
// bucket. A table, not a chart: five named buckets carrying two units each is
// what a table is for (.claude/skills/dataviz/SKILL.md step 1).

/** `render_args.market.originalAskRealization`, validated. */
export type AskRealizationBucket = {
  weeks: string
  n: number
  medianPctOfOriginalAsk: number | null
  reason: string | null
}

export type AskRealization = {
  city: string
  windowMonths: number
  buckets: AskRealizationBucket[]
}

export function readAskRealization(
  market: CmaMarketContext | null | undefined,
): AskRealization | null {
  const raw = (market as unknown as { originalAskRealization?: unknown } | null)
    ?.originalAskRealization
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const city = typeof o.city === 'string' ? o.city.trim() : ''
  if (!city || !Array.isArray(o.buckets)) return null
  const buckets = o.buckets
    .map((b) => {
      const r = b as Record<string, unknown>
      const weeks = typeof r.weeks === 'string' ? r.weeks.trim() : ''
      const n = num(r.n)
      if (!weeks || n == null) return null
      const bucket: AskRealizationBucket = {
        weeks,
        n,
        medianPctOfOriginalAsk: num(r.medianPctOfOriginalAsk),
        reason: typeof r.reason === 'string' && r.reason.trim() ? r.reason.trim() : null,
      }
      return bucket
    })
    .filter((b): b is AskRealizationBucket => b != null)
  // Two buckets is not a trend, and one is not a table.
  if (buckets.filter((b) => b.medianPctOfOriginalAsk != null).length < 3) return null
  return { city, windowMonths: num(o.windowMonths) ?? 12, buckets }
}

/**
 * "0-2" → 0 and 2 weeks; "17+" → 17 and Infinity. The labels come off the
 * build block, so the parse tolerates whatever shape it wrote rather than
 * assuming one.
 */
function bucketRange(weeks: string): { lo: number; hi: number } | null {
  const open = /^(\d+)\s*\+$/.exec(weeks)
  if (open) return { lo: Number(open[1]), hi: Number.POSITIVE_INFINITY }
  const span = /^(\d+)\s*[-–]\s*(\d+)$/.exec(weeks)
  if (span) return { lo: Number(span[1]), hi: Number(span[2]) }
  return null
}

/** Which bucket the seller's own days land in. Null when they carry none. */
export function subjectRealizationBucket(
  buckets: readonly AskRealizationBucket[],
  subjectDays: number | null,
): string | null {
  if (subjectDays == null || !(subjectDays > 0)) return null
  const weeks = subjectDays / 7
  for (const b of buckets) {
    const r = bucketRange(b.weeks)
    if (r && weeks > r.lo - 1 && weeks <= r.hi) return b.weeks
  }
  return null
}

/**
 * The table, with the seller's own weeks marked.
 *
 * The mark says what it is. A listing that came off without an offer does not
 * BELONG in a bucket of homes that got one — the buckets measure weeks to an
 * accepted offer — so the row it lands on is labelled "your home ran N days
 * and never got one" rather than implying it realized that share.
 */
export function renderAskRealizationHtml(a: {
  market: CmaMarketContext | null
  subject: CmaSubject
  /** Inside the composed spread: no source line of its own. */
  bare?: boolean
}): string {
  const raw = (a.market as unknown as { originalAskRealization?: unknown } | null)
    ?.originalAskRealization
  const table = readAskRealization(a.market)
  if (!table) {
    const withheld = statWithheldReason(raw)
    return withheld
      ? `<h3 class="subhead">What the first asking price actually realized</h3>
  <p class="chart-read">${esc(withheld)}</p>`
      : ''
  }
  const subjectDays = subjectDomDays(a.subject)
  const failed = subjectListingFailed(a.subject)
  const mine = subjectRealizationBucket(table.buckets, subjectDays)
  const scale = realizationScale(table.buckets)
  const rows = table.buckets
    .map((b) => {
      const isMine = mine != null && b.weeks === mine
      const value =
        b.medianPctOfOriginalAsk != null
          ? `${b.medianPctOfOriginalAsk.toFixed(1)}%`
          : (b.reason ?? '—')
      return `<tr${isMine ? ' class="is-mine"' : ''}>
      <th>${esc(weeksLabel(b.weeks))}${
        isMine
          ? `<span class="rz-mine">${esc(
              failed && subjectDays != null
                ? `your home ran ${int(subjectDays)} days and never got one`
                : `your home`,
            )}</span>`
          : ''
      }</th>
      <td class="n">${int(b.n)}</td>
      <td class="rz-mark">${realizationMark(b.medianPctOfOriginalAsk, scale, isMine)}</td>
      <td class="n">${esc(value)}</td>
    </tr>`
    })
    .join('')
  const period =
    table.windowMonths === 12 ? 'the last 12 months' : `the last ${int(table.windowMonths)} months`
  return `<h3 class="subhead">What the first asking price actually realized</h3>
  <table class="kv realization">
    <colgroup><col class="rz-weeks"/><col class="rz-n"/><col class="rz-mark"/><col class="rz-share"/></colgroup>
    <thead><tr><th>Weeks to an offer</th><th class="n">Sales</th><th class="rz-mark">${esc(
      `${scale.lo}% to ${scale.hi}%`,
    )}</th><th class="n">Share of the first ask</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${realizationReading(table, mine, subjectDays, failed)}
  ${
    a.bare
      ? ''
      : `<p class="small">${esc(
          `Single-family sales in ${table.city} over ${period}, from the Oregon Data Share MLS. Each row is the median close over the price that listing first asked, across the sales in that row.`,
        )}</p>`
  }`
}

/**
 * The one scale every row's mark is drawn on.
 *
 * Cropped to the data at the bottom and anchored at the top on the whole first
 * ask, which is the only number in this table that means something on its own.
 * A share of the ask does not grow from zero, so a bar from zero would draw
 * five rows that all look the same (dataviz anti-patterns: "lollipops from
 * zero for a tight range"); the shape only appears when the axis is the range
 * the data actually occupies, and the header prints that range.
 */
function realizationScale(buckets: readonly AskRealizationBucket[]): { lo: number; hi: number } {
  const vals = buckets
    .map((b) => b.medianPctOfOriginalAsk)
    .filter((v): v is number => v != null && Number.isFinite(v))
  const hi = Math.max(100, Math.ceil(Math.max(...vals, 100)))
  const lo = Math.min(Math.floor(Math.min(...vals, hi)) - 1, hi - 2)
  return { lo, hi }
}

/**
 * One row's mark: a dot on the shared scale, beside the figure it encodes.
 *
 * The evaluator's note on this table was "five rows, no mark, no bar — a table
 * wearing hairlines, for the most persuasive fact in the document", and that
 * the series is not monotonic (100.0 → 97.0 → 97.2 → 95.3 → 92.1) with nothing
 * on the page showing the reversal. A dot per row shows it at a glance. The
 * figure stays printed beside it, so print and a screen reader lose nothing —
 * the mark is `aria-hidden`, because the number next to it is the same fact.
 */
function realizationMark(
  pct: number | null | undefined,
  scale: { lo: number; hi: number },
  isMine: boolean,
): string {
  if (pct == null || !Number.isFinite(pct)) return ''
  const x = ((Math.min(Math.max(pct, scale.lo), scale.hi) - scale.lo) / (scale.hi - scale.lo)) * 96
  return `<svg viewBox="0 0 100 14" class="rz-svg" aria-hidden="true" focusable="false"><line x1="0" y1="7" x2="96" y2="7" stroke="rgba(16,39,66,0.22)" stroke-width="0.75"/><line x1="96" y1="2" x2="96" y2="12" stroke="rgba(16,39,66,0.22)" stroke-width="0.75"/><circle cx="${x.toFixed(
    1,
  )}" cy="7" r="${isMine ? '4.2' : '3.2'}" fill="#102742"/></svg>`
}

/** "0-2" → "0 to 2"; "17+" → "17 or more". */
function weeksLabel(weeks: string): string {
  const r = bucketRange(weeks)
  if (!r) return weeks
  return r.hi === Number.POSITIVE_INFINITY ? `${r.lo} or more` : `${r.lo} to ${r.hi}`
}

/**
 * The reading under the table. Two measured facts and, when the seller's own
 * listing sat past the last bucket, the one sentence that follows from them.
 * No slogan, no prediction: every clause names a number printed above it.
 */
function realizationReading(
  table: AskRealization,
  mine: string | null,
  subjectDays: number | null,
  failed: boolean,
): string {
  const priced = table.buckets.filter(
    (b): b is AskRealizationBucket & { medianPctOfOriginalAsk: number } =>
      b.medianPctOfOriginalAsk != null,
  )
  if (priced.length < 2) return ''
  const first = priced[0]!
  const last = priced[priced.length - 1]!
  const firstRange = bucketRange(first.weeks)
  const lastRange = bucketRange(last.weeks)
  const bits = [
    `Homes that had an offer inside ${
      firstRange && Number.isFinite(firstRange.hi) ? int(firstRange.hi) : weeksLabel(first.weeks)
    } weeks closed at a median ${first.medianPctOfOriginalAsk.toFixed(
      1,
    )} percent of the price they first asked, over ${int(first.n)} sales.`,
    `Homes that took ${
      lastRange && !Number.isFinite(lastRange.hi)
        ? `${int(lastRange.lo)} weeks or more`
        : `${weeksLabel(last.weeks)} weeks`
    } closed at ${last.medianPctOfOriginalAsk.toFixed(1)} percent, over ${int(last.n)}.`,
  ]
  // The series is not always monotonic — on Redmond it runs 100.0 → 97.0 →
  // 97.2 → 95.3 → 92.1. Quoting the two ends and saying nothing about the step
  // back up describes a straight line the table does not draw.
  const up = priced.findIndex(
    (b, i) => i > 0 && b.medianPctOfOriginalAsk > priced[i - 1]!.medianPctOfOriginalAsk,
  )
  if (up > 0) {
    const rose = priced[up]!
    const before = priced[up - 1]!
    bits.push(
      `The fall is not steady: the ${weeksLabel(rose.weeks)} week row closed at ${rose.medianPctOfOriginalAsk.toFixed(
        1,
      )} percent, above the ${before.medianPctOfOriginalAsk.toFixed(1)} percent of the row before it.`,
    )
  }
  if (mine != null && failed && subjectDays != null && subjectDays > 0) {
    bits.push(
      `Your listing ran ${int(subjectDays)} days, which is the last row, and it never reached an offer at all.`,
    )
  }
  return `<p class="chart-read">${esc(bits.join(' '))}</p>`
}
