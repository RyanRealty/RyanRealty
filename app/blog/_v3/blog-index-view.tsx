/**
 * The blog index, one view for four routes (SITE-29).
 *
 * /blog, /blog/category/<category>, /blog/page/<n>, and
 * /blog/category/<category>/page/<n> each read their locator from the PATH,
 * load the same three DAL reads, and render this. The bare index therefore
 * awaits no searchParams, which is what lets it prerender and revalidate;
 * until 2026-09-09 it read ?category= and ?page= on every request and so
 * rendered at request time for a query it almost never received.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Market grain for this leaf: the posts are the page. Ledger of posts fills
 * the fold. Count is a caption. Quiet holds categories, popular, pagination.
 * Two of the six patterns.
 *
 * THE PAGE CONTRACT: canonical, OG, Twitter, robots via shouldNoIndexBlogIndex
 * (category and page views stay noindex, as they were on the query form),
 * Blog + ItemList JSON-LD, BreadcrumbList, a rendered V3SectionTracker with
 * pageType="blog", the three parallel reads (BLOG_CATEGORIES,
 * getPublishedBlogPosts, getPopularBlogSlugs). No per-visitor read.
 */

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import type { GetPublishedBlogPostsResult, getPopularBlogSlugs } from '@/lib/data'
import { shouldNoIndexBlogIndex } from '@/lib/seo-routing'
import { BLOG_CATEGORIES } from '@/lib/blog/categories'
import ShareButton from '@/components/ShareButton'
import { valuationHref } from '@/lib/site/valuation-href'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { blogIndexCaption, blogIndexRow } from './blog-index-rows'
import { publishBlogIndexItemList } from '@/lib/blog/publish-blog-index-list'
import {
  BLOG_PAGE_SIZE,
  blogIndexHref,
  blogIndexTotalPages,
  blogIndexTrail,
  type BlogIndexLocator,
} from './blog-index-paths'

export const BLOG_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
/** Every index view canonicalizes to the bare index, as the query form did. */
export const BLOG_INDEX_CANONICAL = `${BLOG_SITE_URL}/blog`
const defaultOgImage = `${BLOG_SITE_URL}/api/og?type=default`

export const BLOG_INDEX_TITLE = 'Central Oregon market writing'
export const BLOG_INDEX_DESCRIPTION =
  'How homes are selling in Bend and the towns around it. Monthly numbers, neighborhood context, and what changed.'

/**
 * Everything but `alternates`, which each route sets in its own file so the
 * SEO authoring gate can see the canonical where the route is.
 */
export function blogIndexMetadata({ category, page }: BlogIndexLocator): Omit<Metadata, 'alternates'> {
  const shouldNoIndex = shouldNoIndexBlogIndex({ category, page: String(page) })
  return {
    title: BLOG_INDEX_TITLE,
    description: BLOG_INDEX_DESCRIPTION,
    robots: shouldNoIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: `${BLOG_INDEX_TITLE} | Ryan Realty`,
      description: BLOG_INDEX_DESCRIPTION,
      url: BLOG_INDEX_CANONICAL,
      type: 'website',
      images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty blog' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${BLOG_INDEX_TITLE} | Ryan Realty`,
      description: BLOG_INDEX_DESCRIPTION,
      images: [defaultOgImage],
    },
  }
}

export type BlogIndexViewProps = BlogIndexLocator & {
  posts: GetPublishedBlogPostsResult['posts']
  total: number
  popularSlugs: Awaited<ReturnType<typeof getPopularBlogSlugs>>
  /**
   * The route renders its own <V3Breadcrumb trail={blogIndexTrail(loc)} />
   * (ci:breadcrumb reads the page file); the view seats it first in <main>
   * and mirrors the same trail into the BreadcrumbList JSON-LD.
   */
  breadcrumb: ReactNode
}

export function BlogIndexView({ category, page, posts, total, popularSlugs, breadcrumb }: BlogIndexViewProps) {
  const offset = (page - 1) * BLOG_PAGE_SIZE
  const totalPages = blogIndexTotalPages(total)
  const trail = blogIndexTrail({ category, page })
  const breadcrumbItems = trail.map((crumb) => ({
    name: crumb.label,
    url: crumb.href ?? blogIndexHref({ category, page }),
  }))

  const postRows: V3LedgerPlainRow[] = []
  for (const post of posts) {
    const row = blogIndexRow(post)
    if (row) postRows.push(row)
  }
  const [firstPost, ...restPosts] = postRows

  const categoryItems: V3QuietItem[] = BLOG_CATEGORIES.map((cat) => ({
    label: cat === category ? `${cat} (showing)` : cat,
    href: blogIndexHref({ category: cat, page: 1 }),
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
      pageItems.push({ label: 'Previous page', href: blogIndexHref({ category, page: page - 1 }) })
    }
    if (page < totalPages) {
      pageItems.push({ label: 'Next page', href: blogIndexHref({ category, page: page + 1 }) })
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${BLOG_INDEX_TITLE} | Ryan Realty`,
    url: BLOG_INDEX_CANONICAL,
    description: BLOG_INDEX_DESCRIPTION,
    mainEntity: publishBlogIndexItemList({
      posts,
      offset,
      total,
      siteUrl: BLOG_SITE_URL,
    }),
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <MetadataBlock schemas={[{ type: 'breadcrumb', items: breadcrumbItems }]} />
        {breadcrumb}

        {firstPost ? (
          <V3Ledger
            id="latest"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text(BLOG_INDEX_TITLE)}
            note={v3Text(blogIndexCaption(total, category))}
            rows={[firstPost, ...restPosts]}
          />
        ) : (
          <V3Ledger
            id="latest"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text(BLOG_INDEX_TITLE)}
            note={v3Text(blogIndexCaption(total, category))}
            rows={[]}
            emptyMessage={v3Text('No posts in this category yet.')}
            action={{ label: v3Text('View all posts'), href: '/blog' }}
          />
        )}

        <ShareButton
          url={BLOG_INDEX_CANONICAL}
          title={BLOG_INDEX_TITLE}
          text="How homes are selling in Bend and the towns around it, from Ryan Realty."
          trackContext="blog_index"
          variant="default"
        />

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
