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
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getBlogPostBySlug, getRelatedBlogPosts, getDetachedMarket } from '@/lib/data'
import { getBlogRelatedHomes } from '@/lib/data/blog/getBlogRelatedHomes'
import { matchGeoLinksForPost } from '@/lib/blog-geo-links'
import {
  matchBuyablePlaceForPost,
  publishBlogContextualCta,
  publishBlogRelatedHomes,
} from '@/lib/blog/publish-blog-related-homes'
import { publishBlogReportPeriod } from '@/lib/blog/publish-blog-report-period'
import { blogRelatedHomeRows } from './_v3/blog-related-homes'
import { buildBlogArticleView } from './_v3/article-view'
import { BlogArticleRail } from './_v3/BlogArticleRail.client'
import './_v3/blog-article.css'
import {
  BLOG_CURRENT_MOS_PLACES,
  blogClaimsCurrentMos,
  publishBlogCurrentMos,
  rewriteBlogCurrentMos,
} from '@/lib/blog/publish-blog-current-mos'
import { rewriteBlogMosVerdicts } from '@/lib/blog/publish-blog-mos-verdicts'
import { publishBlogFaq } from '@/lib/blog/publish-blog-faq'
import '@/components/site/v3/V3ArticleIsland.css'
import { generateBlogSchema } from '@/lib/structured-data'
import ShareButton from '@/components/ShareButton'
import { formatDate } from '@/lib/format/date'
import { valuationHref } from '@/lib/site/valuation-href'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Doors,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  V3Stage,
  type V3Door,
  type V3LedgerFigureRow,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

type PageProps = { params: Promise<{ slug: string }> }

function stripHtml(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function estimateReadTime(content: string | null | undefined): number {
  const text = stripHtml(content)
  if (!text) return 2
  return Math.max(1, Math.round(text.split(/\s+/).length / 220))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)
  // notFound() here, in generateMetadata: app/loading.tsx opens a Suspense
  // boundary on every route, so the page body's notFound() lands after the
  // shell's 200 has flushed and a crawler reads a 200 "Post Not Found" with no
  // H1 (measured 2026-09-09 on next start). Metadata resolves before the
  // shell, so this one is a real 404 (SITE-29).
  if (!post) notFound()

  const period = publishBlogReportPeriod({
    title: post.title,
    html: post.content?.trim() || post.excerpt?.trim() || '',
    seoTitle: post.seo_title,
  })
  const title = period.metaTitle
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
// and caches, and later hits are served for 300s. The months-of-supply guard
// below then re-runs at most every 300s, inside its intent.
export const dynamicParams = true
export const revalidate = 300
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

  const relatedPosts = await getRelatedBlogPosts(post.slug, post.category, 3)
  const buyablePlace = matchBuyablePlaceForPost(post)
  const relatedHomeTiles = buyablePlace ? await getBlogRelatedHomes(buyablePlace, 8) : []
  const publishedHomes = publishBlogRelatedHomes({
    place: buyablePlace,
    listingKeys: relatedHomeTiles.map((tile) => tile.listingKey),
  })
  const relatedHomeRows: V3LedgerFigureRow[] = publishedHomes
    ? blogRelatedHomeRows(
        relatedHomeTiles.filter((tile) => publishedHomes.listingKeys.includes(tile.listingKey)),
      )
    : []
  const [firstRelatedHome, ...restRelatedHomes] = relatedHomeRows
  const contextualCta = publishBlogContextualCta(buyablePlace)
  const pageUrl = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`
  const readMinutes = estimateReadTime(post.content)
  const rawBody = post.content?.trim() || post.excerpt?.trim() || ''
  const period = publishBlogReportPeriod({
    title: post.title,
    html: rawBody,
    seoTitle: post.seo_title,
  })
  const articleSchema = generateBlogSchema({
    title: period.displayTitle,
    slug: post.slug,
    excerpt: post.excerpt,
    published_at: post.published_at,
    updated_at: post.updated_at,
    image: post.hero_image_url
      ? `${siteUrl}/api/og?type=blog&id=${encodeURIComponent(post.slug)}`
      : undefined,
    author_name: post.author_name,
  })
  // AEO: the Questions section of a guide is also its FAQPage schema. Same
  // markup, one source, so the schema cannot drift from the visible answers.
  const faqSchema = publishBlogFaq(rawBody)
  const currentMosBody = blogClaimsCurrentMos(rawBody)
    ? rewriteBlogCurrentMos(
        rawBody,
        publishBlogCurrentMos(
          BLOG_CURRENT_MOS_PLACES,
          // D27: the live months-of-supply guard reads leftover detached membership,
          // the same pile every public page and client document reads. This is not a
          // published figure from the post — it exists so an archived post cannot
          // assert a stale verdict — so moving it does not rewrite the archive. A
          // leftover miss returns null, and publishBlogCurrentMos withholds that
          // place rather than asserting a verdict off a population we did not read.
          await Promise.all(
            BLOG_CURRENT_MOS_PLACES.map(async (place) => {
              // Leftover publishes city, region and neighborhood. "Central Oregon
              // overall" is the region row and is the row this guard exists for, so
              // it must not be narrowed away. getDetachedMarket normalises the slug,
              // which is what makes the list's cache-alphabet 'la pine' resolve to
              // the metric alphabet 'la-pine'. Any other grain withholds rather than
              // being coerced into one we did not read.
              if (
                place.geoType !== 'city' &&
                place.geoType !== 'region' &&
                place.geoType !== 'neighborhood'
              ) {
                return null
              }
              const row = await getDetachedMarket(place.geoType, place.geoSlug).catch(() => null)
              if (!row || row.monthsOfSupply == null) return null
              return {
                monthsOfSupply: row.monthsOfSupply,
                activeCount: row.activeCount,
                refreshedAt: row.computedAt,
              }
            }),
          ),
        ),
      )
    : rawBody
  const articleBody = rewriteBlogMosVerdicts(currentMosBody)
  // The reading apparatus, derived from the body and from nothing else: the
  // figures the writer already sourced in a sentence, the questions the post
  // answers, the Questions block as disclosures, every citation wearing its
  // host. ./_v3/article-view.ts states what it refuses to infer.
  const view = buildBlogArticleView(articleBody)
  const title = period.displayTitle.trim()
  if (!title) notFound()
  const category = post.category?.trim()
  const publishedLabel = post.published_at ? formatDate(post.published_at) : null
  // A dateline, the way a printed guide carries one — not a taxonomy label. The
  // category still does real work one line down, as a link to its archive.
  const mastheadEyebrow = [category ?? 'Central Oregon', publishedLabel].filter(Boolean).join(' · ')
  // The crumb names the SUBJECT. A guide title states a decision ("Awbrey Glen:
  // A $1,349,000 Median and an $87 HOA") and at 375 it wraps inside its own
  // crumb, leaving the separator hanging on a line by itself; the part before
  // the colon is both shorter and a better name for where the reader is. The
  // full title is the H1 one element below, and is what the BreadcrumbList
  // JSON-LD carries.
  const crumbSubject = title.split(':')[0]?.trim() ?? title
  const crumbLabel =
    crumbSubject !== title && crumbSubject.length >= 4 && crumbSubject.length <= 26
      ? crumbSubject
      : title.length > 34
        ? `${title.slice(0, 34).replace(/[\s:,–-]+\S*$/, '')}…`
        : title
  const bylineLine = [
    post.author_name?.trim() ? post.author_name.trim() : 'Ryan Realty',
    publishedLabel ?? 'Date not recorded',
    `${readMinutes} min read`,
  ].join(' · ')

  const relatedRows: V3LedgerPlainRow[] = []
  for (const related of relatedPosts) {
    const relatedTitle = related.title?.trim()
    const relatedSlug = related.slug?.trim()
    if (!relatedTitle || !relatedSlug) continue
    // SITE-52: the heading is already "Related posts", so a 'Guide' fallback
    // would only repeat it — the published date is the context line worth
    // printing, and a post with none carries no when at all.
    relatedRows.push({
      href: `/blog/${relatedSlug}`,
      ...(related.published_at ? { when: v3Text(formatDate(related.published_at)) } : {}),
      what: v3Text(relatedTitle),
      id: relatedSlug,
    })
  }
  const [firstRelated, ...restRelated] = relatedRows
  // Keep reading is a DOOR, not a second Ledger. Two Ledgers in a row is the
  // stacked-section page PUBLIC_UI's rhythm rule and TASTE.md both name: the
  // homes above are rows of figures, so the posts below are photographs.
  const relatedDoors: V3Door[] = relatedPosts.flatMap((related) => {
    const relatedTitle = related.title?.trim()
    const relatedSlug = related.slug?.trim()
    if (!relatedTitle || !relatedSlug) return []
    return [
      {
        kicker: v3Text(related.published_at ? formatDate(related.published_at) : 'Guide'),
        label: v3Text(relatedTitle),
        href: `/blog/${relatedSlug}`,
        ...(related.hero_image_url
          ? { imageSrc: related.hero_image_url, imageAlt: relatedTitle }
          : {}),
      },
    ]
  })

  const geoItems: V3QuietItem[] = matchGeoLinksForPost(post).map((geo) => ({
    label: `${geo.label}, ${geo.city}`,
    href: geo.href,
  }))
  const exploreHrefs = new Set<string>([contextualCta.href])

  const tagBody = post.tags && post.tags.length > 0 ? post.tags.filter((t) => t.trim()).join(' · ') : null

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
        <MetadataBlock
          schemas={[
            ...(faqSchema ? [faqSchema] : []),
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Blog', url: '/blog' },
                { name: period.displayTitle, url: `/blog/${encodeURIComponent(post.slug)}` },
              ],
            },
          ]}
        />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Blog', href: '/blog' },
            { label: crumbLabel },
          ]}
        />

        {/* THE MASTHEAD. The photograph is the ground the title stands on, not a
            screen of scenery the reader scrolls past: `compact` takes the Stage's
            height from its own copy, so the byline and the first figures are in
            the same first view on desktop. A post with no owned image keeps the
            Quiet masthead rather than borrowing someone else's photograph. */}
        {post.hero_image_url ? (
          <V3Stage
            id="post"
            headline={title}
            headingLevel={1}
            height="compact"
            overlayStrength="deep"
            posterSrc={post.hero_image_url}
            eyebrow={mastheadEyebrow}
          />
        ) : (
          <V3Quiet
            id="post"
            heading={title}
            headingLevel={1}
            eyebrow={mastheadEyebrow}
            items={[{ kind: 'prose', body: bylineLine }]}
          />
        )}

        <article id="article-body" aria-label={title}>
          <div className="v3-article-island">
            <div className="v3-blog-byline">
              <p className="v3-blog-byline-meta">{bylineLine}</p>
              <div className="v3-blog-byline-actions">
                {category ? (
                  <Link
                    className="v3-blog-byline-link"
                    href={`/blog?category=${encodeURIComponent(category)}`}
                  >
                    More in {category}
                  </Link>
                ) : null}
                <ShareButton
                  url={pageUrl}
                  title={period.displayTitle}
                  text={post.excerpt ?? undefined}
                  trackContext="blog_post"
                  variant="default"
                  className="v3-blog-share"
                />
              </div>
            </div>

            {post.excerpt?.trim() ? <p className="v3-blog-dek">{post.excerpt.trim()}</p> : null}
            {period.periodNote ? <p className="v3-blog-dek">{period.periodNote}</p> : null}

            {view.html ? (
              <div className="v3-blog-layout">
                <BlogArticleRail figures={view.figures} sections={view.sections} title={title} />
                <div
                  className="v3-blog-prose prose max-w-prose"
                  dangerouslySetInnerHTML={{ __html: view.html }}
                />
              </div>
            ) : (
              <p className="v3-blog-dek">This article is being updated.</p>
            )}

            {post.author_name ? (
              <section className="mt-10" aria-label="About the author">
                {post.author_photo_url ? (
                  <Image
                    src={post.author_photo_url}
                    alt={post.author_name}
                    width={64}
                    height={64}
                    className="object-cover"
                  />
                ) : null}
                {post.author_slug ? (
                  <Link href={`/team/${post.author_slug}`}>{post.author_name}</Link>
                ) : (
                  <p>{post.author_name}</p>
                )}
                <p>
                  {post.author_title ? `${post.author_title} at Ryan Realty.` : 'Ryan Realty.'}
                </p>
              </section>
            ) : null}
          </div>
        </article>

        {firstRelatedHome && buyablePlace ? (
          <V3Ledger
            id="related-homes"
            eyebrow={v3Text('On the market now')}
            heading={v3Text(`${buyablePlace.label} homes`)}
            rows={[firstRelatedHome, ...restRelatedHomes]}
            source={v3Text(`Active SFR in ${buyablePlace.label}. Same inventory as ${buyablePlace.href}.`)}
            action={{ label: v3Text(contextualCta.label), href: contextualCta.href }}
          />
        ) : null}

        {relatedDoors.length >= 2 ? (
          <V3Doors
            id="related"
            name={v3Text('Keep reading')}
            doors={relatedDoors as [V3Door, V3Door, ...V3Door[]]}
          />
        ) : firstRelated ? (
          <V3Ledger
            id="related"
            eyebrow={v3Text('Keep reading')}
            heading={v3Text('Related posts')}
            rows={[firstRelated, ...restRelated]}
            action={{ label: v3Text('All posts'), href: '/blog' }}
          />
        ) : null}

        <V3Quiet
          id="explore"
          eyebrow="More resources"
          heading="Next steps"
          items={[
            { label: contextualCta.label, href: contextualCta.href },
            ...geoItems.filter((item) => !('href' in item) || !exploreHrefs.has(item.href)),
            ...(tagBody ? [{ kind: 'prose' as const, term: 'Tags', body: tagBody }] : []),
            { label: 'All posts', href: '/blog' },
            ...(category
              ? [{ label: `More in ${category}`, href: `/blog?category=${encodeURIComponent(category)}` }]
              : []),
            { label: 'Value my home', href: valuationHref(`/blog/${post.slug}`) },
          ]}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. The KB page nested KbFooter the same way, and
          ci:default-chrome-footer counts footers without checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
