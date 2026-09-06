/**
 * Print chapters for the Sunstone seller CMA. Cover stays in render.ts.
 * Conditional pages omit when extras/site/pricing have nothing verified.
 */

import { buildLinePlot } from '@/lib/charts/plot'
import { PRINT_NAVY_CREAM, renderPrintChartSvg } from '@/lib/charts/print-svg'
import { renderBandRivalsHtml } from '@/lib/cma/band-rivals'
import { renderCompMatrixHtml } from '@/lib/cma/comp-matrix'
import { seasonalityChartSvg } from '@/lib/cma/seasonality-chart'
import { renderCompMapKeyHtml, renderCompStripHtml } from '@/lib/cma/comp-strip'
import { renderCompPinMapHtml } from '@/lib/cma/comp-pin-map'
import {
  dateLong,
  dec,
  escapeHtml,
  int,
  sparkPhotoAt,
  usd,
} from '@/lib/cma/render-blocks'
import { clientSourceLine, formatClientMlsField } from '@/lib/cma/client-facing'
import {
  renderBandOutcomesHtml,
  renderInventoryBoardHtml,
  renderListingTrendHtml,
  renderSold90Html,
  renderStatusGridHtml,
} from '@/lib/cma/market-area-chapters'
import { productClass } from '@/lib/cma/market-area'
import { describeCompSearch } from '@/lib/pricing/search-story'
import { sellerNetFromPrice } from '@/lib/pricing/seller-net'
import type { CmaExtras, CmaLegalFacts, CmaPermitFact, CmaSubjectPhotos } from '@/lib/cma/extras'
import type { CmaSiteData } from '@/lib/cma/county'
import type { SubdivisionStory } from '@/lib/cma/subdivision-story'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'
import { whyPage } from '@/lib/cma/render-why-page'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import { assembleCompFlyerPages } from '@/lib/cma/opinion-flyers'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import type { CmaMarketArea, CmaSoldBand } from '@/lib/cma/market-status'
import { subjectPossessive, subjectSectionTitle } from '@/lib/cma/land-pricing'
import type { CmaParcelSet } from '@/lib/cma/parcel-shapes'
import { TAXLOT_DISCLAIMER } from '@/lib/data/geo/getTaxlots'
import { renderParcelSilhouettesHtml } from '@/lib/cma/parcel-silhouettes'

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
  site?: CmaSiteData | null
  /** Recorded lot polygons for the subject and its comps. Null when unavailable. */
  parcels?: CmaParcelSet | null
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
  const aerial = a.mapDataUri
    ? `<img class="map-img" src="${esc(a.mapDataUri)}" alt="Map of ${esc(s.streetAddress)} and the sales that priced it" />`
    : ''
  const history = s.listingHistoryLine?.trim()
    ? `<p>${esc(s.listingHistoryLine.trim())}</p>`
    : ''
  const sectionTitle = subjectSectionTitle(s)
  return {
    meta: `${esc(s.streetAddress)} · ${sectionTitle}`,
    toc: sectionTitle,
    body: `
  <h2 class="section">${sectionTitle}</h2>
  ${aerial}
  ${kvTable(rows)}
  ${history}`,
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
  const html = renderStatusGridHtml(area)
  if (!html || !area) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Status in this market`,
    toc: 'Status in this market',
    body: `
  <h2 class="section">Status in this market</h2>
  <p>${esc(area.label)}.</p>
  ${html}`,
  }
}

export function sold90Page(a: OpinionPageArgs): CmaPageDef | null {
  const band = sold90Band(a)
  if (!band || band.count < 3) return null
  const html = renderSold90Html({ sold90: band } as CmaMarketArea)
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

export function trendChartsPage(a: OpinionPageArgs): CmaPageDef | null {
  const html = renderListingTrendHtml(a.extras?.marketArea)
  if (!html) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · New listings over time`,
    toc: 'New listings over time',
    body: `
  <h2 class="section">New listings and asking prices</h2>
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
  <p>Typical seller concessions in this set are ${usd(concession)}. Net at list is list minus that number, before commission and closing costs.</p>
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
  ${n.knownCount > 0 ? `<p class="small">${n.givenCount} of ${n.knownCount} comparable sales reported a concession${n.medianWhenGiven != null ? `, median ${usd(n.medianWhenGiven)} when given` : ''}.</p>` : ''}`,
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
  <p>Median days from list to pending, by the month a sale closed, across ${esc(String(x.yearsCovered))} years and ${esc(int(x.totalClosed))} closed sales in ${esc(city)}.${
    fastest ? ` The shortest waits land in ${esc(fastest)}.` : ''
  }</p>
  <div class="szn is-hero" data-anim="chart">${svg}</div>
  <p class="small">${esc(clientSourceLine(x.source, `Closed single-family sales in ${a.subject.city}, grouped by close month.`))}</p>`,
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
export function marketVolumePage(a: OpinionPageArgs): CmaPageDef | null {
  const y = a.market?.yearMart
  if (!y || y.source !== 'mart' || y.soldCount <= 0 || y.totalVolume <= 0) return null
  const geo = y.geoType === 'city' ? y.geoLabel : 'Central Oregon'
  return {
    meta: `${esc(a.subject.streetAddress)} · ${esc(geo)} closed sales, ${esc(String(y.year))}`,
    toc: `${geo} closed sales, ${y.year}`,
    body: `
  <h2 class="section">${esc(geo)} closed sales, ${esc(String(y.year))}</h2>
  <p>${esc(geo)} closed ${esc(usd(Math.round(y.totalVolume)))} across ${esc(int(y.soldCount))} sales, all property types.</p>
  <p class="small">Closed sales in ${esc(geo)} for ${esc(String(y.year))}, all property types, pulled ${esc(dateLong(y.computedAt))}.</p>`,
  }
}

export function outcomesPage(a: OpinionPageArgs): CmaPageDef | null {
  const html = renderBandOutcomesHtml(a.extras?.marketArea?.outcomes)
  if (!html) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Sold and unsold`,
    toc: 'Sold and unsold in this band',
    body: `
  <h2 class="section">Sold and unsold in this band</h2>
  ${html}`,
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
      },
    }),
  }
}

export function salesAndMapPage(a: OpinionPageArgs): CmaPageDef {
  const pinMap = renderCompPinMapHtml(a.subject, a.comps, a.mapDataUri)
  const story = describeCompSearch({ subdivision: a.subject.subdivision, tiersUsed: a.tiersUsed ?? [] })
  const strip = renderCompStripHtml(a.comps, subjectPossessive(a.subject))
  return {
    meta: `${esc(a.subject.streetAddress)} · The sales that set the number`,
    toc: 'The sales that set the number',
    body: `
  <h2 class="section">The sales that set the number</h2>
  <p>${esc(story.body)}</p>
  ${renderCompMatrixHtml(a.subject, a.comps)}
  ${pinMap ? `<h3 class="subhead">Comp map</h3><div class="pin-map-wrap">${pinMap}</div>${story.legend ? `<p>${esc(story.legend)}</p>` : ''}` : ''}
  ${pinMap ? `<h3 class="subhead">Marker key</h3>${renderCompMapKeyHtml(a.subject, a.comps)}` : ''}
  ${strip}`,
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
  rest.push(snapshotPage(a))
  const photos = photosPage(a)
  if (photos) rest.push(photos)
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
  const outcomes = outcomesPage(a)
  if (outcomes) rest.push(outcomes)
  const status = statusGridPage(a)
  if (status) rest.push(status)
  const sold90 = sold90Page(a)
  if (sold90) rest.push(sold90)
  const kpis = marketKpiPage(a)
  if (kpis) rest.push(kpis)
  const trends = trendChartsPage(a)
  if (trends) rest.push(trends)
  const seasonality = seasonalityPage(a)
  if (seasonality) rest.push(seasonality)
  const volume = marketVolumePage(a)
  if (volume) rest.push(volume)
  rest.push(salesAndMapPage(a))
  // Straight after the sales, while the comp numbers on the tiles still refer
  // to the grid the reader just read.
  const lotLines = lotLinesPage(a)
  if (lotLines) rest.push(lotLines)
  rest.push(...assembleCompFlyerPages(a.comps, subjectPossessive(a.subject)))
  const subdivision = subdivisionChapterPage(a)
  if (subdivision) rest.push(subdivision)
  const permits = permitsPage(a)
  if (permits) rest.push(permits)
  const net = sellerNetPage(a)
  if (net) rest.push(net)
  return rest
}

export { clientSourceLine }
