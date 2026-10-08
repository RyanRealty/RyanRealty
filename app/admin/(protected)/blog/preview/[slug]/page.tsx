// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/blog/preview/[slug] — a blog_posts row of ANY status, rendered by the
 * same function the public /blog/[slug] page renders with
 * (app/blog/[slug]/_v3/render-blog-post.tsx), so Matt reviews a draft exactly
 * as it will publish (Matt 2026-10-05, "Admin draft preview").
 *
 * Auth, twice: the (protected) layout redirects a signed-out visitor to
 * /admin/login, and this body calls requireAdminPage('content.blog') BEFORE the
 * draft read, because a layout and its page render in parallel and a layout
 * redirect alone does not stop the page body from reading.
 *
 * No per-broker record scope (scripts/entity-scope-baseline.json): a blog post
 * is brokerage content with no owning broker, and every holder of content.blog
 * already reads every row, drafts included, on /admin/blog (getAdminBlogPosts).
 *
 * noindex,nofollow; force-dynamic, so nothing here is ever cached or
 * prerendered. The read is getBlogPostDraftBySlug: uncached, service role.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getBlogPostDraftBySlug } from '@/lib/data'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { draftPreviewBanner } from '@/lib/blog/draft-preview'
import { VerdictLine } from '@/components/admin/v2'
import { renderBlogPost } from '@/app/blog/[slug]/_v3/render-blog-post'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Draft preview',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

type PageProps = { params: Promise<{ slug: string }> }

export default async function AdminBlogDraftPreviewPage({ params }: PageProps) {
  await requireAdminPage('content.blog')
  const { slug } = await params
  const post = await getBlogPostDraftBySlug(slug)
  if (!post) notFound()

  const banner = draftPreviewBanner({ slug: post.slug, status: post.status })
  const article = await renderBlogPost(post, { tracking: false })

  return (
    <>
      {/* The admin v2 language (ci:admin-ui), same width and gutter as /admin/blog. */}
      <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
        <VerdictLine tone="attention">
          <b>{banner.title}</b> {banner.status}. Slug: <code>{post.slug}</code>.
          {banner.revisionNote ? (
            <>
              {' '}
              <b>{banner.revisionNote}</b>
            </>
          ) : null}{' '}
          <Link href="/admin/blog">Back to the blog library</Link>
        </VerdictLine>
      </div>
      {article}
    </>
  )
}
