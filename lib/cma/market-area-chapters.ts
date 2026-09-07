/**
 * Web + print chapters for market-area density. Our look. Our number.
 */

import { UNADDRESSED_DOC_LINKS, cleanText, dec, escapeHtml, int, propertyIntelligenceBlock, usd } from '@/lib/cma/render-blocks'
import { clientAreaLabel, clientSourceLine } from '@/lib/cma/client-facing'
import { formatMonthsOfSupply, monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'
import {
  askOutcomeBarsPhoneSvg,
  askOutcomeBarsSvg,
  daysToOfferPhoneSvg,
  daysToOfferSvg,
  medianCloseLinePhoneSvg,
  medianCloseLineSvg,
  offerTimingCurvePhoneSvg,
  offerTimingCurveSvg,
  type AskOutcome,
  type AskOutcomeGroup,
  type DaysRow,
  type OfferTiming,
} from '@/lib/cma/market-charts'
import { trackedDocLink, type TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import { subjectDomDays, subjectListingFailed } from '@/lib/cma/comp-matrix'
import type { CmaExpiredPeer, CmaMarketArea, CmaSoldBand, CmaStatusBucket } from '@/lib/cma/market-status'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import { collapseExpiredPeerCycles, peerMatchesSubject } from '@/lib/cma/market-status'
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
 * The market board. Every figure here is CITY grain, not this house's peers,
 * so the median-sold label says so — a seller reading "$532,311 median sold"
 * two scrolls under a $389,000 recommend has to be told which is which
 * (dataviz: name the grain the numbers actually are).
 *
 * F7, 2026-09-07: one stat row, the same one the failed-then-sold statistics
 * use, months of supply first with its verdict word under it. The letter had
 * no rule for the immersive's `.stat3` grid at all, so on paper and at
 * reading width the four figures printed as a stacked list — number, label,
 * number, label — under a 42px months-of-supply hero.
 *
 * Every label says what its number is, and two of them used to lie about it:
 *
 * - `medianDom` is `market_stats_cache.median_dom`, the median of
 *   `listings.days_to_pending` (on-market date to pending). It is the days a
 *   seller waited for an accepted offer, not "days on market", and CLAUDE.md
 *   §7 bans publishing a list-to-close figure under that name — so the label
 *   names the offer, which is what the column actually measures.
 * - `saleToListRatio` carries `median_sale_to_original_list` from the pace
 *   read, not sale to the final ask. A seller who cut twice reads "sold to
 *   list" as the last ask, which is a different and better-looking number.
 */
export function renderInventoryBoardHtml(market: CmaMarketContext | null | undefined): string {
  if (!market) return ''
  const mos = market.monthsOfSupply
  const verdict = mos != null ? monthsOfSupplyVerdict(mos) : null
  const saleToList =
    market.saleToListRatio != null
      ? dec(market.saleToListRatio <= 2 ? market.saleToListRatio * 100 : market.saleToListRatio, 1)
      : null
  const trend = market.trend ?? []
  const chart = medianCloseLineSvg(trend)
  const chartPhone = medianCloseLinePhoneSvg(trend)
  const chartHtml = chart
    ? `<div class="szn median-wide" data-anim="chart">${chart}</div>${
        chartPhone ? `<div class="szn median-phone" data-anim="chart">${chartPhone}</div>` : ''
      }`
    : ''
  const stats: Array<{ val: string; lbl: string; verdict?: string }> = []
  if (mos != null) {
    stats.push({
      val: formatMonthsOfSupply(mos),
      lbl: 'months of supply',
      verdict: verdict?.label,
    })
  }
  if (saleToList != null) stats.push({ val: `${saleToList}%`, lbl: 'sold price to original ask' })
  if (market.medianDom != null) {
    stats.push({ val: int(market.medianDom), lbl: 'median days to an accepted offer' })
  }
  if (market.medianSalePrice != null) {
    stats.push({
      val: usd(market.medianSalePrice),
      lbl: `median sold, every ${market.geoLabel} home`,
    })
  }
  if (stats.length === 0) return chartHtml
  const cells = stats
    .map(
      (s) => `<div class="stat">
      <div class="val">${esc(s.val)}</div>
      <div class="lbl">${esc(s.lbl)}</div>
      ${s.verdict ? `<div class="lbl vd">${esc(s.verdict)}</div>` : ''}
    </div>`,
    )
    .join('')
  return `<div class="stat-strip is-${Math.min(stats.length, 4)}">${cells}</div>
  ${chartHtml}`
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
      const group: AskOutcomeGroup = { key, n, medianDays, medianCutPct: num(r.medianCutPct) }
      return group
    })
    .filter((g): g is AskOutcomeGroup => g != null)
  // One thin group makes the comparison a lie, so the whole graphic goes.
  if (groups.length < 2 || groups.some((g) => g.n < CHAPTER2_MIN_N)) return null
  return { city, windowMonths: num(o.windowMonths) ?? 12, groups }
}

/** The §0 trace, at seller grain: what was counted, where, over how long. */
function chapter2SourceLine(city: string, windowMonths: number, n: number | null): string {
  const period = windowMonths === 12 ? 'the last 12 months' : `the last ${int(windowMonths)} months`
  const count = n != null ? `${int(n)} closed sales. ` : ''
  return `${count}Single-family sales in ${city} over ${period}, from the Oregon Data Share MLS.`
}

/** 2a. When homes like yours get their offer. */
export function renderOfferTimingHtml(a: {
  market: CmaMarketContext | null
  subject: CmaSubject
}): string {
  const timing = readOfferTiming(a.market)
  if (!timing) return ''
  const subjectDays = subjectListingFailed(a.subject) ? subjectDomDays(a.subject) : null
  const wide = offerTimingCurveSvg(timing, subjectDays)
  if (!wide) return ''
  const phone = offerTimingCurvePhoneSvg(timing, subjectDays)
  const nineInTen = timing.points.find((p) => p.pct >= 90)
  const reading = [
    timing.medianDays != null && timing.medianDays > 0
      ? `Half of the homes that sold in ${timing.city} had an offer inside ${int(timing.medianDays)} days.`
      : null,
    nineInTen ? `Nine in ten inside ${int(nineInTen.days)}.` : null,
    subjectDays != null && subjectDays > 0 ? `Yours went ${int(subjectDays)} days without one.` : null,
  ]
    .filter(Boolean)
    .join(' ')
  return `<h3 class="subhead">When homes like yours get their offer</h3>
  <div class="szn timing-wide">${wide}</div>
  ${phone ? `<div class="szn timing-phone">${phone}</div>` : ''}
  ${reading ? `<p class="chart-read">${esc(reading)}</p>` : ''}
  <p class="small">${esc(chapter2SourceLine(timing.city, timing.windowMonths, timing.n))}</p>`
}

/** 2b. The first price decides the days. */
export function renderAskOutcomeHtml(a: {
  market: CmaMarketContext | null
  subject: CmaSubject
}): string {
  const outcome = readAskOutcome(a.market)
  if (!outcome) return ''
  const mine: AskOutcomeGroup['key'] | null = subjectListingFailed(a.subject) ? 'did-not-sell' : null
  const wide = askOutcomeBarsSvg(outcome, mine)
  if (!wide) return ''
  const phone = askOutcomeBarsPhoneSvg(outcome, mine)
  const by = (k: AskOutcomeGroup['key']) => outcome.groups.find((g) => g.key === k) ?? null
  const noCut = by('sold-no-cut')
  const cut = by('sold-after-cut')
  const dead = by('did-not-sell')
  const reading = [
    noCut ? `Homes that launched at the right price sold in a median of ${int(noCut.medianDays)} days.` : null,
    cut
      ? `Homes that had to cut took ${int(cut.medianDays)}${
          cut.medianCutPct != null && cut.medianCutPct > 0
            ? ` and gave up a median ${cut.medianCutPct.toFixed(1)} percent`
            : ''
        }.`
      : null,
    dead ? `Homes that never cut enough came off after a median ${int(dead.medianDays)} days.` : null,
  ]
    .filter(Boolean)
    .join(' ')
  return `<h3 class="subhead">The first price decides the days</h3>
  <div class="szn outcome-wide">${wide}</div>
  ${phone ? `<div class="szn outcome-phone">${phone}</div>` : ''}
  ${reading ? `<p class="chart-read">${esc(reading)}</p>` : ''}
  <p class="small">${esc(chapter2SourceLine(outcome.city, outcome.windowMonths, null))}</p>`
}

/**
 * "Near you, these asked and did not sell."
 *
 * Short linked rows, never a matrix. The twelve-row side-by-side table this
 * replaces asked a reader to compare a bathroom count across five listings
 * that all share one fact: they did not sell. Address, ask, days, how it came
 * off — and the address is a tracked link into the site.
 */
export function renderUnsoldPeerRowsHtml(
  subject: CmaSubject,
  peers: readonly CmaExpiredPeer[] | null | undefined,
  ctx?: TrackedDocLinkCtx | null,
): string {
  if (!peers || peers.length === 0) return ''
  const named = collapseExpiredPeerCycles(
    peers.filter((p) => p.address.trim() && p.listPrice > 0 && !peerMatchesSubject(p, subject)),
  )
  if (named.length === 0) return ''
  const rows = named
    .slice(0, 6)
    .map((p) => {
      const href = trackedDocLink(
        'listing',
        {
          listingKey: p.listingKey ?? null,
          streetNumber: streetNumberOf(p.address),
          streetName: streetNameOf(p.address),
          city: subject.city,
          subdivisionName: subject.subdivision,
        },
        ctx ?? UNADDRESSED_DOC_LINKS,
      )
      const status = cleanText(p.status)?.toLowerCase() ?? null
      const facts = [
        p.daysOnMarket != null && p.daysOnMarket > 0 ? `${int(p.daysOnMarket)} days` : null,
        status ? `came off ${status}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      return `<li class="unsold-row"><a href="${esc(href)}" data-rr-track="cma-unsold-peer">${esc(p.address)}</a><span class="unsold-ask">${usd(p.listPrice)}</span>${
        facts ? `<span class="unsold-meta">${esc(facts)}</span>` : ''
      }</li>`
    })
    .join('')
  return `<h3 class="subhead">Near you, these asked and did not sell</h3>
  <ul class="unsold-list">${rows}</ul>`
}

/** "730 Quince" -> "730". MLS addresses on this row are already street-only. */
function streetNumberOf(address: string): string | null {
  return /^\s*(\d+[A-Za-z]?)\s/.exec(address)?.[1] ?? null
}

function streetNameOf(address: string): string | null {
  const rest = address.replace(/^\s*\d+[A-Za-z]?\s+/, '').trim()
  return rest || null
}
