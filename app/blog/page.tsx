/**
 * /blog — the bare index: every category, page 1.
 *
 * STATIC (SITE-29). This route reads no request state: no searchParams, no
 * cookies. Until 2026-09-09 it read ?category= and ?page= on every request
 * (and awaited the session and the identity cookie for nothing), so the
 * index rendered at origin on every hit. Category and page views now live on
 * their own paths (app/blog/_v3/blog-index-paths.ts), each ISR on demand; the
 * old query forms 308 to them in next.config. The view, the metadata and the
 * page contract live in app/blog/_v3/blog-index-view.tsx, shared by all four
 * routes.
 */

import type { Metadata } from 'next'
import { getPublishedBlogPosts, getPopularBlogSlugs } from '@/lib/data'
import { V3Breadcrumb } from '@/components/site/v3'
import { BLOG_INDEX_CANONICAL, BlogIndexView, blogIndexMetadata } from './_v3/blog-index-view'
import { BLOG_PAGE_SIZE, blogIndexTrail } from './_v3/blog-index-paths'

const LOCATOR = { category: 'All', page: 1 } as const

export const metadata: Metadata = {
  ...blogIndexMetadata(LOCATOR),
  alternates: { canonical: BLOG_INDEX_CANONICAL },
}

export const revalidate = 300

export default async function BlogIndexPage() {
  const [{ posts, total }, popularSlugs] = await Promise.all([
    getPublishedBlogPosts({ category: null, limit: BLOG_PAGE_SIZE, offset: 0 }),
    getPopularBlogSlugs(5),
  ])
  return (
    <BlogIndexView
      {...LOCATOR}
      posts={posts}
      total={total}
      popularSlugs={popularSlugs}
      breadcrumb={<V3Breadcrumb trail={blogIndexTrail(LOCATOR)} />}
    />
  )
}
