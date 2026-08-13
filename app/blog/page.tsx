/**
 * /blog — Central Oregon market writing index, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Instrument (the index answer) -> Ledger (the posts) -> Quiet (categories,
 * popular, pagination). Three of the six patterns.
 *
 * THE PAGE CONTRACT: generateMetadata (canonical, OG, Twitter, robots via
 * shouldNoIndexBlogIndex), Blog + ItemList JSON-LD, BreadcrumbList, a rendered
 * V3SectionTracker with pageType="blog", the three parallel reads
 * (getBlogCategories, getPublishedBlogPosts, getPopularBlogSlugs) plus the
 * session and identity-bridge reads that pin this route dynamic.
 *
 * DROPPED: KbHero, KbBreadcrumb, KbFooter, SmoothScrollProvider, the featured
 * photo grid and art-card layout. Every post that used to render still renders,
 * as a Ledger row (title, date, category, excerpt). ShareButton stays as an
 * island above the list.
 */

import type { Metadata } from 'next'
import { getPublishedBlogPosts, getPopularBlogSlugs } from '@/lib/data'
import { getBlogCategories } from '@/app/actions/blog'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { shouldNoIndexBlogIndex } from '@/lib/seo-routing'
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
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

type BlogSearchParams = { category?: string; page?: string }

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<BlogSearchParams>
}): Promise<Metadata> {
  const params = await searchParams
  const shouldNoIndex = shouldNoIndexBlogIndex(params)
  const title = 'Central Oregon market writing'
  const description =
    'How homes are selling in Bend and the towns around it. Monthly numbers, neighborhood context, and what changed.'
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/blog` },
    robots: shouldNoIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: 'Central Oregon market writing | Ryan Realty',
      description,
      url: `${siteUrl}/blog`,
      type: 'website',
      images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty blog' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Central Oregon market writing | Ryan Realty',
      description,
      images: [defaultOgImage],
    },
  }
}

type PageProps = { searchParams: Promise<BlogSearchParams> }

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const params = await searchParams
  const category = params.category?.trim() || 'All'
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * 12
  const [categories, { posts, total }, popularSlugs] = await Promise.all([
    getBlogCategories(),
    getPublishedBlogPosts({ category: category === 'All' ? null : category, limit: 12, offset }),
    getPopularBlogSlugs(5),
    getSession(),
    getPersonIdFromCookie(),
  ])
  const totalPages = Math.ceil(total / 12)

  const postRows: V3LedgerPlainRow[] = []
  for (const post of posts) {
    const title = post.title?.trim()
    const slug = post.slug?.trim()
    if (!title || !slug) continue
    const excerpt = post.excerpt?.trim()
    const when = post.published_at ? formatDate(post.published_at) : post.category?.trim() || 'Guide'
    postRows.push({
      href: `/blog/${slug}`,
      when: v3Text(when),
      what: v3Text(title),
      detail: excerpt
        ? v3Text(excerpt)
        : post.category
          ? v3Text(`${post.category} · ${post.read_time_min} min read`)
          : v3Text(`${post.read_time_min} min read`),
      id: slug,
    })
  }
  const [firstPost, ...restPosts] = postRows

  const categoryItems: V3QuietItem[] = categories
    .map((cat) => cat.trim())
    .filter((cat): cat is string => Boolean(cat))
    .map((cat) => ({
      label: cat === category ? `${cat} (showing)` : cat,
      href: cat === 'All' ? '/blog' : `/blog?category=${encodeURIComponent(cat)}`,
    }))

  const popularItems: V3QuietItem[] = []
  for (const post of popularSlugs.slice(0, 5)) {
    const title = post.title?.trim()
    const slug = post.slug?.trim()
    if (!title || !slug) continue
    popularItems.push({ label: title, href: `/blog/${slug}` })
  }

  const pageItems: V3QuietItem[] = []
  if (totalPages > 1) {
    pageItems.push({
      kind: 'prose',
      term: 'Pages',
      body: `Page ${page} of ${totalPages}`,
    })
    if (page > 1) {
      pageItems.push({
        label: 'Previous page',
        href: `/blog?page=${page - 1}${category !== 'All' ? `&category=${encodeURIComponent(category)}` : ''}`,
      })
    }
    if (page < totalPages) {
      pageItems.push({
        label: 'Next page',
        href: `/blog?page=${page + 1}${category !== 'All' ? `&category=${encodeURIComponent(category)}` : ''}`,
      })
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Central Oregon market writing | Ryan Realty',
    url: `${siteUrl}/blog`,
    description:
      'How homes are selling in Bend and the towns around it. Monthly numbers, neighborhood context, and what changed.',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: posts.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${siteUrl}/blog/${encodeURIComponent(p.slug)}`,
        name: p.title,
      })),
    },
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="blog" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <MetadataBlock
          schemas={[
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Blog', url: '/blog' },
              ],
            },
          ]}
        />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Blog' }]} />

        <V3Instrument
          id="writing"
          level={1}
          eyebrow={v3Text('Central Oregon')}
          headline={v3Text('Central Oregon market writing')}
          figures={[
            {
              value: v3Text(total.toLocaleString('en-US')),
              label: v3Text(category === 'All' ? 'published posts' : `posts in ${category}`),
              href: '/blog',
            },
          ]}
          source={v3Text(
            'published rows from blog_posts, newest first, twelve per page. Category filters read the same table',
          )}
          action={{
            label: v3Text('Value my home'),
            href: valuationHref('/blog'),
            variant: 'primary',
          }}
        />

        <ShareButton
          url={`${siteUrl}/blog`}
          title="Central Oregon market writing"
          text="How homes are selling in Bend and the towns around it, from Ryan Realty."
          trackContext="blog_index"
          variant="default"
        />

        {firstPost ? (
          <V3Ledger
            id="latest"
            eyebrow={v3Text('Latest posts')}
            heading={v3Text(category === 'All' ? 'All posts' : category)}
            rows={[firstPost, ...restPosts]}
          />
        ) : (
          <V3Ledger
            id="latest"
            eyebrow={v3Text('Latest posts')}
            heading={v3Text(category === 'All' ? 'All posts' : category)}
            rows={[]}
            emptyMessage={v3Text('No posts in this category yet.')}
            action={{ label: v3Text('View all posts'), href: '/blog' }}
          />
        )}

        <V3Quiet
          id="explore"
          eyebrow="Index"
          heading="Categories and recent posts"
          items={[
            ...categoryItems,
            ...popularItems,
            ...pageItems,
            { label: 'Central Oregon housing market', href: '/housing-market' },
            { label: 'Value my home', href: valuationHref('/blog') },
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
