/**
 * renderMarketReportEmail — the per-contact market-report email (Wave 8,
 * chart + context rebuild).
 *
 * PURE render. The caller fetches the §0-accurate data (getMarketReportData,
 * which now attaches a monthly trend summary per area) and passes the blocks
 * in; this module turns them into a brand-clean, email-safe
 * { subject, html, text, traces }. No data access, no send.
 *
 * What the rebuild adds over the v1 text-only stat sheet:
 *   - A hero headline carrying the ONE story of the period (biggest verified
 *     signal across the subscribed areas — YoY move, market verdict, or the
 *     median itself). Never an invented narrative.
 *   - Every stat ships WITH context: vs the prior month (from the monthly
 *     cache series), vs last year (the cache's own YoY column), and a
 *     plain-English "what this means for you" line driven by the canonical
 *     months-of-supply thresholds (≤4 sellers, 4–6 balanced, ≥6 buyers).
 *   - Charts as email-safe images: <img> tags pointing at
 *     /api/email/market-chart (satori PNG, navy on cream). An image is only
 *     embedded when the area's trend series actually has enough points, and
 *     every img carries alt text.
 *   - `traces`: one { figure, source } entry per displayed figure so the
 *     admin preview can audit the §0 trace. Traces are NEVER rendered into
 *     the recipient email.
 *
 * Email-client constraints: table-based layout, inline styles only, max-width
 * 640 shell (lib/email/shell.ts), no flexbox/grid, no external CSS. Brand
 * voice (CLAUDE.md §3): sentence case, currency rounded to the nearest
 * thousand, "38 days", signed-arrow one-decimal percents, tabular numerals,
 * no em-dash or semicolon in prose, no banned words, no hyphens or colons in
 * user-facing headlines. Every number here came from the cache via the data
 * block; this module only formats it. It never invents a figure.
 */

import {
  EMAIL_NAVY,
  EMAIL_CREAM,
  EMAIL_INK,
  EMAIL_BODY_MUTED,
  EMAIL_BORDER,
  EMAIL_SERIF,
} from '@/lib/email/brand'
import { wrapBrandedEmail, type ShellBroker } from '@/lib/email/shell'
import { formatDate } from '@/lib/format/date'
import type {
  MarketReportAreaBlock,
  MarketTrendSummary,
} from '@/lib/data/crm/getMarketReportData'
import type { MoSVerdict } from '@/lib/data/types/market'

const MUTED = EMAIL_BODY_MUTED
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export interface RenderMarketReportEmailInput {
  /** Recipient first name (or full name); blank/absent uses a neutral greeting. */
  contactName?: string | null
  /** brokers.slug for attribution (used by the send engine, not the render). */
  brokerSlug?: string | null
  /** The verified market blocks, already fetched + filtered by getMarketReportData. */
  areas: MarketReportAreaBlock[]
  /** One-click unsubscribe URL embedded in the footer. */
  unsubscribeUrl: string
  /** The subscription's assigned broker — renders the close card when set. */
  senderBroker?: ShellBroker | null
}

/** One displayed figure's audit trace (admin preview only, never in the email). */
export type EmailFigureTrace = { figure: string; source: string }

export interface RenderedMarketReportEmail {
  subject: string
  html: string
  text: string
  /** §0 audit trail — one entry per figure shown in the html. */
  traces: EmailFigureTrace[]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** First token of a name, trimmed. Empty when no usable name. */
function firstName(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n) return ''
  return n.split(/\s+/)[0] ?? ''
}

/**
 * Round to the nearest thousand and format as $XXX,000. Pure. Returns the
 * em-dash data placeholder (allowed for "unavailable") when the value is null.
 */
export function formatCurrencyRounded(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value / 1000) * 1000
  return '$' + rounded.toLocaleString('en-US')
}

/** Integer + " days" (e.g. "38 days"). Em-dash placeholder when unavailable. */
export function formatDays(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)} days`
}

/** One-decimal signed-arrow YoY: "↑ 2.1% YoY" / "↓ 1.4% YoY" / flat. Em-dash when null. */
export function formatYoy(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return 'flat YoY'
  const arrow = rounded > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(rounded).toFixed(1)}% YoY`
}

/** One-decimal signed-arrow month change: "↑ 2.2% vs May" / "flat vs May". */
export function formatMomPct(value: number | null | undefined, prevMonth: string | null): string {
  if (value == null || !Number.isFinite(value) || !prevMonth) return '—'
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return `flat vs ${prevMonth}`
  const arrow = rounded > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(rounded).toFixed(1)}% vs ${prevMonth}`
}

/** Months of supply with one decimal + " months". Em-dash when null. */
export function formatMonths(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)} months`
}

/** Plain-language verdict phrase (sentence case, no hype). */
export function verdictLabel(verdict: MoSVerdict | null | undefined): string {
  switch (verdict) {
    case 'sellers':
      return "Seller's market"
    case 'balanced':
      return 'Balanced market'
    case 'buyers':
      return "Buyer's market"
    default:
      return '—'
  }
}

/**
 * The plain-English "what this means for you" line, driven strictly by the
 * canonical months-of-supply verdict (≤4 sellers, 4–6 balanced, ≥6 buyers).
 * Exported so the copy is unit-testable against the banned-vocabulary list.
 */
export function meaningLine(verdict: MoSVerdict | null | undefined): string | null {
  switch (verdict) {
    case 'sellers':
      return 'Supply is tight relative to demand, so well priced homes are drawing attention quickly and sellers hold the leverage.'
    case 'balanced':
      return 'Supply and demand are close to even, so realistic pricing matters more than timing for both sides.'
    case 'buyers':
      return 'There are more homes for sale than current demand is absorbing, which gives buyers room to negotiate on price and terms.'
    default:
      return null
  }
}

/** Build the subject line. One area names it; several use a regional framing. */
export function buildSubject(areas: MarketReportAreaBlock[]): string {
  if (areas.length === 1) {
    return `${areas[0].areaLabel} market update`
  }
  return `Your Central Oregon market update`
}

/**
 * The hero headline — the ONE story of the period. Deterministic priority over
 * verified figures only (never an invented narrative): the area with the
 * largest YoY median move tells the price story; else the market verdict; else
 * the median itself. Sentence case, no colon, no hyphen (brand headline rule).
 */
export function buildHeadline(areas: MarketReportAreaBlock[]): string {
  if (areas.length === 0) return 'Where your market stands'

  // The area with the largest verified YoY move carries the story.
  let lead: MarketReportAreaBlock = areas[0]
  for (const a of areas) {
    const cur = lead.yoyPct != null && Number.isFinite(lead.yoyPct) ? Math.abs(lead.yoyPct) : -1
    const cand = a.yoyPct != null && Number.isFinite(a.yoyPct) ? Math.abs(a.yoyPct) : -1
    if (cand > cur) lead = a
  }

  const yoy = lead.yoyPct != null && Number.isFinite(lead.yoyPct) ? Math.round(lead.yoyPct * 10) / 10 : null
  if (yoy != null && Math.abs(yoy) >= 0.1) {
    const dir = yoy > 0 ? 'up' : 'down'
    return `${lead.areaLabel} home prices are ${dir} ${Math.abs(yoy).toFixed(1)}% from a year ago`
  }
  if (yoy != null) {
    return `${lead.areaLabel} home prices are holding steady year over year`
  }
  if (lead.marketVerdict != null && lead.monthsOfSupply != null) {
    const v = verdictLabel(lead.marketVerdict).toLowerCase()
    return `${lead.areaLabel} is a ${v} with ${formatMonths(lead.monthsOfSupply)} of supply`
  }
  if (lead.medianPrice != null) {
    return `The ${lead.areaLabel} median sale price now sits at ${formatCurrencyRounded(lead.medianPrice)}`
  }
  return `Where the ${lead.areaLabel} market stands`
}

/** Whole number with comma separators. Em-dash when unavailable. */
function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('en-US')
}

/** Signed whole-count delta phrase: "12 more than May" / "8 fewer than May". */
function inventoryDeltaPhrase(delta: number | null, prevMonth: string | null): string | null {
  if (delta == null || !Number.isFinite(delta) || !prevMonth) return null
  const n = Math.round(Math.abs(delta))
  if (n === 0) return `unchanged from ${prevMonth}`
  return `${n.toLocaleString('en-US')} ${delta > 0 ? 'more' : 'fewer'} than ${prevMonth}`
}

/** Signed day-delta phrase: "3 days faster than May" / "2 days slower than May". */
function domDeltaPhrase(delta: number | null, prevMonth: string | null): string | null {
  if (delta == null || !Number.isFinite(delta) || !prevMonth) return null
  const n = Math.round(Math.abs(delta))
  if (n === 0) return `even with ${prevMonth}`
  const word = n === 1 ? 'day' : 'days'
  // A lower DOM month over month means homes sold faster.
  return `${n} ${word} ${delta < 0 ? 'faster' : 'slower'} than ${prevMonth}`
}

/** How many points in the trend carry a non-null value for the metric. */
function trendPointCount(
  trend: MarketTrendSummary | null | undefined,
  pick: (p: MarketTrendSummary['points'][number]) => number | null,
): number {
  if (!trend) return 0
  return trend.points.filter((p) => {
    const v = pick(p)
    return v != null && Number.isFinite(v)
  }).length
}

/** Absolute chart-image URL for an area + metric (12 completed months). */
export function chartImageUrl(
  area: Pick<MarketReportAreaBlock, 'geoType' | 'slug'>,
  metric: 'median_price' | 'inventory' | 'dom',
): string {
  const params = new URLSearchParams({
    geo: area.geoType,
    slug: area.slug,
    metric,
    months: '12',
  })
  return `${SITE_URL}/api/email/market-chart?${params.toString()}`
}

/** Where each core figure in a block traces to (per-figure, per the block's source tag). */
function cacheSource(area: MarketReportAreaBlock): string {
  return `market_stats_cache geo_type=${area.geoType} geo=${area.slug} period=rolling_365d`
}

function pulseOrCacheSource(area: MarketReportAreaBlock): string {
  return area.source === 'market_pulse_live'
    ? `market_pulse_live geo_type=${area.geoType} geo=${area.slug}`
    : cacheSource(area)
}

function monthlySource(area: MarketReportAreaBlock): string {
  return `market_stats_cache geo_type=${area.geoType} geo=${area.slug} period_type=monthly`
}

type AreaRender = { html: string; text: string; traces: EmailFigureTrace[] }

/**
 * One area's editorial section: verdict kicker, serif area name, the median
 * price moment with YoY + month-over-month context, the price trend chart,
 * context-carrying stat rows, the "what this means for you" line, the
 * inventory chart, and the CTA. Also returns the plain-text mirror and the
 * per-figure traces.
 */
function renderAreaBlock(area: MarketReportAreaBlock): AreaRender {
  const traces: EmailFigureTrace[] = []
  const textLines: string[] = []
  const verdict = verdictLabel(area.marketVerdict)
  const hasVerdict = area.marketVerdict != null
  const href = `${SITE_URL}${area.href}`
  const trend = area.trend ?? null

  // ── Kicker ────────────────────────────────────────────────────────────────
  const kicker = hasVerdict
    ? `<div style="font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${MUTED};margin-bottom:8px;font-variant-numeric:tabular-nums;">${escapeHtml(verdict)} &middot; ${formatMonths(area.monthsOfSupply)} of supply</div>`
    : ''
  if (hasVerdict && area.monthsOfSupply != null) {
    traces.push({
      figure: `${area.areaLabel} months of supply ${formatMonths(area.monthsOfSupply)}`,
      source:
        area.source === 'market_pulse_live'
          ? `${pulseOrCacheSource(area)} (months_of_supply)`
          : `computed active / (sold_12mo / 12) from ${cacheSource(area)}`,
    })
    traces.push({
      figure: `${area.areaLabel} verdict ${verdict}`,
      source: `derived from months of supply ${formatMonths(area.monthsOfSupply)} against the canonical thresholds (4 or less sellers, 4 to 6 balanced, 6 or more buyers)`,
    })
  }

  // ── Median price moment + context ─────────────────────────────────────────
  const priceLine = formatCurrencyRounded(area.medianPrice)
  if (area.medianPrice != null) {
    traces.push({
      figure: `${area.areaLabel} median sale price ${priceLine} (trailing 12 months)`,
      source: `${cacheSource(area)} (median_sale_price)`,
    })
  }
  if (area.yoyPct != null && Number.isFinite(area.yoyPct)) {
    traces.push({
      figure: `${area.areaLabel} median price ${formatYoy(area.yoyPct)}`,
      source: `${cacheSource(area)} (yoy_median_price_delta_pct)`,
    })
  }

  // Month-over-month median context from the monthly cache series.
  let momHtml = ''
  let momText = ''
  if (
    trend &&
    trend.latestMedianPrice != null &&
    trend.prevMedianPrice != null &&
    trend.momPricePct != null &&
    trend.latestMonthLabel &&
    trend.prevMonthLabel
  ) {
    const latestStr = formatCurrencyRounded(trend.latestMedianPrice)
    const prevStr = formatCurrencyRounded(trend.prevMedianPrice)
    const momStr = formatMomPct(trend.momPricePct, trend.prevMonthLabel)
    const sentence = `${trend.latestMonthLabel} closed at a ${latestStr} median, ${momStr} (${prevStr}).`
    momHtml = `<p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:${EMAIL_INK};font-variant-numeric:tabular-nums;">${escapeHtml(sentence)}</p>`
    momText = sentence
    traces.push({
      figure: `${area.areaLabel} ${trend.latestMonthLabel} median ${latestStr} vs ${trend.prevMonthLabel} ${prevStr} (${momStr})`,
      source: `${monthlySource(area)} (median_sale_price, two most recent completed months)`,
    })
  }

  // ── Charts (only when the series is real) ─────────────────────────────────
  const priceChartOk = trendPointCount(trend, (p) => p.medianSalePrice) >= 3
  const inventoryChartOk = trendPointCount(trend, (p) => p.endOfPeriodInventory) >= 3

  const priceChart = priceChartOk
    ? `<div style="margin:14px 0 4px;"><img src="${chartImageUrl(area, 'median_price')}" alt="Line chart of the ${escapeHtml(area.areaLabel)} median sale price by month over the last 12 months" width="532" style="display:block;width:100%;max-width:532px;height:auto;border:1px solid ${EMAIL_BORDER};border-radius:8px;"></div>`
    : ''
  if (priceChartOk) {
    traces.push({
      figure: `${area.areaLabel} median sale price trend chart (12 completed months)`,
      source: `/api/email/market-chart geo=${area.geoType} slug=${area.slug} metric=median_price — ${monthlySource(area)}`,
    })
  }

  const inventoryChart = inventoryChartOk
    ? `<div style="margin:16px 0 4px;"><img src="${chartImageUrl(area, 'inventory')}" alt="Bar chart of homes for sale in ${escapeHtml(area.areaLabel)} by month over the last 12 months" width="532" style="display:block;width:100%;max-width:532px;height:auto;border:1px solid ${EMAIL_BORDER};border-radius:8px;"></div>`
    : ''
  if (inventoryChartOk) {
    traces.push({
      figure: `${area.areaLabel} homes for sale trend chart (12 completed months)`,
      source: `/api/email/market-chart geo=${area.geoType} slug=${area.slug} metric=inventory — ${monthlySource(area)}`,
    })
  }

  // ── Stat rows with context sub-lines ──────────────────────────────────────
  type StatRow = { label: string; value: string; context: string | null }
  const rows: StatRow[] = []

  const invContext = trend
    ? inventoryDeltaPhrase(trend.momInventoryDelta, trend.prevMonthLabel)
    : null
  const invContextFull =
    invContext && trend?.latestMonthLabel ? `${trend.latestMonthLabel} ended ${invContext}` : null
  rows.push({
    label: 'Homes for sale',
    value: formatCount(area.activeListings),
    context: invContextFull,
  })
  if (area.activeListings != null) {
    traces.push({
      figure: `${area.areaLabel} homes for sale ${formatCount(area.activeListings)}`,
      source:
        area.source === 'market_pulse_live'
          ? `${pulseOrCacheSource(area)} (active_count)`
          : `${cacheSource(area)} (end_of_period_inventory)`,
    })
  }
  if (invContextFull && trend) {
    traces.push({
      figure: `${area.areaLabel} inventory ${trend.latestMonthLabel} ended ${invContext}`,
      source: `${monthlySource(area)} (end_of_period_inventory, two most recent completed months)`,
    })
  }

  const domContext = trend ? domDeltaPhrase(trend.momDomDelta, trend.prevMonthLabel) : null
  const domContextFull =
    domContext && trend?.latestMonthLabel && trend.latestDom != null
      ? `${formatDays(trend.latestDom)} in ${trend.latestMonthLabel}, ${domContext}`
      : null
  rows.push({
    label: 'Median days on market',
    value: formatDays(area.domMedian),
    context: domContextFull,
  })
  if (area.domMedian != null) {
    traces.push({
      figure: `${area.areaLabel} median days on market ${formatDays(area.domMedian)} (trailing 12 months)`,
      source: `${cacheSource(area)} (median_dom)`,
    })
  }
  if (domContextFull && trend) {
    traces.push({
      figure: `${area.areaLabel} DOM ${formatDays(trend.latestDom)} in ${trend.latestMonthLabel}, ${domContext}`,
      source: `${monthlySource(area)} (median_dom, two most recent completed months)`,
    })
  }

  rows.push({
    label: 'Homes sold, last 12 months',
    value: formatCount(area.soldLast12mo),
    context: null,
  })
  if (area.soldLast12mo != null) {
    traces.push({
      figure: `${area.areaLabel} homes sold last 12 months ${formatCount(area.soldLast12mo)}`,
      source: `${cacheSource(area)} (sold_count)`,
    })
  }

  rows.push({
    label: 'Months of supply',
    value: formatMonths(area.monthsOfSupply),
    context: hasVerdict ? verdict : null,
  })

  const rowHtml = (r: StatRow): string => {
    const contextLine = r.context
      ? `<div style="font-size:12px;line-height:1.5;color:${MUTED};margin-top:2px;">${escapeHtml(r.context)}</div>`
      : ''
    return `<tr>
      <td style="padding:10px 0;font-size:14px;color:${MUTED};border-top:1px solid ${EMAIL_BORDER};vertical-align:top;">${escapeHtml(r.label)}</td>
      <td style="padding:10px 0;font-size:14px;color:${EMAIL_INK};text-align:right;font-weight:600;font-variant-numeric:tabular-nums;border-top:1px solid ${EMAIL_BORDER};vertical-align:top;">${r.value}${contextLine}</td>
    </tr>`
  }

  // ── "What this means for you" ─────────────────────────────────────────────
  const meaning = meaningLine(area.marketVerdict)
  const meaningHtml = meaning
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr><td style="background:rgba(16,39,66,0.05);padding:14px 16px;border-left:3px solid ${EMAIL_NAVY};">
        <div style="font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};margin-bottom:6px;">What this means for you</div>
        <div style="font-size:14px;line-height:1.6;color:${EMAIL_INK};">${escapeHtml(meaning)}</div>
      </td></tr></table>`
    : ''

  const html = `<tr><td style="padding:34px 34px 0;">
    ${kicker}
    <div style="font-family:${EMAIL_SERIF};font-size:26px;line-height:1.2;color:${EMAIL_NAVY};margin-bottom:16px;">${escapeHtml(area.areaLabel)}</div>
    <div style="font-family:${EMAIL_SERIF};font-size:42px;line-height:1.05;color:${EMAIL_NAVY};font-variant-numeric:tabular-nums;">${priceLine}</div>
    <div style="font-size:13px;color:${MUTED};margin:6px 0 12px;font-variant-numeric:tabular-nums;">Median sale price, trailing 12 months &middot; ${formatYoy(area.yoyPct)}</div>
    ${momHtml}
    ${priceChart}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-variant-numeric:tabular-nums;margin-top:10px;">
      ${rows.map(rowHtml).join('')}
    </table>
    ${meaningHtml}
    ${inventoryChart}
    <div style="margin-top:20px;padding-bottom:6px;">
      <a href="${href}" style="display:inline-block;background:${EMAIL_NAVY};color:${EMAIL_CREAM};font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:12px 26px;">SEE THE FULL ${escapeHtml(area.areaLabel.toUpperCase())} REPORT &rarr;</a>
    </div>
  </td></tr>`

  // ── Plain-text mirror ─────────────────────────────────────────────────────
  textLines.push(area.areaLabel.toUpperCase())
  if (hasVerdict) {
    textLines.push(`${verdict} with ${formatMonths(area.monthsOfSupply)} of supply`)
  }
  textLines.push(`Median sale price (trailing 12 months) ${priceLine} (${formatYoy(area.yoyPct)})`)
  if (momText) textLines.push(momText)
  textLines.push(`Homes for sale now ${formatCount(area.activeListings)}${invContextFull ? ` (${invContextFull})` : ''}`)
  textLines.push(`Median days on market ${formatDays(area.domMedian)}${domContextFull ? ` (${domContextFull})` : ''}`)
  textLines.push(`Homes sold last 12 months ${formatCount(area.soldLast12mo)}`)
  if (meaning) textLines.push(`What this means for you. ${meaning}`)
  textLines.push(`Full report ${href}`)

  return { html, text: textLines.join('\n'), traces }
}

/**
 * Render the market-report email. Pure given the data blocks. The caller must
 * pass a non-empty `areas` (getMarketReportData already filtered out unavailable
 * areas); if `areas` is empty the send engine should skip the contact rather
 * than send an empty email, so this returns a safe minimal body.
 */
export function renderMarketReportEmail(
  input: RenderMarketReportEmailInput,
): RenderedMarketReportEmail {
  const fn = firstName(input.contactName)
  const greeting = fn ? `Hi ${escapeHtml(fn)},` : 'Hi,'
  const areas = Array.isArray(input.areas) ? input.areas : []
  const subject = buildSubject(areas)
  const asOf = formatDate(areas[0]?.refreshedAt ?? new Date())
  const mastheadArea = areas.length === 1 ? areas[0].areaLabel : 'Central Oregon'
  const headline = buildHeadline(areas)
  const traces: EmailFigureTrace[] = []

  traces.push({
    figure: `Headline "${headline}"`,
    source:
      'derived from the verified area blocks below (largest YoY move leads), no independent figure',
  })

  // Raw for the preheader (the shell escapes it), escaped inline for the body.
  const introRaw =
    areas.length === 1
      ? `Here is where the ${areas[0].areaLabel} market stands as of ${asOf}, with the context to read the numbers the way we do.`
      : `Here is where your Central Oregon markets stand as of ${asOf}, with the context to read the numbers the way we do.`
  const introLine = escapeHtml(introRaw)

  const headerHtml = `<tr><td style="padding:30px 34px 0;">
    <p style="margin:0 0 10px;font-size:16px;color:${EMAIL_INK};">${greeting}</p>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${EMAIL_INK};">${introLine}</p>
    <div style="font-family:${EMAIL_SERIF};font-size:30px;line-height:1.25;color:${EMAIL_NAVY};border-top:3px solid ${EMAIL_NAVY};padding-top:16px;">${escapeHtml(headline)}</div>
  </td></tr>`

  const rendered = areas.map(renderAreaBlock)
  const blocksHtml = rendered.map((r) => r.html).join('')
  for (const r of rendered) traces.push(...r.traces)

  const methodologyHtml = `<tr><td style="padding:28px 34px 6px;">
    <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};border-top:1px solid ${EMAIL_BORDER};padding-top:16px;">Every figure here comes from closed and active Central Oregon MLS data for single family homes, refreshed daily. Month labels refer to completed calendar months. Reply to this email if you want a pricing read on a specific home.</p>
  </td></tr>`

  const html = wrapBrandedEmail({
    bodyHtml: headerHtml + blocksHtml + methodologyHtml,
    previewText: headline,
    mastheadLine: `MARKET REPORT · ${mastheadArea}`,
    senderBroker: input.senderBroker ?? null,
    unsubscribeUrl: input.unsubscribeUrl,
    audienceLine: 'You are receiving this market update because you subscribed to Ryan Realty reports.',
  })

  const textParts: string[] = []
  textParts.push(fn ? `Hi ${fn},` : 'Hi,')
  textParts.push('')
  textParts.push(introRaw)
  textParts.push('')
  textParts.push(headline)
  textParts.push('')
  for (const r of rendered) {
    textParts.push(r.text)
    textParts.push('')
  }
  textParts.push(
    'Every figure here comes from closed and active Central Oregon MLS data for single family homes, refreshed daily. Month labels refer to completed calendar months. Reply to this email if you want a pricing read on a specific home.',
  )
  textParts.push('')
  textParts.push('--')
  textParts.push('Ryan Realty - Bend, Oregon - ryan-realty.com')
  textParts.push(`Unsubscribe: ${input.unsubscribeUrl}`)

  return { subject, html, text: textParts.join('\n'), traces }
}
