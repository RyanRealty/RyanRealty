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
 * Defaults match the brand voice (no banned vocabulary). Inputs are
 * trimmed and capped to 60/155 chars where the platforms truncate.
 *
 * Per docs/EXECUTION_PLAN.md §9 Wave 2 Layer 2. Paired with
 * `<MetadataBlock>` (components/site/MetadataBlock.tsx) for the
 * JSON-LD side of the same per-page metadata contract.
 */

const MAX_TITLE = 60
const MAX_DESC = 155

export type PageMetadataInput = {
  /** Page title; auto-appended with " | Ryan Realty — Central Oregon Real Estate" via layout.tsx template. */
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
  /** Set to true to noindex (drafts, preview routes). Default false. */
  noindex?: boolean
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

export function pageMetadata(input: PageMetadataInput): Metadata {
  const site = getCanonicalSiteUrl()
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`
  const canonical = `${site}${path}`
  const title = input.title.trim().slice(0, MAX_TITLE)
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
    robots: input.noindex ? 'noindex, nofollow' : 'index, follow',
  }
}
