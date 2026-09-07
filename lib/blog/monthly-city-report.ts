/**
 * Monthly city market report for the blog: one post per city per month,
 * the figures stated once each with their month, from the same cache rows
 * the market pages read.
 *
 * Why (Matt 2026-09-07): the answer-engine baseline found the page pattern
 * that gets Ryan Realty recommended is a dated local report with the median
 * sale price and months of supply stated once. The July 2026 city reports were
 * hand-made; this makes them a cron.
 *
 * §0 discipline: every figure here arrives from a DAL read the caller names
 * (the Market Truth detached monthly series the market page charts, and the
 * getCityReportSnapshot live block the page's hero reads). Nothing is
 * estimated. A month with too few closings, a missing median, or a trend
 * whose last completed month is not the requested one REFUSES to build. The
 * months-of-supply sentence uses marketVerdict, the one bucket rule
 * (ci:market-formula, ci:publish-blog-mos-verdicts).
 *
 * Pure: no I/O, so the tests run the whole thing on fixtures.
 */
import { marketVerdict } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'

export type MonthlyReportCity = { slug: 'bend' | 'redmond'; label: string; marketHref: string; searchHref: string }

export const MONTHLY_REPORT_CITIES: readonly MonthlyReportCity[] = [
  { slug: 'bend', label: 'Bend', marketHref: '/housing-market/bend', searchHref: '/homes-for-sale?city=bend' },
  { slug: 'redmond', label: 'Redmond', marketHref: '/housing-market/redmond', searchHref: '/homes-for-sale?city=redmond' },
]

/** One completed month, in the trend-point shape (Market Truth series carries price and count only). */
export type MonthlyReportMonth = {
  periodStart: string
  medianSalePrice: number | null
  soldCount: number | null
  medianDom: number | null
  endOfPeriodInventory: number | null
}

/** Live block from getCityReportSnapshot, read the day the report builds. */
export type MonthlyReportLive = {
  activeCount: number | null
  monthsOfSupply: number | null
  medianDaysToPending: number | null
  refreshedAt: string | null
}

export type MonthlyReportInput = {
  city: MonthlyReportCity
  /** YYYY-MM of the month being reported. */
  month: string
  /** The completed month's row. */
  current: MonthlyReportMonth | null
  /** Same month one year earlier, when the cache has it. */
  priorYear: MonthlyReportMonth | null
  live: MonthlyReportLive | null
  /** ISO timestamp of the build, printed as the verification date. */
  builtAt: string
  /** Methodology stamp carried by the cache rows. */
  methodology: string
}

export type MonthlyReportPost = {
  slug: string
  title: string
  seoTitle: string
  seoDescription: string
  excerpt: string
  category: 'Market Reports'
  tags: string[]
  content: string
}

export type MonthlyReportResult = { ok: true; post: MonthlyReportPost } | { ok: false; reason: string }

/** Fewer closings than this and a monthly median is noise, not a figure. */
export const MIN_CLOSINGS = 15

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function monthLabel(month: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return null
  const name = MONTHS[Number(m[2]) - 1]
  return name ? `${name} ${m[1]}` : null
}

export function monthlyReportSlug(city: MonthlyReportCity, month: string): string {
  const label = monthLabel(month) ?? month
  return `${city.slug}-oregon-market-report-${label.toLowerCase().replace(/\s+/g, '-')}`
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function pct(delta: number): string {
  const abs = Math.abs(delta * 100)
  return `${abs.toFixed(1)}%`
}

/** "up 4.6% from $693,000" / "down 3.1% from $752,000" / "flat against $733,000". */
function yoyPhrase(now: number, then: number, unit: (n: number) => string): string {
  const delta = (now - then) / then
  if (Math.abs(delta) < 0.0005) return `flat against ${unit(then)}`
  return `${delta > 0 ? 'up' : 'down'} ${pct(delta)} from ${unit(then)}`
}

function verifiedDate(iso: string): string {
  const d = new Date(iso)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export function buildMonthlyCityReport(input: MonthlyReportInput): MonthlyReportResult {
  const { city, month, current, priorYear, live } = input
  const label = monthLabel(month)
  if (!label) return { ok: false, reason: `month must be YYYY-MM, got ${month}` }
  if (!current) return { ok: false, reason: `${city.label} ${label}: no completed monthly row in the cache yet` }
  if (!current.periodStart.startsWith(month)) {
    return { ok: false, reason: `${city.label}: latest completed month is ${current.periodStart.slice(0, 7)}, not ${month}` }
  }
  if (current.medianSalePrice == null || current.medianSalePrice <= 0) {
    return { ok: false, reason: `${city.label} ${label}: no median sale price in the cache row` }
  }
  if (current.soldCount == null || current.soldCount < MIN_CLOSINGS) {
    return { ok: false, reason: `${city.label} ${label}: ${current.soldCount ?? 0} closings is below the ${MIN_CLOSINGS} floor` }
  }

  const monthName = label.split(' ')[0]
  const year = label.split(' ')[1]
  const verified = verifiedDate(input.builtAt)
  const median = current.medianSalePrice
  const sold = current.soldCount

  // The month's figures, each stated once.
  const lines: string[] = []
  lines.push(
    priorYear?.medianSalePrice
      ? `<li>Median sale price: <strong>${money(median)}</strong>, ${yoyPhrase(median, priorYear.medianSalePrice, money)} in ${monthName} ${Number(year) - 1}</li>`
      : `<li>Median sale price: <strong>${money(median)}</strong></li>`,
  )
  lines.push(
    priorYear?.soldCount
      ? `<li>Homes sold: <strong>${sold}</strong>, ${yoyPhrase(sold, priorYear.soldCount, (n) => String(Math.round(n)))} a year earlier</li>`
      : `<li>Homes sold: <strong>${sold}</strong></li>`,
  )
  if (current.medianDom != null) {
    lines.push(
      priorYear?.medianDom != null
        ? `<li>Median days on market: <strong>${Math.round(current.medianDom)}</strong>, against ${Math.round(priorYear.medianDom)} last ${monthName}</li>`
        : `<li>Median days on market: <strong>${Math.round(current.medianDom)}</strong></li>`,
    )
  }
  if (current.endOfPeriodInventory != null) {
    lines.push(
      priorYear?.endOfPeriodInventory
        ? `<li>Active listings at month end: <strong>${current.endOfPeriodInventory}</strong>, ${yoyPhrase(current.endOfPeriodInventory, priorYear.endOfPeriodInventory, (n) => String(Math.round(n)))} a year ago</li>`
        : `<li>Active listings at month end: <strong>${current.endOfPeriodInventory}</strong></li>`,
    )
  }

  // Live read for the buying section, only when the snapshot carries it.
  const mos = live?.monthsOfSupply ?? null
  const verdict = marketVerdict(mos)
  const liveDate = live?.refreshedAt ? verifiedDate(live.refreshedAt) : verified
  const liveSentences: string[] = []
  if (live?.activeCount != null) liveSentences.push(`${city.label} is carrying ${live.activeCount} active single-family listings as of ${liveDate}.`)
  if (mos != null && verdict.kind !== 'unknown') {
    liveSentences.push(`Months of supply sits at ${formatMonthsOfSupply(mos)}, which is a ${verdict.label} by the standard measure: 4 months or less favors sellers, above 4 and under 6 is balanced, 6 or more favors buyers.`)
  }
  if (live?.medianDaysToPending != null) liveSentences.push(`The homes going pending now are doing it in a median ${Math.round(live.medianDaysToPending)} days.`)

  const priceLead = priorYear?.medianSalePrice
    ? median > priorYear.medianSalePrice
      ? 'up from a year ago'
      : median < priorYear.medianSalePrice
        ? 'down from a year ago'
        : 'level with a year ago'
    : 'for the month'
  const excerpt = `${city.label}'s ${monthName} ${year} numbers from our MLS database: a ${money(median)} median sale price, ${priceLead}, ${sold} homes sold, and where supply sits today.`

  const content = `<p>${city.label}'s ${monthName} closings are in. Here are the numbers, single-family homes in ${city.label} from our MLS database, verified ${verified}, followed by what they mean if you are selling or buying this month.</p>

<h2>The ${monthName} numbers</h2>
<ul>
${lines.join('\n')}
</ul>
<p>Single-family homes in ${city.label}, from our market statistics cache (methodology ${input.methodology}), verified ${verified}. The live version of every figure is on the <a href="${city.marketHref}">${city.label} market page</a>.</p>

<h2>If you are selling</h2>
<p>The ${monthName} median is the number buyers will hold your list price against, and the closings behind it are the comps. Price to them and the showings come in the first two weeks. Price above them and the listing joins the homes that sit and then cut. Our guide to <a href="/blog/how-to-price-your-bend-home">pricing a home in this market</a> covers how we set the number, and <a href="/sell">Value my home</a> starts a written valuation with the comps behind it.</p>

<h2>If you are buying</h2>
<p>${liveSentences.length ? liveSentences.join(' ') : `The live inventory, months of supply, and days to pending are on the <a href="${city.marketHref}">${city.label} market page</a>.`} Seller credits toward closing costs have been common in Central Oregon closings, and the share carrying one is in <a href="/blog/bend-buyers-market-shift-2026">our report on the shift toward buyers</a>. Ask for one in the offer.</p>

<h2>The bottom line</h2>
<p>${sold} homes closed in ${city.label} in ${monthName} at a ${money(median)} median. <a href="${city.searchHref}">Get listing alerts for ${city.label}</a> to see new inventory the day it lists, or <a href="/sell">Value my home</a> if you are the one deciding whether to list.</p>

<h2>Questions</h2>
<h3>What was the median home price in ${city.label} in ${monthName} ${year}?</h3>
<p>${money(median)} for a single-family home, the median of ${sold} closed sales in our MLS database, verified ${verified}.</p>
<h3>How many homes sold in ${city.label} in ${monthName} ${year}?</h3>
<p>${sold} single-family homes closed in ${city.label} in ${monthName} ${year}${priorYear?.soldCount ? `, against ${priorYear.soldCount} in ${monthName} ${Number(year) - 1}` : ''}.</p>
<h3>Is ${city.label} a buyer's or seller's market right now?</h3>
<p>${mos != null && verdict.kind !== 'unknown' ? `As of ${liveDate}, ${city.label} has ${formatMonthsOfSupply(mos)} months of supply, which is a ${verdict.label}. Four months or less favors sellers, above four and under six is balanced, six or more favors buyers.` : `The current months of supply and the verdict it carries are on the <a href="${city.marketHref}">${city.label} market page</a>, updated from live MLS data.`}</p>
<h3>How long do homes take to sell in ${city.label}?</h3>
<p>${current.medianDom != null ? `The homes that closed in ${monthName} ${year} had a median of ${Math.round(current.medianDom)} days on market.` : `The current median days on market is on the ${city.label} market page.`}${live?.medianDaysToPending != null ? ` The homes going pending as of ${liveDate} are doing it in a median ${Math.round(live.medianDaysToPending)} days.` : ''}</p>
<h3>Where do these numbers come from?</h3>
<p>Our own MLS database, single-family homes in ${city.label}, through the same market statistics cache the site's market pages read, methodology ${input.methodology}. The month's figures are closed sales. The supply figures are live counts as of ${liveDate}.</p>`

  const title = `${city.label} Oregon Market Report: ${label}`
  const seoTitle = `${city.label} Oregon Housing Market Report, ${label}`
  const seoDescription = `${city.label}, Oregon home sales for ${label}: ${money(median)} median sale price, ${sold} homes sold, days on market, active listings, and months of supply from our MLS database.`
  return {
    ok: true,
    post: {
      slug: monthlyReportSlug(city, month),
      title,
      seoTitle: seoTitle.length <= 60 ? seoTitle : title,
      seoDescription: seoDescription.length <= 160 ? seoDescription : seoDescription.slice(0, 157).replace(/[\s,]+\S*$/, '') + '.',
      excerpt,
      category: 'Market Reports',
      tags: ['market report', city.label.toLowerCase(), label.toLowerCase().split(' ')[0], 'central oregon'],
      content,
    },
  }
}

/** The YYYY-MM one month before the given date, in UTC. */
export function previousMonth(now: Date): string {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = new Date(Date.UTC(y, m - 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Pick the row for a YYYY-MM out of a trend series, or null. */
export function findMonth(points: readonly MonthlyReportMonth[], month: string): MonthlyReportMonth | null {
  return points.find((p) => p.periodStart.startsWith(month)) ?? null
}

/** The same month one year earlier. */
export function sameMonthLastYear(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return month
  return `${Number(m[1]) - 1}-${m[2]}`
}
