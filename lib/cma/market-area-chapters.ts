/**
 * Web + print chapters for market-area density. Our look. Our number.
 */

import { dec, escapeHtml, int, propertyIntelligenceBlock, usd } from '@/lib/cma/render-blocks'
import { clientSourceLine } from '@/lib/cma/client-facing'
import { formatMonthsOfSupply, monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'
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
  const heroMeta = tileMeta(selected)
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
      ${heroMeta ? `<div class="status-hero-m">${esc(heroMeta)}</div>` : ''}
    </div>
    ${tiles ? `<div class="status-tiles">${tiles}</div>` : ''}`
}

export function renderStatusGridHtml(area: CmaMarketArea | null | undefined): string {
  if (!area) return ''
  const boards = statusBoards(area)
  if (!boards) return ''
  return `${boards}<p class="small">${esc(clientSourceLine(area.source, `Similar homes in ${area.label}.`))}</p>`
}

export function renderSold90Html(area: CmaMarketArea | null | undefined): string {
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
  <p class="small">${esc(clientSourceLine(s.source, 'Closed sales in this market area over the last 90 days.'))}</p>`
}

export function renderInventoryBoardHtml(market: CmaMarketContext | null | undefined): string {
  if (!market) return ''
  const mos = market.monthsOfSupply
  const verdict = mos != null ? monthsOfSupplyVerdict(mos) : null
  const saleToList =
    market.saleToListRatio != null
      ? dec(market.saleToListRatio <= 2 ? market.saleToListRatio * 100 : market.saleToListRatio, 1)
      : null
  const chart = medianCloseLineSvg(market.trend ?? [])
  return `${
    mos != null
      ? `<div class="inv-hero">
    <div class="inv-hero-n">${esc(formatMonthsOfSupply(mos))}</div>
    <div class="inv-hero-l">months of supply</div>
    ${verdict ? `<div class="inv-verdict">${esc(verdict.label)}</div>` : ''}
  </div>`
      : ''
  }
  <div class="stat3">
    ${saleToList != null ? `<div class="st"><div class="st-n">${saleToList}%</div><div class="st-l">sold to list</div></div>` : ''}
    ${market.medianDom != null ? `<div class="st"><div class="st-n">${int(market.medianDom)}</div><div class="st-l">median days on market</div></div>` : ''}
    ${market.medianSalePrice != null ? `<div class="st"><div class="st-n">${usd(market.medianSalePrice)}</div><div class="st-l">median sold</div></div>` : ''}
  </div>
  ${chart ? `<div class="szn is-hero" data-anim="chart">${chart}</div>` : ''}`
}

export function renderListingTrendHtml(area: CmaMarketArea | null | undefined): string {
  const svg = area?.listingTrend ? listingTrendSvg(area.listingTrend) : ''
  if (!svg || !area) return ''
  return `<div class="szn is-hero" data-anim="chart">${svg}</div><p class="small">${esc(area.label)}.</p>`
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
        <div class="kick r">This market</div>
        <h2 class="h r">${esc(area!.label)}</h2>
        <div class="r">${status}</div>
      </div>
    </section>`)
  }
  if (sold90) {
    parts.push(`<section class="sc sc-navy" id="sold-90">
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
        <h2 class="h r">${esc(a.subject.streetAddress)}</h2>
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
      toc: 'This market',
      body: `<h2 class="section">${esc(area.label)}</h2>
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
      toc: 'How fast this market is moving',
      body: `<h2 class="section">How fast this market is moving</h2>${inventory}`,
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
      toc: a.subject.streetAddress,
      body: `<h2 class="section">${esc(a.subject.streetAddress)}</h2>${photos}`,
    })
  }
  return pages
}

/** Wider market only: 90-day sold, months of supply, new-list trend. One scene. */
export function immersiveWiderMarketChapters(a: MarketChapterArgs): string {
  const area = a.extras?.marketArea
  const sold90 = renderSold90Html(area)
  const inventory = renderInventoryBoardHtml(a.market)
  const trend = renderListingTrendHtml(area)
  if (!sold90 && !inventory && !trend) return ''
  return `<section class="sc sc-navy" id="wider-market">
      <div class="in">
        <div class="kick r">${esc(a.market?.geoLabel ?? a.subject.city)}</div>
        <h2 class="h r">This market</h2>
        ${
          sold90 && area?.sold90
            ? `<div id="sold-90" class="r">
          <h3 class="sub r">What ${esc(area.sold90.bedsLabel)} homes sold for</h3>
          ${sold90}
        </div>`
            : ''
        }
        ${
          inventory
            ? `<div id="inventory" class="r">
          <h3 class="sub r">How fast this market is moving</h3>
          ${inventory}
        </div>`
            : ''
        }
        ${
          trend
            ? `<div id="listing-trend" class="r">
          <h3 class="sub r">New listings and asking prices</h3>
          ${trend}
        </div>`
            : ''
        }
      </div>
    </section>`
}

export function printWiderMarketPages(a: MarketChapterArgs): CmaPageDef[] {
  const area = a.extras?.marketArea
  const sold90 = renderSold90Html(area)
  const inventory = renderInventoryBoardHtml(a.market)
  const trend = renderListingTrendHtml(area)
  const chunks: string[] = []
  if (sold90 && area?.sold90) {
    chunks.push(`<h2 class="section">This market</h2>
  <h3 class="subhead">What ${esc(area.sold90.bedsLabel)} homes sold for</h3>${sold90}`)
  }
  if (inventory) {
    chunks.push(
      `${chunks.length ? '<h3 class="subhead">How fast this market is moving</h3>' : '<h2 class="section">How fast this market is moving</h2>'}${inventory}`,
    )
  }
  if (trend) {
    chunks.push(
      `${chunks.length ? '<h3 class="subhead">New listings and asking prices</h3>' : '<h2 class="section">New listings and asking prices</h2>'}${trend}`,
    )
  }
  if (!chunks.length) return []
  return [
    {
      meta: `${esc(a.subject.streetAddress)} · This market`,
      toc: 'This market',
      body: chunks.join('\n'),
    },
  ]
}
