/**
 * Deterministic CMA HTML renderer — multi-page letter-format document in the
 * canonical brutalist navy/cream editorial style (exemplar:
 * public/drafts/cma-21042-robin/cma.html). Self-contained: inline CSS,
 * absolute asset URLs, map embedded as a data URI. Print-friendly page breaks.
 *
 * Every figure printed here is computed by the same build from live Supabase
 * rows (CLAUDE.md §0). Copy is deterministic template text vetted against the
 * brand-voice banned list. The final page carries the Oregon competitive
 * market analysis disclosures required by OAR 863-015-0190 under ORS ch. 696.
 */

import { cmaStylesheet } from '@/lib/cma/render-css'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import type {
  CmaAdjustedComp,
  CmaBroker,
  CmaClient,
  CmaMarketContext,
  CmaPricing,
  CmaSubject,
} from '@/lib/cma/types'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

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
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const esc = escapeHtml

const usd = formatPriceExact

function usdSigned(n: number): string {
  const abs = usd(Math.abs(n))
  if (n === 0) return '$0'
  return n > 0 ? `+${abs}` : `−${abs}`
}

function int(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

function dec(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

const dateLong = formatDate

function monthYear(iso: string | null | undefined): string {
  return formatDate(iso, { month: 'short', day: undefined, year: 'numeric' })
}

/** Rewrite a Spark CDN photo URL to a specific size tier. */
export function sparkPhotoAt(url: string | null, size: string): string | null {
  if (!url) return null
  if (/cdn\.resize\.sparkplatform\.com/.test(url)) {
    return url.replace(/\/\d+x\d+\//, `/${size}/`)
  }
  return url
}

function trimRemarks(remarks: string | null, max = 850): string | null {
  if (!remarks) return null
  const clean = remarks.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

interface PageDef {
  meta: string
  body: string
}

function wrapPage(page: PageDef, index: number, total: number, brokerPhone: string): string {
  return `
<section class="page">
  <header class="pg-header">
    <img src="${SITE_URL}/images/brand/logo-blue.png" alt="Ryan Realty" class="logo" />
    <div class="pg-meta">${page.meta}</div>
  </header>
  ${page.body}
  <footer class="pg-footer">
    <span>Ryan Realty · ${esc(brokerPhone)}</span>
    <span>Page ${index + 1} of ${total}</span>
  </footer>
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

function coverPage(a: RenderCmaArgs): PageDef {
  const hero = heroForSubject(a.subject)
  const p = a.pricing
  const clientLine = a.client.name ? `Prepared for ${esc(a.client.name)}` : 'Comparative Market Analysis'
  return {
    meta: `Comparative Market Analysis · ${dateLong(a.generatedAtIso)}`,
    body: `
  <div class="cover-label">${clientLine}</div>
  <h1 class="cover-title">${esc(a.subject.streetAddress)}</h1>
  <div class="cover-sub">${esc(a.subject.city)}, Oregon ${esc(a.subject.postalCode ?? '')}${a.subject.subdivision ? ` · ${esc(a.subject.subdivision)}` : ''}</div>
  ${hero.src ? `<img class="hero-photo" src="${hero.src}" alt="${esc(a.subject.streetAddress)}" />` : '<div class="hero-photo"></div>'}
  <div class="hero-caption">${esc(hero.caption)}</div>
  ${subjectStatStrip(a.subject)}
  <div class="value-block">
    <div class="vb-label">Estimated Market Value Range</div>
    <p class="vb-range">${usd(p.valueLow)} to ${usd(p.valueHigh)}</p>
    <div class="vb-detail">Based on ${a.comps.length} closed sales near the subject, each adjusted to today's market conditions and to the subject's size before reconciliation.</div>
    <div class="vb-most-likely"><strong>Recommended list price · ${usd(p.recommended)}.</strong> Confidence: ${p.confidence}. ${esc(p.confidenceReason)}</div>
  </div>
  <div class="presented-by">
    Presented by <strong>${esc(a.broker.displayName)}</strong> · ${esc(a.broker.title)} · Ryan Realty${a.broker.phone ? ` · ${esc(a.broker.phone)}` : ''}
  </div>`,
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
    body: `
  <h2 class="section">Subject Property</h2>
  <div class="two-col">
    <div>
      <h3 class="subhead">At a glance</h3>
      <p>${s.yearBuilt ? `${s.yearBuilt}-built home` : 'Home'}${s.lotAcres != null ? ` on ${dec(s.lotAcres, 2)} acres` : ''}${s.subdivision ? ` in the ${esc(s.subdivision)} subdivision` : ''}, ${esc(s.city)}. ${s.listingHistoryLine ? esc(s.listingHistoryLine) : 'No prior MLS listing history on file.'}</p>
      <h3 class="subhead">Site and structure</h3>
      <ul class="note-list">${facts.map((f) => `<li>${f}</li>`).join('')}</ul>
      ${a.sellerImprovementsText ? `<h3 class="subhead">Seller-reported details</h3><p class="small">${esc(a.sellerImprovementsText)} (Seller-reported, confirm at listing.)</p>` : ''}
    </div>
    <div>
      <h3 class="subhead">How this analysis works</h3>
      <p>Every comparable sale in this report is a real closed transaction pulled from the Oregon Data Share MLS. Each comp is first normalized to today's market using the verified year-over-year price trend for ${esc(a.market?.geoLabel ?? s.city)}${yoy != null ? ` (${dec(yoy, 1)}% YoY)` : ''}, then adjusted for the size difference against your home. The reconciled result is checked against two independent pricing methods before a recommendation is made.</p>
      <p>The full adjustment ledger, the market context, and the data trace are all included, so every number in this document can be audited back to its source.</p>
    </div>
  </div>
  ${remarks ? `<h2 class="section" style="margin-top:20px;">Most Recent MLS Remarks</h2><p class="small" style="font-style:italic;">"${esc(remarks)}"</p><p class="small">Quoted from the property's most recent MLS listing. Descriptions are the prior listing agent's words, provided for record.</p>` : ''}`,
  }
}

function mapPage(a: RenderCmaArgs): PageDef | null {
  if (!a.mapDataUri) return null
  const keyItems: string[] = []
  keyItems.push(
    `<div class="k"><span class="pin subject">S</span><div class="txt"><strong>Subject</strong><br/>${esc(a.subject.streetAddress)}</div></div>`,
  )
  a.comps.forEach((c, i) => {
    keyItems.push(
      `<div class="k"><span class="pin">${i + 1}</span><div class="txt"><strong>${esc(c.address)}</strong><br/>${usd(c.closePrice)} · ${monthYear(c.closeDate)}</div></div>`,
    )
  })
  return {
    meta: `Comparable Sales Map · ${esc(a.subject.city)}`,
    body: `
  <h2 class="section">Where the Comps Sit</h2>
  <p style="margin-bottom:14px;">Every comparable sale in this report on one map, with the subject marked S. Marker numbers match the comp order used throughout the report. Pin positions use each listing's recorded MLS coordinates.</p>
  <img class="map-img" src="${a.mapDataUri}" alt="Comparable sales map" />
  <h3 class="subhead" style="margin-top:0;">Marker key</h3>
  <div class="map-key">${keyItems.join('')}</div>`,
  }
}

function compCardsAndTablePage(a: RenderCmaArgs): PageDef {
  const s = a.subject
  const cards = a.comps
    .slice(0, 8)
    .map((c) => {
      const ph = sparkPhotoAt(c.photoUrl, '640x480')
      return `
    <div class="comp-card">
      ${ph ? `<img class="ph" src="${ph}" alt="${esc(c.address)}" />` : '<div class="ph-missing">No MLS photo on file</div>'}
      <div class="body">
        <div class="addr">${esc(c.address)}</div>
        <div class="stats">${int(c.beds)} bd · ${dec(c.baths, 0)} ba · ${int(c.sqft)} sf${c.lotAcres != null ? ` · ${dec(c.lotAcres, 2)} ac` : ''}${c.yearBuilt ? ` · ${c.yearBuilt}` : ''}</div>
        <div class="price">${usd(c.closePrice)} <span class="when">${monthYear(c.closeDate)}${c.daysToOffer != null ? ` · ${int(c.daysToOffer)}d to offer` : ''}</span></div>
      </div>
    </div>`
    })
    .join('')

  const subjectPpsf = s.sqft ? a.pricing.recommended / s.sqft : null
  const rows = a.comps
    .map(
      (c, i) => `
    <tr>
      <td>${i + 1}. ${esc(c.address)}</td>
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
    body: `
  <h2 class="section">Comparable Closed Sales</h2>
  <p>${a.comps.length} closed single-family sales selected for similarity to the subject (size, location, and recency). Ordered most recent first. DTO is days to offer, the active-marketing read. DOM includes time under contract.</p>
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
  <p class="small" style="margin-top:8px;">Subject List $ column shows the recommended list price for context. Em dash cells indicate a value that does not apply or is unavailable.</p>`,
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
  ${
    a.excludedOutliers.length > 0
      ? `<h3 class="subhead">Excluded outliers</h3><ul class="note-list">${a.excludedOutliers
          .map((o) => `<li>${esc(o.address)} (${usd(o.closePrice)}): ${esc(o.reason)}.</li>`)
          .join('')}</ul>`
      : ''
  }
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
  return {
    meta: `Comparable Sale ${index + 1} of ${a.comps.length} · ${esc(comp.subdivision ?? comp.city)}`,
    body: `
  <div class="flyer-badge">Closed ${monthYear(comp.closeDate)}${comp.daysToOffer != null ? ` · ${int(comp.daysToOffer)}d to offer` : ''}</div>
  <h1 class="flyer-title">${esc(comp.address)}</h1>
  <div class="flyer-sub">${esc(comp.city)}, Oregon${comp.subdivision ? ` · ${esc(comp.subdivision)}` : ''}${comp.mlsNumber ? ` · MLS ${esc(comp.mlsNumber)}` : ''}</div>
  ${hero ? `<img class="flyer-hero" src="${hero}" alt="${esc(comp.address)}" />` : '<div class="flyer-hero"></div>'}
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
    <div class="f"><div class="fl">Close Date</div><div class="fv">${dateLong(comp.closeDate)}</div></div>
    <div class="f"><div class="fl">Days on Market</div><div class="fv">${comp.daysToOffer != null ? `${int(comp.daysToOffer)} days to offer` : '—'}${comp.domTotal != null ? ` · DOM ${int(comp.domTotal)}` : ''}</div></div>
    <div class="f"><div class="fl">View</div><div class="fv">${esc(comp.viewDescription ?? '—')}</div></div>
    <div class="f"><div class="fl">Tax (annual)</div><div class="fv">${usd(comp.taxAnnual)}</div></div>
    <div class="f"><div class="fl">Adjusted to Subject</div><div class="fv">${usd(comp.adjustedPrice)}</div></div>
    <div class="f"><div class="fl">Selection Tier</div><div class="fv">${esc(comp.selectionTier)}</div></div>
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
      ? `${esc(m.geoLabel)} is carrying ${dec(m.monthsOfSupply, 1)} months of supply, with ${int(m.activeCount)} active single-family listings on the market right now against the pace of closed sales over the last six months. The standard thresholds read 4 months or less as a seller's market, 4 to 6 as balanced, and 6 or more as a buyer's market.`
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
    body: `
  <h2 class="section">Pricing Strategy</h2>
  <p>${p.method2 != null ? 'Three' : 'Two'} independent methods, one answer. ${p.converged ? 'The methods land within the 5% convergence tolerance, which is the math check.' : 'The methods land wider than the 5% tolerance, so the reconciliation method governs and the stated confidence is reduced.'}</p>
  <h3 class="subhead">Method 1 · Tiered price per square foot</h3>
  <p>The comps' time-adjusted $/sqft rates span ${usd(Math.round(p.method1Low / (s.sqft || 1)))} to ${usd(Math.round(p.method1High / (s.sqft || 1)))} at the 25th to 75th percentile. Applied to the subject's ${int(s.sqft)} sqft that brackets ${usd(p.method1Low)} to ${usd(p.method1High)}, with the median rate landing at ${usd(p.method1Mid)}.</p>
  ${
    p.method2 != null
      ? `<h3 class="subhead">Method 2 · Size-matched baseline${p.improvementsValueAdd ? ' plus documented improvements' : ''}</h3>
  <p>The median adjusted price of the three comps closest to the subject in living area${p.improvementsValueAdd ? `, plus ${usd(p.improvementsValueAdd)} of credited improvement value from the seller's reported spend at a 65% recovery rate,` : ''} lands at ${usd(p.method2)}.</p>`
      : ''
  }
  <h3 class="subhead">Method ${p.method2 != null ? '3' : '2'} · Adjusted-comp reconciliation</h3>
  <p>The similarity-weighted average of every comp's fully adjusted price (time plus size, weights favoring the closest and most recent sales) lands at ${usd(p.method3)}. This method carries the market-conditions correction, so it anchors the recommendation.</p>
  <h3 class="subhead">Converged range</h3>
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
  ${p.notes.length > 0 ? `<h3 class="subhead" style="margin-top:14px;">Method notes</h3><ul class="note-list">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
  <p class="small" style="margin-top:10px;">Confidence: <strong>${p.confidence}</strong>. ${esc(p.confidenceReason)}</p>`,
  }
}

function rationalePage(a: RenderCmaArgs): PageDef {
  const m = a.market
  const traceLines = [a.subjectTrace, ...a.compTrace]
  return {
    meta: `${esc(a.subject.streetAddress)} · Why This Price`,
    body: `
  <h2 class="section">Why This List Price</h2>
  <ul class="note-list">
    <li>The recommendation sits on ${a.comps.length} verified closed sales, not on an automated estimate or a single anchor comp.</li>
    <li>Every comp was normalized to today's market before comparison${m?.yoyMedianPriceDeltaPct != null ? `, using the verified ${dec(m.yoyMedianPriceDeltaPct, 1)}% year-over-year trend for ${esc(m.geoLabel)}` : ''}.</li>
    ${m?.monthsOfSupply != null ? `<li>${esc(m.geoLabel)} is carrying ${dec(m.monthsOfSupply, 1)} months of supply. The tier grid reflects that reality rather than working against it.</li>` : ''}
    ${m?.medianDom != null ? `<li>The median ${esc(m.geoLabel)} sale is taking ${int(m.medianDom)} days. Pricing inside the supported range is what keeps a listing on the fast side of that number.</li>` : ''}
    <li>Where a defensible dollar adjustment was not possible, the difference is disclosed and down-weighted instead of guessed.</li>
  </ul>
  <h2 class="section" style="margin-top:18px;">Verification Trace</h2>
  <div class="trace">
    <div class="t-hd">Data sources (audit trail)</div>
    Every figure in this report traces to the Oregon Data Share MLS via the Ryan Realty data platform, pulled ${dateLong(a.generatedAtIso)}.<br/><br/>
    ${traceLines.map((t) => esc(t)).join('<br/>')}
  </div>`,
  }
}

function disclosurePage(a: RenderCmaArgs): PageDef {
  const b = a.broker
  const headshot = b.photoUrl ? (b.photoUrl.startsWith('http') ? b.photoUrl : `${SITE_URL}${b.photoUrl}`) : null
  return {
    meta: `${esc(a.subject.streetAddress)} · Presented by ${esc(b.displayName)}`,
    body: `
  <h2 class="section">Disclosure</h2>
  <p><strong>Purpose and intent.</strong> This document is a competitive market analysis prepared by a licensed Oregon real estate broker to assist the owner of ${esc(a.subject.streetAddress)}, ${esc(a.subject.city)}, Oregon in evaluating a potential listing price. It is provided in accordance with ORS chapter 696 and OAR 863-015-0190.</p>
  <p><strong>Property description.</strong> ${esc(a.subject.streetAddress)}, ${esc(a.subject.city)}, Oregon ${esc(a.subject.postalCode ?? '')} · ${int(a.subject.beds)} bedrooms · ${dec(a.subject.baths, 0)} bathrooms · ${int(a.subject.sqft)} sqft${a.subject.lotAcres != null ? ` · ${dec(a.subject.lotAcres, 2)} acres` : ''}${a.subject.yearBuilt ? ` · built ${a.subject.yearBuilt}` : ''}.</p>
  <p><strong>Basis for the value.</strong> The value range rests on ${a.comps.length} closed comparable sales from the Oregon Data Share MLS, adjusted for market conditions and size as shown in the adjustment grid, and on verified market statistics for ${esc(a.market?.geoLabel ?? a.subject.city)}. The term value as used in this analysis means the estimated worth of or price for the property. It does not mean or imply a value arrived at by any method of appraisal.</p>
  <p><strong>Limiting conditions.</strong> Interior condition was not inspected. Figures are accurate as of the pull date in the verification trace and market conditions change continuously. Seller-reported facts, where used, are labeled as such and should be confirmed at listing.</p>
  <p><strong>Licensee interest.</strong> Neither ${esc(b.displayName)} nor Ryan Realty holds any existing or contemplated interest in the subject property. Any such interest, should one arise, will be disclosed in writing.</p>
  <p><strong>Not an appraisal.</strong> This competitive market analysis is not intended as an appraisal. If an appraisal is desired, the services of a competent professional licensed appraiser should be obtained. Unless the preparing licensee is also licensed by the Oregon Appraiser Certification and Licensure Board, this report is not intended to meet the requirements set out in the Uniform Standards of Professional Appraisal Practice. Equal Housing Opportunity.</p>
  <div class="signature-page">
    ${headshot ? `<img class="portrait" src="${headshot}" alt="${esc(b.displayName)}" />` : '<div></div>'}
    <div class="sig-content">
      <div class="sig-name">${esc(b.displayName)}</div>
      <div class="sig-printed">${esc(b.displayName)}</div>
      <div class="sig-title">${esc(b.title)} · Ryan Realty · Prepared ${dateLong(a.generatedAtIso)}</div>
      <div class="sig-contact">
        ${b.phone ? `<strong>${esc(b.phone)}</strong><br/>` : ''}
        ${b.email ? `${esc(b.email)}<br/>` : ''}
        ryan-realty.com · Bend · Oregon
      </div>
      ${b.licenseNumber ? `<div class="sig-license">Oregon Real Estate License # ${esc(b.licenseNumber)}</div>` : ''}
    </div>
  </div>`,
  }
}

export function renderCmaHtml(a: RenderCmaArgs): { html: string; pageCount: number } {
  const pages: PageDef[] = []
  pages.push(coverPage(a))
  pages.push(subjectPage(a))
  const map = mapPage(a)
  if (map) pages.push(map)
  pages.push(compCardsAndTablePage(a))
  pages.push(adjustmentPage(a))
  a.comps.forEach((c, i) => pages.push(compFlyerPage(a, c, i)))
  const market = marketPage(a)
  if (market) pages.push(market)
  pages.push(pricingPage(a))
  pages.push(rationalePage(a))
  pages.push(disclosurePage(a))

  const brokerPhone = a.broker.phone ?? '541.213.6706'
  const body = pages.map((p, i) => wrapPage(p, i, pages.length, brokerPhone)).join('\n')
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
