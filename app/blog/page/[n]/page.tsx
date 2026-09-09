// @no-static-params — on-demand ISR (SITE-29): generateStaticParams returns [] on purpose so nothing
// prerenders at build (ci:ssg-budget); the first hit renders and caches under `revalidate`.
/**
 * /blog/page/<n> — every category, page n ≥ 2 (SITE-29).
 *
 * The path form of the old /blog?page= view, which 308s here (/page/1 308s to
 * the bare index). Same view, metadata and page contract as /blog
 * (app/blog/_v3/blog-index-view.tsx); noindex, follow, canonical to the bare
 * index, as the query form was. A page past the last is a 404.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublishedBlogPosts, getPopularBlogSlugs } from '@/lib/data'
import { V3Breadcrumb } from '@/components/site/v3'
import { BLOG_INDEX_CANONICAL, BlogIndexView, blogIndexMetadata } from '@/app/blog/_v3/blog-index-view'
import {
  BLOG_PAGE_SIZE,
  blogIndexTotalPages,
  blogIndexTrail,
  parseBlogPageSegment,
} from '@/app/blog/_v3/blog-index-paths'

type PageProps = { params: Promise<{ n: string }> }

export const revalidate = 300
export const dynamicParams = true
// On-demand ISR, zero build-time fan-out (ci:ssg-budget, SITE-29): the first
// hit renders and caches, later hits are served for 300s. A segment with no
// generateStaticParams at all would never be cached.
export async function generateStaticParams(): Promise<Array<Record<string, string>>> {
  return []
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { n } = await params
  return {
    ...blogIndexMetadata({ category: 'All', page: parseBlogPageSegment(n) ?? 1 }),
    alternates: { canonical: BLOG_INDEX_CANONICAL },
  }
}

export default async function BlogPagePage({ params }: PageProps) {
  const { n } = await params
  const page = parseBlogPageSegment(n)
  if (page == null) notFound()
  const [{ posts, total }, popularSlugs] = await Promise.all([
    getPublishedBlogPosts({ category: null, limit: BLOG_PAGE_SIZE, offset: (page - 1) * BLOG_PAGE_SIZE }),
    getPopularBlogSlugs(5),
  ])
  if (page > blogIndexTotalPages(total)) notFound()
  const loc = { category: 'All', page }
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
