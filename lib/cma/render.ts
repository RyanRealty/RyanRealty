/**
 * Deterministic CMA HTML renderer — multi-page letter-format document.
 * Sunstone spine: cover, subject snapshot, facts, then market and comps.
 * Conditional legal, photos, permits, and seller-net omit when unknown.
 */

import { cmaStylesheet } from '@/lib/cma/render-css'
import {
  dateLong,
  escapeHtml,
  monthYear,
  reviewNoticeBandHtml,
  sparkPhotoAt,
} from '@/lib/cma/render-blocks'
import { readReviewNotice } from '@/lib/cma/render-contract'
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
import type { TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import type { DevelopmentOpportunities } from '@/lib/cma/development'
import type { RentalPotential } from '@/lib/cma/rental-potential'
import { assembleOpinionPages } from '@/lib/cma/opinion-pages'
import { coverWorthSentence, rangeSpreadCauseSentence } from '@/lib/cma/cover-value'
import {
  cmaCoverLabelHtml,
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
  /**
   * The centre, zoom and pin coordinates the map tile was drawn at, so the
   * document can put its own tappable pins over it (tasteReview item 2).
   * Resolved beside `mapDataUri` at SERVE, never stored on `render_args`.
   */
  mapOverlay?: import('@/lib/cma/comp-pin-map').CompPinMapOverlay | null
  /** Deprecated (C9). Letter ignores this — comps map is the single map. */
  subjectMapDataUri?: string | null
  generatedAtIso: string
  subjectTrace: string
  compTrace: string[]
  /**
   * The pricing side's own account of the comp search — the rungs it walked,
   * how many kept sales each supplied, and its sentence. Absent on every row
   * built before it landed; chapter 3 then derives the sentence from
   * `compTrace` and the printed sales (round-four class E).
   */
  compSearch?: unknown
  excludedOutliers: Array<{ address: string; closePrice: number; ppsf: number; reason: string }>
  sellerImprovementsText?: string | null
  site?: CmaSiteData | null
  /** Recorded lot polygons for the subject and its comps; drives "The land". */
  parcels?: CmaParcelSet | null
  expiredAudit?: ExpiredAuditData | null
  /**
   * Whose listing this is TODAY — `standardStatus`, whether it is active with
   * another brokerage, whether it was withdrawn rather than expired. Written
   * at build; the closing chapter reads it and stops asking for the listing
   * when it says somebody else has it (class D).
   */
  subjectStatus?: import('@/lib/cma/render-contract').CmaSubjectStatus | null
  development?: DevelopmentOpportunities | null
  rental?: RentalPotential | null
  extras?: CmaExtras | null
  subdivisionStory?: SubdivisionStory | null
  equity?: CmaEquityPosition | null
  listingPlan?: ListingPlan | null
  thisHomePlan?: string[] | null
  tiersUsed?: string[]
  /**
   * Who this document went to. Every address and CTA links back into the site
   * carrying it. Resolved at SERVE (print-html / serve-document), never stored
   * on render_args — identity belongs to the delivery, not to the figures.
   */
  docLinks?: TrackedDocLinkCtx | null
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
 *
 * THERE IS NOTHING HERE TO CHOOSE BETWEEN, and that is the finding, not an
 * omission (tasteReview round two, item 4: "the cover still opens on the
 * annotated aerial"). Checked on 2026-09-08 against the stored rows for all
 * four exemplars: `extras.photos.current` holds exactly ONE url on each,
 * `extras.photos.historical` is empty, and `subject.photoUrl` IS that url. The
 * annotated aerial on 2465 7th is the only photograph the MLS record carries
 * for that home. A renderer rule that skipped the first photo would degrade
 * every listing whose first photo is its front elevation, which is most of
 * them; the photo SET belongs to the build side, and until a row carries more
 * than one there is no selection to make.
 */
function heroForSubject(subject: CmaSubject): { src: string | null; caption: string; stale: boolean } {
  // C9: cover may use a photo, never a map — comps pin map is the single letter map.
  const src = sparkPhotoAt(subject.photoUrl, '1024x768')
  const when = monthYear(subject.lastListDate)
  const ageMonths = monthsSince(subject.lastListDate)
  const stale = ageMonths != null && ageMonths > STALE_SUBJECT_PHOTO_MONTHS

  if (src && !stale) {
    return {
      src,
      caption: `Most recent MLS listing photo${when !== '—' ? ` (${when})` : ''} · MLS ${subject.mlsNumber ?? '—'}`,
      stale: false,
    }
  }

  if (src) {
    return {
      src,
      caption: `MLS listing photo from ${when} · MLS ${subject.mlsNumber ?? '—'}. This may not show the home today.`,
      stale: true,
    }
  }

  return { src: null, caption: 'No MLS photo on file for this home.', stale: false }
}

/**
 * Chapter 0, per the blueprint: a full-bleed listing photo with a CREAM title
 * block over it. Address, one sentence, who it was prepared for, and the date.
 *
 * What came off it: a five-item product bar, a facts blurb, a specs line, a
 * search story, a photo credit, and a 72px number the reader meets again as
 * the title of chapter 3. A cover that says everything says nothing, and this
 * one had a navy scrim over the house so the photograph — the one thing a
 * seller actually wants to look at — read as a background texture.
 */
function coverPage(a: RenderCmaArgs): PageDef {
  // Cover prefers MLS photo; never a second map (C9). Non-map fallback when no photo.
  const hero = heroForSubject(a.subject)
  const prepared = [
    a.client.name ? `Prepared for ${a.client.name}` : 'Prepared',
    `by ${a.broker.displayName}, Ryan Realty`,
  ].join(' ')
  const worth = coverWorthSentence(a.pricing)
  // A quarter-of-the-price range meets the reader on the cover first, and it
  // said nothing about why it was that wide (tasteReview round two, §3.E).
  const why = rangeSpreadCauseSentence(a.pricing)
  return {
    cover: true,
    meta: `Pricing report · ${dateLong(a.generatedAtIso)}`,
    body: `
  <div class="cover-stage">
    ${hero.src ? `<img class="hero-photo" src="${esc(hero.src)}" alt="${esc(a.subject.streetAddress)}" />` : '<div class="hero-photo"></div>'}
    <div class="cover-plate">
      ${cmaCoverLabelHtml()}
      <h1 class="cover-title">${esc(a.subject.streetAddress)}</h1>
      <div class="cover-sub">${esc(a.subject.city)}, Oregon ${esc(a.subject.postalCode ?? '')}</div>
      ${worth ? `<p class="cover-worth">${esc(worth)}</p>` : ''}
      ${why ? `<p class="cover-why">${esc(why)}</p>` : ''}
      <p class="cover-presented">${esc(`${prepared} · ${dateLong(a.generatedAtIso)}`)}</p>
      ${hero.stale ? `<p class="hero-caption">${esc(hero.caption)}</p>` : ''}
    </div>
  </div>`,
  }

}

/**
 * The review band, directly under the cover.
 *
 * Round-four class C: it belongs on the sheet a reader turns to first, not on
 * a page of its own. `.page-cover` already breaks after itself, so prepending
 * the band to the first chapter puts it at the top of page two on paper and
 * immediately under the cover on screen — one sheet, no orphan page.
 */
function withReviewNotice(a: RenderCmaArgs, pages: PageDef[]): PageDef[] {
  const review = readReviewNotice(a.pricing)
  if (!review) return pages
  const band = reviewNoticeBandHtml(review.notice ?? '', 'letter')
  if (!band) return pages
  const at = pages.findIndex((p) => !p.cover)
  if (at < 0) return [...pages, { meta: 'Pricing report', body: band }]
  return pages.map((p, i) => (i === at ? { ...p, body: `${band}
${p.body}` } : p))
}

export function renderCmaHtml(a: RenderCmaArgs): { html: string; pageCount: number } {
  // P10: cover, then the ONE chapter order both documents walk
  // (OPINION_CHAPTER_ORDER). Nothing is appended here — a chapter that exists
  // only on the letter is exactly the drift the shared order removes.
  const pages: PageDef[] = withReviewNotice(a, [coverPage(a), ...assembleOpinionPages(a)])
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
