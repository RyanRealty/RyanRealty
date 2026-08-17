/**
 * Web + print chapters for market-area density. Our look. Our number.
 */

import { dec, escapeHtml, int, propertyIntelligenceBlock, usd } from '@/lib/cma/render-blocks'
import { clientSourceLine } from '@/lib/cma/client-facing'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { listingTrendSvg, medianCloseLineSvg } from '@/lib/cma/market-charts'
import type { CmaMarketArea, CmaStatusBucket } from '@/lib/cma/market-status'
import type { CmaAdjustedComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'
import type { CmaSiteData } from '@/lib/cma/county'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'

export type MarketChapterArgs = {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  extras?: { marketArea?: CmaMarketArea | null } | null
  site?: CmaSiteData | null
}

const esc = escapeHtml

function money(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  return usd(Math.round(n))
}

function bucketCells(b: CmaStatusBucket): string[] {
  return [
    int(b.count),
    money(b.low) ?? '',
    money(b.median) ?? '',
    money(b.high) ?? '',
    b.medianPpsf != null ? `${usd(Math.round(b.medianPpsf))}/sf` : '',
    b.medianDom != null ? `${int(Math.round(b.medianDom))} days` : '',
  ]
}

function statusTable(area: CmaMarketArea): string {
  const cols = [area.selected, area.active, area.pending, area.expired, area.closed].filter(
    (b): b is CmaStatusBucket => Boolean(b && b.count > 0),
  )
  if (cols.length === 0) return ''
  const labels = ['Homes', 'Low', 'Median', 'High', '$ / sf', 'DOM']
  const head = `<tr><th></th>${cols.map((c) => `<th class="v">${esc(c.label)}</th>`).join('')}</tr>`
  const body = labels
    .map((label, i) => {
      const cells = cols.map((c) => bucketCells(c)[i] ?? '')
      if (cells.every((c) => !c)) return ''
      return `<tr><td>${esc(label)}</td>${cells.map((c) => `<td class="v">${c}</td>`).join('')}</tr>`
    })
    .join('')
  return `<table class="kv is-wide compare-board status-grid"><thead>${head}</thead><tbody>${body}</tbody></table>`
}

export function renderStatusGridHtml(area: CmaMarketArea | null | undefined): string {
  if (!area) return ''
  const table = statusTable(area)
  if (!table) return ''
  return `${table}<p class="small">${esc(clientSourceLine(area.source, `Similar homes in ${area.label}.`))}</p>`
}

export function renderSold90Html(area: CmaMarketArea | null | undefined): string {
  const s = area?.sold90
  if (!s || s.count < 3) return ''
  return `<div class="stat3">
    <div class="st"><div class="st-n">${int(s.count)}</div><div class="st-l">closed in 90 days</div></div>
    <div class="st"><div class="st-n">${money(s.median) ?? ''}</div><div class="st-l">median sold</div></div>
    <div class="st"><div class="st-n">${money(s.low) ?? ''} to ${money(s.high) ?? ''}</div><div class="st-l">${esc(s.bedsLabel)} band</div></div>
  </div>
  <p class="small">${esc(clientSourceLine(s.source, 'Closed sales in this market area over the last 90 days.'))}</p>`
}

export function renderInventoryBoardHtml(market: CmaMarketContext | null | undefined): string {
  if (!market) return ''
  const mos = market.monthsOfSupply
  const saleToList =
    market.saleToListRatio != null
      ? dec(market.saleToListRatio <= 2 ? market.saleToListRatio * 100 : market.saleToListRatio, 1)
      : null
  const chart = medianCloseLineSvg(market.trend ?? [])
  return `<div class="stat4">
    ${mos != null ? `<div class="st"><div class="st-n">${esc(formatMonthsOfSupply(mos))}</div><div class="st-l">months of supply</div></div>` : ''}
    ${saleToList != null ? `<div class="st"><div class="st-n">${saleToList}%</div><div class="st-l">sold to list</div></div>` : ''}
    ${market.medianDom != null ? `<div class="st"><div class="st-n">${int(market.medianDom)}</div><div class="st-l">median days on market</div></div>` : ''}
    ${market.medianSalePrice != null ? `<div class="st"><div class="st-n">${usd(market.medianSalePrice)}</div><div class="st-l">median sold</div></div>` : ''}
  </div>
  ${chart ? `<div class="szn" data-anim="chart">${chart}</div>` : ''}`
}

export function renderListingTrendHtml(area: CmaMarketArea | null | undefined): string {
  const svg = area?.listingTrend ? listingTrendSvg(area.listingTrend) : ''
  return svg ? `<div class="szn" data-anim="chart">${svg}</div>` : ''
}

export function renderPhotoSetHtml(a: Pick<MarketChapterArgs, 'subject' | 'comps'>): string {
  const urls = [
    a.subject.photoUrl,
    ...a.comps.map((c) => c.photoUrl),
  ].filter((u): u is string => Boolean(u && u.trim()))
  const unique = [...new Set(urls)].slice(0, 12)
  if (unique.length === 0) return ''
  const tiles = unique
    .map(
      (src, i) =>
        `<figure class="photo-tile"><img src="${esc(src)}" alt="${i === 0 ? esc(a.subject.streetAddress) : 'Comparable sale'}" loading="lazy" referrerpolicy="no-referrer"/></figure>`,
    )
    .join('')
  return `<div class="photo-set">${tiles}</div>`
}

export function immersiveMarketChapters(a: MarketChapterArgs): string {
  const area = a.extras?.marketArea
  const status = renderStatusGridHtml(area)
  const sold90 = renderSold90Html(area)
  const inventory = renderInventoryBoardHtml(a.market)
  const trend = renderListingTrendHtml(area)
  const facts = propertyIntelligenceBlock(a.site)
  const photos = renderPhotoSetHtml(a)
  const parts: string[] = []
  if (status) {
    parts.push(`<section class="sc sc-cream" id="status-grid">
      <div class="in wide">
        <div class="kick r">This market area</div>
        <h2 class="h r">${esc(area!.label)}</h2>
        <p class="lede r">Selected sales against what is for sale, under contract, expired, and closed. Same product class. Not the whole ZIP.</p>
        <div class="r">${status}</div>
      </div>
    </section>`)
  }
  if (sold90) {
    parts.push(`<section class="sc sc-cream tight" id="sold-90">
      <div class="in">
        <div class="kick r">Last 90 days</div>
        <h2 class="h r">What ${esc(area!.sold90!.bedsLabel)} homes actually sold for</h2>
        <div class="r">${sold90}</div>
      </div>
    </section>`)
  }
  if (inventory) {
    parts.push(`<section class="sc sc-cream" id="inventory">
      <div class="in">
        <div class="kick r">${esc(a.market?.geoLabel ?? a.subject.city)}</div>
        <h2 class="h r">Supply, sold-to-list, and the sold line</h2>
        <div class="r">${inventory}</div>
      </div>
    </section>`)
  }
  if (trend) {
    parts.push(`<section class="sc sc-cream tight" id="listing-trend">
      <div class="in">
        <div class="kick r">Listings over time</div>
        <h2 class="h r">New listings and asking prices</h2>
        <div class="r">${trend}</div>
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
  if (photos) {
    parts.push(`<section class="sc sc-cream tight" id="photo-set">
      <div class="in wide">
        <div class="kick r">The house</div>
        <h2 class="h r">Photo set</h2>
        <div class="r">${photos}</div>
      </div>
    </section>`)
  }
  return parts.join('\n')
}

export function printMarketAreaPages(a: MarketChapterArgs): CmaPageDef[] {
  const area = a.extras?.marketArea
  const pages: CmaPageDef[] = []
  const status = renderStatusGridHtml(area)
  if (status && area) {
    pages.push({
      meta: `${esc(a.subject.streetAddress)} · Market area`,
      toc: 'This market area',
      body: `<h2 class="section">${esc(area.label)}</h2>
      <p>Selected sales against what is for sale, under contract, expired, and closed. Same product class. Not the whole ZIP.</p>
      ${status}`,
    })
  }
  const sold90 = renderSold90Html(area)
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
      toc: 'Supply and the sold line',
      body: `<h2 class="section">Supply, sold-to-list, and the sold line</h2>${inventory}`,
    })
  }
  const trend = renderListingTrendHtml(area)
  if (trend) {
    pages.push({
      meta: `${esc(a.subject.streetAddress)} · Listing trend`,
      toc: 'New listings over time',
      body: `<h2 class="section">New listings and asking prices</h2>${trend}`,
    })
  }
  const photos = renderPhotoSetHtml(a)
  if (photos) {
    pages.push({
      meta: `${esc(a.subject.streetAddress)} · Photos`,
      toc: 'Photo set',
      body: `<h2 class="section">Photo set</h2>${photos}`,
    })
  }
  return pages
}
