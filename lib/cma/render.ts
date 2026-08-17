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

import { buildLinePlot } from '@/lib/charts/plot'
import { PRINT_NAVY_CREAM, renderPrintChartSvg } from '@/lib/charts/print-svg'
import { seasonalityChartSvg } from '@/lib/cma/seasonality-chart'
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
import {
  clientPlaceClause,
  clientSourceLine,
  formatClientMlsField,
  whyThisListPrice,
} from '@/lib/cma/client-facing'
import type {
  CmaAdjustedComp,
  CmaBroker,
  CmaClient,
  CmaMarketContext,
  CmaPricing,
  CmaSubject,
} from '@/lib/cma/types'
import { displayConfidence, pricingRangeDisplay } from '@/lib/cma/pricing'
import type { CmaExtras } from '@/lib/cma/extras'
import type { SubdivisionStory } from '@/lib/cma/subdivision-story'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ListingPlan } from '@/lib/cma/listing-plan'
import type { CmaSiteData } from '@/lib/cma/county'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import { composeInboundCoverLine, resolveThisHomePlan } from '@/lib/cma/inbound-packet'
import type { DevelopmentOpportunities } from '@/lib/cma/development'
import type { RentalPotential } from '@/lib/cma/rental-potential'
import { propertyUsePage } from '@/lib/cma/render-use-of-property'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import { marketPage as marketBoardPage } from '@/lib/cma/render-market-page'
import { printMarketAreaPages } from '@/lib/cma/market-area-chapters'
import { whyPage } from '@/lib/cma/render-why-page'
import { renderCompMapKeyHtml, renderCompStripHtml } from '@/lib/cma/comp-strip'

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
  /** How we would market THIS address (list-kit hero). Not the /sell brochure. */
  thisHomePlan?: string[] | null
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
  const conf = displayConfidence(p)
  const range = pricingRangeDisplay(p)
  // ONE document (Matt 2026-08-05): the expired review is a section, not a
  // different doc — the label never changes with it.
  const docLabel = 'Comparative Market Analysis'
  const clientLine = a.client.name ? `Prepared for ${esc(a.client.name)}` : docLabel
  return {
    meta: `${docLabel} · ${dateLong(a.generatedAtIso)}`,
    body: `
  <div class="cover-label">${clientLine}</div>
  <h1 class="cover-title">${esc(a.subject.streetAddress)}</h1>
  <div class="cover-sub">${esc(a.subject.city)}, Oregon ${esc(a.subject.postalCode ?? '')}${cleanText(a.subject.subdivision) ? ` · ${esc(cleanText(a.subject.subdivision)!)}` : ''}<br/>${esc(composeInboundCoverLine(a.subject.streetAddress))}</div>
  ${hero.src ? `<img class="hero-photo" src="${esc(hero.src)}" alt="${esc(a.subject.streetAddress)}" />` : '<div class="hero-photo"></div>'}
  <div class="hero-caption">${esc(hero.caption)}</div>
  <div class="value-block">
    <div class="vb-top">
      <div>
        <div class="vb-label">Recommended list price</div>
        <p class="vb-price">${usd(p.recommended)}</p>
      </div>
      <div class="vb-pill">${esc(conf)} confidence</div>
    </div>
    <div class="vb-range">${esc(range.label)} ${usd(p.valueLow)} to ${usd(p.valueHigh)}</div>
    ${range.note ? `<div class="vb-detail">${esc(range.note)}</div>` : ''}
    <div class="vb-detail">${esc(whyThisListPrice(a).coverSentence)} ${a.comps.length} closed MLS sales, each adjusted for when it sold and how its size compares to yours. Automated estimates are not used.${a.market?.geoLabel ? ` The market read is ${esc(a.market.geoLabel)}, not the ZIP.` : ''}</div>
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
  <h2 class="section">Contents</h2>
  <ol class="toc">${rows}</ol>`,
  }
}

function subjectPage(a: RenderCmaArgs): PageDef {
  const s = a.subject
  const facts: string[] = []
  facts.push(`${int(s.beds)} bedrooms · ${dec(s.baths, 0)} bathrooms · ${int(s.sqft)} sqft${s.mlsNumber ? ` (MLS ${esc(s.mlsNumber)})` : ''}`)
  if (s.lotAcres != null) facts.push(`${dec(s.lotAcres, 2)}-acre parcel${s.garageSpaces ? ` · ${int(s.garageSpaces)}-car garage` : ''}`)
  if (s.yearBuilt) facts.push(`Built ${s.yearBuilt}`)
  const view = formatClientMlsField(s.viewDescription)
  if (view) facts.push(`View: ${esc(view)}`)
  if (s.taxAnnual) facts.push(`Annual property tax ${usd(s.taxAnnual)}`)
  const remarks = trimRemarks(s.publicRemarks, 1100)
  const yoy = a.market?.yoyMedianPriceDeltaPct
  return {
    meta: `${esc(s.streetAddress)} · Subject Property`,
    toc: 'The property, on the record',
    body: `
  <h2 class="section">Subject property</h2>
  <div class="two-col">
    <div>
      <h3 class="subhead">On the record</h3>
      <p>${s.yearBuilt ? `${s.yearBuilt}-built home` : 'Home'}${s.lotAcres != null ? ` on ${dec(s.lotAcres, 2)} acres` : ''}${cleanText(s.subdivision) ? ` in the ${esc(cleanText(s.subdivision)!)} subdivision` : ''}, ${esc(s.city)}. ${s.listingHistoryLine ? esc(s.listingHistoryLine) : 'No prior MLS listing history on file.'}</p>
      <h3 class="subhead">Site and structure</h3>
      <ul class="note-list">${facts.map((f) => `<li>${f}</li>`).join('')}</ul>
      ${a.sellerImprovementsText ? `<h3 class="subhead">Seller-reported details</h3><p class="small">${esc(a.sellerImprovementsText)} (Seller-reported, confirm at listing.)</p>` : ''}
      ${propertyIntelligenceBlock(a.site)}
    </div>
    <div>
      <h3 class="subhead">How this analysis works</h3>
      <p>Every comparable sale here is a closed transaction from the Oregon Data Share MLS. Each one is moved to today's market at the ${esc(a.market?.geoLabel ?? s.city)} year-over-year price trend${yoy != null ? ` of ${dec(yoy, 1)}%` : ''}, then adjusted for the size difference against your home.</p>
    </div>
  </div>
  ${remarks ? `<h2 class="section" style="margin-top:20px;">Most recent MLS remarks</h2><p class="small" style="font-style:italic;">"${esc(remarks)}"</p><p class="small">The listing agent's words, from the most recent MLS listing on this property.</p>` : ''}`,
  }
}

function mapPage(a: RenderCmaArgs): PageDef | null {
  if (!a.mapDataUri) return null
  return {
    meta: `Comparable Sales Map · ${esc(a.subject.city)}`,
    toc: 'Where the comps sit',
    body: `
  <h2 class="section">Where the comps sit</h2>
  <p style="margin-bottom:14px;">Pin numbers match the comparison strip. Each marker carries the sold price, the adjusted price to the subject, and why that sale stayed in the set.</p>
  <img class="map-img" src="${a.mapDataUri}" alt="Comparable sales map" />
  <h3 class="subhead" style="margin-top:0;">Marker key</h3>
  ${renderCompMapKeyHtml(a.subject, a.comps)}`,
  }
}

/** Sold price as a percentage of the last list price. Null when list is absent. */
function soldVsList(c: CmaAdjustedComp): string | null {
  if (!c.listPrice || c.listPrice <= 0) return null
  return `${dec((c.closePrice / c.listPrice) * 100, 1)}% of list`
}

function compCardsAndTablePage(a: RenderCmaArgs): PageDef {
  const competing = a.comps.filter((c) => c.competingArea).length
  return {
    meta: `${esc(a.subject.streetAddress)} · Comparable Sales`,
    toc: 'The comparable sales',
    body: `
  <h2 class="section">Comparable Closed Sales</h2>
  <p>${a.comps.length} closed single-family sales, selected for similarity to the subject in size, lot character, location, and recency. Pin numbers match the map. ${competing > 0 ? `${competing} of them come from a competing market area.` : 'All of them sit in the subject\'s own market area.'} One-page flyers after this strip are the print drill-in, not the comparison.</p>
  ${renderCompStripHtml(a.comps)}`,
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
    meta: `Comparable Sale ${index + 1} of ${a.comps.length}${clientPlaceClause(comp.subdivision, comp.city) ? ` · ${esc(clientPlaceClause(comp.subdivision, comp.city)!)}` : ''}`,
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
    <div class="f"><div class="fl">Seller concessions</div><div class="fv">${comp.concessionsAmount != null ? usd(comp.concessionsAmount) : '—'}</div></div>
    <div class="f"><div class="fl">Seller net from price</div><div class="fv">${comp.sellerNet != null ? usd(comp.sellerNet) : '—'}</div></div>
    <div class="f"><div class="fl">Sold vs List</div><div class="fv">${vsList ? esc(vsList) : '—'}</div></div>
    <div class="f"><div class="fl">Close Date</div><div class="fv">${dateLong(comp.closeDate)}</div></div>
    <div class="f"><div class="fl">Days on Market</div><div class="fv">${comp.daysToOffer != null ? `${int(comp.daysToOffer)} to offer` : '—'}${comp.domTotal != null ? ` · DOM ${int(comp.domTotal)}` : ''}</div></div>
    <div class="f"><div class="fl">Distance from Subject</div><div class="fv">${comp.proximity ? esc(comp.proximity) : '—'}</div></div>
    ${formatClientMlsField(comp.viewDescription) ? `<div class="f"><div class="fl">View</div><div class="fv">${esc(formatClientMlsField(comp.viewDescription)!)}</div></div>` : ''}
    <div class="f"><div class="fl">Adjusted to Subject</div><div class="fv">${usd(comp.adjustedPrice)}</div></div>
  </div>
  ${remarks ? '<p class="small">Description quoted from the MLS listing record.</p>' : ''}`,
  }
}

function marketPage(a: RenderCmaArgs): PageDef | null {
  return marketBoardPage({ subject: a.subject, comps: a.comps, market: a.market })
}

function pricedPage(a: RenderCmaArgs): PageDef {
  return pricingPage({
    subject: a.subject,
    comps: a.comps,
    market: a.market,
    pricing: a.pricing,
  })
}

function rationalePage(a: RenderCmaArgs): PageDef {
  return whyPage(a)
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
  const view = formatClientMlsField(s.viewDescription)
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

// ── Report extras (Matt 2026-08-05): when-to-list + competition ────────────

function subdivisionYearChartSvg(
  years: readonly { year: number; count: number }[],
): string {
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


// ── The subdivision story (Matt 2026-08-05: the homeowner's deep read) ─────

function thisHomePlanPage(a: RenderCmaArgs): PageDef | null {
  const lines = resolveThisHomePlan({ thisHomePlan: a.thisHomePlan, streetAddress: a.subject.streetAddress })
  if (lines.length === 0) return null
  const address = a.subject.streetAddress.trim()
  const title = address ? `How we would market ${address}` : 'How we would market this home'
  const hero = lines.slice(0, 3)
  const secondary = lines.slice(3)
  const heroLis = hero.map((s) => `<li><strong>${esc(s)}</strong></li>`).join('')
  const rest = secondary.length
    ? `<h3 class="subhead">Also on this listing</h3><ul class="note-list">${secondary
        .map((s) => `<li>${esc(s)}</li>`)
        .join('')}</ul>`
    : ''
  return {
    meta: `${esc(address || 'This home')} · How we would market it`,
    toc: title,
    body: `
  <h2 class="section">${esc(title)}</h2>
  <p>The plan below is for ${esc(address || 'this home')}, not a generic listing package.</p>
  <ul class="note-list">${heroLis}</ul>
  ${rest}`,
  }
}

function listingPlanPage(a: RenderCmaArgs): PageDef | null {
  const p = a.listingPlan
  if (!p) return null
  const rows = p.items
    .map(
      (i) =>
        `<li><strong>${esc(i.trigger)}</strong><div>${esc(i.action)}</div><div class="small">${esc(i.basis)}</div></li>`,
    )
    .join('')
  const address = a.subject.streetAddress.trim()
  const heading = address ? `What we would do at ${address}` : 'What We Would Do'
  return {
    meta: `${esc(address || 'This home')} · What We Would Do`,
    toc: heading,
    body: `
  <h2 class="section">${esc(heading)}</h2>
  <p>Every line below comes from a number in this report, measured on your home.</p>
  <ul class="note-list">${rows}</ul>
  <div class="trace"><div class="t-hd">Source</div>${esc(clientSourceLine(p.source, 'Figures already computed in this report.'))}</div>`,
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
  const yearChart = subdivisionYearChartSvg(f.years)
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
  ${yearChart ? `<div class="chart-block" data-anim="chart">${yearChart}</div>` : ''}
  <table class="comp-table">
    <thead><tr><th>Year</th><th>Sales</th><th>Median close</th><th>Median $/sqft</th></tr></thead>
    <tbody>${yearRows}</tbody>
  </table>
  ${sections}
  ${notable ? `<h3 class="subhead">Recent sales, one line each</h3><ul class="note-list">${notable}</ul>` : ''}
  ${position ? `<p><strong>${position}</strong></p>` : ''}
  <div class="trace"><div class="t-hd">Source</div>${esc(clientSourceLine(f.source, `Closed single-family sales in ${f.name}.`))}</div>`,
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
  <div class="trace"><div class="t-hd">Source</div>${esc(clientSourceLine(x.source, `Closed single-family sales in ${a.subject.city}, grouped by close month.`))}</div>`,
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
  <div class="trace"><div class="t-hd">Source</div>${esc(clientSourceLine(b.source, `Active and pending listings in ${a.subject.city} in this price band.`))}</div>`)
  }
  if (sub) {
    blocks.push(`
  <h3 class="subhead">${esc(sub.name)}, the last ${int(sub.months)} months</h3>
  <p>${int(sub.closedCount)} home${sub.closedCount === 1 ? '' : 's'} in your subdivision closed in the last ${int(sub.months)} months, from ${usd(sub.low)} to ${usd(sub.high)}${sub.medianClose != null ? `, median ${usd(Math.round(sub.medianClose))}` : ''}.</p>
  <div class="trace"><div class="t-hd">Source</div>${esc(clientSourceLine(sub.source, `Closed sales in ${sub.name}.`))}</div>`)
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
  <div class="trace"><div class="t-hd">Source</div>${esc(clientSourceLine(fin.source, `${a.subject.city} sales in the last 12 months that reported financing.`))}</div>`)
  }
  if (bench) {
    blocks.push(`
  <h3 class="subhead">Presentation bench</h3>
  <p>The sold comps in this report marketed with a median of ${int(bench.compMedianPhotos)} photos. Your last listing carried ${int(bench.subjectPhotos)}.</p>
  <div class="trace"><div class="t-hd">Source</div>${esc(clientSourceLine(bench.source, 'Photo counts on the subject listing and the sold comps in this report.'))}</div>`)
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
  <p>Your home came off the market without selling. The numbers below come straight from the MLS record and the verified comparable sales in this report. Under each one is our take.</p>
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
  <p><strong>Limiting conditions.</strong> Interior condition was not inspected. Figures are accurate as of the pull date on this report and market conditions change continuously. Seller-reported facts, where used, are labeled as such and should be independently confirmed.</p>
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
  const thisHome = thisHomePlanPage(a)
  if (thisHome) rest.push(thisHome)
  rest.push(...printMarketAreaPages(a))
  rest.push(compCardsAndTablePage(a))
  const map = mapPage(a)
  if (map) rest.push(map)
  rest.push(adjustmentPage(a))
  a.comps.forEach((c, i) => rest.push(compFlyerPage(a, c, i)))
  const market = marketPage(a)
  if (market) rest.push(market)
  const story = subdivisionStoryPage(a)
  if (story) rest.push(story)
  const whenToList = whenToListPage(a)
  if (whenToList) rest.push(whenToList)
  const useOf = propertyUsePage({
    streetAddress: a.subject.streetAddress,
    development: a.development,
    rental: a.rental,
  })
  if (useOf) rest.push(useOf)
  rest.push(pricedPage(a))
  const competition = competitionPage(a)
  if (competition) rest.push(competition)
  rest.push(rationalePage(a))
  const highlights = highlightsPage(a)
  if (highlights) rest.push(highlights)
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
