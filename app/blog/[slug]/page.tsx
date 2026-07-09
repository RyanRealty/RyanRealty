/**
 * Blog post detail — KB (kinetic-brutalist) design, Phase 9 page-class migration
 * (docs/KB_CONVERGENCE_ROADMAP.md). RESTYLED IN PLACE: every piece of content from
 * the prior shadcn version is preserved — category link, title, author (with team
 * link), date, read-time, top + bottom ShareButton, hero image, the HTML article
 * body (dangerouslySetInnerHTML), tags, author bio, related posts, and BOTH JSON-LD
 * blocks (Article + Breadcrumb). Only the presentation moved to the KB look (navy +
 * cream surfaces, Amboqia display, hard --edge borders, mono labels). Styling reuses
 * kb.css tokens + the @tailwindcss/typography prose plugin (recolored to navy via its
 * own --tw-prose-* CSS vars) + inline var(--navy) — no inline <style> (D32), no forked
 * KB component, no kb.css edit, no off-ladder Tailwind, no raw hex.
 *
 * KbNav + KbFooter carry the chrome (default chrome hidden for ^/blog via HideChrome).
 */
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getBlogPostBySlug, getRelatedBlogPosts } from '@/lib/data'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { generateBlogSchema, generateBreadcrumbSchema } from '@/lib/structured-data'
import ShareButton from '@/components/ShareButton'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

// KB tokens (all from kb.css) as inline style values — keeps the page on the brand
// palette without raw hex or off-ladder Tailwind arbitrary utilities.
const NAVY = 'var(--navy)'
const NAVY_70 = 'var(--navy-70)'
const NAVY_12 = 'var(--navy-12)'
const CREAM = 'var(--cream)'
const EDGE_NAVY = 'var(--edge) solid var(--navy)'
const PLATE = 'var(--navy)' // image-placeholder plate (on-palette navy token)
const AMBOQIA = 'var(--font-amboqia-safe),serif'

// Recolor the @tailwindcss/typography prose body to KB navy by setting the plugin's
// own CSS variables. No arbitrary Tailwind, no <style>. The headings get the Amboqia
// face; everything reads navy on the cream surface.
const proseVars: CSSProperties = {
  color: NAVY,
  ['--tw-prose-body' as string]: NAVY,
  ['--tw-prose-headings' as string]: NAVY,
  ['--tw-prose-links' as string]: NAVY,
  ['--tw-prose-bold' as string]: NAVY,
  ['--tw-prose-counters' as string]: NAVY_70,
  ['--tw-prose-bullets' as string]: NAVY,
  ['--tw-prose-hr' as string]: NAVY_12,
  ['--tw-prose-quotes' as string]: NAVY_70,
  ['--tw-prose-quote-borders' as string]: NAVY,
  ['--tw-prose-captions' as string]: NAVY_70,
  ['--tw-prose-th-borders' as string]: NAVY,
  ['--tw-prose-td-borders' as string]: NAVY_12,
}

const metaRow: CSSProperties = {
  color: NAVY_70,
  fontSize: '.66rem',
  fontWeight: 600,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  fontVariantNumeric: 'tabular-nums',
}

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
  const description = post.seo_description?.trim() || post.excerpt?.trim() || 'Central Oregon real estate insights from Ryan Realty.'
  const canonical = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`
  const ogImageUrl = post.hero_image_url
    ? `${siteUrl}/api/og?type=blog&id=${encodeURIComponent(post.slug)}`
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
  const [post, session, fubPersonId] = await Promise.all([
    getBlogPostBySlug(slug),
    getSession(),
    getPersonIdFromCookie(),
  ])
  if (!post) notFound()

  const relatedPosts = await getRelatedBlogPosts(post.slug, post.category, 3)

  const pageUrl = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`
  const pageTitle = `${post.title} | Ryan Realty Blog`
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  const readMinutes = estimateReadTime(post.content)
  const articleSchema = generateBlogSchema({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    published_at: post.published_at,
    updated_at: post.updated_at,
    image: post.hero_image_url
      ? `${siteUrl}/api/og?type=blog&id=${encodeURIComponent(post.slug)}`
      : undefined,
    author_name: post.author_name,
  })
  const articleBody = post.content?.trim() || post.excerpt?.trim() || ''

  return (
    <main className="kb-root">
      {/* solid — article pages have no dark hero; the transparent bar rendered
          white links + a white wordmark on cream (invisible) at scroll 0. */}
      <KbNav solid />
      <KbSectionTracker pageType="blog_post" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Blog', url: `${siteUrl}/blog` },
              { name: post.title, url: `${siteUrl}/blog/${encodeURIComponent(post.slug)}` },
            ])
          ),
        }}
      />
      <KbBreadcrumb
        trail={[{ label: 'Home', href: '/' }, { label: 'Blog', href: '/blog' }, { label: post.title }]}
      />
      <SmoothScrollProvider>
        <section className="section" id="post" aria-label="Article">
          <div className="wrap">
            <article className="mx-auto w-full" style={{ color: NAVY, maxWidth: 880 }}>
              <header className="pb-6 pt-12" style={{ borderBottom: EDGE_NAVY }}>
                {post.category ? (
                  <Link
                    href={`/blog?category=${encodeURIComponent(post.category)}`}
                    className="inline-block uppercase transition-colors"
                    style={{ color: NAVY_70, fontSize: '.66rem', fontWeight: 700, letterSpacing: '.16em' }}
                  >
                    {post.category}
                  </Link>
                ) : null}
                <h1
                  className="display mt-4"
                  style={{ fontSize: 'clamp(2.2rem,6vw,4.2rem)', lineHeight: 0.9, letterSpacing: '-.015em' }}
                >
                  {post.title}
                </h1>
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2" style={metaRow}>
                  {post.author_name ? (
                    post.author_slug ? (
                      <Link href={`/team/${post.author_slug}`} className="transition-colors hover:underline">
                        {post.author_name}
                      </Link>
                    ) : (
                      <span>{post.author_name}</span>
                    )
                  ) : null}
                  {post.published_at ? (
                    <time dateTime={post.published_at}>
                      {new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </time>
                  ) : null}
                  <span>{readMinutes} min read</span>
                  <ShareButton
                    url={pageUrl}
                    title={post.title}
                    text={post.excerpt ?? undefined}
                    trackContext="blog_post"
                    variant="compact"
                  />
                </div>
              </header>

              {post.hero_image_url ? (
                <div
                  className="relative mt-8 aspect-video overflow-hidden"
                  style={{ border: EDGE_NAVY, background: PLATE }}
                >
                  <Image
                    src={post.hero_image_url}
                    alt={post.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 880px"
                    priority
                  />
                </div>
              ) : null}

              {articleBody ? (
                <div
                  className="prose prose-neutral mt-8 max-w-none"
                  style={proseVars}
                  dangerouslySetInnerHTML={{ __html: articleBody }}
                />
              ) : (
                <p className="mt-8 font-medium" style={{ color: NAVY_70, fontSize: '1.05rem' }}>
                  This article is being updated.
                </p>
              )}

              {/* Tags — plain metadata labels, not styled as clickable filters
                  (design-audit #150: these previously matched the clickable
                  category pills' pill/border styling with no click handler). */}
              {post.tags && post.tags.length > 0 ? (
                <div className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-6" style={{ borderTop: `1px solid ${NAVY_12}` }}>
                  {post.tags.map((tag, i) => (
                    <span key={tag} className="inline-flex items-center" style={{ color: NAVY_70, fontSize: '.78rem', fontWeight: 500 }}>
                      {tag}
                      {i < post.tags!.length - 1 ? <span aria-hidden="true" style={{ marginLeft: '.5rem', opacity: 0.5 }}>·</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Bottom share */}
              <div
                className="mt-8 flex flex-wrap items-center justify-between gap-4 pt-6"
                style={{ borderTop: `1px solid ${NAVY_12}` }}
              >
                <p className="font-medium" style={{ color: NAVY_70, fontSize: '.95rem' }}>
                  Found this helpful? Share it with someone who could use it.
                </p>
                <ShareButton
                  url={pageUrl}
                  title={post.title}
                  text={post.excerpt ?? undefined}
                  trackContext="blog_post_bottom"
                  variant="default"
                />
              </div>

              {/* Author bio */}
              {post.author_name ? (
                <section
                  className="mt-14 flex items-start gap-5 p-6"
                  style={{ border: EDGE_NAVY }}
                  aria-label="About the author"
                >
                  {post.author_photo_url ? (
                    <Image
                      src={post.author_photo_url}
                      alt={post.author_name}
                      width={64}
                      height={64}
                      className="shrink-0 object-cover"
                      style={{ border: `1px solid ${NAVY_12}` }}
                    />
                  ) : (
                    <div
                      className="flex size-16 shrink-0 items-center justify-center leading-none"
                      style={{ background: NAVY, color: CREAM, fontFamily: AMBOQIA, fontSize: '1.6rem' }}
                      aria-hidden="true"
                    >
                      {post.author_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <span className="block uppercase" style={{ color: NAVY_70, fontSize: '.62rem', fontWeight: 700, letterSpacing: '.16em' }}>
                      About the author
                    </span>
                    {post.author_slug ? (
                      <Link
                        href={`/team/${post.author_slug}`}
                        className="mt-1.5 inline-block leading-none transition-opacity hover:opacity-70"
                        style={{ color: NAVY, fontFamily: AMBOQIA, fontSize: '1.5rem', letterSpacing: '-.01em' }}
                      >
                        {post.author_name}
                      </Link>
                    ) : (
                      <span className="mt-1.5 inline-block leading-none" style={{ color: NAVY, fontFamily: AMBOQIA, fontSize: '1.5rem', letterSpacing: '-.01em' }}>
                        {post.author_name}
                      </span>
                    )}
                    <p className="mt-2.5 font-medium" style={{ color: NAVY_70, fontSize: '.95rem', lineHeight: 1.5 }}>
                      {post.author_title ? `${post.author_title} at Ryan Realty.` : 'Ryan Realty.'}
                    </p>
                  </div>
                </section>
              ) : null}

              {/* Related posts */}
              {relatedPosts.length > 0 ? (
                <section className="mt-16" aria-labelledby="post-related-h">
                  <div className="flex items-baseline gap-4 pb-4" style={{ borderBottom: EDGE_NAVY }}>
                    <h2
                      id="post-related-h"
                      className="display"
                      style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', lineHeight: 0.92 }}
                    >
                      Related Posts
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3">
                    {relatedPosts.map((related) => (
                      <Link
                        key={related.id}
                        href={`/blog/${related.slug}`}
                        className="group flex flex-col py-6 sm:px-5"
                        style={{ borderBottom: EDGE_NAVY }}
                      >
                        {related.hero_image_url ? (
                          <div
                            className="relative mb-4 aspect-[16/10] overflow-hidden"
                            style={{ border: EDGE_NAVY, background: PLATE }}
                          >
                            <Image
                              src={related.hero_image_url}
                              alt={related.title || 'Related post'}
                              fill
                              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                              sizes="(max-width: 640px) 100vw, 33vw"
                            />
                          </div>
                        ) : null}
                        <p className="text-base font-semibold leading-snug" style={{ color: NAVY }}>
                          {related.title}
                        </p>
                        {related.published_at ? (
                          <time
                            className="mt-2 block uppercase tabular-nums"
                            style={{ color: NAVY_70, fontSize: '.62rem', fontWeight: 600, letterSpacing: '.12em' }}
                            dateTime={related.published_at}
                          >
                            {new Date(related.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </time>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </article>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
