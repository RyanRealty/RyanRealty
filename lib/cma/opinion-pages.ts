/**
 * Print chapters for the price-opinion spine. Cover stays in render.ts.
 * Each page makes the next one necessary.
 */

import { buildLinePlot } from '@/lib/charts/plot'
import { PRINT_NAVY_CREAM, renderPrintChartSvg } from '@/lib/charts/print-svg'
import { renderBandRivalsHtml } from '@/lib/cma/band-rivals'
import { renderCompMapKeyHtml, renderCompStripHtml } from '@/lib/cma/comp-strip'
import { renderCompPinMapHtml } from '@/lib/cma/comp-pin-map'
import { dateLong, dec, escapeHtml, int, usd, usdSigned } from '@/lib/cma/render-blocks'
import { clientSourceLine } from '@/lib/cma/client-facing'
import { printWiderMarketPages } from '@/lib/cma/market-area-chapters'
import { describeCompSearch } from '@/lib/pricing/search-story'
import type { CmaExtras } from '@/lib/cma/extras'
import type { SubdivisionStory } from '@/lib/cma/subdivision-story'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'
import { whyPage } from '@/lib/cma/render-why-page'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import { assembleCompFlyerPages } from '@/lib/cma/opinion-flyers'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'

const esc = escapeHtml

export type OpinionPageArgs = {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  extras?: CmaExtras | null
  subdivisionStory?: SubdivisionStory | null
  mapDataUri: string | null
  tiersUsed?: string[]
  generatedAtIso: string
  excludedOutliers: Array<{ address: string; closePrice: number; ppsf: number; reason: string }>
  equity?: CmaEquityPosition | null
  expiredAudit?: ExpiredAuditData | null
}

function subdivisionYearChartSvg(years: readonly { year: number; count: number }[]): string {
  const plot = buildLinePlot([
    {
      name: 'Closed sales',
      points: years
        .filter((y) => y.year > 0 && y.count > 0)
        .map((y) => ({
          value: y.count,
          tick: String(y.year),
          label: String(y.count),
          at: y.year,
        })),
    },
  ])
  if (!plot) return ''
  return renderPrintChartSvg(plot, {
    caption: 'Closed sales by year',
    colors: PRINT_NAVY_CREAM,
  })
}

export function competitionPage(a: OpinionPageArgs): CmaPageDef | null {
  const b = a.extras?.band
  if (!b) return null
  const rivals = b.rivals ?? []
  return {
    meta: `${esc(a.subject.streetAddress)} · At this price`,
    toc: 'Who you are competing with at this price',
    body: renderBandRivalsHtml({
      city: a.subject.city,
      lo: b.lo,
      hi: b.hi,
      activeCount: b.activeCount,
      pendingCount: b.pendingCount,
      rivals,
    }),
  }
}

export function salesAndMapPage(a: OpinionPageArgs): CmaPageDef {
  const pinMap = renderCompPinMapHtml(a.subject, a.comps)
  const story = describeCompSearch({ subdivision: a.subject.subdivision, tiersUsed: a.tiersUsed ?? [] })
  const strip = renderCompStripHtml(a.comps)
  return {
    meta: `${esc(a.subject.streetAddress)} · The sales that set the number`,
    toc: 'The three sales that set the number',
    body: `
  <h2 class="section">The three sales that set the number</h2>
  <p>${esc(story.body)} Tap a house on the web view to see its pin.</p>
  ${pinMap ? `<div class="pin-map-wrap">${pinMap}</div>` : ''}
  ${
    a.mapDataUri
      ? `<h3 class="subhead">Where the comps sit</h3>
  <img class="map-img" src="${a.mapDataUri}" alt="${esc(story.headline)}" />
  <h3 class="subhead">Marker key</h3>${renderCompMapKeyHtml(a.subject, a.comps)}`
      : ''
  }
  ${strip}
  <h3 class="subhead">What each sale becomes on your house</h3>
  <table class="comps">
    <thead><tr><th>Sale</th><th class="num">Close $</th><th class="num">Time</th><th class="num">Size</th><th class="num">Adjusted $</th></tr></thead>
    <tbody>${a.comps
      .map(
        (c) =>
          `<tr><td>${esc(c.address)}</td><td class="num">${usd(c.closePrice)}</td><td class="num">${usdSigned(c.timeAdjustment)}</td><td class="num">${usdSigned(c.sizeAdjustment)}</td><td class="num">${usd(c.adjustedPrice)}</td></tr>`,
      )
      .join('')}</tbody>
  </table>`,
  }
}

export function subdivisionChapterPage(a: OpinionPageArgs): CmaPageDef | null {
  const st = a.subdivisionStory
  if (!st) return null
  const f = st.facts
  const yearRows = f.years
    .map(
      (y) =>
        `<tr><td>${y.year}</td><td>${int(y.count)}</td><td>${usd(y.medianClose)}</td><td>${y.medianPpsf != null ? usd(Math.round(y.medianPpsf)) : '—'}</td></tr>`,
    )
    .join('')
  const yearChart = subdivisionYearChartSvg(f.years)
  const sections = st.sections
    .map((sec) => `<h3 class="subhead">${esc(sec.heading)}</h3><p>${esc(sec.body)}</p>`)
    .join('')
  const notable = st.notableSales
    .filter((n) => n.line)
    .map((n) => `<li><strong>${esc(n.address)}</strong> (${usd(n.closePrice)}, ${dateLong(n.closeDate)}): ${esc(n.line)}</li>`)
    .join('')
  const position = [
    f.subjectSqftPercentile != null
      ? `Your home is as large or larger than ${f.subjectSqftPercentile}% of everything that has sold here.`
      : null,
    f.vintageSpan ? `The street was built out ${f.vintageSpan.min} to ${f.vintageSpan.max}.` : null,
    f.recordHigh ? `The record is ${usd(f.recordHigh.price)} at ${esc(f.recordHigh.address)} (${dateLong(f.recordHigh.date)}).` : null,
    f.medianDomRecent != null
      ? `Sales here over the last two years carried a median of ${int(f.medianDomRecent)} days on market.`
      : null,
    f.saleToListRecentPct != null
      ? `Sellers here collected a median ${dec(f.saleToListRecentPct, 1)}% of their final asking price.`
      : null,
  ]
    .filter(Boolean)
    .join(' ')
  return {
    meta: `${esc(a.subject.streetAddress)} · ${esc(f.name)}`,
    toc: `This subdivision, ${f.name}`,
    body: `
  <h2 class="section">${esc(f.name)}</h2>
  ${a.mapDataUri ? `<img class="map-img is-plat" src="${a.mapDataUri}" alt="${esc(f.name)} subdivision" />` : ''}
  <p>${int(f.totalSales)} closed single-family sales in ${esc(f.name)}.</p>
  ${sections}
  ${yearChart ? `<div class="chart-block" data-anim="chart">${yearChart}</div>` : ''}
  <table class="comp-table">
    <thead><tr><th>Year</th><th>Sales</th><th>Median close</th><th>Median $/sqft</th></tr></thead>
    <tbody>${yearRows}</tbody>
  </table>
  ${notable ? `<h3 class="subhead">Recent sales, one line each</h3><ul class="note-list">${notable}</ul>` : ''}
  ${position ? `<p><strong>${position}</strong></p>` : ''}`,
  }
}

export function assembleOpinionPages(a: OpinionPageArgs): CmaPageDef[] {
  const rest: CmaPageDef[] = []
  rest.push(
    whyPage({
      subject: a.subject,
      comps: a.comps,
      market: a.market,
      pricing: a.pricing,
      equity: a.equity,
      expiredAudit: a.expiredAudit,
      generatedAtIso: a.generatedAtIso,
      excludedOutliers: a.excludedOutliers,
    }),
  )
  rest.push(
    pricingPage({
      subject: a.subject,
      comps: a.comps,
      market: a.market,
      pricing: a.pricing,
      tiersUsed: a.tiersUsed,
    }),
  )
  const competition = competitionPage(a)
  if (competition) rest.push(competition)
  rest.push(salesAndMapPage(a))
  rest.push(...assembleCompFlyerPages(a.comps))
  const subdivision = subdivisionChapterPage(a)
  if (subdivision) rest.push(subdivision)
  rest.push(...printWiderMarketPages(a))
  return rest
}

export { clientSourceLine }
