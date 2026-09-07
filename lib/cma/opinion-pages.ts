/**
 * The seller document's chapters, in print form. The cover stays in render.ts,
 * the immersive twin of every chapter here is in opinion-scenes.ts, and the
 * order both walk is OPINION_CHAPTER_ORDER at the bottom of this file.
 *
 * Chapters 0 to 7 of docs/plans/CMA_REIMAGINED_2026-09-07.md. A chapter omits
 * rather than printing an empty frame.
 */

import { renderBandRivalsHtml } from '@/lib/cma/band-rivals'
import { daysOnMarketFrom } from '@/lib/cma/listing-history-line'
import { dateLong, dottedPhone, escapeHtml, int, phoneHref, propertyDescription, usd } from '@/lib/cma/render-blocks'
import { clientSourceLine } from '@/lib/cma/client-facing'
import {
  renderBandOutcomesHtml,
  renderDaysToOfferHtml,
  renderExpiredPeersHtml,
  widerMarketBodyHtml,
} from '@/lib/cma/market-area-chapters'
import {
  FAILED_ASK_BACKTEST,
  listingTimelineReading,
  resolveListingTimeline,
} from '@/lib/cma/expired-audit'
import { listingTimelinePhoneSvg, listingTimelineSvg } from '@/lib/cma/market-charts'
import { subjectDomDays } from '@/lib/cma/comp-matrix'
import { sellerNetFromPrice } from '@/lib/pricing/seller-net'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import type { CmaBroker, CmaClient } from '@/lib/cma/types'
import type { DevelopmentOpportunities } from '@/lib/cma/development'
import type { CmaExtras } from '@/lib/cma/extras'
import type { CmaSiteData } from '@/lib/cma/county'
import type { SubdivisionStory } from '@/lib/cma/subdivision-story'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import type { CmaParcelSet } from '@/lib/cma/parcel-shapes'

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





/**
 * Chapter 1. What happened.
 *
 * Blueprint: "It asked $460,000 and did not sell." THEIR listing as a timeline
 * — a shaded zone at the value range, their ask stepping down across it and
 * never entering it — then one sentence of fact, then the relist figures.
 *
 * It is the first thing a homeowner whose listing failed wants answered, so it
 * sits before the number. Returns null on an asked origin: there is no failed
 * listing to draw.
 */
export function whatHappenedPage(a: OpinionPageArgs): CmaPageDef | null {
  const ea = a.expiredAudit
  if (!ea || ea.findings.length === 0) return null
  const b = FAILED_ASK_BACKTEST
  const heading = whatHappenedHeading(a.subject)
  return {
    meta: `${esc(a.subject.streetAddress)} · What happened`,
    toc: heading,
    body: `
  <h2 class="section">${esc(heading)}</h2>
  ${whatHappenedGraphicHtml(a)}
  <div class="stat-strip is-3">
    <div class="stat"><div class="val">${int(b.pairs)}</div><div class="lbl">Central Oregon homes came off unsold and then sold, 2023 to 2026</div></div>
    <div class="stat"><div class="val">${(b.closeMedianRatio * 100).toFixed(1)}%</div><div class="lbl">of the ask that failed is what the median one sold for</div></div>
    <div class="stat"><div class="val">${b.shareClosedAboveAskPct}%</div><div class="lbl">sold for more than that ask</div></div>
  </div>`,
  }
}

/**
 * The timeline and its sentence, or the fallback sentence.
 *
 * Shared by the letter and the immersive so the two cannot draw a different
 * listing. Two layouts of one graphic ship and exactly one is ever visible:
 * the wide one on paper and at reading width, the drawn-to-fit one below
 * 700px. This chart's reading is the gap between a line and a zone, and a
 * cropped right edge deletes the day it came off, which is the point.
 */
export function whatHappenedGraphicHtml(a: OpinionPageArgs): string {
  const timeline = resolveListingTimeline({
    subject: a.subject,
    expiredAudit: a.expiredAudit,
    rangeLow: a.pricing.valueLow,
    rangeHigh: a.pricing.valueHigh,
    rangeLabel: 'where homes like yours sold',
    domDays: subjectDomDays(a.subject),
  })
  if (!timeline) {
    // The row carries no list date and no ask, so there is no period to draw.
    // State what IS known and stop (CLAUDE.md §0).
    return `<p class="chart-read">${esc(
      `Your home came off the market without selling. Homes like yours sold for ${usd(a.pricing.valueLow)} to ${usd(a.pricing.valueHigh)}.`,
    )}</p>`
  }
  const wide = listingTimelineSvg(timeline)
  const phone = listingTimelinePhoneSvg(timeline)
  if (!wide) {
    return `<p class="chart-read">${esc(
      `Your home came off the market without selling. Homes like yours sold for ${usd(a.pricing.valueLow)} to ${usd(a.pricing.valueHigh)}.`,
    )}</p>`
  }
  const reading = listingTimelineReading({
    timeline,
    city: a.subject.city,
    marketMedianDom: a.market?.medianDom ?? null,
  })
  return `<div class="szn timeline-wide">${wide}</div>
  ${phone ? `<div class="szn timeline-phone">${phone}</div>` : ''}
  ${reading ? `<p class="chart-read">${esc(reading)}</p>` : ''}`
}

/** "It asked $460,000 and did not sell." Shared by both documents. */
export function whatHappenedHeading(subject: CmaSubject): string {
  const ask = subject.lastListPrice
  return ask != null && ask > 0
    ? `It asked ${usd(ask)} and did not sell.`
    : 'It came off the market without selling.'
}

/**
 * Chapter 2. Priced right sells. Priced high sits.
 *
 * The one thing the document has to land, and the blueprint's own words for
 * it: "we need to illustrate that if homes are priced too high they sit and
 * expire, period." Local numbers, never a slogan.
 */
export function pricedRightPage(a: OpinionPageArgs): CmaPageDef | null {
  const days = renderDaysToOfferHtml({ subject: a.subject, comps: a.comps, market: a.market })
  const ruler = bandChapterShowsRuler(a)
    ? renderBandOutcomesHtml(a.extras?.marketArea?.outcomes, a.comps, a.subject.city)
    : ''
  const peers = renderExpiredPeersHtml(a.subject, a.extras?.marketArea?.expiredPeers)
  if (!days && !ruler && !peers) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Priced right sells`,
    toc: PRICED_RIGHT_HEADING,
    body: `
  <h2 class="section">${esc(PRICED_RIGHT_HEADING)}</h2>
  ${days}
  ${ruler}
  ${peers}`,
  }
}

export const PRICED_RIGHT_HEADING = 'Priced right sells. Priced high sits.'

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
  <p><strong>Licensee interest.</strong> Neither ${esc(name)} nor Ryan Realty holds any existing or contemplated interest in this property. Any such interest, should one arise, will be disclosed in writing.</p>
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
    : 'Call or text if you want to walk the sales.'
  const consultUrl = `https://ryan-realty.com/contact?utm_source=crm&utm_medium=doc&utm_campaign=${isAudit ? 'expired' : 'cma'}&utm_content=letter-next-step`
  return {
    closing: true,
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



/**
 * ONE chapter order, walked by both documents.
 *
 * THE BLUEPRINT SUPERSEDES THE SPINE HERE (docs/plans/CMA_REIMAGINED_2026-09-07.md,
 * Matt 2026-09-07: "it does not flow and looks awful. reimagine it"). The old
 * thirteen-chapter order answered every question the engine could answer. This
 * one answers the three a homeowner opening a failed listing on a phone
 * actually has, in the order they ask them:
 *
 *   1. what happened to my listing, in one picture
 *   2. in this market, priced right sells and priced high sits
 *   3. what is it worth, what proves it, what do I do next
 *
 * Cut, deliberately, because they serve none of the three: the property-facts
 * table (Home location), the drawn lot outlines (The land), the subdivision
 * year table (Your street) and the permit list. The subdivision survives as
 * ONE line inside chapter 5, which is all of it a seller reads.
 *
 * `disclosure` is not a blueprint chapter and stays anyway: this document is
 * prepared by a licensed Oregon principal broker under ORS 696 and
 * OAR 863-015-0190, and the statutory paragraphs are not a chapter we get to
 * cut for flow. It sits immediately before the closing, which carries the
 * signature, the licence and the not-an-appraisal sentence the blueprint
 * names.
 *
 * An asked origin (someone who requested a value) has no failed listing, so
 * chapter 1 returns null and the order closes over it.
 */
export const OPINION_CHAPTER_ORDER = [
  'what-happened',
  'priced-right',
  'what-its-worth',
  'competition',
  'this-market',
  'net-at-list',
  'disclosure',
  'next-step',
] as const

export type OpinionChapterId = (typeof OPINION_CHAPTER_ORDER)[number]

/**
 * Chapter 1 now draws the seller's OWN listing as a timeline, so it no longer
 * owns the sold/unsold ruler and chapter 2 shows it on every document.
 */
export function bandChapterShowsRuler(_a: Pick<OpinionPageArgs, 'expiredAudit'>): boolean {
  return true
}

export function assembleOpinionPages(a: OpinionPageArgs): CmaPageDef[] {
  const build: Record<OpinionChapterId, () => CmaPageDef | null> = {
    'what-happened': () => whatHappenedPage(a),
    'priced-right': () => pricedRightPage(a),
    'what-its-worth': () =>
      pricingPage({
        subject: a.subject,
        comps: a.comps,
        market: a.market,
        pricing: a.pricing,
        tiersUsed: a.tiersUsed,
        mapDataUri: a.mapDataUri,
      }),
    competition: () => competitionPage(a),
    'this-market': () => thisMarketPage(a),
    'net-at-list': () => sellerNetPage(a),
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
