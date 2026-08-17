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
import { getBlogPostBySlug, getRelatedBlogPosts, getMarketPulse } from '@/lib/data'
import { getBlogRelatedHomes } from '@/lib/data/blog/getBlogRelatedHomes'
import { matchGeoLinksForPost } from '@/lib/blog-geo-links'
import {
  matchBuyablePlaceForPost,
  publishBlogContextualCta,
  publishBlogRelatedHomes,
} from '@/lib/blog/publish-blog-related-homes'
import { publishBlogReportPeriod } from '@/lib/blog/publish-blog-report-period'
import { blogRelatedHomeRows } from './_v3/blog-related-homes'
import {
  BLOG_CURRENT_MOS_PLACES,
  blogClaimsCurrentMos,
  publishBlogCurrentMos,
  rewriteBlogCurrentMos,
} from '@/lib/blog/publish-blog-current-mos'
import '@/components/site/v3/V3ArticleIsland.css'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { generateBlogSchema } from '@/lib/structured-data'
import ShareButton from '@/components/ShareButton'
import { formatDate } from '@/lib/format/date'
import { valuationHref } from '@/lib/site/valuation-href'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
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
  if (!post) return { title: 'Post Not Found | Ryan Realty', robots: { index: false, follow: true } }

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

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const [post] = await Promise.all([
    getBlogPostBySlug(slug),
    getSession(),
    getPersonIdFromCookie(),
  ])
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
  const articleBody = blogClaimsCurrentMos(rawBody)
    ? rewriteBlogCurrentMos(
        rawBody,
        publishBlogCurrentMos(
          BLOG_CURRENT_MOS_PLACES,
          await Promise.all(
            BLOG_CURRENT_MOS_PLACES.map((place) =>
              getMarketPulse({ geoType: place.geoType, geoSlug: place.geoSlug }),
            ),
          ),
        ),
      )
    : rawBody
  const title = period.displayTitle.trim()
  if (!title) notFound()
  const category = post.category?.trim()
  const publishedLabel = post.published_at ? formatDate(post.published_at) : null

  const relatedRows: V3LedgerPlainRow[] = []
  for (const related of relatedPosts) {
    const relatedTitle = related.title?.trim()
    const relatedSlug = related.slug?.trim()
    if (!relatedTitle || !relatedSlug) continue
    relatedRows.push({
      href: `/blog/${relatedSlug}`,
      when: v3Text(related.published_at ? formatDate(related.published_at) : 'Guide'),
      what: v3Text(relatedTitle),
      id: relatedSlug,
    })
  }
  const [firstRelated, ...restRelated] = relatedRows

  const geoItems: V3QuietItem[] = matchGeoLinksForPost(post).map((geo) => ({
    label: `${geo.label}, ${geo.city}`,
    href: geo.href,
  }))
  const exploreHrefs = new Set<string>([contextualCta.href])

  const tagBody = post.tags && post.tags.length > 0 ? post.tags.filter((t) => t.trim()).join(' · ') : null

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="blog_post" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
        <MetadataBlock
          schemas={[
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
            { label: title },
          ]}
        />

        <V3Quiet
          id="post"
          heading={title}
          headingLevel={1}
          eyebrow={category ? `${category} · Central Oregon` : 'Central Oregon market writing'}
          items={[
            {
              kind: 'prose',
              body: [
                post.author_name?.trim()
                  ? post.author_name.trim()
                  : 'Ryan Realty',
                publishedLabel ?? 'Date not recorded',
                `${readMinutes} min read`,
              ].join(' · '),
            },
            ...(period.periodNote ? [{ kind: 'prose' as const, body: period.periodNote }] : []),
          ]}
        />

        <article id="article-body" aria-label={title}>
          {post.hero_image_url ? (
            <div className="relative mt-8 aspect-video overflow-hidden">
              <Image
                src={post.hero_image_url}
                alt={title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 880px"
                priority
              />
            </div>
          ) : null}

          <div className="v3-article-island">
            {articleBody ? (
              <div className="prose mt-8 max-w-prose" dangerouslySetInnerHTML={{ __html: articleBody }} />
            ) : (
              <p>This article is being updated.</p>
            )}

            <div className="mt-8">
              <ShareButton
                url={pageUrl}
                title={period.displayTitle}
                text={post.excerpt ?? undefined}
                trackContext="blog_post"
                variant="default"
              />
            </div>

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

        {firstRelated ? (
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
          heading="Keep reading"
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
