/**
 * /blog/[slug] — one published article, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet (the article answer) -> article-body island -> Ledger (related posts)
 * -> Quiet (geo doors and the valuation edge). Three of the six patterns.
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
 * claims rewrite through publishBlogCurrentMos + getMarketPulse. Place-about
 * posts render related homes through matchBlogPlace + publishBlogRelatedHomes.
 * Intra-page drive/median claims rewrite through publishBlogPlaceFigures.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  getBlogPostBySlug,
  getRelatedBlogPosts,
  getMarketPulse,
  getCityListings,
  getCommunityListings,
} from '@/lib/data'
import { matchGeoLinksForPost } from '@/lib/blog-geo-links'
import { matchBlogPlace } from '@/lib/blog/match-blog-place'
import { publishBlogRelatedHomes } from '@/lib/blog/publish-blog-related-homes'
import {
  blogClaimsPlaceFigures,
  publishBlogMedianGap,
  rewriteBlogPlaceFigures,
} from '@/lib/blog/publish-blog-place-figures'
import {
  BLOG_CURRENT_MOS_PLACES,
  blogClaimsCurrentMos,
  publishBlogCurrentMos,
  rewriteBlogCurrentMos,
} from '@/lib/blog/publish-blog-current-mos'
import { BlogRelatedHomes } from './_v3/BlogRelatedHomes'
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

  const title = post.seo_title?.trim() || `${post.title} | Ryan Realty Blog`
  let description =
    post.seo_description?.trim() ||
    post.excerpt?.trim() ||
    'Central Oregon housing market writing from Ryan Realty.'
  if (blogClaimsPlaceFigures(description)) {
    const [redmondPulse, bendPulse] = await Promise.all([
      getMarketPulse({ geoType: 'city', geoSlug: 'redmond' }),
      getMarketPulse({ geoType: 'city', geoSlug: 'bend' }),
    ])
    description = rewriteBlogPlaceFigures(
      description,
      publishBlogMedianGap(redmondPulse, bendPulse),
    )
  }
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
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }],
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
  const pageUrl = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`
  const readMinutes = estimateReadTime(post.content)
  const rawBody = post.content?.trim() || post.excerpt?.trim() || ''
  const place = matchBlogPlace(post)
  const claimsPlaceFigures = blogClaimsPlaceFigures(rawBody)
  const [mosPulses, placeTiles, redmondPulse, bendPulse] = await Promise.all([
    blogClaimsCurrentMos(rawBody)
      ? Promise.all(
          BLOG_CURRENT_MOS_PLACES.map((row) =>
            getMarketPulse({ geoType: row.geoType, geoSlug: row.geoSlug }),
          ),
        )
      : Promise.resolve(null),
    place
      ? Promise.all(
          place.queryNames.slice(0, 4).map((name) =>
            place.kind === 'community'
              ? getCommunityListings(name, {
                  status: 'active',
                  propertyType: 'A',
                  sort: 'newest',
                  limit: 8,
                })
              : getCityListings(name, {
                  status: 'active',
                  propertyType: 'A',
                  sort: 'newest',
                  limit: 8,
                }),
          ),
        ).then((batches) => batches.flat())
      : Promise.resolve([]),
    claimsPlaceFigures ? getMarketPulse({ geoType: 'city', geoSlug: 'redmond' }) : Promise.resolve(null),
    claimsPlaceFigures ? getMarketPulse({ geoType: 'city', geoSlug: 'bend' }) : Promise.resolve(null),
  ])
  const mosBody = mosPulses
    ? rewriteBlogCurrentMos(rawBody, publishBlogCurrentMos(BLOG_CURRENT_MOS_PLACES, mosPulses))
    : rawBody
  const articleBody = claimsPlaceFigures
    ? rewriteBlogPlaceFigures(mosBody, publishBlogMedianGap(redmondPulse, bendPulse))
    : mosBody
  const articleSchema = generateBlogSchema({
    title: post.title,
    slug: post.slug,
    excerpt: claimsPlaceFigures
      ? rewriteBlogPlaceFigures(post.excerpt ?? '', publishBlogMedianGap(redmondPulse, bendPulse))
      : post.excerpt,
    published_at: post.published_at,
    updated_at: post.updated_at,
    image: post.hero_image_url
      ? `${siteUrl}/api/og?type=blog&id=${encodeURIComponent(post.slug)}`
      : undefined,
    author_name: post.author_name,
  })
  const relatedHomes = place ? publishBlogRelatedHomes(place, placeTiles) : null
  const title = post.title.trim()
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
  if (place && !geoItems.some((item) => 'href' in item && item.href === place.href)) {
    geoItems.unshift({ label: `${place.label} homes for sale`, href: place.href })
  }

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
                { name: post.title, url: `/blog/${encodeURIComponent(post.slug)}` },
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
                title={post.title}
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

        {relatedHomes ? <BlogRelatedHomes homes={relatedHomes} /> : null}

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
            ...geoItems,
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
