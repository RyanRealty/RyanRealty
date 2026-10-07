// @no-static-params — on-demand ISR (SITE-29): generateStaticParams returns [] on purpose so nothing
// prerenders at build (ci:ssg-budget); the first hit renders and caches under `revalidate`.
/**
 * /blog/[slug] — one published article, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet (the article answer) -> article-body island -> Ledger (related homes
 * when the post names a buyable place) -> Ledger (related posts) -> Quiet
 * (contextual CTA, geo doors, valuation). Four of the six patterns.
 *
 * THE PAGE CONTRACT: generateMetadata (seo_title, seo_description, OG image
 * rules unchanged), Article JSON-LD via generateBlogSchema, BreadcrumbList,
 * V3SectionTracker pageType="blog_post", getBlogPostBySlug + getRelatedBlogPosts,
 * session and identity-bridge reads, the HTML body (dangerouslySetInnerHTML),
 * matchGeoLinksForPost, ShareButton (top of the island and bottom), author bio.
 *
 * DROPPED: KbBreadcrumb, KbFooter, SmoothScrollProvider. Dates go through
 * formatDate (Pacific), not toLocaleDateString.
 *
 * The article HTML is an island on purpose: V3Quiet items are strings, and
 * the CMS body is markup. Do not flatten it into a figure. The island still
 * uses the v3 measure/gutter (V3ArticleIsland.css). Current months-of-supply
 * claims rewrite through publishBlogCurrentMos + getMarketPulse.
 *
 * ONE RENDER PATH (2026-10-05): everything about the POST lives in
 * ./_v3/render-blog-post.tsx, which the login-only draft preview at
 * /admin/blog/preview/[slug] calls with the same row shape. This file keeps
 * what is about the ROUTE: the published-only read, generateMetadata, the ISR
 * config and the fallback notFound(). The draft read must never be imported
 * here. The real HTTP 404 for an unknown or draft slug is middleware.ts (0b2b).
 */

import { siteOrigin } from '@/lib/site-origin'
import { cleanTitle } from '@/lib/site/page-metadata'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getBlogPostBySlug } from '@/lib/data'
import { publishBlogReportPeriod } from '@/lib/blog/publish-blog-report-period'
import { renderBlogPost } from './_v3/render-blog-post'

const siteUrl = siteOrigin()

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)
  // THIS notFound() IS NOT THE 404. Next 16 streams metadata for every UA but
  // the HTML-limited bots (Googlebot is not one), so generateMetadata renders
  // under app/loading.tsx's Suspense boundary like the body does: a throw here
  // lands after the shell's 200 and ISR caches a 200 "Page not found"
  // (production, browser and Googlebot UA, 2026-10-05; the SITE-29 note that
  // metadata resolves before the shell was wrong). The real 404 is answered
  // before render by middleware.ts (0b2b) from the published-slug set
  // (lib/data/blog/publishedBlogSlugsEdge.ts). This stays as the fallback for
  // when that read fails and passes the request through.
  if (!post) notFound()

  const period = publishBlogReportPeriod({
    title: post.title,
    html: post.content?.trim() || post.excerpt?.trim() || '',
    seoTitle: post.seo_title,
  })
  // A DB seo_title can carry the brand already ("… | Ryan Realty"); the
  // layout template adds it, so strip it here or it prints twice (live SEO
  // audit 2026-10-04: /blog/new-federal-housing-law-central-oregon).
  const title = cleanTitle(period.metaTitle)
  const description =
    post.seo_description?.trim() ||
    post.excerpt?.trim() ||
    'Central Oregon housing market writing from Ryan Realty.'
  const canonical = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`
  const ogImageUrl = post.hero_image_url
    ? post.hero_image_url.includes('.supabase.co/storage/')
      ? post.hero_image_url
      : `${siteUrl}/api/og?type=blog&id=${encodeURIComponent(post.slug)}`
    : `${siteUrl}/api/og?type=default`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
      siteName: 'Ryan Realty',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: period.displayTitle }],
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
      ...(post.updated_at ? { modifiedTime: post.updated_at } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

// ISR ON DEMAND, ZERO BUILD-TIME FAN-OUT (SITE-29). A dynamic segment with no
// generateStaticParams at all is never cached: Next classifies it fully
// dynamic and every request rendered at origin (private, no-store, measured
// 2026-09-09 on next start). The empty list below is the on-demand shape
// ci:ssg-budget prescribes for /subdivisions: nothing prerenders at build (a
// fan-out over every post chains getBlogRelatedHomes → getCityListings and
// getDetachedMarket and cost 11.2 of 14 build minutes), the first hit renders
// and caches, and later hits are served for 86400s. The months-of-supply guard
// below then re-runs at most every 86400s, inside its intent.
export const dynamicParams = true
export const revalidate = 86400
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  // No per-visitor read here. Until 2026-09-09 this awaited the session and the
  // identity cookie beside the post and discarded both; each reads cookies(),
  // which made every blog post render at request time (private, no-store, CDN
  // MISS, ~100ms of TTFB) on the site's highest-impression class, for nothing:
  // ShareButton and V3SectionTracker are client components and hydrate their
  // own state (SITE-29).
  const post = await getBlogPostBySlug(slug)
  if (!post) notFound()

  return renderBlogPost(post)
}
