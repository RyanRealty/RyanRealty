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
import { sellerFacingFindingMeaning, type ExpiredAuditData } from '@/lib/cma/expired-audit'
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
  propertyDescription,
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
  /** Deprecated (C9). Letter ignores this — comps map is the single map. */
  subjectMapDataUri?: string | null
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
  /** The closing sheet. Navy is the cover and this page only. */
  closing?: boolean
}

function wrapPage(page: PageDef): string {
  if (page.cover) {
    return `
<section class="page page-cover">
  ${page.body}
</section>`
  }
  // ONE register (CMA_REIMAGINED_2026-09-07.md § The register): cream
  // throughout, navy on the cover and the closing sheet only. The closing
  // takes the cream wordmark, because the navy one disappears into the field.
  const logo = page.closing ? 'logo-white.png' : 'logo-blue.png'
  return `
<section class="page${page.flyer ? ' page-flyer' : ''}${page.closing ? ' page-closing' : ''}">
  <header class="pg-header">
    <img src="${SITE_URL}/images/brand/${logo}" alt="Ryan Realty" class="logo" />
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
 * Order: a current photo, else the stale photo captioned honestly, else nothing.
 * Never a map (C9 — comps map is the single map; cover uses photo or empty).
 */
function heroForSubject(subject: CmaSubject): { src: string | null; caption: string } {
  // C9: cover may use a photo, never a map — comps pin map is the single letter map.
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

  if (src) {
    return {
      src,
      caption: `MLS listing photo from ${when} · MLS ${subject.mlsNumber ?? '—'}. This may not show the home today.`,
    }
  }

  return { src: null, caption: 'No MLS photo on file for this home.' }
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
  // Cover prefers MLS photo; never a second map (C9). Non-map fallback when no photo.
  const hero = heroForSubject(a.subject)
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
  const band = a.extras?.band
  const productBar = cmaProductBarFromExtras({
    marketPresent: Boolean(a.market),
    marketGeoLabel: a.market?.geoLabel ?? null,
    placeLinks: places,
    nearbyActiveCount: band?.activeCount ?? null,
    nearbyPendingCount: band?.pendingCount ?? null,
    nearbyActiveLabels: [],
    recentSoldCount: a.comps.length,
    closedSalePrices: [],
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

export function renderCmaHtml(a: RenderCmaArgs): { html: string; pageCount: number } {
  // P10: cover, then the ONE chapter order both documents walk
  // (OPINION_CHAPTER_ORDER). Nothing is appended here — a chapter that exists
  // only on the letter is exactly the drift the shared order removes.
  const pages: PageDef[] = [coverPage(a), ...assembleOpinionPages(a)]
  const body = pages.map((p) => wrapPage(p)).join('\n')
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
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
