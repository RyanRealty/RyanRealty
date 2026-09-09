// @no-static-params — on-demand ISR (SITE-29): generateStaticParams returns [] on purpose so nothing
// prerenders at build (ci:ssg-budget); the first hit renders and caches under `revalidate`.
/**
 * /blog/category/<category>/page/<n> — one category, page n ≥ 2 (SITE-29).
 *
 * The path form of the old /blog?category=&page= view, which 308s here. Same
 * view, metadata and page contract as /blog (app/blog/_v3/blog-index-view.tsx);
 * noindex, follow, canonical to the bare index. Unknown category or a page
 * past the last is a 404.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublishedBlogPosts, getPopularBlogSlugs } from '@/lib/data'
import { V3Breadcrumb } from '@/components/site/v3'
import { isBlogCategoryPath } from '@/lib/blog/categories'
import { BLOG_INDEX_CANONICAL, BlogIndexView, blogIndexMetadata } from '@/app/blog/_v3/blog-index-view'
import {
  BLOG_PAGE_SIZE,
  blogIndexTotalPages,
  blogIndexTrail,
  decodeBlogCategorySegment,
  parseBlogPageSegment,
} from '@/app/blog/_v3/blog-index-paths'

type PageProps = { params: Promise<{ category: string; n: string }> }

export const revalidate = 300
export const dynamicParams = true
// On-demand ISR, zero build-time fan-out (ci:ssg-budget, SITE-29): the first
// hit renders and caches, later hits are served for 300s. A segment with no
// generateStaticParams at all would never be cached.
export async function generateStaticParams(): Promise<Array<Record<string, string>>> {
  return []
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, n } = await params
  const cat = decodeBlogCategorySegment(category)
  return {
    ...blogIndexMetadata({ category: cat ?? 'All', page: parseBlogPageSegment(n) ?? 1 }),
    alternates: { canonical: BLOG_INDEX_CANONICAL },
  }
}

export default async function BlogCategoryPagePage({ params }: PageProps) {
  const { category, n } = await params
  const cat = decodeBlogCategorySegment(category)
  const page = parseBlogPageSegment(n)
  if (!isBlogCategoryPath(cat) || page == null) notFound()
  const [{ posts, total }, popularSlugs] = await Promise.all([
    getPublishedBlogPosts({ category: cat, limit: BLOG_PAGE_SIZE, offset: (page - 1) * BLOG_PAGE_SIZE }),
    getPopularBlogSlugs(5),
  ])
  if (page > blogIndexTotalPages(total)) notFound()
  const loc = { category: cat, page }
  return (
    <BlogIndexView
      {...loc}
      posts={posts}
      total={total}
      popularSlugs={popularSlugs}
      breadcrumb={<V3Breadcrumb trail={blogIndexTrail(loc)} />}
    />
  )
}
