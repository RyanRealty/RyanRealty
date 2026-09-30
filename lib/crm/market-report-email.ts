/**
 * renderMarketReportEmail — the per-contact market-report email (Wave 8,
 * chart + context rebuild; the 2026-09-29 accuracy and footer rebuild).
 *
 * PURE render. The caller fetches the §0-accurate data (getMarketReportData,
 * which attaches the monthly trend and the provenance of every figure) and
 * passes the blocks in; this module turns them into a brand-clean, email-safe
 * { subject, html, text, figures }. No data access, no send.
 *
 * WHAT THE 2026-09-29 REBUILD CHANGED, and why (Matt's review of a real render):
 *   - ONE INSTRUMENT PER COMPARISON. Bend printed "Homes for sale 739" beside
 *     "August ended 21 fewer than July". The 739 is the live Market Truth count;
 *     the 21 came from market_stats_cache monthly end-of-period inventory
 *     (455 to 434), a different instrument that counts a different set of
 *     homes. A comparison now prints only when it comes from the same
 *     instrument as the figure it sits beside, so the inventory and
 *     days-on-market month-over-month lines and the inventory chart (whose
 *     big number read 434 beside the 739) are gone. The year-over-year move
 *     stays: it is the same Market Truth cell family as the median it
 *     qualifies. The month-over-month median sentence stays as its own line:
 *     both of its months come from the monthly cache.
 *   - A MONTHLY MEDIAN NEEDS A SAMPLE. Larkspur printed "↓ 19.1% vs July" from
 *     5 August sales against 4 July sales. See MOM_MIN_MONTH_SALES.
 *   - NO PLACEHOLDERS. A missing figure drops its row; months of supply is
 *     dropped at neighborhood grain entirely (it is withheld there, so the row
 *     read "Months of supply —" on every neighborhood report). No em dash
 *     anywhere in the email (Matt 2026-09-20).
 *   - THE MOST SPECIFIC AREA FIRST. A contact's neighborhood leads; her city
 *     follows. See orderAreasBySpecificity.
 *   - ONE FOOTER, and it carries "View this report online", "Manage your
 *     report" and a report-scoped Unsubscribe (all to the no-login page). The
 *     old "You are receiving this market update because you subscribed…"
 *     line broke the shell rule against narrating the send (shell.ts).
 *   - The CTA anchor is #market, the id the destination sections carry
 *     (app/cities/[slug]/[neighborhoodSlug]/page.tsx and
 *     app/housing-market/[...slug]/_v3/city-view.tsx). #market-report matched
 *     nothing, so the click landed at the top of the page.
 *   - `figures`: one structured trace per printed number (area, label, value,
 *     display, source, filter, as_of, n), stored with the send so an admin can
 *     audit anything that went out. Never rendered into the email.
 *
 * Email-client constraints: table-based layout, inline styles only, max-width
 * 640 shell (lib/email/shell.ts), no flexbox/grid, no external CSS. Every
 * number here came from the data block; this module only formats it. It never
 * invents a figure.
 */

import {
  EMAIL_NAVY,
  EMAIL_CREAM,
  EMAIL_INK,
  EMAIL_BODY_MUTED,
  EMAIL_BORDER,
  EMAIL_SERIF,
} from '@/lib/email/brand'
import { BROKERAGE_POSTAL_ADDRESS } from '@/lib/email/prepare'
import { wrapBrandedEmail, type ShellBroker } from '@/lib/email/shell'
import { formatDate } from '@/lib/format/date'
import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'
import type { MarketTrendPoint } from '@/lib/data/market/getMarketTrend'
import {
  formatCount,
  formatCurrencyRounded,
  formatDays,
  formatMomPct,
  formatMonths,
  formatYoy,
  formatYoyPlain,
  meaningLine,
  verdictLabel,
} from './market-report-format'
import {
  activeTrace,
  domTrace,
  figuresToTraces,
  monthEnd,
  monthlyTrace,
  mosTrace,
  twelveMonthTrace,
  type EmailFigureTrace,
  type ReportFigure,
} from './market-report-figures'
import { cityMarketPath } from '@/lib/market/canonical-market-path'

// Public surface preserved after the 2026-07-29 formatter extraction —
// app/actions/generate-market-report.ts and the test suite import these from
// this module.
export {
  formatCurrencyRounded,
  formatDays,
  formatYoy,
  formatMomPct,
  formatMonths,
  verdictLabel,
  meaningLine,
}
export type { EmailFigureTrace, ReportFigure }

const MUTED = EMAIL_BODY_MUTED
const SITE_URL = 'https://ryan-realty.com'

/** The links one report carries. All optional so a pure render can omit them. */
export type MarketReportEmailLinks = {
  /** "View this report online": the stored copy on the no-login page. */
  viewUrl?: string | null
  /** "Manage your report": the no-login preferences page. */
  manageUrl?: string | null
  /** The report-scoped Unsubscribe (the preferences page, opened on "Stop"). */
  unsubscribeUrl: string
}

export interface RenderMarketReportEmailInput {
  /** Recipient first name (or full name); blank/absent uses a neutral greeting. */
  contactName?: string | null
  /** brokers.slug for attribution (used by the send engine, not the render). */
  brokerSlug?: string | null
  /** The verified market blocks, already fetched + filtered by getMarketReportData. */
  areas: MarketReportAreaBlock[]
  /** The report-scoped Unsubscribe. Kept top-level for existing callers. */
  unsubscribeUrl: string
  /** "View this report online" and "Manage your report". */
  viewUrl?: string | null
  manageUrl?: string | null
  /** The subscription's assigned broker — renders the close card when set. */
  senderBroker?: ShellBroker | null
  /** When the report was assembled; drives "as of". Defaults to now. */
  asOf?: Date | string | null
}

export interface RenderedMarketReportEmail {
  subject: string
  html: string
  text: string
  /** §0 trace, structured: one entry per printed figure. Stored with the send. */
  figures: ReportFigure[]
  /** The same trace as one-line strings, for the admin preview dialog. */
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
 * Most specific first: a neighborhood (a resort community or a Bend district)
 * before a city. A contact who lives in Larkspur and also follows Bend reads
 * about her street first and the city second (Matt 2026-09-29). Stable within
 * a grain, so two cities keep the order the subscription stores. Pure.
 */
export function orderAreasBySpecificity<T extends Pick<MarketReportAreaBlock, 'geoType'>>(areas: readonly T[]): T[] {
  const rank = (a: T) => (a.geoType === 'neighborhood' ? 0 : 1)
  return areas
    .map((a, i) => ({ a, i }))
    .sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i)
    .map((x) => x.a)
}

/**
 * Minimum trailing-12-month closed-sale count before an area's YoY median move
 * is allowed to carry the hero headline and the subject line.
 *
 * WHY THIS EXISTS. A cited figure can still be a bad headline. On 2026-07-29 a
 * real lead received the subject "Old Bend home prices are down 17.1% from a
 * year ago". The number was exact — market_stats_cache yoy_median_price_delta_pct
 * for bend-old-bend rolling_365d is -17.0558 — but it rested on sold_count = 15
 * for the whole trailing year, three of them in the last 90 days. The same
 * geography's yearly series reads -38.8% (2024), +8.4% (2025), -23.1% (2026).
 * No housing market moves like that. That is which individual houses happened
 * to close, promoted to a confident claim in a stranger's inbox.
 *
 * WHY 30. A median is a positional statistic: with n = 15 the printed figure IS
 * the 8th sale, so one unusual property swings it by six figures, and the YoY
 * delta compounds that instability across two such samples. Thirty is the
 * conventional floor where a sample median stops tracking individual
 * transactions, it is the level local-MLS practice already uses to suppress
 * small-geography stats, and over a trailing year it means the median rests on
 * at least ~2.5 closes a month rather than a scatter of isolated sales. Old
 * Bend's 15 fails it by half. A city like Bend (1,657 trailing closes) clears it
 * by 55x, so the floor never touches the areas that carry real signal.
 *
 * LIMIT OF THIS CHECK. soldLast12mo counts the CURRENT window only, so it is a
 * proxy for the prior-year window the YoY also depends on. The cache does not
 * expose that second count. A thin prior-year window is therefore still
 * possible above the floor, which is a reason the floor is not lower.
 *
 * SCOPE. This gates the HEADLINE only. A thin area still renders its full block
 * in the body with its figures and its §0 trace intact. The claim just does not
 * get to speak for the whole email.
 */
export const HEADLINE_MIN_SOLD_COUNT = 30

/**
 * Minimum closed sales in EACH of two months before a month-over-month median
 * change prints, and in every month a price chart draws.
 *
 * WHY THIS EXISTS. On 2026-09-29 Cheryl Younger's Larkspur report printed
 * "↓ 19.1% vs July": August's median rested on 5 sales and July's on 4. With
 * five sales the median IS the third house to close, so the 19.1% said which
 * three houses happened to close, not where Larkspur prices went.
 *
 * WHY 10. It is a third of the 30-sale floor HEADLINE_MIN_SOLD_COUNT applies
 * to a full year, scaled to one month: at ten sales the median is the average
 * of the fifth and sixth closes, so one unusual house moves it by one position
 * instead of deciding it. Bend's thinnest month in the last year was 87 sales,
 * so the floor never touches a city; it removes the figure only where a monthly
 * median is a handful of houses.
 */
export const MOM_MIN_MONTH_SALES = 10

/** Minimum consecutive qualifying months for a price chart (the chart route's own floor is 6). */
export const CHART_MIN_MONTHS = 6

/**
 * Whether an area's YoY median move is solid enough to be the one story of the
 * period. Pure, exported for tests.
 */
export function yoyCanCarryHeadline(
  area: Pick<MarketReportAreaBlock, 'yoyPct' | 'soldLast12mo'>,
): boolean {
  if (area.yoyPct == null || !Number.isFinite(area.yoyPct)) return false
  if (area.soldLast12mo == null || !Number.isFinite(area.soldLast12mo)) return false
  return area.soldLast12mo >= HEADLINE_MIN_SOLD_COUNT
}

/** Months of supply prints only at city grain; a neighborhood's is withheld. */
function showsMonthsOfSupply(area: MarketReportAreaBlock): boolean {
  return area.geoType === 'city' && area.monthsOfSupply != null && Number.isFinite(area.monthsOfSupply)
}

/** The verdict prints only beside the months-of-supply figure it derives from. */
function showsVerdict(area: MarketReportAreaBlock): boolean {
  return showsMonthsOfSupply(area) && area.marketVerdict != null
}

/**
 * The hero headline — the ONE story of the period. Deterministic priority over
 * verified figures only (never an invented narrative), in area order (most
 * specific first):
 *   1. the largest YoY median move among areas whose sample clears
 *      HEADLINE_MIN_SOLD_COUNT;
 *   2. else the first area with a months-of-supply verdict (city grain);
 *   3. else the first area with a twelve-month median;
 *   4. else "Where your market stands".
 * Sentence case, no colon, no hyphen (brand headline rule).
 */
export function buildHeadline(areasIn: readonly MarketReportAreaBlock[]): string {
  const areas = orderAreasBySpecificity(areasIn)
  if (areas.length === 0) return 'Where your market stands'

  let lead: MarketReportAreaBlock | null = null
  let leadYoyMagnitude: number | null = null
  for (const a of areas) {
    if (!yoyCanCarryHeadline(a)) continue
    const cand = Math.abs(a.yoyPct as number)
    if (leadYoyMagnitude == null || cand > leadYoyMagnitude) {
      lead = a
      leadYoyMagnitude = cand
    }
  }
  // leadYoyMagnitude is null (not falsy-checked) because a flat 0.0% move is a
  // real, reportable story.
  if (lead && leadYoyMagnitude != null) {
    const yoy = Math.round((lead.yoyPct as number) * 10) / 10
    if (Math.abs(yoy) >= 0.1) {
      const dir = yoy > 0 ? 'up' : 'down'
      return `${lead.areaLabel} home prices are ${dir} ${Math.abs(yoy).toFixed(1)}% from a year ago`
    }
    return `${lead.areaLabel} home prices are holding steady year over year`
  }

  const verdictArea = areas.find(showsVerdict)
  if (verdictArea) {
    const v = (verdictLabel(verdictArea.marketVerdict) ?? '').toLowerCase()
    const mos = formatMonths(verdictArea.monthsOfSupply)
    if (v && mos) return `${verdictArea.areaLabel} is a ${v} with ${mos} of supply`
  }

  const priced = areas.find((a) => formatCurrencyRounded(a.medianPrice) != null)
  if (priced) {
    return `${priced.areaLabel} homes sold for a median ${formatCurrencyRounded(priced.medianPrice)} over the last 12 months`
  }
  return `Where the ${areas[0].areaLabel} market stands`
}

/**
 * Build the subject line. The subject carries the period's ONE verified story
 * (the same deterministic headline the hero shows) — "Bend home prices are
 * down 1.2% from a year ago" earns the open that "Bend market update" never
 * did (2026-07-15 conversion audit). When the headline engine has no story to
 * tell (the "Where … stands" fallbacks), the plain area framing stays.
 */
export function buildSubject(areasIn: readonly MarketReportAreaBlock[]): string {
  const areas = orderAreasBySpecificity(areasIn)
  const base =
    areas.length === 1 ? `${areas[0].areaLabel} market update` : 'Your Central Oregon market update'
  const headline = buildHeadline(areas)
  if (headline.startsWith('Where')) return base
  return headline
}

/** "YYYY-MM" of a period start. */
function monthKey(periodStart: string): string {
  return periodStart.slice(0, 7)
}

/** True when `later` is the calendar month right after `earlier` (period starts). */
export function isNextMonth(earlier: string, later: string): boolean {
  const a = new Date(`${monthKey(earlier)}-01T00:00:00Z`)
  const b = new Date(`${monthKey(later)}-01T00:00:00Z`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false
  const next = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1))
  return next.getTime() === b.getTime()
}

function monthName(periodStart: string): string {
  // formatDate prints a dash for an unparseable date; never let that reach the
  // email. An unparseable period start falls back to its YYYY-MM key.
  const at = new Date(`${monthKey(periodStart)}-01T12:00:00Z`)
  if (Number.isNaN(at.getTime())) return monthKey(periodStart)
  return formatDate(at, { month: 'long', day: undefined, year: undefined, timeZone: 'UTC' })
}

function qualifiesMonth(p: MarketTrendPoint): boolean {
  return (
    p.medianSalePrice != null &&
    Number.isFinite(p.medianSalePrice) &&
    p.soldCount != null &&
    p.soldCount >= MOM_MIN_MONTH_SALES
  )
}

/**
 * The month-over-month median pair, or null when it must not print: the two
 * most recent completed months must be consecutive calendar months and each
 * must rest on MOM_MIN_MONTH_SALES closed sales. Pure, exported for tests.
 */
export function momMedianPair(
  points: readonly MarketTrendPoint[] | null | undefined,
): { latest: MarketTrendPoint; prev: MarketTrendPoint; pct: number } | null {
  if (!points || points.length < 2) return null
  const latest = points[points.length - 1]
  const prev = points[points.length - 2]
  if (!isNextMonth(prev.periodStart, latest.periodStart)) return null
  if (!qualifiesMonth(latest) || !qualifiesMonth(prev)) return null
  const pct = Math.round((((latest.medianSalePrice as number) - (prev.medianSalePrice as number)) / (prev.medianSalePrice as number)) * 1000) / 10
  if (!Number.isFinite(pct)) return null
  return { latest, prev, pct }
}

/**
 * The run of months a price chart may draw: the most recent consecutive
 * completed months, each qualifying, at least CHART_MIN_MONTHS long, at most 12.
 * Null when the series is gapped or thin. Pure, exported for tests.
 */
export function chartableMonths(points: readonly MarketTrendPoint[] | null | undefined): MarketTrendPoint[] | null {
  if (!points || points.length === 0) return null
  const run: MarketTrendPoint[] = []
  for (let i = points.length - 1; i >= 0 && run.length < 12; i--) {
    const p = points[i]
    if (!qualifiesMonth(p)) break
    if (run.length > 0 && !isNextMonth(p.periodStart, run[0].periodStart)) break
    run.unshift(p)
  }
  return run.length >= CHART_MIN_MONTHS ? run : null
}

/**
 * Absolute chart-image URL for an area + metric. `through` (YYYY-MM) pins the
 * chart to the months the email described, so a report opened next month (or
 * read again from the archive) still shows the chart that went out.
 */
export function chartImageUrl(
  area: Pick<MarketReportAreaBlock, 'geoType' | 'slug'>,
  metric: 'median_price' | 'inventory' | 'dom',
  opts: { months?: number; through?: string | null } = {},
): string {
  const params = new URLSearchParams({
    geo: area.geoType,
    slug: area.slug,
    metric,
    months: String(opts.months ?? 12),
  })
  if (opts.through) params.set('through', opts.through)
  return `${SITE_URL}/api/email/market-chart?${params.toString()}`
}

/**
 * Where "SEE THE FULL REPORT" actually lands (conversion-audit 2026-07-15 #2).
 * City areas land on /housing-market/<city>, a hero that reads "<City> market
 * report". Neighborhood and community areas land on their geo page AT the
 * market section. The anchor is #market: that is the id the market section
 * carries on both destinations (the old #market-report matched nothing). GA4
 * UTMs ride along (audit #8); the first-party agent and person-token params
 * are stamped by attributeOutbound at send time (fragment-aware).
 * Exported for tests.
 */
export function reportCtaUrl(area: Pick<MarketReportAreaBlock, 'slug' | 'geoType' | 'href'>): string {
  const path = area.geoType === 'city' ? cityMarketPath(area.slug) : area.href
  return `${SITE_URL}${path}?utm_source=crm&utm_medium=email&utm_campaign=market-report#market`
}

type AreaRender = { html: string; text: string; figures: ReportFigure[] }

function fig(
  area: MarketReportAreaBlock,
  label: string,
  value: number | null,
  display: string,
  trace: { source: string; filter: string; as_of: string | null; n: number | null },
): ReportFigure {
  return {
    area: area.slug,
    areaLabel: area.areaLabel,
    label,
    value,
    display,
    source: trace.source,
    filter: trace.filter,
    as_of: trace.as_of,
    n: trace.n,
  }
}

/**
 * One area's editorial section: verdict kicker (city only), serif area name,
 * the twelve-month median with its year-over-year move, the month-over-month
 * median line (when both months carry a sample), the price chart (when the
 * series is unbroken and sampled), the stat rows that have a value, the
 * "market read" (city only), and the CTA. Also the plain-text mirror and the
 * figures trace for everything printed.
 */
function renderAreaBlock(area: MarketReportAreaBlock): AreaRender {
  const figures: ReportFigure[] = []
  const textLines: string[] = []
  const href = reportCtaUrl(area)
  const points = area.trend?.points ?? null

  // ── Kicker: the verdict beside the months-of-supply figure it derives from ─
  let kicker = ''
  let kickerText: string | null = null
  const mosDisplay = showsMonthsOfSupply(area) ? formatMonths(area.monthsOfSupply) : null
  const verdict = showsVerdict(area) ? verdictLabel(area.marketVerdict) : null
  if (verdict && mosDisplay) {
    kicker = `<div style="font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${MUTED};margin-bottom:8px;font-variant-numeric:tabular-nums;">${escapeHtml(verdict)} &middot; ${escapeHtml(mosDisplay)} of supply</div>`
    kickerText = `${verdict} with ${mosDisplay} of supply`
    // The kicker prints both numbers; each carries its trace.
    figures.push(fig(area, 'months of supply', area.monthsOfSupply, mosDisplay, mosTrace(area)))
    figures.push(
      fig(area, 'market verdict', null, verdict, {
        source: 'derived from months of supply against the canonical thresholds (4 or less sellers, 4 to 6 balanced, 6 or more buyers)',
        filter: `months_of_supply=${area.monthsOfSupply}`,
        as_of: mosTrace(area).as_of,
        n: null,
      }),
    )
  }

  // ── Twelve-month median + its year-over-year move (same instrument) ───────
  const priceDisplay = formatCurrencyRounded(area.medianPrice)
  const yoyDisplay = formatYoyPlain(area.yoyPct)
  let priceHtml = ''
  if (priceDisplay) {
    figures.push(fig(area, 'median sale price, last 12 months', area.medianPrice, priceDisplay, twelveMonthTrace(area, 'median_close')))
    if (yoyDisplay) {
      figures.push(fig(area, 'median sale price change from a year ago', area.yoyPct, yoyDisplay, twelveMonthTrace(area, 'yoy_median_price')))
    }
    const caption = yoyDisplay ? `Median sale price, last 12 months &middot; ${escapeHtml(yoyDisplay)}` : 'Median sale price, last 12 months'
    priceHtml = `<div style="font-family:${EMAIL_SERIF};font-size:42px;line-height:1.05;color:${EMAIL_NAVY};font-variant-numeric:tabular-nums;">${escapeHtml(priceDisplay)}</div>
    <div style="font-size:13px;color:${MUTED};margin:6px 0 12px;font-variant-numeric:tabular-nums;">${caption}</div>`
    textLines.push(`Median sale price, last 12 months ${priceDisplay}${yoyDisplay ? ` (${yoyDisplay})` : ''}`)
  }

  // ── Month-over-month median: its own line, both months from the monthly cache
  let momHtml = ''
  const mom = momMedianPair(points)
  if (mom) {
    const latestStr = formatCurrencyRounded(mom.latest.medianSalePrice) as string
    const prevStr = formatCurrencyRounded(mom.prev.medianSalePrice) as string
    const latestName = monthName(mom.latest.periodStart)
    const prevName = monthName(mom.prev.periodStart)
    const momStr = formatMomPct(mom.pct, prevName) as string
    const sentence = `${latestName} closed at a ${latestStr} median, ${momStr} (${prevStr}).`
    momHtml = `<p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:${EMAIL_INK};font-variant-numeric:tabular-nums;">${escapeHtml(sentence)}</p>`
    textLines.push(sentence)
    figures.push(fig(area, `${latestName} median sale price`, mom.latest.medianSalePrice, latestStr, monthlyTrace(area, mom.latest, 'median_sale_price')))
    figures.push(fig(area, `${prevName} median sale price`, mom.prev.medianSalePrice, prevStr, monthlyTrace(area, mom.prev, 'median_sale_price')))
    figures.push(
      fig(area, `median sale price change ${prevName} to ${latestName}`, mom.pct, momStr, {
        source: 'computed from the two monthly market_stats_cache rows above',
        filter: `(${mom.latest.medianSalePrice} - ${mom.prev.medianSalePrice}) / ${mom.prev.medianSalePrice}`,
        as_of: monthEnd(mom.latest.periodStart),
        n: Math.min(mom.latest.soldCount ?? 0, mom.prev.soldCount ?? 0),
      }),
    )
  }

  // ── Price chart: an unbroken, sampled run of completed months ─────────────
  let priceChart = ''
  const run = chartableMonths(points)
  if (run) {
    const through = monthKey(run[run.length - 1].periodStart)
    const url = chartImageUrl(area, 'median_price', { months: run.length, through })
    priceChart = `<div style="margin:14px 0 4px;"><img src="${url}" alt="Line chart of the ${escapeHtml(area.areaLabel)} median sale price by month over the last ${run.length} months" width="532" style="display:block;width:100%;max-width:532px;height:auto;border:1px solid ${EMAIL_BORDER};border-radius:8px;"></div>`
    figures.push({
      area: area.slug,
      areaLabel: area.areaLabel,
      label: `median sale price chart, ${run.length} completed months through ${through}`,
      value: null,
      display: 'chart',
      source: 'market_stats_cache via getMarketTrend, drawn by /api/email/market-chart',
      filter: `geo_type=${area.geoType} geo_slug=${area.slug} period_type=monthly months=${run.length} through=${through} each month n>=${MOM_MIN_MONTH_SALES}`,
      as_of: monthEnd(run[run.length - 1].periodStart),
      n: run.length,
    })
  }

  // ── Stat rows: only the ones with a value, no context line from another
  // instrument. Months of supply is not a row: the kicker above the area name
  // already prints it beside the verdict it decides (city grain only).
  type StatRow = { label: string; value: string; context: string | null }
  const rows: StatRow[] = []

  const activeDisplay = formatCount(area.activeListings)
  if (activeDisplay) {
    rows.push({ label: 'Homes for sale', value: activeDisplay, context: null })
    figures.push(fig(area, 'homes for sale', area.activeListings, activeDisplay, activeTrace(area)))
    textLines.push(`Homes for sale ${activeDisplay}`)
  }

  const domDisplay = formatDays(area.domMedian)
  if (domDisplay) {
    rows.push({ label: 'Median days on market, last 12 months', value: domDisplay, context: null })
    figures.push(fig(area, 'median days on market, last 12 months', area.domMedian, domDisplay, domTrace(area)))
    textLines.push(`Median days on market, last 12 months ${domDisplay}`)
  }

  const soldDisplay = formatCount(area.soldLast12mo)
  if (soldDisplay) {
    rows.push({ label: 'Homes sold, last 12 months', value: soldDisplay, context: null })
    figures.push(fig(area, 'homes sold, last 12 months', area.soldLast12mo, soldDisplay, twelveMonthTrace(area, 'closed_count')))
    textLines.push(`Homes sold, last 12 months ${soldDisplay}`)
  }

  const rowHtml = (r: StatRow): string => {
    const contextLine = r.context
      ? `<div style="font-size:12px;line-height:1.5;color:${MUTED};margin-top:2px;">${escapeHtml(r.context)}</div>`
      : ''
    return `<tr>
      <td style="padding:10px 0;font-size:14px;color:${MUTED};border-top:1px solid ${EMAIL_BORDER};vertical-align:top;">${escapeHtml(r.label)}</td>
      <td style="padding:10px 0;font-size:14px;color:${EMAIL_INK};text-align:right;font-weight:600;font-variant-numeric:tabular-nums;border-top:1px solid ${EMAIL_BORDER};vertical-align:top;">${escapeHtml(r.value)}${contextLine}</td>
    </tr>`
  }
  const rowsHtml = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-variant-numeric:tabular-nums;margin-top:10px;">
      ${rows.map(rowHtml).join('')}
    </table>`
    : ''

  // ── "Market read": only beside the verdict it interprets (city grain) ──────
  const meaning = verdict ? meaningLine(area.marketVerdict) : null
  const meaningHtml = meaning
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr><td style="background:rgba(16,39,66,0.05);padding:14px 16px;border-left:3px solid ${EMAIL_NAVY};">
        <div style="font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};margin-bottom:6px;">Market read</div>
        <div style="font-size:14px;line-height:1.6;color:${EMAIL_INK};">${escapeHtml(meaning)}</div>
      </td></tr></table>`
    : ''

  const html = `<tr><td style="padding:34px 34px 0;">
    ${kicker}
    <div style="font-family:${EMAIL_SERIF};font-size:26px;line-height:1.2;color:${EMAIL_NAVY};margin-bottom:16px;">${escapeHtml(area.areaLabel)}</div>
    ${priceHtml}
    ${momHtml}
    ${priceChart}
    ${rowsHtml}
    ${meaningHtml}
    <div style="margin-top:20px;padding-bottom:6px;">
      <a href="${href}" style="display:inline-block;background:${EMAIL_NAVY};color:${EMAIL_CREAM};font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:12px 26px;">SEE THE FULL ${escapeHtml(area.areaLabel.toUpperCase())} REPORT &rarr;</a>
    </div>
  </td></tr>`

  // ── Plain-text mirror ─────────────────────────────────────────────────────
  const text = [
    area.areaLabel.toUpperCase(),
    ...(kickerText ? [kickerText] : []),
    ...textLines,
    ...(meaning ? [`Market read. ${meaning}`] : []),
    `Full report ${href}`,
  ].join('\n')

  return { html, text, figures }
}

/** "Larkspur", "Larkspur and Bend", "Larkspur, Bend and Sisters". */
function areaList(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
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
  const areas = orderAreasBySpecificity(Array.isArray(input.areas) ? input.areas : [])
  const subject = buildSubject(areas)
  const asOfDate = input.asOf != null ? new Date(input.asOf) : new Date()
  const asOf = formatDate(Number.isNaN(asOfDate.getTime()) ? new Date() : asOfDate, { month: 'long' })
  const mastheadArea = areas.length === 1 ? areas[0].areaLabel : 'Central Oregon'
  const headline = buildHeadline(areas)
  const figures: ReportFigure[] = []

  figures.push({
    area: null,
    areaLabel: null,
    label: 'headline',
    value: null,
    display: headline,
    source: `derived from the area figures below: the largest year-over-year move among areas with at least ${HEADLINE_MIN_SOLD_COUNT} closed sales in the last 12 months, else the first city verdict, else the first twelve-month median`,
    filter: areas.map((a) => a.slug).join(','),
    as_of: null,
    n: null,
  })

  // Raw for the preheader (the shell escapes it), escaped inline for the body.
  const labels = areas.map((a) => a.areaLabel)
  const introRaw =
    areas.length === 1
      ? `Here is where the ${labels[0]} market stands as of ${asOf}.`
      : areas.length <= 3
        ? `Here is where ${areaList(labels)} stand as of ${asOf}.`
        : `Here is where your Central Oregon markets stand as of ${asOf}.`
  const introLine = escapeHtml(introRaw)

  const headerHtml = `<tr><td style="padding:30px 34px 0;">
    <p style="margin:0 0 10px;font-size:16px;color:${EMAIL_INK};">${greeting}</p>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${EMAIL_INK};">${introLine}</p>
    <div style="font-family:${EMAIL_SERIF};font-size:30px;line-height:1.25;color:${EMAIL_NAVY};border-top:3px solid ${EMAIL_NAVY};padding-top:16px;">${escapeHtml(headline)}</div>
  </td></tr>`

  const rendered = areas.map(renderAreaBlock)
  const blocksHtml = rendered.map((r) => r.html).join('')
  for (const r of rendered) figures.push(...r.figures)

  const methodology =
    'Every figure here comes from closed and active Central Oregon MLS data for single family homes. Month names refer to completed calendar months. Reply to this email if you want a pricing read on a specific home.'
  const methodologyHtml = `<tr><td style="padding:28px 34px 6px;">
    <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};border-top:1px solid ${EMAIL_BORDER};padding-top:16px;">${escapeHtml(methodology)}</p>
  </td></tr>`

  const html = wrapBrandedEmail({
    bodyHtml: headerHtml + blocksHtml + methodologyHtml,
    previewText: headline,
    mastheadLine: `MARKET REPORT · ${mastheadArea}`,
    senderBroker: input.senderBroker ?? null,
    unsubscribeUrl: input.unsubscribeUrl,
    manageUrl: input.manageUrl ?? null,
    manageLabel: 'Manage your report',
    viewOnlineUrl: input.viewUrl ?? null,
    viewOnlineLabel: 'View this report online',
  })

  // One plain-text footer: the postal address and the same three links. prepare
  // (footer: 'from-body') sees both and adds nothing.
  const textParts: string[] = [
    fn ? `Hi ${fn},` : 'Hi,',
    '',
    introRaw,
    '',
    headline,
    '',
  ]
  for (const r of rendered) {
    textParts.push(r.text)
    textParts.push('')
  }
  textParts.push(methodology)
  textParts.push('')
  textParts.push('--')
  textParts.push(`${BROKERAGE_POSTAL_ADDRESS} · ryan-realty.com`)
  if (input.viewUrl) textParts.push(`View this report online: ${input.viewUrl}`)
  if (input.manageUrl) textParts.push(`Manage your report: ${input.manageUrl}`)
  textParts.push(`Unsubscribe: ${input.unsubscribeUrl}`)

  return { subject, html, text: textParts.join('\n'), figures, traces: figuresToTraces(figures) }
}
