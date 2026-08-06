/**
 * Deterministic CMA HTML renderer — multi-page letter-format document in the
 * canonical brutalist navy/cream editorial style. Self-contained: inline CSS,
 * absolute asset URLs, map embedded as a data URI. Print-friendly page breaks.
 *
 * Every figure printed here is computed by the same build from live Supabase
 * rows (CLAUDE.md §0). Copy is deterministic template text vetted against the
 * brand-voice banned list. The disclosure page carries the Oregon competitive
 * market analysis elements required by OAR 863-015-0190 under ORS ch. 696.
 *
 * The document is a LISTING-STRATEGY document, not a neutral appraisal: it
 * leads with the number a seller is deciding against, then the evidence, then
 * what the property can do that the comp grid does not price (Matt 2026-07-30).
 * Shared fact-section markup lives in lib/cma/render-blocks.ts so the CMA, the
 * expired audit, and the BPO all print the same property the same way.
 */

import { cmaStylesheet } from '@/lib/cma/render-css'
import {
  cleanText,
  collectHighlights,
  dateLong,
  dec,
  dottedPhone,
  escapeHtml,
  int,
  marketingHighlightsBlock,
  monthYear,
  phoneHref,
  propertyIntelligenceBlock,
  sparkPhotoAt,
  trimRemarks,
  usd,
  usdSigned,
  verifyResourcesBlock,
} from '@/lib/cma/render-blocks'
import type {
  CmaAdjustedComp,
  CmaBroker,
  CmaClient,
  CmaMarketContext,
  CmaPricing,
  CmaSubject,
} from '@/lib/cma/types'
import type { CmaExtras } from '@/lib/cma/extras'
import type { SubdivisionStory } from '@/lib/cma/subdivision-story'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ListingPlan } from '@/lib/cma/listing-plan'
import type { CmaSiteData } from '@/lib/cma/county'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import type { DevelopmentOpportunities } from '@/lib/cma/development'
import type { RentalPotential } from '@/lib/cma/rental-potential'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

// Re-exported so lib/bpo/render.ts keeps ONE import path for the shared blocks.
export {
  escapeHtml,
  sparkPhotoAt,
  propertyIntelligenceBlock,
  developmentItemsBlock,
  developmentResourcesBlock,
} from '@/lib/cma/render-blocks'

const esc = escapeHtml

export interface RenderCmaArgs {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  broker: CmaBroker
  client: CmaClient
  mapDataUri: string | null
  generatedAtIso: string
  subjectTrace: string
  compTrace: string[]
  excludedOutliers: Array<{ address: string; closePrice: number; ppsf: number; reason: string }>
  sellerImprovementsText?: string | null
  site?: CmaSiteData | null
  /** Present = the subject's last cycle failed; renders the last-listing review section. */
  expiredAudit?: ExpiredAuditData | null
  /** Zoning read, buildability answers, buyer options, HOA, marketing highlights. */
  development?: DevelopmentOpportunities | null
  /** Long / mid / short-term rental read for the same parcel. */
  rental?: RentalPotential | null
  /** Data-backed report extras: seasonality, band, subdivision, financing, photos. */
  extras?: CmaExtras | null
  /** The subdivision deep story: deterministic facts + grounded AI narrative. */
  subdivisionStory?: SubdivisionStory | null
  /** What they paid, and what the recommendation says it has done since. */
  equity?: CmaEquityPosition | null
  /** What we would do about this home, derived from its own measured gaps. */
  listingPlan?: ListingPlan | null
}

interface PageDef {
  meta: string
  body: string
  /** Contents-page label. Omitted = the page is not listed (flyer runs, etc.). */
  toc?: string
}

/** Header stays in the body (per-section). The footer does not: an absolute
 *  footer follows its box when a section spills, landing mid-document with the
 *  tail under it. It is a Chrome running mark now. See docs/PAGE_CONTRACT.md. */
function wrapPage(page: PageDef): string {
  return `
<section class="page">
  <header class="pg-header">
    <img src="${SITE_URL}/images/brand/logo-blue.png" alt="Ryan Realty" class="logo" />
    <div class="pg-meta">${page.meta}</div>
  </header>
  ${page.body}
</section>`
}

function heroForSubject(subject: CmaSubject): { src: string | null; caption: string } {
  const src = sparkPhotoAt(subject.photoUrl, '1024x768')
  if (src) {
    const when = monthYear(subject.lastListDate)
    return {
      src,
      caption: `Most recent MLS listing photo${when !== '—' ? ` (${when})` : ''} · MLS ${subject.mlsNumber ?? '—'}`,
    }
  }
  return { src: null, caption: 'No MLS photo on file for the subject.' }
}

function subjectStatStrip(subject: CmaSubject): string {
  return `
  <div class="stat-strip">
    <div class="stat"><div class="lbl">Beds</div><div class="val">${int(subject.beds)}</div></div>
    <div class="stat"><div class="lbl">Baths</div><div class="val">${dec(subject.baths, subject.baths != null && subject.baths % 1 !== 0 ? 1 : 0)}</div></div>
    <div class="stat"><div class="lbl">Living Sqft</div><div class="val">${int(subject.sqft)}</div></div>
    <div class="stat"><div class="lbl">Lot</div><div class="val">${subject.lotAcres != null ? `${dec(subject.lotAcres, 2)} ac` : '—'}</div></div>
    <div class="stat"><div class="lbl">Year Built</div><div class="val">${subject.yearBuilt ?? '—'}</div></div>
  </div>`
}

/**
 * Cover. The recommended list price is the single largest element on the page:
 * a seller reads this document to answer one question, and the answer used to
 * sit in the third sentence of a paragraph inside the value block.
 */
function coverPage(a: RenderCmaArgs): PageDef {
  const hero = heroForSubject(a.subject)
  const p = a.pricing
  // ONE document (Matt 2026-08-05): the expired review is a section, not a
  // different doc — the label never changes with it.
  const docLabel = 'Comparative Market Analysis'
  const clientLine = a.client.name ? `Prepared for ${esc(a.client.name)}` : docLabel
  return {
    meta: `${docLabel} · ${dateLong(a.generatedAtIso)}`,
    body: `
  <div class="cover-label">${clientLine}</div>
  <h1 class="cover-title">${esc(a.subject.streetAddress)}</h1>
  <div class="cover-sub">${esc(a.subject.city)}, Oregon ${esc(a.subject.postalCode ?? '')}${cleanText(a.subject.subdivision) ? ` · ${esc(cleanText(a.subject.subdivision)!)}` : ''}</div>
  ${hero.src ? `<img class="hero-photo" src="${esc(hero.src)}" alt="${esc(a.subject.streetAddress)}" />` : '<div class="hero-photo"></div>'}
  <div class="hero-caption">${esc(hero.caption)}</div>
  <div class="value-block">
    <div class="vb-top">
      <div>
        <div class="vb-label">Recommended list price</div>
        <p class="vb-price">${usd(p.recommended)}</p>
      </div>
      <div class="vb-pill">${esc(p.confidence)} confidence</div>
    </div>
    <div class="vb-range">Supported range ${usd(p.valueLow)} to ${usd(p.valueHigh)}</div>
    <div class="vb-detail">${a.comps.length} closed sales near the subject, each adjusted to today's market and to your home's size before reconciliation. ${esc(p.confidenceReason)}</div>
  </div>
  ${subjectStatStrip(a.subject)}
  <div class="presented-by">
    Presented by <strong>${esc(a.broker.displayName)}</strong> · ${esc(a.broker.title)} · Ryan Realty${a.broker.phone ? ` · ${esc(a.broker.phone)}` : ''}
  </div>`,
  }
}

/** Contents. Built from the assembled page list, so it can never drift. */
function contentsPage(rest: PageDef[], a: RenderCmaArgs): PageDef {
  const rows = rest
    .map((p, i) => ({ label: p.toc, page: i + 3 }))
    .filter((e): e is { label: string; page: number } => Boolean(e.label))
    .map((e) => `<li><span class="t">${esc(e.label)}</span><span class="d"></span><span class="p">${e.page}</span></li>`)
    .join('')
  return {
    meta: `${esc(a.subject.streetAddress)} · Contents`,
    body: `
  <h2 class="section">What Is In This Report</h2>
  <p>The recommendation is on the cover. Everything after it is the evidence behind that number, and what this property can do that a comparable-sales grid does not price.</p>
  <ol class="toc">${rows}</ol>`,
  }
}

function subjectPage(a: RenderCmaArgs): PageDef {
  const s = a.subject
  const facts: string[] = []
  facts.push(`${int(s.beds)} bedrooms · ${dec(s.baths, 0)} bathrooms · ${int(s.sqft)} sqft${s.mlsNumber ? ` (MLS ${esc(s.mlsNumber)})` : ''}`)
  if (s.lotAcres != null) facts.push(`${dec(s.lotAcres, 2)}-acre parcel${s.garageSpaces ? ` · ${int(s.garageSpaces)}-car garage` : ''}`)
  if (s.yearBuilt) facts.push(`Built ${s.yearBuilt}`)
  if (s.viewDescription) facts.push(`View: ${esc(s.viewDescription)}`)
  if (s.taxAnnual) facts.push(`Annual property tax ${usd(s.taxAnnual)}`)
  const remarks = trimRemarks(s.publicRemarks, 1100)
  const yoy = a.market?.yoyMedianPriceDeltaPct
  return {
    meta: `${esc(s.streetAddress)} · Subject Property`,
    toc: 'The property, on the record',
    body: `
  <h2 class="section">Subject Property</h2>
  <div class="two-col">
    <div>
      <h3 class="subhead">At a glance</h3>
      <p>${s.yearBuilt ? `${s.yearBuilt}-built home` : 'Home'}${s.lotAcres != null ? ` on ${dec(s.lotAcres, 2)} acres` : ''}${cleanText(s.subdivision) ? ` in the ${esc(cleanText(s.subdivision)!)} subdivision` : ''}, ${esc(s.city)}. ${s.listingHistoryLine ? esc(s.listingHistoryLine) : 'No prior MLS listing history on file.'}</p>
      <h3 class="subhead">Site and structure</h3>
      <ul class="note-list">${facts.map((f) => `<li>${f}</li>`).join('')}</ul>
      ${a.sellerImprovementsText ? `<h3 class="subhead">Seller-reported details</h3><p class="small">${esc(a.sellerImprovementsText)} (Seller-reported, confirm at listing.)</p>` : ''}
      ${propertyIntelligenceBlock(a.site)}
    </div>
    <div>
      <h3 class="subhead">How this analysis works</h3>
      <p>Every comparable sale in this report is a real closed transaction pulled from the Oregon Data Share MLS. Each comp is first normalized to today's market using the verified year-over-year price trend for ${esc(a.market?.geoLabel ?? s.city)}${yoy != null ? ` (${dec(yoy, 1)}% YoY)` : ''}, then adjusted for the size difference against your home. The reconciled result is checked against two independent pricing methods before a recommendation is made.</p>
      <p>The full adjustment ledger, the market context, and the data trace are all included, so every number in this document can be audited back to its source.</p>
    </div>
  </div>
  ${remarks ? `<h2 class="section" style="margin-top:20px;">Most Recent MLS Remarks</h2><p class="small" style="font-style:italic;">"${esc(remarks)}"</p><p class="small">Quoted from the property's most recent MLS listing. Descriptions are the listing agent's words, provided for record.</p>` : ''}`,
  }
}

function mapPage(a: RenderCmaArgs): PageDef | null {
  if (!a.mapDataUri) return null
  const keyItems = [
    `<div class="k"><span class="pin subject">S</span><div class="txt"><strong>Subject</strong><br/>${esc(a.subject.streetAddress)}</div></div>`,
    ...a.comps.map(
      (c, i) =>
        `<div class="k"><span class="pin">${i + 1}</span><div class="txt"><strong>${esc(c.address)}</strong><br/>${usd(c.closePrice)} · ${monthYear(c.closeDate)}${c.proximity ? ` · ${esc(c.proximity)}` : ''}</div></div>`,
    ),
  ]
  return {
    meta: `Comparable Sales Map · ${esc(a.subject.city)}`,
    toc: 'Where the comps sit',
    body: `
  <h2 class="section">Where the Comps Sit</h2>
  <p style="margin-bottom:14px;">Every comparable sale in this report on one map, with the subject marked S. Marker numbers match the comp order used throughout the report. Pin positions use each listing's recorded MLS coordinates, and each key line carries the straight-line distance and direction from the subject.</p>
  <img class="map-img" src="${a.mapDataUri}" alt="Comparable sales map" />
  <h3 class="subhead" style="margin-top:0;">Marker key</h3>
  <div class="map-key">${keyItems.join('')}</div>`,
  }
}

/** Sold price as a percentage of the last list price. Null when list is absent. */
function soldVsList(c: CmaAdjustedComp): string | null {
  if (!c.listPrice || c.listPrice <= 0) return null
  return `${dec((c.closePrice / c.listPrice) * 100, 1)}% of list`
}

function compCardsAndTablePage(a: RenderCmaArgs): PageDef {
  const s = a.subject
  const competing = a.comps.filter((c) => c.competingArea).length
  const cards = a.comps
    .slice(0, 8)
    .map((c, i) => {
      const ph = sparkPhotoAt(c.photoUrl, '640x480')
      const vsList = soldVsList(c)
      return `
    <div class="comp-card">
      <div class="ph-wrap">
        ${ph ? `<img class="ph" src="${esc(ph)}" alt="${esc(c.address)}" />` : '<div class="ph-missing">No MLS photo on file</div>'}
        <span class="num-chip">${i + 1}</span>
        ${c.proximity ? `<span class="prox-chip">${esc(c.proximity)}</span>` : ''}
      </div>
      <div class="body">
        <div class="addr">${esc(c.address)}</div>
        <div class="stats">${int(c.beds)} bd · ${dec(c.baths, 0)} ba · ${int(c.sqft)} sf${c.lotAcres != null ? ` · ${dec(c.lotAcres, 2)} ac` : ''}${c.yearBuilt ? ` · ${c.yearBuilt}` : ''}</div>
        <div class="price">${usd(c.closePrice)}</div>
        <div class="when">${monthYear(c.closeDate)}${vsList ? ` · ${esc(vsList)}` : ''}</div>
        ${c.competingArea ? `<div class="area-tag">Competing area · ${esc(c.competingArea)}</div>` : ''}
      </div>
    </div>`
    })
    .join('')

  const subjectPpsf = s.sqft ? a.pricing.recommended / s.sqft : null
  const rows = a.comps
    .map(
      (c, i) => `
    <tr>
      <td>${i + 1}. ${esc(c.address)}${c.proximity || c.competingArea ? `<div class="sub-cell">${c.proximity ? esc(c.proximity) : ''}${c.proximity && c.competingArea ? ' · ' : ''}${c.competingArea ? `competing area: ${esc(c.competingArea)}` : ''}</div>` : ''}</td>
      <td class="num">${dateLong(c.closeDate)}</td>
      <td class="num">${usd(c.listPrice)}</td>
      <td class="num">${usd(c.closePrice)}</td>
      <td class="num">${usd(Math.round(c.closePrice / c.sqft))}</td>
      <td class="num">${int(c.beds)}/${dec(c.baths, 0)}</td>
      <td class="num">${int(c.sqft)}</td>
      <td class="num">${c.lotAcres != null ? dec(c.lotAcres, 2) : '—'}</td>
      <td class="num">${c.yearBuilt ?? '—'}</td>
      <td class="num">${c.daysToOffer != null ? int(c.daysToOffer) : '—'} (${c.domTotal != null ? int(c.domTotal) : '—'})</td>
    </tr>`,
    )
    .join('')

  return {
    meta: `${esc(s.streetAddress)} · Comparable Sales`,
    toc: 'The comparable sales',
    body: `
  <h2 class="section">Comparable Closed Sales</h2>
  <p>${a.comps.length} closed single-family sales, selected for similarity to the subject in size, lot character, location, and recency. Each card carries the straight-line distance and direction from your home, which is the answer to why these sales and not others. ${competing > 0 ? `${competing} of them come from a competing market area and are labeled as such, per Fannie Mae B4-1.3-08.` : 'All of them sit in the subject\'s own market area.'} DTO is days to offer, the active-marketing read. DOM includes time under contract.</p>
  <div class="comp-grid">${cards}</div>
  <table class="comps">
    <thead>
      <tr><th>Property</th><th class="num">Closed</th><th class="num">List $</th><th class="num">Close $</th><th class="num">$/sqft</th><th class="num">Bd/Ba</th><th class="num">Sqft</th><th class="num">Lot ac</th><th class="num">Year</th><th class="num">DTO (DOM)</th></tr>
    </thead>
    <tbody>
      <tr class="subject">
        <td>Subject · ${esc(s.streetAddress)}</td>
        <td class="num">—</td>
        <td class="num">${usd(a.pricing.recommended)}</td>
        <td class="num">—</td>
        <td class="num">${subjectPpsf != null ? usd(Math.round(subjectPpsf)) : '—'}</td>
        <td class="num">${int(s.beds)}/${dec(s.baths, 0)}</td>
        <td class="num">${int(s.sqft)}</td>
        <td class="num">${s.lotAcres != null ? dec(s.lotAcres, 2) : '—'}</td>
        <td class="num">${s.yearBuilt ?? '—'}</td>
        <td class="num">—</td>
      </tr>
      ${rows}
    </tbody>
  </table>
  <p class="small" style="margin-top:8px;">The subject List $ column shows the recommended list price for context. An em dash marks a value that does not apply or is unavailable.</p>`,
  }
}

function adjustmentPage(a: RenderCmaArgs): PageDef {
  const yoy = a.market?.yoyMedianPriceDeltaPct
  const rows = a.comps
    .map(
      (c, i) => `
    <tr>
      <td>${i + 1}. ${esc(c.address)}</td>
      <td class="num">${usd(c.closePrice)}</td>
      <td class="num">${dec(c.monthsSinceClose, 0)} mo</td>
      <td class="num">${usdSigned(c.timeAdjustment)}</td>
      <td class="num">${usdSigned(c.sizeAdjustment)}</td>
      <td class="num"><strong>${usd(c.adjustedPrice)}</strong></td>
    </tr>`,
    )
    .join('')
  return {
    meta: `${esc(a.subject.streetAddress)} · Adjustment Grid`,
    toc: 'Every adjustment, line by line',
    body: `
  <h2 class="section">Per-Comp Adjustment Grid</h2>
  <p>Each comp is reconciled to the subject in two transparent steps. The market-conditions line normalizes the close price to today using the verified ${esc(a.market?.geoLabel ?? a.subject.city)} year-over-year trend${yoy != null ? ` of ${dec(yoy, 1)}%` : ''}. The size line adjusts for the sqft difference at half the comp's adjusted $/sqft rate, the standard appraisal convention for marginal square footage.</p>
  <table class="comps" style="font-size:9.5px;">
    <thead>
      <tr><th>Comp</th><th class="num">Close $</th><th class="num">Age</th><th class="num">Market conditions (time)</th><th class="num">Size ($/sqft)</th><th class="num">Adjusted $</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <h3 class="subhead" style="margin-top:14px;">What is not adjusted, and why</h3>
  <p class="small">Bedroom and bathroom counts, lot differences, and condition are shown on the comp table but carry no dollar adjustment in this report. Defensible values for those items require paired-sales evidence specific to each pairing. Where a comp differs meaningfully from the subject on those dimensions, it is weighted down in the reconciliation rather than adjusted with an unsupported number.</p>
  <div class="trace">
    <div class="t-hd">Weighting</div>
    Reconciliation weights favor comps closest to the subject in living area and closest in time. Weight = size proximity × recency, where size proximity = 1 ÷ (1 + |sqft difference| ÷ subject sqft) and recency = 1 ÷ (1 + months since close ÷ 12). Weights for this set: ${a.comps
      .map((c, i) => `#${i + 1} ${c.weight.toFixed(2)}`)
      .join(', ')}.
  </div>`,
  }
}

function compFlyerPage(a: RenderCmaArgs, comp: CmaAdjustedComp, index: number): PageDef {
  const hero = sparkPhotoAt(comp.photoUrl, '1024x768')
  const remarks = trimRemarks(comp.publicRemarks, 800)
  const ppsf = Math.round(comp.closePrice / comp.sqft)
  const vsList = soldVsList(comp)
  return {
    meta: `Comparable Sale ${index + 1} of ${a.comps.length} · ${esc(cleanText(comp.subdivision) ?? comp.city)}`,
    toc: index === 0 ? 'Comparable sale detail, one page each' : undefined,
    body: `
  <div class="flyer-badge">Closed ${monthYear(comp.closeDate)}${comp.daysToOffer != null ? ` · ${int(comp.daysToOffer)}d to offer` : ''} · ${esc(comp.selectionTier)} comp</div>
  <h1 class="flyer-title">${esc(comp.address)}</h1>
  <div class="flyer-sub">${esc(comp.city)}, Oregon${cleanText(comp.subdivision) ? ` · ${esc(cleanText(comp.subdivision)!)}` : ''}${comp.mlsNumber ? ` · MLS ${esc(comp.mlsNumber)}` : ''}${comp.proximity ? ` · ${esc(comp.proximity)} from the subject` : ''}</div>
  ${hero ? `<img class="flyer-hero" src="${esc(hero)}" alt="${esc(comp.address)}" />` : '<div class="flyer-hero is-empty">Photo not retained on the closed listing</div>'}
  <div class="flyer-stats">
    <div class="s"><div class="l">Beds</div><div class="v">${int(comp.beds)}</div></div>
    <div class="s"><div class="l">Baths</div><div class="v">${dec(comp.baths, 0)}</div></div>
    <div class="s"><div class="l">Sqft</div><div class="v">${int(comp.sqft)}</div></div>
    <div class="s"><div class="l">Lot</div><div class="v">${comp.lotAcres != null ? `${dec(comp.lotAcres, 2)} ac` : '—'}</div></div>
    <div class="s"><div class="l">Year</div><div class="v">${comp.yearBuilt ?? '—'}</div></div>
    <div class="s featured"><div class="l">Sold $/sqft</div><div class="v">${usd(ppsf)}</div></div>
  </div>
  ${remarks ? `<p class="flyer-desc">${esc(remarks)}</p>` : ''}
  <div class="flyer-features">
    <div class="f"><div class="fl">List Price</div><div class="fv">${usd(comp.listPrice)}</div></div>
    <div class="f"><div class="fl">Sold Price</div><div class="fv">${usd(comp.closePrice)}</div></div>
    <div class="f"><div class="fl">Sold vs List</div><div class="fv">${vsList ? esc(vsList) : '—'}</div></div>
    <div class="f"><div class="fl">Close Date</div><div class="fv">${dateLong(comp.closeDate)}</div></div>
    <div class="f"><div class="fl">Days on Market</div><div class="fv">${comp.daysToOffer != null ? `${int(comp.daysToOffer)} to offer` : '—'}${comp.domTotal != null ? ` · DOM ${int(comp.domTotal)}` : ''}</div></div>
    <div class="f"><div class="fl">Distance from Subject</div><div class="fv">${comp.proximity ? esc(comp.proximity) : '—'}</div></div>
    <div class="f"><div class="fl">View</div><div class="fv">${esc(cleanText(comp.viewDescription) ?? '—')}</div></div>
    <div class="f"><div class="fl">Adjusted to Subject</div><div class="fv">${usd(comp.adjustedPrice)}</div></div>
  </div>
  ${remarks ? '<p class="small">Description quoted from the MLS listing record.</p>' : ''}`,
  }
}

function marketPage(a: RenderCmaArgs): PageDef | null {
  const m = a.market
  if (!m) return null
  const verdictLabel =
    m.marketVerdict === 'seller' ? "Seller's market" : m.marketVerdict === 'buyer' ? "Buyer's market" : m.marketVerdict === 'balanced' ? 'Balanced market' : 'Not enough data'
  return {
    meta: `${esc(a.subject.streetAddress)} · Market Context`,
    toc: `${m.geoLabel} market conditions`,
    body: `
  <h2 class="section">Market Context · ${esc(m.geoLabel)}</h2>
  <p>Verified conditions for the subject's market, from the Ryan Realty market data cache. Closed-sale figures cover ${dateLong(m.periodStart)} to ${dateLong(m.periodEnd)}. Inventory is live as of ${dateLong(m.pulseUpdatedAt ?? m.computedAt)}.</p>
  <div class="stat-strip" style="grid-template-columns: repeat(4, 1fr);">
    <div class="stat"><div class="lbl">Months of Supply</div><div class="val">${m.monthsOfSupply != null ? dec(m.monthsOfSupply, 1) : '—'}</div></div>
    <div class="stat"><div class="lbl">Median Sale Price</div><div class="val">${usd(m.medianSalePrice)}</div></div>
    <div class="stat"><div class="lbl">Median DOM</div><div class="val">${m.medianDom != null ? `${int(m.medianDom)} days` : '—'}</div></div>
    <div class="stat"><div class="lbl">Sale-to-List</div><div class="val">${m.saleToListRatio != null ? `${dec(m.saleToListRatio * 100, 1)}%` : '—'}</div></div>
  </div>
  <div class="stat-strip" style="grid-template-columns: repeat(4, 1fr);">
    <div class="stat"><div class="lbl">Closed Sales (12 mo)</div><div class="val">${int(m.soldCount365)}</div></div>
    <div class="stat"><div class="lbl">Active Now</div><div class="val">${int(m.activeCount)}</div></div>
    <div class="stat"><div class="lbl">Median $/sqft</div><div class="val">${m.medianPpsf != null ? usd(Math.round(m.medianPpsf)) : '—'}</div></div>
    <div class="stat"><div class="lbl">YoY Median Price</div><div class="val">${m.yoyMedianPriceDeltaPct != null ? `${dec(m.yoyMedianPriceDeltaPct, 1)}%` : '—'}</div></div>
  </div>
  <h3 class="subhead">${esc(verdictLabel)}</h3>
  <p>${
    m.monthsOfSupply != null
      ? `${esc(m.geoLabel)} is carrying ${dec(m.monthsOfSupply, 1)} months of supply, with ${int(m.activeCount)} active single-family listings on the market right now against the recent pace of closed sales. The standard thresholds read 4 months or less as a seller's market, 4 to 6 as balanced, and 6 or more as a buyer's market.`
      : 'Live inventory was unavailable at build time, so no supply verdict is stated.'
  }</p>
  <p>${
    m.yoyMedianPriceDeltaPct != null
      ? `The median closed price is ${m.yoyMedianPriceDeltaPct >= 0 ? 'up' : 'down'} ${dec(Math.abs(m.yoyMedianPriceDeltaPct), 1)}% year over year. That trend rate is the market-conditions adjustment applied to every comp in the grid, so older sales are read at today's values rather than at their close-date values.`
      : 'No verified year-over-year trend was available for this market, so no time adjustment was applied to the comps. Recent comps are weighted more heavily instead.'
  }</p>
  <div class="trace">
    <div class="t-hd">Source</div>
    <code>market_stats_cache</code> geo <code>${esc(m.geoSlug)}</code>, period rolling_365d ending ${dateLong(m.periodEnd)}, methodology ${esc(m.methodologyVersion ?? '—')}, computed ${dateLong(m.computedAt)} · <code>market_pulse_live</code> active count as of ${dateLong(m.pulseUpdatedAt)}.
  </div>`,
  }
}

function pricingPage(a: RenderCmaArgs): PageDef {
  const p = a.pricing
  const s = a.subject
  return {
    meta: `${esc(s.streetAddress)} · Pricing Strategy`,
    toc: 'Pricing strategy and the three tiers',
    body: `
  <h2 class="section">Pricing Strategy</h2>
  <p>${p.method2 != null ? 'Three' : 'Two'} independent methods, one answer. ${p.converged ? 'The methods land within the 5% convergence tolerance, which is the math check.' : 'The methods land wider than the 5% tolerance, so the reconciliation method governs and the stated confidence is reduced.'}</p>
  <div class="tier-grid">
    <div class="tier">
      <div class="t-lbl">Conservative</div>
      <div class="t-val">${usd(p.conservative)}</div>
      <div class="t-note">Quick-sale entry. Use when a fast, certain close is the priority.</div>
    </div>
    <div class="tier featured">
      <div class="t-lbl">Recommended List</div>
      <div class="t-val">${usd(p.recommended)}</div>
      <div class="t-note">${p.priceOverride != null ? 'Broker-adjusted on review, anchored to the data-supported reconciliation.' : 'The reconciled value of the adjusted comp set. Leaves room to negotiate inside the supported range.'}</div>
    </div>
    <div class="tier">
      <div class="t-lbl">High End</div>
      <div class="t-val">${usd(p.highEnd)}</div>
      <div class="t-note">Ceiling of the supportable range with presentation and condition fully resolved.</div>
    </div>
  </div>
  <h3 class="subhead" style="margin-top:14px;">Method 1 · Tiered price per square foot</h3>
  <p>The comps' time-adjusted $/sqft rates span ${usd(Math.round(p.method1Low / (s.sqft || 1)))} to ${usd(Math.round(p.method1High / (s.sqft || 1)))} at the 25th to 75th percentile. Applied to the subject's ${int(s.sqft)} sqft that brackets ${usd(p.method1Low)} to ${usd(p.method1High)}, with the median rate landing at ${usd(p.method1Mid)}.</p>
  ${
    p.method2 != null
      ? `<h3 class="subhead">Method 2 · Size-matched baseline${p.improvementsValueAdd ? ' plus documented improvements' : ''}</h3>
  <p>The median adjusted price of the three comps closest to the subject in living area${p.improvementsValueAdd ? `, plus ${usd(p.improvementsValueAdd)} of credited improvement value from the seller's reported spend at a 65% recovery rate,` : ''} lands at ${usd(p.method2)}.</p>`
      : ''
  }
  <h3 class="subhead">Method ${p.method2 != null ? '3' : '2'} · Adjusted-comp reconciliation</h3>
  <p>The similarity-weighted average of every comp's fully adjusted price (time plus size, weights favoring the closest and most recent sales) lands at ${usd(p.method3)}. This method carries the market-conditions correction, so it anchors the recommendation.</p>
  ${p.notes.length > 0 ? `<h3 class="subhead">Method notes</h3><ul class="note-list">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
  <p class="small" style="margin-top:8px;">Confidence: <strong>${p.confidence}</strong>. ${esc(p.confidenceReason)}</p>
  <h3 class="subhead">Why this number holds up</h3>
  <ul class="note-list">${whyBullets(a).map((b) => `<li>${b}</li>`).join('')}</ul>`,
  }
}

/** The pricing argument, in the seller's terms. Each line is a printed figure. */
function whyBullets(a: RenderCmaArgs): string[] {
  const m = a.market
  const out = [
    `The recommendation sits on ${a.comps.length} verified closed sales, not on an automated estimate or a single anchor comp.`,
    `Every comp was normalized to today's market before comparison${m?.yoyMedianPriceDeltaPct != null ? `, using the verified ${dec(m.yoyMedianPriceDeltaPct, 1)}% year-over-year trend for ${esc(m.geoLabel)}` : ''}.`,
  ]
  if (m?.monthsOfSupply != null) out.push(`${esc(m.geoLabel)} is carrying ${dec(m.monthsOfSupply, 1)} months of supply. The tier grid reflects that reality rather than working against it.`)
  if (m?.medianDom != null) out.push(`The median ${esc(m.geoLabel)} sale is taking ${int(m.medianDom)} days. Pricing inside the supported range is what keeps a listing on the fast side of that number.`)
  out.push('Where a defensible dollar adjustment was not possible, the difference is disclosed and down-weighted instead of guessed.')
  return out
}

function rationalePage(a: RenderCmaArgs): PageDef {
  const traceLines = [a.subjectTrace, ...a.compTrace]
  const outliers = a.excludedOutliers
  return {
    meta: `${esc(a.subject.streetAddress)} · Verification Trace`,
    toc: 'Verification trace',
    body: `
  <h2 class="section">Verification Trace</h2>
  <p>Every figure in this report is auditable. Below is the exact query path that produced the subject record and the comparable set, printed so you or an appraiser can reproduce it.</p>
  <div class="trace">
    <div class="t-hd">Data sources (audit trail)</div>
    Every figure in this report traces to the Oregon Data Share MLS via the Ryan Realty data platform, pulled ${dateLong(a.generatedAtIso)}.<br/><br/>
    ${traceLines.map((t) => esc(t)).join('<br/>')}
  </div>
  ${outliers.length > 0 ? `<h3 class="subhead">Sales that were pulled and then excluded</h3><ul class="note-list">${outliers.map((o) => `<li>${esc(o.address)} (${usd(o.closePrice)}): ${esc(o.reason)}.</li>`).join('')}</ul>` : ''}`,
  }
}

// ── What the comp grid does not price ───────────────────────────────────────

/**
 * The sellable facts, high in the document and next to the pricing argument.
 * This is the answer to "what makes this property worth the top of the range",
 * and every line carries the record it came from.
 */
/**
 * "What we like about this home" (Matt 2026-08-05) — the warm read, assembled
 * ONLY from verified record facts (§0: nothing editorial is invented; every
 * bullet traces to a subject field or an already-gated highlight). Renders
 * only when at least two concrete things earn a mention.
 */
function whatWeLikePage(a: RenderCmaArgs): PageDef | null {
  const s = a.subject
  const items: Array<{ headline: string; detail: string | null }> = []
  const view = cleanText(s.viewDescription)
  if (view) items.push({ headline: `The view: ${view.replace(/\s*,\s*/g, ', ')}`, detail: 'From the MLS record for this parcel.' })
  if (s.lotAcres != null && s.lotAcres >= 0.5) {
    items.push({ headline: `${dec(s.lotAcres, 2)} acres of ground`, detail: 'Lot size from the county record on the listing.' })
  }
  if (s.garageSpaces != null && s.garageSpaces >= 3) {
    items.push({ headline: `${s.garageSpaces}-car garage`, detail: null })
  }
  if (s.yearBuilt != null && s.yearBuilt >= 2018) {
    items.push({ headline: `Built in ${s.yearBuilt}`, detail: 'Current-code construction: newer roof, systems, and envelope.' })
  }
  if (s.sqft != null && s.sqft >= 3000) {
    items.push({ headline: `${int(s.sqft)} square feet of living space`, detail: null })
  }
  if (s.beds != null && s.beds >= 4) {
    items.push({ headline: `${s.beds} bedrooms`, detail: null })
  }
  // Parcel-capability and rental highlights keep their own pages ("What We
  // Lead With") — mixing rule explainers into the warm read was wrong on the
  // first render. This section is the HOME's own attributes only.
  if (items.length < 2) return null
  const lis = items
    .slice(0, 6)
    .map((i) => `<li><strong>${esc(i.headline)}</strong>${i.detail ? `<div class="small">${esc(i.detail)}</div>` : ''}</li>`)
    .join('')
  return {
    meta: `${esc(a.subject.streetAddress)} · What We Like`,
    toc: 'What we like about this home',
    body: `
  <h2 class="section">What This Home Has</h2>
  <p>From the MLS and county record.</p>
  <ul class="note-list like-list">${lis}</ul>`,
  }
}

function highlightsPage(a: RenderCmaArgs): PageDef | null {
  const highlights = collectHighlights(a.development, a.rental)
  const block = marketingHighlightsBlock(highlights)
  if (!block) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · What We Lead With`,
    toc: 'What we lead with when we market it',
    body: `
  <h2 class="section">What We Lead With</h2>
  <p>A comparable-sales grid prices bedrooms, square feet, and a close date. It does not price what this parcel is allowed to become. Below is what this property can do that the comps cannot, each with the record behind it. This is what the listing copy, the photography brief, and the buyer conversations get built around.</p>
  ${block}`,
  }
}

/**
 * "What you can do with this property" (Matt 2026-08-05: summarize zoning +
 * rental to the basics). ONE page: the zone, each buildability answer as its
 * verdict-first one-liner, and each rental tenure the same way. The detail
 * paragraphs, requirement lists, income tables, and buyer-option spreads are
 * retired from the doc — the one-line headlines were already written to lead
 * with the capability, so this page IS the summary. The disclaimer + a single
 * verified-against line keep the §0 sourcing honest.
 */
function whatYouCanDoPage(a: RenderCmaArgs): PageDef | null {
  const dev = a.development
  const rental = a.rental
  const buildRows = (dev?.items ?? []).map(
    (i) => `<li><strong>${esc(i.topic)}:</strong> ${esc(i.headline)}</li>`,
  )
  const rentRows = (rental?.tenures ?? []).map(
    (t) => `<li><strong>${esc(t.tenure)} rental:</strong> ${esc(t.headline)}</li>`,
  )
  if (buildRows.length === 0 && rentRows.length === 0) return null
  const hoa = dev?.hoa
  const hoaLine =
    hoa?.hasAssociation === true
      ? `<p class="small">There is a homeowners association on record. Recorded covenants can be stricter than zoning, so the CC&amp;Rs get confirmed before any of the above is acted on.</p>`
      : ''
  const verified = [dev ? `${dev.jurisdiction} code, verified ${dev.verifiedAsOf}` : null, rental ? `rental rules for ${rental.jurisdiction}, verified ${rental.verifiedAsOf}` : null]
    .filter(Boolean)
    .join(' · ')
  return {
    meta: `${esc(a.subject.streetAddress)} · What You Can Do With It`,
    toc: 'What you can do with this property',
    body: `
  <h2 class="section">What You Can Do With This Property</h2>
  ${dev ? `<p>The parcel is zoned <strong>${esc(dev.zone)}</strong> in ${esc(dev.jurisdiction)}. In plain terms, here is what that allows.</p>` : ''}
  ${buildRows.length > 0 ? `<h3 class="subhead">Building and use</h3><ul class="note-list">${buildRows.join('')}</ul>` : ''}
  ${rentRows.length > 0 ? `<h3 class="subhead">Renting it out</h3><ul class="note-list">${rentRows.join('')}</ul>` : ''}
  ${hoaLine}
  ${verified ? `<p class="small">Sources: ${esc(verified)}.</p>` : ''}
  ${dev?.disclaimer ? `<p class="small">${esc(dev.disclaimer)}</p>` : rental?.disclaimer ? `<p class="small">${esc(rental.disclaimer)}</p>` : ''}`,
  }
}


// ── Report extras (Matt 2026-08-05): when-to-list + competition ────────────

function seasonalityChartSvg(x: NonNullable<CmaExtras['seasonality']>): string {
  const W = 720
  const H = 210
  const plotTop = 18
  const plotBottom = 168
  const barW = 40
  const gap = (W - 12 * barW) / 13
  const vals = x.byMonth.map((m) => m.medianDaysToPending).filter((v): v is number => v != null)
  const max = Math.max(...vals, 1)
  const fastest = new Set(x.fastestMonths)
  const bars = x.byMonth
    .map((m, i) => {
      const cx = gap + i * (barW + gap)
      const label = `<text x="${cx + barW / 2}" y="${plotBottom + 16}" text-anchor="middle" font-size="11" fill="#102742" opacity="0.75">${m.monthName.slice(0, 3)}</text>`
      if (m.medianDaysToPending == null) {
        return `${label}<text x="${cx + barW / 2}" y="${plotBottom - 6}" text-anchor="middle" font-size="10" fill="#102742" opacity="0.4">n/a</text>`
      }
      const h = Math.max(6, ((plotBottom - plotTop) * m.medianDaysToPending) / max)
      const y = plotBottom - h
      const hot = fastest.has(m.monthName)
      return `${label}
      <rect x="${cx}" y="${y}" width="${barW}" height="${h}" rx="4" fill="#102742" opacity="${hot ? '1' : '0.35'}"/>
      <text x="${cx + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="12" font-weight="600" fill="#102742">${Math.round(m.medianDaysToPending)}</text>`
    })
    .join('\n')
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Median days to pending by close month" style="width:100%;height:auto;display:block;">
    <line x1="0" y1="${plotBottom}" x2="${W}" y2="${plotBottom}" stroke="#102742" stroke-opacity="0.25" stroke-width="1"/>
    ${bars}
  </svg>`
}


// ── The subdivision story (Matt 2026-08-05: the homeowner's deep read) ─────

// ── What you own (the prior purchase and what it has done) ────────────────

// ── What we would do about it (the plan, from this home's own numbers) ────
function listingPlanPage(a: RenderCmaArgs): PageDef | null {
  const p = a.listingPlan
  if (!p) return null
  const rows = p.items
    .map(
      (i) =>
        `<li><strong>${esc(i.trigger)}</strong><div>${esc(i.action)}</div><div class="small">${esc(i.basis)}</div></li>`,
    )
    .join('')
  return {
    meta: `${esc(a.subject.streetAddress)} · What We Would Do`,
    toc: 'What we would do',
    body: `
  <h2 class="section">What We Would Do</h2>
  <p>Every line below comes from a number in this report, measured on your home.</p>
  <ul class="note-list">${rows}</ul>
  <div class="trace"><div class="t-hd">Source</div>${esc(p.source)}</div>`,
  }
}

function subdivisionStoryPage(a: RenderCmaArgs): PageDef | null {
  const st = a.subdivisionStory
  if (!st) return null
  const f = st.facts
  const yearRows = f.years
    .map(
      (y) =>
        `<tr><td>${y.year}</td><td>${int(y.count)}</td><td>${usd(y.medianClose)}</td><td>${y.medianPpsf != null ? usd(Math.round(y.medianPpsf)) : '—'}</td></tr>`,
    )
    .join('')
  const sections = st.sections
    .map((sec) => `<h3 class="subhead">${esc(sec.heading)}</h3><p>${esc(sec.body)}</p>`)
    .join('')
  const notable = st.notableSales
    .filter((n) => n.line)
    .map((n) => `<li><strong>${esc(n.address)}</strong> (${usd(n.closePrice)}, ${dateLong(n.closeDate)}): ${esc(n.line)}</li>`)
    .join('')
  const position = [
    f.subjectSqftPercentile != null ? `Your home is as large or larger than ${f.subjectSqftPercentile}% of everything that has sold here.` : null,
    f.vintageSpan ? `The street was built out ${f.vintageSpan.min} to ${f.vintageSpan.max}.` : null,
    f.recordHigh ? `The record is ${usd(f.recordHigh.price)} at ${esc(f.recordHigh.address)} (${dateLong(f.recordHigh.date)}).` : null,
    f.saleToListRecentPct != null ? `Over the last two years sellers here collected a median ${dec(f.saleToListRecentPct, 1)}% of their final asking price.` : null,
  ]
    .filter(Boolean)
    .join(' ')
  return {
    meta: `${esc(a.subject.streetAddress)} · The Story of ${esc(f.name)}`,
    toc: `The story of ${f.name}`,
    body: `
  <h2 class="section">The Story of ${esc(f.name)}</h2>
  <p>${int(f.totalSales)} closed single-family sales in ${esc(f.name)}, by year.</p>
  <table class="comp-table">
    <thead><tr><th>Year</th><th>Sales</th><th>Median close</th><th>Median $/sqft</th></tr></thead>
    <tbody>${yearRows}</tbody>
  </table>
  ${sections}
  ${notable ? `<h3 class="subhead">Recent sales, one line each</h3><ul class="note-list">${notable}</ul>` : ''}
  ${position ? `<p><strong>${position}</strong></p>` : ''}
  <div class="trace"><div class="t-hd">Source</div>${esc(f.source)}${st.model ? ` · Narrative written by ${esc(st.model)} from these rows, the listing remarks, and the hero photos of the ${st.photoSalesReviewed} most recent sales. Every number in it appears in the table above.` : ''}</div>`,
  }
}

function whenToListPage(a: RenderCmaArgs): PageDef | null {
  const x = a.extras?.seasonality
  if (!x) return null
  const byName = new Map(x.byMonth.map((m) => [m.monthName, m]))
  const fastRow = x.fastestMonths.map((n) => byName.get(n)).filter((m): m is NonNullable<typeof m> => m != null)
  const slowRow = x.slowestMonths.map((n) => byName.get(n)).filter((m): m is NonNullable<typeof m> => m != null)
  const fmtList = (ms: typeof fastRow) => ms.map((m) => `${m.monthName} (${Math.round(m.medianDaysToPending!)} days)`).join(' and ')
  return {
    meta: `${esc(a.subject.streetAddress)} · When to List`,
    toc: 'When to list',
    body: `
  <h2 class="section">When to List</h2>
  <p>${int(x.totalClosed)} single-family sales closed in ${esc(a.subject.city)} over the last ${dec(x.yearsCovered, 1)} years, grouped by close month. Each bar is the median days those homes took to go pending.</p>
  <div class="chart-block" data-anim="chart">${seasonalityChartSvg(x)}</div>
  <p>Fastest: ${fmtList(fastRow)}. Slowest: ${fmtList(slowRow)}. Months with fewer than 12 sales make no claim.</p>
  <div class="trace"><div class="t-hd">Source</div>${esc(x.source)}</div>`,
  }
}

function competitionPage(a: RenderCmaArgs): PageDef | null {
  const b = a.extras?.band
  const sub = a.extras?.subdivisionPulse
  const fin = a.extras?.financing
  const bench = a.extras?.photoBench
  if (!b && !sub && !fin && !bench) return null
  const blocks: string[] = []
  if (b) {
    blocks.push(`
  <h3 class="subhead">Your price band, live</h3>
  <p>${int(b.activeCount)} home${b.activeCount === 1 ? ' is' : 's are'} for sale in ${esc(a.subject.city)} between ${usd(b.lo)} and ${usd(b.hi)}${b.activeMedianAsk != null ? `, at a median ask of ${usd(Math.round(b.activeMedianAsk))}` : ''}${b.activeMedianDom != null ? `, listed a median of ${int(b.activeMedianDom)} days` : ''}. ${int(b.pendingCount)} more ${b.pendingCount === 1 ? 'is' : 'are'} pending in the same band.</p>
  <div class="stat-strip" style="grid-template-columns: repeat(3, 1fr);">
    <div class="stat"><div class="lbl">Active in Band</div><div class="val" data-count>${int(b.activeCount)}</div></div>
    <div class="stat"><div class="lbl">Pending in Band</div><div class="val" data-count>${int(b.pendingCount)}</div></div>
    <div class="stat"><div class="lbl">Median Days on Market</div><div class="val">${b.activeMedianDom != null ? `${int(b.activeMedianDom)} days` : '—'}</div></div>
  </div>
  <div class="trace"><div class="t-hd">Source</div>${esc(b.source)}</div>`)
  }
  if (sub) {
    blocks.push(`
  <h3 class="subhead">${esc(sub.name)}, the last ${int(sub.months)} months</h3>
  <p>${int(sub.closedCount)} home${sub.closedCount === 1 ? '' : 's'} in your subdivision closed in the last ${int(sub.months)} months, from ${usd(sub.low)} to ${usd(sub.high)}${sub.medianClose != null ? `, median ${usd(Math.round(sub.medianClose))}` : ''}.</p>
  <div class="trace"><div class="t-hd">Source</div>${esc(sub.source)}</div>`)
  }
  if (fin) {
    blocks.push(`
  <h3 class="subhead">Who is buying here</h3>
  <p>Of the ${int(fin.sampleCount)} ${esc(a.subject.city)} sales in the last 12 months that reported financing, ${dec(fin.cashPct, 1)}% closed in cash, ${dec(fin.conventionalPct, 1)}% with conventional loans, and ${dec(fin.fhaVaPct, 1)}% FHA or VA.</p>
  <div class="stat-strip" style="grid-template-columns: repeat(3, 1fr);">
    <div class="stat"><div class="lbl">Cash</div><div class="val">${dec(fin.cashPct, 1)}%</div></div>
    <div class="stat"><div class="lbl">Conventional</div><div class="val">${dec(fin.conventionalPct, 1)}%</div></div>
    <div class="stat"><div class="lbl">FHA / VA</div><div class="val">${dec(fin.fhaVaPct, 1)}%</div></div>
  </div>
  <div class="trace"><div class="t-hd">Source</div>${esc(fin.source)}</div>`)
  }
  if (bench) {
    blocks.push(`
  <h3 class="subhead">Presentation bench</h3>
  <p>The sold comps in this report marketed with a median of ${int(bench.compMedianPhotos)} photos. Your last listing carried ${int(bench.subjectPhotos)}.</p>
  <div class="trace"><div class="t-hd">Source</div>${esc(bench.source)}</div>`)
  }
  return {
    meta: `${esc(a.subject.streetAddress)} · Your Competition`,
    toc: 'Your competition right now',
    body: `
  <h2 class="section">Your Competition</h2>
  <p>What a buyer sees next to your home today.</p>
  ${blocks.join('\n')}`,
  }
}

function verifyPage(a: RenderCmaArgs): PageDef | null {
  const block = verifyResourcesBlock(a.development, a.rental)
  if (!block) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Verify It Yourself`,
    toc: 'Verify it yourself',
    body: `
  <h2 class="section">Verify It Yourself</h2>
  <p>Every land-use and rental answer in this report is a preliminary read of a published code, and every one of them is checkable by you at the source. Here is who holds each record and how to reach them.</p>
  ${block}`,
  }
}

// ── The last-listing review (history-driven, 2026-08-05 single-doc fold) ────
// Voice per VOICE.md + the expired-listing-lp SKILL: the data
// tells the story. No editorializing, no blame on the prior agent, no
// "most agents do X" framing. Every number here was verified by the engine.

const LENS_LABELS: Record<string, string> = {
  pricing: 'Price vs the comparable sales',
  'time-on-market': 'Time on market',
  'price-cuts': 'The price path',
  attempts: 'Listing attempts',
  presentation: 'Presentation',
}

function expiredAuditPage(a: RenderCmaArgs): PageDef | null {
  const ea = a.expiredAudit
  if (!ea || ea.findings.length === 0) return null
  const blocks = ea.findings
    .map(
      (f) => `
  <h3 class="subhead">${esc(LENS_LABELS[f.lens] ?? f.lens)}</h3>
  <p>${esc(f.fact)}</p>
  <p class="small">${esc(f.meaning)}</p>`,
    )
    .join('')
  return {
    meta: `${esc(a.subject.streetAddress)} · Your Last Listing`,
    toc: 'Your last listing, and our take',
    body: `
  <h2 class="section">Your Last Listing</h2>
  <p>Your home came off the market without selling. Before anything else, you deserve a straight answer about why. The numbers below come straight from the MLS record and the verified comparable sales in this report. Under each one is our take.</p>
  ${blocks}`,
  }
}

function nextStepPage(a: RenderCmaArgs): PageDef {
  const b = a.broker
  const isAudit = Boolean(a.expiredAudit)
  const tel = phoneHref(b.phone)
  const first = esc(b.displayName.split(/\s+/)[0] ?? b.displayName)
  // A subject that is ALREADY on the market is an existing listing client, not a
  // prospect: never invite them to imagine listing, and never ask them to book a
  // listing consultation. This document is the price conversation.
  const onMarket = /active|pending|coming/i.test(a.subject.standardStatus ?? '')
  const lead = isAudit
    ? `You have the full picture now. The price story, what the last listing left on the table, and the number the market supports today. When you are ready to talk it through, the fastest path is a call or a text. No pressure either way.`
    : onMarket
      ? `You have the full picture now. The recent sales, where they land against the current price, and what the market supports today. When you want to talk it through, the fastest path is a call or a text.`
      : `You have the full picture now. When you want to talk through the range, the timing, or what listing ${esc(a.subject.streetAddress)} would actually look like, the fastest path is a call or a text. No pressure either way.`
  // Pinned to the canonical production domain, NOT SITE_URL: the document is a
  // permanent artifact, and a local/preview build would otherwise bake a
  // vercel.app link (which redirects and strips params) into a client-facing doc.
  const consultUrl = `https://ryan-realty.com/contact?utm_source=crm&utm_medium=doc&utm_campaign=${isAudit ? 'expired' : 'cma'}`
  return {
    meta: `${esc(a.subject.streetAddress)} · Your Next Step`,
    toc: 'Your next step',
    body: `
  <h2 class="section">Your next step</h2>
  <p class="cta-lead">${lead}</p>
  <div class="cta-actions">
    ${tel && b.phone ? `<a href="tel:${tel}">Call ${first} · ${esc(dottedPhone(b.phone) ?? b.phone)}</a>` : ''}
    ${tel ? `<a href="sms:${tel}">Text ${first}</a>` : ''}
    ${b.email ? `<a class="ghost" href="mailto:${esc(b.email)}">Email ${first}</a>` : ''}
    ${onMarket ? '' : `<a class="ghost" href="${consultUrl}">Book the listing consultation</a>`}
  </div>
  ${isAudit ? `<p class="cta-reply-note">Or simply reply to the text that brought you here. It comes straight to ${first}'s phone.</p>` : ''}`,
  }
}
// The closing "Your next step" page no longer repeats a broker signature block —
// the single broker signature lives on the Disclosure page (the ORS/OAR
// certification). The broker is still named in the CTA buttons above.

function disclosurePage(a: RenderCmaArgs): PageDef {
  const b = a.broker
  const headshot = b.photoUrl ? (b.photoUrl.startsWith('http') ? b.photoUrl : `${SITE_URL}${b.photoUrl}`) : null
  return {
    meta: `${esc(a.subject.streetAddress)} · Disclosure · ${esc(b.displayName)}`,
    toc: 'Disclosure and signature',
    body: `
  <h2 class="section">Disclosure</h2>
  <p><strong>Purpose and intent.</strong> This document is a competitive market analysis prepared by a licensed Oregon real estate broker to assist the owner of ${esc(a.subject.streetAddress)}, ${esc(a.subject.city)}, Oregon in evaluating a potential listing price. It is provided in accordance with ORS chapter 696 and OAR 863-015-0190.</p>
  <p><strong>Property description.</strong> ${esc(a.subject.streetAddress)}, ${esc(a.subject.city)}, Oregon ${esc(a.subject.postalCode ?? '')} · ${int(a.subject.beds)} bedrooms · ${dec(a.subject.baths, 0)} bathrooms · ${int(a.subject.sqft)} sqft${a.subject.lotAcres != null ? ` · ${dec(a.subject.lotAcres, 2)} acres` : ''}${a.subject.yearBuilt ? ` · built ${a.subject.yearBuilt}` : ''}.</p>
  <p><strong>Basis for the value.</strong> The value range rests on ${a.comps.length} closed comparable sales from the Oregon Data Share MLS, adjusted for market conditions and size as shown in the adjustment grid, and on verified market statistics for ${esc(a.market?.geoLabel ?? a.subject.city)}. The term value as used in this analysis means the estimated worth of or price for the property. It does not mean or imply a value arrived at by any method of appraisal.</p>
  ${a.development ? '<p><strong>Land use, rental, and code statements.</strong> Zoning, buildability, rental, and covenant statements in this report are preliminary reads of published code and recorded documents as of the verification dates shown beside them. They are not land-use decisions, permits, or legal opinions, and they should be confirmed with the agencies listed at the back of this report before anyone relies on them.</p>' : ''}
  <p><strong>Limiting conditions.</strong> Interior condition was not inspected. Figures are accurate as of the pull date in the verification trace and market conditions change continuously. Seller-reported facts, where used, are labeled as such and should be independently confirmed.</p>
  <p><strong>Licensee interest.</strong> Neither ${esc(b.displayName)} nor Ryan Realty holds any existing or contemplated interest in the subject property. Any such interest, should one arise, will be disclosed in writing.</p>
  <p><strong>Not an appraisal.</strong> This competitive market analysis is not intended as an appraisal. If an appraisal is desired, the services of a competent professional licensed appraiser should be obtained. Unless the preparing licensee is also licensed by the Oregon Appraiser Certification and Licensure Board, this report is not intended to meet the requirements set out in the Uniform Standards of Professional Appraisal Practice. Equal Housing Opportunity.</p>
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

export function renderCmaHtml(a: RenderCmaArgs): { html: string; pageCount: number } {
  // Everything after the cover, in reading order: the property, the evidence
  // behind the number, then what the comp grid cannot price, then the
  // disclosure and the ask.
  const rest: PageDef[] = []
  rest.push(subjectPage(a))
  const likes = whatWeLikePage(a)
  if (likes) rest.push(likes)
  const map = mapPage(a)
  if (map) rest.push(map)
  rest.push(compCardsAndTablePage(a))
  rest.push(adjustmentPage(a))
  a.comps.forEach((c, i) => rest.push(compFlyerPage(a, c, i)))
  const market = marketPage(a)
  if (market) rest.push(market)
  const story = subdivisionStoryPage(a)
  if (story) rest.push(story)
  const whenToList = whenToListPage(a)
  if (whenToList) rest.push(whenToList)
  rest.push(pricingPage(a))
  const competition = competitionPage(a)
  if (competition) rest.push(competition)
  rest.push(rationalePage(a))
  // What the comp grid does not price: the sellable facts first, then the code
  // that backs them, then the ways a buyer can use the parcel.
  const highlights = highlightsPage(a)
  if (highlights) rest.push(highlights)
  const canDo = whatYouCanDoPage(a)
  if (canDo) rest.push(canDo)
  const plan = listingPlanPage(a)
  if (plan) rest.push(plan)
  const verify = verifyPage(a)
  if (verify) rest.push(verify)
  // Last-listing review (Matt 2026-08-05: ONE doc — the expired story is a
  // section; the old audit-only services + net-sheet pages are retired).
  const lastListing = expiredAuditPage(a)
  if (lastListing) rest.push(lastListing)
  rest.push(disclosurePage(a))
  // The ask comes LAST — the document must not end on disclaimers.
  rest.push(nextStepPage(a))

  const pages: PageDef[] = [coverPage(a), contentsPage(rest, a), ...rest]
  const body = pages.map((p) => wrapPage(p)).join('\n')
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="robots" content="noindex,nofollow" />
<title>CMA · ${esc(a.subject.streetAddress)} · ${esc(a.subject.city)}, OR ${esc(a.subject.postalCode ?? '')}</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Caveat:wght@500;600;700&display=swap" rel="stylesheet" />
<style>${cmaStylesheet(SITE_URL)}</style>
</head>
<body>
${body}
</body>
</html>`
  return { html, pageCount: pages.length }
}
