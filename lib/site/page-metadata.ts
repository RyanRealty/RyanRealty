import type { Metadata } from 'next'
import { getCanonicalSiteUrl, shareDescription } from '@/lib/share-metadata'

/**
 * Per-page Metadata helper for Next.js App Router.
 *
 * Returns a `Metadata` object pages spread into `export const metadata`.
 * Sets canonical URL, OG (title/description/image/url/siteName/type),
 * Twitter card defaults, and robots in one place so every page on the
 * site ships consistent social-share + indexing metadata.
 *
 * Per docs/EXECUTION_PLAN.md §9 Wave 2 Layer 2. Paired with
 * `<MetadataBlock>` (components/site/MetadataBlock.tsx) for the
 * JSON-LD side of the same per-page metadata contract.
 */

/**
 * THE TITLE BUDGET IS THE WHOLE DOCUMENT TITLE, SUFFIX INCLUDED (SITE-25).
 *
 * app/layout.tsx appends `title.template` — " | Ryan Realty — Central Oregon",
 * 31 characters — to every page title that is not `title: { absolute }`. The
 * old code capped the page's OWN title at 60 and then let those 31 land on top,
 * so the cap bought nothing and only sheared the phrase people search:
 *
 *   /subdivisions/rock-ridge-cabin-sites-of-black-butte-ranch
 *     "Homes for Sale in Rock Ridge Cabin Sites of Black Butte | Ryan Realty…"
 *     — the word "Ranch" cut off the end of a place name, on a 91-char title.
 *
 * The rule now:
 *   1. A trailing "| Central Oregon…" segment is dropped. The brand suffix
 *      already says Central Oregon; carrying it twice is the defect, not the
 *      style. This is why the registry pages pass a bare entity name — one
 *      region in the document title, contributed by the suffix.
 *   2. A place name is NEVER cut. An over-budget title truncates in the SERP
 *      display, which costs the brand at the tail; a sheared one loses the
 *      phrase entirely, which costs the match. Losing the tail is the cheaper
 *      loss, and the tail is where the brand already sits.
 *   3. The budget is therefore enforced where the input is ours to shorten —
 *      scripts/check-content-metadata.mjs bounds registry names at
 *      TITLE_BUDGET — not by cutting a recorded plat name at render time.
 *   4. What remains here is a backstop at DOC_CEILING (double the budget): a
 *      pathological title sheds WHOLE trailing "|" segments, and only a single
 *      segment longer than that is word-cut, never ending on a dangling
 *      separator, "&", "+", or comma.
 *
 * Every title stays a plain string, so app/layout.tsx's template is the ONE
 * place the brand is added and every page carries the same brand line. An
 * earlier draft flipped over-budget pages to a short " | Ryan Realty" via
 * `title: { absolute }`; at a 29-char budget that fired on nearly every place
 * page — a rule whose exception is the common case — and bought nothing, since
 * Google truncates both forms at the same pixel width.
 *
 * ci:title-brand-once exempts pageMetadata() arguments, so this stays green.
 */
/** Exactly what app/layout.tsx's title.template appends. Keep the two in sync. */
export const BRAND_SUFFIX = ' | Ryan Realty — Central Oregon'
/** The whole document title, suffix included. ~600px SERP proxy, not a hard limit. */
const MAX_TITLE = 60
/**
 * Room left for the page's own title once the layout suffix is counted.
 * scripts/check-content-metadata.mjs holds the registry names to this.
 */
export const TITLE_BUDGET = MAX_TITLE - BRAND_SUFFIX.length
/** Backstop only — double the budget. A document title past it is a content bug. */
const DOC_CEILING = MAX_TITLE * 2
const MAX_DESC = 155

export type PageMetadataInput = {
  /** Page title. Budget TITLE_BUDGET chars — the layout appends BRAND_SUFFIX. */
  title: string
  /** Page description — 100–160 chars recommended. Brand-voice-clean prose. */
  description: string
  /** Path relative to the site root, e.g. /cities/bend or /listings/12345. Leading slash required. */
  path: string
  /** Absolute or root-relative path to OG image (1200×630 recommended). Defaults to /og-default.png. */
  ogImage?: string
  /** OG type. Default 'website'. Use 'article' for blog posts. */
  ogType?: 'website' | 'article'
  /** Twitter image override. Defaults to ogImage. */
  twitterImage?: string
  /** Custom keywords. Falls back to brand defaults. */
  keywords?: ReadonlyArray<string>
  /**
   * Set to true to noindex (drafts, thin variants, out-of-area pages).
   * Emits "noindex, follow": the page leaves the index, its ~200 internal links
   * keep passing. Pair with `nofollow` only when the outbound links themselves
   * must not be crawled.
   */
  noindex?: boolean
  /**
   * Set to true to ALSO drop follow. Separate from `noindex` on purpose — the
   * two were fused as "noindex, nofollow", which told Google to discard every
   * internal link on ~580 rendered noindex pages, and made {index:false,
   * follow:true} inexpressible.
   */
  nofollow?: boolean
}

const DEFAULT_KEYWORDS: ReadonlyArray<string> = [
  'Central Oregon',
  'homes for sale',
  'real estate',
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'Ryan Realty',
]

// Dynamic, always-present OG image (the /og-default.png + /og-home.png static
// files never existed → every share rendered a broken image). The /api/og route
// renders a branded 1200×630 card; robots.ts allows /api/og for social scrapers.
const DEFAULT_OG_IMAGE = '/api/og?type=default'

/** The separators a title segment may end on, plus the two the old cut missed. */
const DANGLING_TOKEN = /\s*[|·—–&+-]\s*$/
const DANGLING_PUNCT = /[\s,;:]+$/

/**
 * Strip a brand the caller (or a DB seoTitle) already baked in, so the layout
 * template cannot double-brand ("Foo | Ryan Realty" + template was shipping
 * "Foo | Ryan Realty | Ryan Realty — Central Oregon").
 */
function stripBakedBrand(t: string): string {
  return t.replace(/\s*[|·—–-]\s*Ryan Realty\b.*$/i, '').trim()
}

/**
 * Drop trailing "| Central Oregon…" segments. The brand suffix supplies the
 * region once; a page-level copy is the duplicate this node exists to remove
 * (/parks/smith-rock shipped "Central Oregon" twice before the layout added a
 * third). Segment 0 is never dropped — a page titled "Central Oregon Housing
 * Market" keeps its name.
 */
function shedRegionSegments(t: string): string {
  const segments = t.split(' | ')
  while (segments.length > 1 && /^Central Oregon\b/i.test(segments[segments.length - 1].trim())) {
    segments.pop()
  }
  return segments.join(' | ').trim()
}

/** Cut on a word boundary, never leaving a dangling separator, "&", "+" or comma. */
function wordCut(t: string, max: number): string {
  if (t.length <= max) return t
  return t
    .slice(0, max)
    .replace(/\s+\S*$/, '') // drop the partial last word
    .replace(DANGLING_PUNCT, '') // "City, Ore" → "City," → "City"
    .replace(DANGLING_TOKEN, '') // a now-dangling "|", "—", "&" or "+"
    .replace(DANGLING_PUNCT, '')
    .trim()
}

/**
 * Normalize a page title: strip a baked brand, drop a duplicated region
 * segment, and cap at `max` on a word boundary without ever ending on a
 * dangling separator, "&" or "+".
 *
 * `max` defaults to the BACKSTOP room, not the budget: cutting a recorded place
 * name to fit 29 characters is the defect this node removed. `documentTitle` is
 * what decides whether a title is cut at all; this is the mechanism.
 */
export function cleanTitle(raw: string, max: number = DOC_CEILING - BRAND_SUFFIX.length): string {
  const original = raw.trim()
  const shed = shedRegionSegments(stripBakedBrand(original))
  const t = shed || original // brand-only input — keep the original rather than go empty
  return wordCut(t, max) || original
}

/**
 * The page's own title, ready for the layout template to brand. Always a plain
 * string: the template is the single place the brand is added.
 */
export function documentTitle(raw: string): string {
  const original = raw.trim()
  const base = shedRegionSegments(stripBakedBrand(original)) || original
  const room = DOC_CEILING - BRAND_SUFFIX.length
  if (base.length <= room) return base
  // Backstop. Shed WHOLE trailing qualifier segments first — a qualifier is
  // disposable, a place name is not — and word-cut only a single segment that
  // is still longer than the ceiling on its own.
  const segments = base.split(' | ')
  while (segments.length > 1 && segments.join(' | ').length > room) segments.pop()
  return wordCut(segments.join(' | '), room) || base
}

/**
 * Place-page document title. Do not emit "Central Oregon, Oregon" — that
 * truncates to "Central Oregon," and the layout suffix becomes
 * "Central Oregon, | Ryan Realty".
 */
export function publishPlaceHomesTitle(name: string, city: string | null | undefined): string {
  const place = name.trim()
  const cityName = (city ?? '').trim()
  if (!place) return 'Homes for Sale | Central Oregon'
  if (!cityName || /^central oregon$/i.test(cityName)) {
    return `Homes for Sale in ${place} | Central Oregon`
  }
  return `Homes for Sale in ${place} | ${cityName}, Oregon`
}

export function pageMetadata(input: PageMetadataInput): Metadata {
  const site = getCanonicalSiteUrl()
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`
  const canonical = `${site}${path}`
  const title = documentTitle(input.title)
  const description = shareDescription(input.description, MAX_DESC)
  const ogImage = input.ogImage ?? DEFAULT_OG_IMAGE
  const twitterImage = input.twitterImage ?? ogImage
  const ogImageUrl = ogImage.startsWith('http') ? ogImage : `${site}${ogImage}`

  return {
    title,
    description,
    keywords: [...(input.keywords ?? DEFAULT_KEYWORDS)],
    alternates: { canonical },
    openGraph: {
      // Social cards get no layout template, so they carry the page's own title.
      title,
      description,
      url: canonical,
      type: input.ogType ?? 'website',
      siteName: 'Ryan Realty',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [twitterImage.startsWith('http') ? twitterImage : `${site}${twitterImage}`],
    },
    // noindex no longer implies nofollow. ~580 rendered noindex pages each carry
    // ~200 internal links; "noindex, nofollow" told Google to drop every one.
    robots: { index: !input.noindex, follow: !input.nofollow },
  }
}
