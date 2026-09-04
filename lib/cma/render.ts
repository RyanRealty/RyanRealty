/**
 * Deterministic CMA HTML renderer — multi-page letter-format document.
 * Sunstone spine: cover, subject snapshot, facts, then market and comps.
 * Conditional legal, photos, permits, and seller-net omit when unknown.
 */

import { cmaStylesheet } from '@/lib/cma/render-css'
import {
  cleanText,
  dateLong,
  dec,
  dottedPhone,
  escapeHtml,
  int,
  monthYear,
  phoneHref,
  sparkPhotoAt,
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
import type { CmaParcelSet } from '@/lib/cma/parcel-shapes'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import { composeInboundCoverLine } from '@/lib/cma/inbound-packet'
import { formatClientMlsField } from '@/lib/cma/client-facing'
import type { DevelopmentOpportunities } from '@/lib/cma/development'
import type { RentalPotential } from '@/lib/cma/rental-potential'
import { assembleOpinionPages } from '@/lib/cma/opinion-pages'
import { coverValueBlockHtml } from '@/lib/cma/cover-value'
import {
  cmaCoverIntroBlurbHtml,
  cmaCoverLabelHtml,
  cmaProductBarFromExtras,
  cmaWhyListPageBody,
  factsFromCmaSurface,
  placeLabelHtml,
  resolveSubjectPlaceLinks,
} from '@/lib/cma/fsbo-cma-render'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

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
  /** Recorded lot polygons for the subject and its comps; drives "The land". */
  parcels?: CmaParcelSet | null
  expiredAudit?: ExpiredAuditData | null
  development?: DevelopmentOpportunities | null
  rental?: RentalPotential | null
  extras?: CmaExtras | null
  subdivisionStory?: SubdivisionStory | null
  equity?: CmaEquityPosition | null
  listingPlan?: ListingPlan | null
  thisHomePlan?: string[] | null
  tiersUsed?: string[]
}

interface PageDef {
  meta: string
  body: string
  toc?: string
  cover?: boolean
  flyer?: boolean
}

function wrapPage(page: PageDef): string {
  if (page.cover) {
    return `
<section class="page page-cover">
  ${page.body}
</section>`
  }
  return `
<section class="page${page.flyer ? ' page-flyer' : ''}">
  <header class="pg-header">
    <img src="${SITE_URL}/images/brand/logo-blue.png" alt="Ryan Realty" class="logo" />
    <div class="pg-meta">${page.meta}</div>
  </header>
  ${page.body}
</section>`
}

/**
 * A subject photo older than this no longer shows today's house.
 *
 * 24 months is not arbitrary: it is the same recency window the accuracy
 * contract already enforces on comparable sales ("close date within 24
 * months"). A photo we would not accept as evidence of a comp's condition is
 * not evidence of the subject's either.
 */
const STALE_SUBJECT_PHOTO_MONTHS = 24

function monthsSince(iso: string | null): number | null {
  if (!iso) return null
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return null
  return (Date.now() - then) / (1000 * 60 * 60 * 24 * 30.44)
}

/**
 * Cover + subject hero.
 *
 * SKILL.md step 5 (locked 2026-06-13, Matt directive): with no MLS photos OR
 * ONLY STALE ONES, the hero is an AERIAL VIEW — never a blank panel. Only the
 * first half of that was built: any photo won regardless of age, and the
 * no-photo branch returned null rather than the aerial. The 655 12th CMA led
 * with a January 2023 photo on a 2026 pricing document (found 2026-08-25).
 *
 * Order: a current photo, else the aerial, else the stale photo captioned
 * honestly (a dated picture of the house beats no picture), else nothing.
 */
function heroForSubject(
  subject: CmaSubject,
  mapDataUri: string | null,
): { src: string | null; caption: string } {
  const src = sparkPhotoAt(subject.photoUrl, '1024x768')
  const when = monthYear(subject.lastListDate)
  const ageMonths = monthsSince(subject.lastListDate)
  const stale = ageMonths != null && ageMonths > STALE_SUBJECT_PHOTO_MONTHS

  if (src && !stale) {
    return {
      src,
      caption: `Most recent MLS listing photo${when !== '—' ? ` (${when})` : ''} · MLS ${subject.mlsNumber ?? '—'}`,
    }
  }

  if (mapDataUri) {
    return {
      src: mapDataUri,
      caption: stale
        ? `Aerial view · subject parcel. The most recent MLS photo is from ${when} and may not show the home today.`
        : 'Aerial view · subject parcel. No MLS photo on file.',
    }
  }

  if (src) {
    return {
      src,
      caption: `MLS listing photo from ${when} · MLS ${subject.mlsNumber ?? '—'}. This may not show the home today.`,
    }
  }

  return { src: null, caption: 'No MLS photo on file for the subject.' }
}

/**
 * The ORS 696 / OAR 863-015-0190 disclosure description. Every field is
 * omitted when the record does not carry it: land has no bedrooms, bathrooms
 * or living area, and printing "— bedrooms · — bathrooms · — sqft" on a vacant
 * lot describes nothing. Omitting an absent fact is the accurate form.
 */
export function propertyDescription(subject: CmaSubject): string {
  const head = [
    esc(subject.streetAddress),
    esc(subject.city),
    `Oregon ${esc(subject.postalCode ?? '')}`.trim(),
  ]
    .filter(Boolean)
    .join(', ')
  const facts = [
    subject.beds != null ? `${int(subject.beds)} bedrooms` : null,
    subject.baths != null ? `${dec(subject.baths, subject.baths % 1 !== 0 ? 1 : 0)} bathrooms` : null,
    subject.sqft != null ? `${int(subject.sqft)} sqft` : null,
    subject.lotAcres != null ? `${dec(subject.lotAcres, 2)} acres` : null,
    subject.yearBuilt != null ? `built ${subject.yearBuilt}` : null,
  ].filter(Boolean)
  return `${head}${facts.length > 0 ? ` · ${facts.join(' · ')}` : ''}.`
}

function coverSpecsLine(subject: CmaSubject): string {
  const baths =
    subject.baths == null
      ? null
      : subject.baths === 1
        ? '1 bath'
        : `${dec(subject.baths, subject.baths % 1 !== 0 ? 1 : 0)} baths`
  return [
    subject.beds != null ? `${subject.beds} bedrooms` : null,
    baths,
    subject.sqft != null ? `${int(subject.sqft)} sq ft` : null,
    cleanText(subject.subdivision),
    subject.yearBuilt != null ? `built ${subject.yearBuilt}` : null,
    subject.lotAcres != null ? `${dec(subject.lotAcres, 2)} acre lot` : null,
    formatClientMlsField(subject.viewDescription),
  ]
    .filter(Boolean)
    .join(' · ')
}

function coverPage(a: RenderCmaArgs): PageDef {
  const hero = heroForSubject(a.subject, a.mapDataUri)
  const specs = coverSpecsLine(a.subject)
  const prepared = [
    a.client.name ? `Prepared for ${a.client.name}` : null,
    `Presented by ${a.broker.displayName}`,
    a.broker.title,
    a.broker.phone ? dottedPhone(a.broker.phone) ?? a.broker.phone : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const coverFacts = factsFromCmaSurface({
    subject: a.subject,
    pricing: a.pricing,
    clientName: a.client.name,
    generatedAtIso: a.generatedAtIso,
    broker: a.broker,
  })
  const places = resolveSubjectPlaceLinks({ subject: a.subject })
  const primaryPlace = places[0] ?? null
  const rivals = a.extras?.band?.rivals ?? []
  const nearbyActives = rivals.filter((r) => r.status === 'Active')
  const productBar = cmaProductBarFromExtras({
    marketPresent: Boolean(a.market),
    marketGeoLabel: a.market?.geoLabel ?? null,
    placeLinks: places,
    nearbyActiveCount:
      nearbyActives.length > 0 ? nearbyActives.length : (a.extras?.band?.activeCount ?? null),
    nearbyActiveLabels: nearbyActives.map((r) => r.address).filter(Boolean),
    recentSoldCount: a.comps.length,
    bandLo: a.extras?.band?.lo ?? null,
    bandHi: a.extras?.band?.hi ?? null,
    bandActiveCount: a.extras?.band?.activeCount ?? null,
    closedSalePrices: a.comps
      .map((c) => c.closePrice)
      .filter((n) => typeof n === 'number' && Number.isFinite(n) && n > 0),
  }).html
  const subdivLinked = placeLabelHtml(a.subject.subdivision, primaryPlace?.href ?? null)
  const specsHtml = (() => {
    if (!specs) return ''
    const plain = cleanText(a.subject.subdivision) ?? ''
    if (!subdivLinked || !plain) return `<p class="cover-specs">${esc(specs)}</p>`
    const idx = specs.indexOf(plain)
    if (idx < 0) return `<p class="cover-specs">${esc(specs)}</p>`
    return `<p class="cover-specs">${esc(specs.slice(0, idx))}${subdivLinked}${esc(specs.slice(idx + plain.length))}</p>`
  })()
  return {
    cover: true,
    meta: `Pricing report · ${dateLong(a.generatedAtIso)}`,
    body: `
  <div class="cover-stage">
    ${hero.src ? `<img class="hero-photo" src="${esc(hero.src)}" alt="${esc(a.subject.streetAddress)}" />` : '<div class="hero-photo"></div>'}
    <div class="cover-veil" aria-hidden="true"></div>
    <div class="cover-mast">
      ${cmaCoverLabelHtml()}
      <h1 class="cover-title">${esc(a.subject.streetAddress)}</h1>
      <div class="cover-sub">${esc(a.subject.city)}, Oregon ${esc(a.subject.postalCode ?? '')}<br/>${esc(composeInboundCoverLine(a.subject.streetAddress))}</div>
    </div>
    <div class="value-block">
      ${coverValueBlockHtml(a)}
      ${cmaCoverIntroBlurbHtml(coverFacts)}
      ${productBar}
      ${specsHtml}
      <p class="cover-presented">${esc(prepared)}</p>
      <p class="hero-caption">${esc(hero.caption)}</p>
    </div>
  </div>`,
  }

}

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
  const onMarket = /active|pending|coming/i.test(a.subject.standardStatus ?? '')
  const lead = isAudit
    ? `You have the full picture now. The price story, what the last listing left on the table, and the number the market supports today. When you are ready to talk it through, the fastest path is a call or a text. No pressure either way.`
    : onMarket
      ? `You have the full picture now. The recent sales, where they land against the current price, and what the market supports today. When you want to talk it through, the fastest path is a call or a text.`
      : `You have the full picture now. When you want to talk through the range or the timing, the fastest path is a call or a text. No pressure either way.`
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
    ${onMarket ? '' : `<a class="ghost" href="${consultUrl}">Book a conversation</a>`}
  </div>
  ${isAudit ? `<p class="cta-reply-note">Or simply reply to the text that brought you here. It comes straight to ${first}'s phone.</p>` : ''}`,
  }
}

function whyListPage(a: RenderCmaArgs): PageDef {
  const facts = factsFromCmaSurface({
    subject: a.subject,
    pricing: a.pricing,
    clientName: a.client.name,
    generatedAtIso: a.generatedAtIso,
    broker: a.broker,
  })
  return {
    meta: `${esc(a.subject.streetAddress)} · Why list with a realtor`,
    toc: 'Why most sellers list with a realtor',
    body: cmaWhyListPageBody(facts),
  }
}

function closingPage(a: RenderCmaArgs): PageDef {
  const disclosure = disclosurePage(a)
  const next = nextStepPage(a)
  return {
    meta: `${esc(a.subject.streetAddress)} · Disclosure`,
    toc: 'Disclosure and next step',
    body: `${disclosure.body}
  ${next.body}`,
  }
}

function disclosurePage(a: RenderCmaArgs): PageDef {
  const b = a.broker
  const headshot = b.photoUrl ? (b.photoUrl.startsWith('http') ? b.photoUrl : `${SITE_URL}${b.photoUrl}`) : null
  return {
    meta: `${esc(a.subject.streetAddress)} · Disclosure · ${esc(b.displayName)}`,
    toc: 'Disclosure and signature',
    body: `
  <h2 class="section">Disclosure</h2>
  <p><strong>Purpose and intent.</strong> This document is a competitive market analysis prepared by a licensed Oregon real estate broker to assist the owner of ${esc(a.subject.streetAddress)}, ${esc(a.subject.city)}, Oregon in evaluating a potential listing price. It is provided in accordance with ORS chapter 696 and OAR 863-015-0190.</p>
  <p><strong>Property description.</strong> ${propertyDescription(a.subject)}</p>
  <p><strong>Basis for the value.</strong> The value range rests on ${a.comps.length} closed comparable sales from the Oregon Data Share MLS, adjusted for market conditions and size, and on verified market statistics for ${esc(a.market?.geoLabel ?? a.subject.city)}. The term value as used in this analysis means the estimated worth of or price for the property. It does not mean or imply a value arrived at by any method of appraisal.</p>
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
  const rest: PageDef[] = []
  rest.push(...assembleOpinionPages(a))
  const lastListing = expiredAuditPage(a)
  if (lastListing) rest.push(lastListing)
  rest.push(whyListPage(a))
  rest.push(closingPage(a))

  const pages: PageDef[] = [coverPage(a), ...rest]
  const body = pages.map((p) => wrapPage(p)).join('\n')
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="robots" content="noindex,nofollow" />
<title>Pricing report · ${esc(a.subject.streetAddress)} · ${esc(a.subject.city)}, OR ${esc(a.subject.postalCode ?? '')}</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Caveat:wght@500;600;700&display=swap" rel="stylesheet" />
<style>${cmaStylesheet(SITE_URL)}</style>
</head>
<body>
${body}
</body>
</html>`
  return { html, pageCount: pages.length }
}
