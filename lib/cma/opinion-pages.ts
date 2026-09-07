/**
 * Print chapters for the Sunstone seller CMA. Cover stays in render.ts.
 * Conditional pages omit when extras/site/pricing have nothing verified.
 */

import { buildLinePlot } from '@/lib/charts/plot'
import { PRINT_NAVY_CREAM, renderPrintChartSvg } from '@/lib/charts/print-svg'
import { renderBandRivalsHtml } from '@/lib/cma/band-rivals'
import { daysOnMarketFrom } from '@/lib/cma/listing-history-line'
import { renderCompMatrixHtml } from '@/lib/cma/comp-matrix'
import { seasonalityChartSvg } from '@/lib/cma/seasonality-chart'
import { renderCompPinMapHtml } from '@/lib/cma/comp-pin-map'
import {
  cleanText,
  dateLong,
  dec,
  escapeHtml,
  int,
  sparkPhotoAt,
  usd,
} from '@/lib/cma/render-blocks'
import { clientAreaLabel, clientSourceLine, formatClientMlsField } from '@/lib/cma/client-facing'
import {
  renderBandOutcomesHtml,
  renderDaysToOfferHtml,
  renderExpiredPeersHtml,
  renderInventoryBoardHtml,
  renderSold90Html,
  renderStatusGridHtml,
  widerMarketBodyHtml,
} from '@/lib/cma/market-area-chapters'
import { FAILED_ASK_BACKTEST, sellerFacingFindingMeaning } from '@/lib/cma/expired-audit'
import { dottedPhone, phoneHref, propertyDescription } from '@/lib/cma/render-blocks'
import type { CmaBroker, CmaClient } from '@/lib/cma/types'
import type { DevelopmentOpportunities } from '@/lib/cma/development'
import { productClass } from '@/lib/cma/market-area'
import { describeCompSearch } from '@/lib/pricing/search-story'
import { sellerNetFromPrice } from '@/lib/pricing/seller-net'
import type { CmaExtras, CmaLegalFacts, CmaPermitFact, CmaSubjectPhotos } from '@/lib/cma/extras'
import type { CmaSiteData } from '@/lib/cma/county'
import type { SubdivisionStory } from '@/lib/cma/subdivision-story'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import type { CmaMarketArea, CmaSoldBand } from '@/lib/cma/market-status'
import { subjectSectionTitle } from '@/lib/cma/land-pricing'
import type { CmaParcelSet } from '@/lib/cma/parcel-shapes'
import { TAXLOT_DISCLAIMER } from '@/lib/data/geo/getTaxlots'
import { lotsDifferMaterially, renderParcelSilhouettesHtml, uniformLotLine } from '@/lib/cma/parcel-silhouettes'

const esc = escapeHtml

export type OpinionPageArgs = {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  extras?: CmaExtras | null
  subdivisionStory?: SubdivisionStory | null
  mapDataUri: string | null
  /** Deprecated for letter render (C9). Ignored — comps map is the single map. */
  subjectMapDataUri?: string | null
  tiersUsed?: string[]
  generatedAtIso: string
  /** Carried on render_args; nothing on the seller document prints it. */
  excludedOutliers?: Array<{ address: string; closePrice: number; ppsf: number; reason: string }>
  equity?: CmaEquityPosition | null
  expiredAudit?: ExpiredAuditData | null
  site?: CmaSiteData | null
  /** Recorded lot polygons for the subject and its comps. Null when unavailable. */
  parcels?: CmaParcelSet | null
  /**
   * Closing chapters moved onto the shared spine (P10), so the assembler needs
   * what they print. Optional so existing callers that only build the middle
   * chapters keep compiling.
   */
  broker?: CmaBroker | null
  client?: CmaClient | null
  development?: DevelopmentOpportunities | null
}

function kvTable(rows: Array<[string, string]>): string {
  if (rows.length === 0) return ''
  const body = rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')
  return `<table class="kv">${body}</table>`
}

function mlsField(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return formatClientMlsField(v)
  if (typeof v === 'object') {
    try {
      return formatClientMlsField(JSON.stringify(v))
    } catch {
      return null
    }
  }
  return formatClientMlsField(String(v))
}

function typeLabel(subType: string | null | undefined): string | null {
  const overlay = subType?.trim()
  const c = productClass(overlay ?? null)
  if (c === 'detached') return 'Detached house'
  if (c === 'attached') return 'Attached'
  if (c === 'manufactured') return 'Manufactured'
  if (c === 'leased-land') return 'Leased land'
  if (c === 'coop') return 'Cooperative'
  return overlay ? overlay : null
}

function floodLine(flood: CmaLegalFacts['flood'] | undefined): string | null {
  if (!flood?.zone) return null
  if (flood.inSFHA === true) return `Zone ${flood.zone}. Special Flood Hazard Area.`
  if (flood.inSFHA === false) return `Zone ${flood.zone}. Not a Special Flood Hazard Area.`
  return `Zone ${flood.zone}.`
}

function photoSets(a: OpinionPageArgs): CmaSubjectPhotos {
  const fromExtras = a.extras?.photos
  if (fromExtras && (fromExtras.current.length > 0 || fromExtras.historical.length > 0)) {
    return fromExtras
  }
  const current = a.subject.photoUrl?.trim() ? [a.subject.photoUrl] : []
  return { current, historical: [] }
}

function photoGrid(urls: string[], leadAlt: string): string {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))]
  if (unique.length === 0) return ''
  const tiles = unique
    .map((src, i) => {
      const url = sparkPhotoAt(src, '1024x768') ?? src
      const lead = i === 0 ? ' photo-lead' : ''
      const eager = i < 4 ? 'eager' : 'lazy'
      return `<figure class="photo-tile${lead}"><img src="${esc(url)}" alt="${i === 0 ? esc(leadAlt) : 'Listing photo'}" loading="${eager}" referrerpolicy="no-referrer"/></figure>`
    })
    .join('')
  return `<div class="photo-set">${tiles}</div>`
}

function sold90Band(a: OpinionPageArgs): CmaSoldBand | null {
  return a.extras?.sold90 ?? a.extras?.marketArea?.sold90 ?? null
}

export function snapshotPage(a: OpinionPageArgs): CmaPageDef {
  const s = a.subject
  const overlay = a.extras?.propertyFacts
  const baths =
    s.baths == null
      ? null
      : s.baths === 1
        ? '1 bath'
        : `${dec(s.baths, s.baths % 1 !== 0 ? 1 : 0)} baths`
  const type = overlay?.propertyType?.trim() || typeLabel(s.propertySubType)
  const stories = overlay?.stories?.trim() || mlsField(s.levelsRaw)
  const rows: Array<[string, string]> = []
  if (type) rows.push(['Type', type])
  if (s.beds != null) rows.push(['Beds', String(s.beds)])
  if (baths) rows.push(['Baths', baths])
  if (s.sqft != null) rows.push(['Living area', `${int(s.sqft)} sq ft`])
  if (s.lotAcres != null) rows.push(['Lot', `${dec(s.lotAcres, 2)} acres`])
  if (s.yearBuilt != null) rows.push(['Year built', String(s.yearBuilt)])
  if (s.garageSpaces != null) rows.push(['Garage', `${int(s.garageSpaces)} spaces`])
  if (stories) rows.push(['Stories', stories])
  if (overlay?.fireplaces != null) rows.push(['Fireplaces', int(overlay.fireplaces)])
  if (s.standardStatus?.trim()) rows.push(['Status', s.standardStatus.trim()])
  const parcelAcres = a.parcels?.subject.acres ?? a.site?.parcelAcres ?? null
  if (parcelAcres != null) {
    const mls = s.lotAcres ?? null
    const differs =
      mls != null && mls > 0 && Math.abs(mls - parcelAcres) / Math.min(mls, parcelAcres) > 0.1
    if (differs) {
      rows.push([
        'Lot, county record',
        `${dec(parcelAcres, 2)} acres — the county record and the MLS listing disagree on this lot`,
      ])
    }
  }
  const L = a.extras?.legal
  const site = a.site
  const parcel = L?.parcel?.trim() || site?.taxAccount?.trim() || null
  const taxlot = L?.taxlot?.trim() || site?.taxlot?.trim() || null
  const owner = L?.owner?.trim() || null
  const timeOwned = L?.timeOwned?.trim() || null
  const vesting = L?.vesting?.trim() || null
  const flood = floodLine(L?.flood ?? site?.flood)
  if (parcel) rows.push(['Parcel', parcel])
  if (taxlot) rows.push(['Taxlot', taxlot])
  if (owner) rows.push(['Owner', owner])
  if (timeOwned) rows.push(['Time owned', timeOwned])
  if (vesting) rows.push(['Vesting', vesting])
  if (flood) rows.push(['Flood', flood])
  const history = s.listingHistoryLine?.trim()
    ? `<p>${esc(s.listingHistoryLine.trim())}</p>`
    : ''
  // P6: when the drawn-lot chapter is dropped because every lot is the same
  // lot, the fact it would have shown lands here as one sentence.
  const uniformLots =
    a.parcels && !lotsDifferMaterially(a.parcels) ? uniformLotLine(a.parcels) : ''
  const sectionTitle = subjectSectionTitle(s)
  // C9: letter keeps at most one map — the comps pin map on the pricing page.
  // Subject-only maps do not render here even when subjectMapDataUri is still stamped.
  return {
    meta: `${esc(s.streetAddress)} · ${sectionTitle}`,
    toc: sectionTitle,
    body: `
  <h2 class="section">${sectionTitle}</h2>
  ${kvTable(rows)}
  ${history}
  ${uniformLots ? `<p>${esc(uniformLots)}</p>` : ''}`,
  }
}

export function factsPage(a: OpinionPageArgs): CmaPageDef {
  const s = a.subject
  const overlay = a.extras?.propertyFacts
  const type = overlay?.propertyType?.trim() || typeLabel(s.propertySubType)
  const stories = overlay?.stories?.trim() || mlsField(s.levelsRaw)
  const baths =
    s.baths == null ? null : dec(s.baths, s.baths % 1 !== 0 ? 1 : 0)
  const rows: Array<[string, string]> = []
  if (type) rows.push(['Type', type])
  if (s.propertySubType?.trim()) rows.push(['Subtype', s.propertySubType.trim()])
  if (baths) rows.push(['Baths', baths])
  if (s.garageSpaces != null) rows.push(['Garage', `${int(s.garageSpaces)} spaces`])
  if (stories) rows.push(['Stories', stories])
  if (overlay?.fireplaces != null) rows.push(['Fireplaces', int(overlay.fireplaces)])
  if (s.lotAcres != null) rows.push(['Lot', `${dec(s.lotAcres, 2)} acres`])
  // The county's own acreage, measured off the recorded polygon, printed as its
  // own figure rather than folded into the MLS one. When the two disagree the
  // row says so: a broker pricing on land has to see that the records differ,
  // and nothing here picks a winner (CLAUDE.md §0).
  const parcelAcres = a.parcels?.subject.acres ?? a.site?.parcelAcres ?? null
  if (parcelAcres != null) {
    const mls = s.lotAcres ?? null
    const differs =
      mls != null && mls > 0 && Math.abs(mls - parcelAcres) / Math.min(mls, parcelAcres) > 0.1
    rows.push([
      'Lot, county record',
      `${dec(parcelAcres, 2)} acres${differs ? ' — the county record and the MLS listing disagree on this lot' : ''}`,
    ])
  }
  return {
    meta: `${esc(s.streetAddress)} · Property facts`,
    toc: 'Property facts',
    body: `
  <h2 class="section">Property facts</h2>
  ${kvTable(rows)}`,
  }
}

export function legalPage(a: OpinionPageArgs): CmaPageDef | null {
  const L = a.extras?.legal
  const site = a.site
  const parcel = L?.parcel?.trim() || site?.taxAccount?.trim() || null
  const taxlot = L?.taxlot?.trim() || site?.taxlot?.trim() || null
  const owner = L?.owner?.trim() || null
  const timeOwned = L?.timeOwned?.trim() || null
  const vesting = L?.vesting?.trim() || null
  const flood = floodLine(L?.flood ?? site?.flood)
  const rows: Array<[string, string]> = []
  if (parcel) rows.push(['Parcel', parcel])
  if (taxlot) rows.push(['Taxlot', taxlot])
  if (owner) rows.push(['Owner', owner])
  if (timeOwned) rows.push(['Time owned', timeOwned])
  if (vesting) rows.push(['Vesting', vesting])
  if (flood) rows.push(['Flood', flood])
  if (rows.length === 0) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Legal, owner, and flood`,
    toc: 'Legal, owner, and flood',
    body: `
  <h2 class="section">Legal, owner, and flood</h2>
  ${kvTable(rows)}`,
  }
}

export function photosPage(a: OpinionPageArgs): CmaPageDef | null {
  const sets = photoSets(a)
  const current = photoGrid(sets.current, a.subject.streetAddress)
  const historical = photoGrid(sets.historical, `Earlier photo of ${a.subject.streetAddress}`)
  if (!current && !historical) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Photos`,
    toc: 'Photos',
    body: `
  <h2 class="section">Photos</h2>
  ${current ? `<h3 class="subhead">Current listing</h3>${current}` : ''}
  ${historical ? `<h3 class="subhead">Earlier listings</h3>${historical}` : ''}`,
  }
}

export function statusGridPage(a: OpinionPageArgs): CmaPageDef | null {
  const area = a.extras?.marketArea
  const html = renderStatusGridHtml(area, a.subject.city)
  const label = clientAreaLabel(area?.label, a.subject.city)
  if (!html || !area || !label) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Status in this market`,
    toc: 'Status in this market',
    body: `
  <h2 class="section">Status in this market</h2>
  <p>${esc(label)}.</p>
  ${html}`,
  }
}

export function sold90Page(a: OpinionPageArgs): CmaPageDef | null {
  const band = sold90Band(a)
  if (!band || band.count < 3) return null
  const rec = a.pricing.recommended
  if (rec > 0 && band.median != null && band.median > 0) {
    const ratio = band.median / rec
    if (ratio > 1.2 || ratio < 1 / 1.2) return null
  }
  const html = renderSold90Html({ sold90: band } as CmaMarketArea, a.subject.city)
  if (!html) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · 90-day solds`,
    toc: 'Last 90 days',
    body: `
  <h2 class="section">What ${esc(band.bedsLabel)} homes sold for</h2>
  ${html}`,
  }
}

export function marketKpiPage(a: OpinionPageArgs): CmaPageDef | null {
  const html = renderInventoryBoardHtml(a.market)
  if (!html || !a.market) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · How fast this market is moving`,
    toc: 'How fast this market is moving',
    body: `
  <h2 class="section">How fast this market is moving</h2>
  ${html}`,
  }
}

export function permitsPage(a: OpinionPageArgs): CmaPageDef | null {
  const permits: CmaPermitFact[] = a.extras?.permits?.length
    ? a.extras.permits
    : a.site?.permits ?? []
  const ownership = a.extras?.ownershipHistory ?? []
  if (permits.length === 0 && ownership.length === 0) return null
  const permitRows = permits.map((p) => {
    const bits = [p.type, p.permit, p.status].filter((v): v is string => Boolean(v && String(v).trim()))
    return `<li>${esc(bits.join(' · '))}</li>`
  })
  const ownRows = ownership.map((o) => {
    const bits = [
      dateLong(o.date),
      o.event?.trim() || null,
      o.owner?.trim() || null,
      o.price != null && o.price > 0 ? usd(o.price) : null,
    ].filter((v): v is string => Boolean(v))
    return `<li>${esc(bits.join(' · '))}</li>`
  })
  return {
    meta: `${esc(a.subject.streetAddress)} · Permits and ownership`,
    toc: 'Permits and ownership',
    body: `
  <h2 class="section">Permits and ownership</h2>
  ${permitRows.length ? `<h3 class="subhead">Permits of record</h3><ul class="note-list">${permitRows.join('')}</ul>` : ''}
  ${ownRows.length ? `<h3 class="subhead">Ownership history</h3><ul class="note-list">${ownRows.join('')}</ul>` : ''}`,
  }
}

export function sellerNetPage(a: OpinionPageArgs): CmaPageDef | null {
  const n = a.pricing.sellerNet
  if (!n || n.expectedConcessions == null) return null
  const concession = n.expectedConcessions
  const low = sellerNetFromPrice(a.pricing.conservative, concession)
  const rec = sellerNetFromPrice(a.pricing.recommended, concession)
  const high = sellerNetFromPrice(a.pricing.highEnd, concession)
  if (low == null && rec == null && high == null) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Seller net at list`,
    toc: 'Seller net at list',
    body: `
  <h2 class="section">Seller net at list</h2>
  <p>Net at list is list minus ${usd(concession)}, before commission and closing costs. That concession is the median of the sales that set this price, including sales that reported none.</p>
  <div class="stat-strip is-3">
    ${low != null ? `<div class="stat"><div class="lbl">Net at list low</div><div class="val">${usd(low)}</div></div>` : ''}
    ${rec != null ? `<div class="stat"><div class="lbl">Net at recommended list</div><div class="val">${usd(rec)}</div></div>` : ''}
    ${high != null ? `<div class="stat"><div class="lbl">Net at list high</div><div class="val">${usd(high)}</div></div>` : ''}
  </div>
  <div class="stat-strip is-3">
    <div class="stat"><div class="lbl">List low</div><div class="val">${usd(a.pricing.conservative)}</div></div>
    <div class="stat"><div class="lbl">Recommended list</div><div class="val">${usd(a.pricing.recommended)}</div></div>
    <div class="stat"><div class="lbl">List high</div><div class="val">${usd(a.pricing.highEnd)}</div></div>
  </div>
  ${n.knownCount > 0 ? `<p class="small">${n.givenCount} of ${n.knownCount} sales that set this price reported a concession${n.medianWhenGiven != null ? `, median ${usd(n.medianWhenGiven)} when given` : ''}.</p>` : ''}`,
  }
}

function chartUsd(n: number): string {
  return `$${Math.round(n / 1000)}K`
}

function subdivisionYearChartSvg(
  years: readonly { year: number; count: number; medianClose: number }[],
): string {
  const plot = buildLinePlot([
    {
      name: 'Median close',
      points: years
        .filter((y) => y.year > 0 && y.medianClose > 0)
        .map((y) => ({
          value: y.medianClose,
          tick: String(y.year),
          label: chartUsd(y.medianClose),
          at: y.year,
        })),
    },
  ])
  if (!plot) return ''
  return renderPrintChartSvg(plot, {
    caption: 'Median close by year',
    colors: PRINT_NAVY_CREAM,
    kicker: 'Median close',
  })
}

/**
 * When to list. Median days to pending by close month, over the years the
 * market actually covers.
 *
 * This chapter was computed and then never drawn: buildCmaExtras() has always
 * returned `seasonality`, but the price-opinion-spine refactor (9a73b6f1) took
 * out the only renderer and nothing replaced it. Nothing else in the document
 * answers a seller asking when to go on the market.
 */
export function seasonalityPage(a: OpinionPageArgs): CmaPageDef | null {
  const x = a.extras?.seasonality
  // Two months of bars is not a season. Say nothing rather than imply a shape.
  if (!x || x.byMonth.filter((m) => m.medianDaysToPending != null).length < 6) return null
  const svg = seasonalityChartSvg(x)
  if (!svg) return null
  const fastest = x.fastestMonths.length ? x.fastestMonths.join(' and ') : null
  const city = a.subject.city.trim() || 'this city'
  const heading = `When homes in ${city} sell fastest`
  return {
    meta: `${esc(a.subject.streetAddress)} · ${esc(heading)}`,
    toc: heading,
    body: `
  <h2 class="section">${esc(heading)}</h2>
  <p>Median days from list to under contract, by the month a sale closed, across ${esc(String(x.yearsCovered))} years and ${esc(int(x.totalClosed))} closed sales in ${esc(city)}.${
    fastest ? ` The shortest waits land in ${esc(fastest)}.` : ''
  }</p>
  <div class="szn is-hero" data-anim="chart">${svg}</div>
  <p class="small">${esc(clientSourceLine(x.source, `Closed single-family sales in ${a.subject.city}, grouped by close month.`, {
      city: a.subject.city,
    }))}</p>`,
  }
}

/**
 * Annual closed volume for this market. `market.yearMart` has always been
 * computed (getCmaMarketBoardYear) and is already cited in citations.json as
 * `year_volume`, but the only renderer lived in the market page the
 * price-opinion-spine refactor orphaned, so the figure was gathered, cited, and
 * never shown.
 *
 * Only the year mart moved here. The rest of that page — a market verdict and a
 * median-close-by-month chart — is what marketKpiPage already draws from the
 * same CmaMarketContext, and a second verdict computed a second way is exactly
 * the divergence CLAUDE.md §0 forbids in a client valuation document.
 */
export function marketVolumePage(_a: OpinionPageArgs): CmaPageDef | null {
  return null
}

export function outcomesPage(a: OpinionPageArgs): CmaPageDef | null {
  // On an expired document the ruler leads the "Your last listing" chapter
  // instead (P2) — the seller's own failed ask is the reading, so the chart
  // belongs beside it, not two chapters later.
  const chart = bandChapterShowsRuler(a)
    ? renderBandOutcomesHtml(a.extras?.marketArea?.outcomes, a.comps, a.subject.city)
    : ''
  const peers = renderExpiredPeersHtml(a.subject, a.extras?.marketArea?.expiredPeers)
  if (!chart && !peers) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Sold and unsold`,
    toc: 'Sold and unsold in this band',
    body: `
  <h2 class="section">Sold and unsold in this band</h2>
  ${chart || ''}
  ${peers || '<p>Homes like this in the same price band that came off without a sale.</p>'}`,
  }
}

const LENS_LABELS: Record<string, string> = {
  pricing: 'Price vs the comparable sales',
  'time-on-market': 'Time on market',
  'price-cuts': 'The price path',
  attempts: 'Listing attempts',
  presentation: 'Presentation',
}

/**
 * Your last listing. For an expired owner this is the WHY, so it sits directly
 * after the number and carries the price ruler with the seller's own failed ask
 * marked on it, plus the failed-then-sold backtest (P2).
 */
export function lastListingPage(a: OpinionPageArgs): CmaPageDef | null {
  const ea = a.expiredAudit
  if (!ea || ea.findings.length === 0) return null
  const ruler = renderBandOutcomesHtml(a.extras?.marketArea?.outcomes, a.comps, a.subject.city)
  const b = FAILED_ASK_BACKTEST
  const blocks = ea.findings
    .map((f) => {
      const meaning = sellerFacingFindingMeaning(f.meaning)
      return `
  <h3 class="subhead">${esc(LENS_LABELS[f.lens] ?? f.lens)}</h3>
  <p>${esc(f.fact)}</p>
  ${meaning ? `<p class="small">${esc(meaning)}</p>` : ''}`
    })
    .join('')
  return {
    meta: `${esc(a.subject.streetAddress)} · Your last listing`,
    toc: 'Your last listing',
    body: `
  <h2 class="section">Your last listing</h2>
  <p>Your home came off the market without selling.</p>
  ${ruler}
  <div class="stat-strip is-3">
    <div class="stat"><div class="val">${int(b.pairs)}</div><div class="lbl">Central Oregon homes failed to sell, then sold later, 2023 to 2026</div></div>
    <div class="stat"><div class="val">${(b.closeMedianRatio * 100).toFixed(1)}%</div><div class="lbl">of the failed ask is what the median one later sold for</div></div>
    <div class="stat"><div class="val">${b.shareClosedAboveAskPct}%</div><div class="lbl">later sold for more than the ask that failed</div></div>
  </div>
  ${blocks}`,
  }
}

/** How fast homes like yours went (P4). Replaces the month ledger. */
export function daysToOfferPage(a: OpinionPageArgs): CmaPageDef | null {
  const html = renderDaysToOfferHtml({ subject: a.subject, comps: a.comps, market: a.market })
  if (!html) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · How fast homes like yours went`,
    toc: 'How fast homes like yours went',
    body: `
  <h2 class="section">How fast homes like yours went</h2>
  ${html}`,
  }
}

/** This market. The 90-day band renders only when it is this house's product. */
export function thisMarketPage(a: OpinionPageArgs): CmaPageDef | null {
  const body = widerMarketBodyHtml(
    { subject: a.subject, comps: a.comps, market: a.market, extras: a.extras, pricing: a.pricing },
    'h3',
  )
  if (!body) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · This market`,
    toc: 'This market',
    body: `
  <h2 class="section">This market</h2>
  ${body}`,
  }
}

/** ORS 696 / OAR 863-015-0190 disclosure and signature. Both documents (P10). */
export function disclosurePage(a: OpinionPageArgs): CmaPageDef | null {
  const b = a.broker
  if (!b) return null
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const headshot = b.photoUrl ? (b.photoUrl.startsWith('http') ? b.photoUrl : `${site}${b.photoUrl}`) : null
  return {
    meta: `${esc(a.subject.streetAddress)} · Disclosure · ${esc(b.displayName)}`,
    toc: 'Disclosure and signature',
    body: `
  <h2 class="section">Disclosure</h2>
  ${cmaDisclosureProseHtml(a)}
  <div class="signature-page">
    ${headshot ? `<img class="portrait" src="${esc(headshot)}" alt="${esc(b.displayName)}" />` : '<div></div>'}
    <div class="sig-content">
      <div class="sig-name">${esc(b.displayName)}</div>
      <div class="sig-printed">${esc(b.displayName)}</div>
      <div class="sig-title">${esc(b.title)} · Ryan Realty · Prepared ${dateLong(a.generatedAtIso)}</div>
      <div class="sig-contact">
        ${b.phone ? `<strong>${phoneHref(b.phone) ? `<a href="tel:${phoneHref(b.phone)}">${esc(dottedPhone(b.phone) ?? b.phone)}</a>` : esc(dottedPhone(b.phone) ?? b.phone)}</strong><br/>` : ''}
        ${b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a><br/>` : ''}
        ryan-realty.com · Bend · Oregon
      </div>
      ${b.licenseNumber ? `<div class="sig-license">Oregon Real Estate License # ${esc(b.licenseNumber)}</div>` : ''}
    </div>
  </div>`,
  }
}

/** The disclosure paragraphs alone, so the immersive scene prints the same words. */
export function cmaDisclosureProseHtml(a: OpinionPageArgs): string {
  const b = a.broker
  const name = b?.displayName ?? 'the preparing broker'
  return `
  <p><strong>Purpose and intent.</strong> This document is a competitive market analysis prepared by a licensed Oregon real estate broker to assist the owner of ${esc(a.subject.streetAddress)}, ${esc(a.subject.city)}, Oregon in evaluating a potential listing price. It is provided in accordance with ORS chapter 696 and OAR 863-015-0190.</p>
  <p><strong>Property description.</strong> ${propertyDescription(a.subject)}</p>
  <p><strong>Basis for the value.</strong> The value range rests on ${a.comps.length} closed comparable sales from the Oregon Data Share MLS, adjusted for market conditions and size, and on verified market statistics for ${esc(a.market?.geoLabel ?? a.subject.city)}. The term value as used in this analysis means the estimated worth of or price for the property. It does not mean or imply a value arrived at by any method of appraisal.</p>
  ${a.development ? '<p><strong>Land use, rental, and code statements.</strong> Zoning, buildability, rental, and covenant statements in this report are preliminary reads of published code and recorded documents as of the verification dates shown beside them. They are not land-use decisions, permits, or legal opinions, and they should be confirmed with the agencies listed at the back of this report before anyone relies on them.</p>' : ''}
  <p><strong>Limiting conditions.</strong> Interior condition was not inspected. Figures are accurate as of the pull date on this report and market conditions change continuously. Seller-reported facts, where used, are labeled as such and should be independently confirmed.</p>
  <p><strong>Licensee interest.</strong> Neither ${esc(name)} nor Ryan Realty holds any existing or contemplated interest in the subject property. Any such interest, should one arise, will be disclosed in writing.</p>
  <p><strong>Not an appraisal.</strong> This competitive market analysis is not intended as an appraisal. If an appraisal is desired, the services of a competent professional licensed appraiser should be obtained. Unless the preparing licensee is also licensed by the Oregon Appraiser Certification and Licensure Board, this report is not intended to meet the requirements set out in the Uniform Standards of Professional Appraisal Practice. Equal Housing Opportunity.</p>`
}

/** What we would like them to do next. We, never I (VOICE.md). */
export function nextStepPage(a: OpinionPageArgs): CmaPageDef | null {
  const b = a.broker
  if (!b) return null
  const isAudit = Boolean(a.expiredAudit)
  const tel = phoneHref(b.phone)
  const first = esc(b.displayName.split(/\s+/)[0] ?? b.displayName)
  const onMarket = /active|pending|coming/i.test(a.subject.standardStatus ?? '')
  const lead = isAudit
    ? 'Sorry this listing did not sell. If you want a second look at the number, call or text.'
    : 'Call or text if you want to walk the comps.'
  const consultUrl = `https://ryan-realty.com/contact?utm_source=crm&utm_medium=doc&utm_campaign=${isAudit ? 'expired' : 'cma'}&utm_content=letter-next-step`
  return {
    meta: `${esc(a.subject.streetAddress)} · Your next step`,
    toc: 'Your next step',
    body: `
  <h2 class="section">Your next step</h2>
  <p class="cta-lead">${lead}</p>
  <div class="cta-actions">
    ${tel && b.phone ? `<a href="tel:${tel}" data-rr-track="cma-call">Call ${first} · ${esc(dottedPhone(b.phone) ?? b.phone)}</a>` : ''}
    ${tel ? `<a href="sms:${tel}" data-rr-track="cma-text">Text ${first}</a>` : ''}
    ${b.email ? `<a class="ghost" href="mailto:${esc(b.email)}" data-rr-track="cma-email">Email ${first}</a>` : ''}
    ${onMarket ? '' : `<a class="ghost" href="${consultUrl}" data-rr-track="cma-book">Book a conversation</a>`}
  </div>
  ${isAudit ? `<p class="cta-reply-note">Reply to the text that brought you here.</p>` : ''}`,
  }
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
      subject: {
        beds: a.subject.beds,
        baths: a.subject.baths,
        sqft: a.subject.sqft,
        yearBuilt: a.subject.yearBuilt,
        lotAcres: a.subject.lotAcres,
        recommendedList: a.pricing.recommended,
        latitude: a.subject.latitude,
        longitude: a.subject.longitude,
        photoUrl: a.subject.photoUrl,
        listingHistoryLine: a.subject.listingHistoryLine,
        daysOnMarket: daysOnMarketFrom({ onMarketDate: a.subject.lastListDate }),
      },
    }),
  }
}

/** @deprecated C1 — letter comps live once on pricingPage. Kept for tests that import the name. */
export function salesAndMapPage(a: OpinionPageArgs): CmaPageDef {
  const pinMap = renderCompPinMapHtml(a.subject, a.comps, a.mapDataUri)
  const story = describeCompSearch({ subdivision: a.subject.subdivision, tiersUsed: a.tiersUsed ?? [] })
  return {
    meta: `${esc(a.subject.streetAddress)} · The sales that set the number`,
    toc: 'The sales that set the number',
    body: `
  <h2 class="section">The sales that set the number</h2>
  <p>${esc(story.body)}</p>
  ${renderCompMatrixHtml(a.subject, a.comps)}
  ${pinMap ? `<h3 class="subhead">Where those sales are</h3><div class="pin-map-wrap">${pinMap}</div>${story.legend ? `<p>${esc(story.legend)}</p>` : ''}` : ''}`,
  }
}

/**
 * The land, drawn. The comp grid states a lot size in a cell; this puts the
 * recorded outlines beside each other at one scale, where a flag lot and a
 * square quarter acre stop looking like the same number.
 *
 * Returns null when there is nothing to compare — the section never appears as
 * an empty frame.
 */
export function lotLinesPage(a: OpinionPageArgs): CmaPageDef | null {
  // P6: six identical rectangles is not a chapter. When the lots do not
  // differ the fact prints as one sentence in Home location instead.
  if (!lotsDifferMaterially(a.parcels ?? null)) return null
  const strip = renderParcelSilhouettesHtml(a.parcels ?? null)
  if (!strip) return null
  const taxlot = a.parcels?.subject.taxlot?.trim()
  return {
    meta: `${esc(a.subject.streetAddress)} · The land`,
    toc: 'The land',
    body: `
  <h2 class="section">The land</h2>
  ${strip}
  ${taxlot ? `<p class="fine">Subject tax lot ${esc(taxlot)}.</p>` : ''}
  <p class="fine">${esc(TAXLOT_DISCLAIMER)}</p>`,
  }
}

export function subdivisionChapterPage(a: OpinionPageArgs): CmaPageDef | null {
  const st = a.subdivisionStory
  if (!st) return null
  const f = st.facts
  // A chapter headed "N/A" shipped on 65365 Concorde: the MLS row carries no
  // subdivision and the story was built anyway. cleanText knows the whole
  // family of MLS placeholders (N/A, None, Unknown, "Not in a subdivision").
  const name = cleanText(f.name)
  if (!name) return null
  const yearRows = f.years
    .map(
      (y) =>
        `<tr><td>${y.year}</td><td>${int(y.count)}</td><td>${usd(y.medianClose)}</td><td>${y.medianPpsf != null ? usd(Math.round(y.medianPpsf)) : '—'}</td></tr>`,
    )
    .join('')
  // C3: letter keeps ≤2 labeled charts elsewhere; subdivision uses the year table only.
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
    meta: `${esc(a.subject.streetAddress)} · ${esc(name)}`,
    toc: `This subdivision, ${name}`,
    body: `
  <h2 class="section">${esc(name)}</h2>
  <p>${int(f.totalSales)} closed single-family sales in ${esc(name)}.</p>
  ${sections}
  <table class="comp-table">
    <thead><tr><th>Year</th><th>Sales</th><th>Median close</th><th>Median $/sqft</th></tr></thead>
    <tbody>${yearRows}</tbody>
  </table>
  ${notable ? `<h3 class="subhead">Recent sales, one line each</h3><ul class="note-list">${notable}</ul>` : ''}
  ${position ? `<p><strong>${position}</strong></p>` : ''}`,
  }
}

/**
 * ONE chapter order, walked by both documents (P10, Matt 2026-09-07).
 *
 * The letter builds a `CmaPageDef` per id and the immersive builds a scene per
 * the same id, from the same helpers and the same gates, so a chapter cannot
 * exist on one path and not the other, and cannot appear in a different place.
 * Anything that renders on only one path is a bug, not a variant.
 *
 * The order answers the seller's questions in the order they ask them:
 * what is it worth and why -> for an expired, why did mine not sell -> what
 * does it compete with at that price -> how fast will it go -> what next.
 */
export const OPINION_CHAPTER_ORDER = [
  'how-we-got-the-price',
  'your-last-listing',
  'sold-and-unsold',
  'competition',
  'how-fast',
  'this-market',
  'home-location',
  'the-land',
  'your-street',
  'permits',
  'seller-net',
  'disclosure',
  'next-step',
] as const

export type OpinionChapterId = (typeof OPINION_CHAPTER_ORDER)[number]

/** The expired chapter owns the ruler, so the band chapter does not repeat it. */
export function bandChapterShowsRuler(a: Pick<OpinionPageArgs, 'expiredAudit'>): boolean {
  return !a.expiredAudit
}

export function assembleOpinionPages(a: OpinionPageArgs): CmaPageDef[] {
  const build: Record<OpinionChapterId, () => CmaPageDef | null> = {
    'how-we-got-the-price': () =>
      pricingPage({
        subject: a.subject,
        comps: a.comps,
        market: a.market,
        pricing: a.pricing,
        tiersUsed: a.tiersUsed,
        mapDataUri: a.mapDataUri,
      }),
    'your-last-listing': () => lastListingPage(a),
    'sold-and-unsold': () => outcomesPage(a),
    competition: () => competitionPage(a),
    'how-fast': () => daysToOfferPage(a),
    'this-market': () => thisMarketPage(a),
    'home-location': () => snapshotPage(a),
    'the-land': () => lotLinesPage(a),
    'your-street': () => subdivisionChapterPage(a),
    permits: () => permitsPage(a),
    'seller-net': () => sellerNetPage(a),
    disclosure: () => disclosurePage(a),
    'next-step': () => nextStepPage(a),
  }
  const pages: CmaPageDef[] = []
  for (const id of OPINION_CHAPTER_ORDER) {
    const page = build[id]()
    if (page) pages.push(page)
  }
  return pages
}

export { clientSourceLine }
