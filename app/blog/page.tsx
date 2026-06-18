/**
 * Blog index — KB (kinetic-brutalist) design, Phase 9 page-class migration
 * (docs/KB_CONVERGENCE_ROADMAP.md). RESTYLED IN PLACE: every section, data fetch,
 * form, link, image, stat, and JSON-LD from the prior shadcn version is preserved.
 * Only the presentation moved to the KB look (navy + cream surfaces, Amboqia
 * display headings, hard --edge borders, .section/.wrap rhythm, mono labels). Styling
 * reuses shared kb.css classes + inline var(--navy) tokens — no inline <style> (D32),
 * no forked KB component, no kb.css edit, no off-ladder Tailwind, no raw hex.
 *
 * KbNav + KbFooter carry the chrome (default chrome hidden for ^/blog via HideChrome).
 * KbArticles isn't used for the grid because it can't carry the per-post category /
 * author / read-time metadata this page shows — so the grid reuses the KbArticles
 * .art-* card classes in place instead of dropping content.
 */
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getPublishedBlogPosts, getPopularBlogSlugs } from '@/lib/data'
import { getBlogCategories } from '@/app/actions/blog'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { shouldNoIndexBlogIndex } from '@/lib/seo-routing'
import ShareButton from '@/components/ShareButton'
import { generateBreadcrumbSchema } from '@/lib/structured-data'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

// KB tokens (all from kb.css). Kept as inline style values so the page stays on the
// brand palette without raw hex or off-ladder Tailwind arbitrary utilities.
const NAVY = 'var(--navy)'
const NAVY_70 = 'var(--navy-70)'
const NAVY_12 = 'var(--navy-12)'
const CREAM = 'var(--cream)'
const EDGE_NAVY = 'var(--edge) solid var(--navy)'
const PLATE = 'var(--navy)' // image-placeholder plate (on-palette navy token)

const metaRow: CSSProperties = {
  color: NAVY_70,
  fontSize: '.66rem',
  fontWeight: 600,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  fontVariantNumeric: 'tabular-nums',
}
const catPill = (active: boolean): CSSProperties => ({
  border: '1px solid var(--navy)',
  background: active ? NAVY : 'transparent',
  color: active ? CREAM : NAVY,
  padding: '9px 15px',
  fontSize: '.72rem',
  fontWeight: 700,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
})

type BlogSearchParams = { category?: string; page?: string }

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<BlogSearchParams>
}): Promise<Metadata> {
  const params = await searchParams
  const shouldNoIndex = shouldNoIndexBlogIndex(params)
  const title = 'Central Oregon Real Estate Blog | Market Insights and Guides | Ryan Realty'
  const description = 'Market reports, community guides, and tips for buying and selling in Central Oregon.'
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/blog` },
    robots: shouldNoIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: 'Central Oregon Real Estate Blog | Ryan Realty',
      description,
      url: `${siteUrl}/blog`,
      type: 'website',
      images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty blog' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Central Oregon Real Estate Blog | Ryan Realty',
      description,
      images: [defaultOgImage],
    },
  }
}

function estimateReadTime(content: string | null): number {
  if (!content) return 2
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

type PageProps = { searchParams: Promise<BlogSearchParams> }

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const params = await searchParams
  const category = params.category ?? 'All'
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * 12
  const [categories, { posts, total }, popularSlugs, session, fubPersonId] = await Promise.all([
    getBlogCategories(),
    getPublishedBlogPosts({ category: category === 'All' ? null : category, limit: 12, offset }),
    getPopularBlogSlugs(5),
    getSession(),
    getFubPersonIdFromCookie(),
  ])
  const pageUrl = `${siteUrl}/blog`
  const pageTitle = 'Blog | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })
  const totalPages = Math.ceil(total / 12)
  const featured = posts[0]
  const gridPosts = page === 1 ? posts.slice(1) : posts

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Central Oregon Real Estate Blog | Ryan Realty',
    url: `${siteUrl}/blog`,
    description: 'Market insights and guides for Central Oregon real estate.',
    // Machine-readable article list — lets AI engines enumerate + cite posts
    // without scraping the HTML grid.
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
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="blog" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Blog', url: `${siteUrl}/blog` },
            ])
          ),
        }}
      />
      <KbBreadcrumb overlay trail={[{ label: 'Home', href: '/' }, { label: 'Blog' }]} />
      <SmoothScrollProvider>
        {/* Hero — same title/subtitle as the prior ContentPageHero, now in the KB
            hero. videoSrc=null → the reports hero photo renders as a still. The hero
            already carries Browse + Sell CTAs (the prior page's Market Reports /
            Guides CTAs are reachable from the KbNav menu directory). */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Guides and insights"
          titleTop="Real Estate"
          titleBottom="Blog"
          lead="Market insights, community guides, and tips for buying and selling in Central Oregon."
          videoSrc={null}
          posterSrc={CONTENT_HERO_IMAGES.reports}
          mediaCaption="Central Oregon · Old Mill District"
        />

        {/* Latest posts header + share */}
        <section className="section articles" id="latest" aria-labelledby="blog-latest-h">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Latest posts</span>
              <h2 id="blog-latest-h" className="sec-title display">
                The Journal
              </h2>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-5">
              <nav className="flex flex-wrap gap-2" aria-label="Categories">
                {categories.map((cat) => {
                  const active = category === cat
                  return (
                    <Link
                      key={cat}
                      href={cat === 'All' ? '/blog' : `/blog?category=${encodeURIComponent(cat)}`}
                      className="inline-block transition-colors"
                      style={catPill(active)}
                      aria-current={active ? 'true' : undefined}
                    >
                      {cat}
                    </Link>
                  )
                })}
              </nav>
              <ShareButton
                url={`${siteUrl}/blog`}
                title="Central Oregon real estate blog"
                text="Market reports, community guides, and buying or selling tips for Central Oregon."
                trackContext="blog_index"
                variant="compact"
              />
            </div>

            {/* Featured post — page 1 only */}
            {featured && page === 1 && (
              <article className="mt-10" style={{ borderTop: EDGE_NAVY }}>
                <Link href={`/blog/${featured.slug}`} className="group grid grid-cols-1 lg:grid-cols-2">
                  {featured.hero_image_url && (
                    <div
                      className="relative aspect-[2/1] overflow-hidden lg:aspect-auto"
                      style={{ borderBottom: EDGE_NAVY, background: PLATE, minHeight: 340 }}
                    >
                      <Image
                        src={featured.hero_image_url}
                        alt={featured.title || 'Featured blog post'}
                        fill
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 1024px"
                        priority
                      />
                    </div>
                  )}
                  <div className="flex flex-col justify-center py-8 lg:py-10 lg:pl-10">
                    {featured.category && (
                      <span
                        className="uppercase tabular-nums"
                        style={{ color: NAVY_70, fontSize: '.62rem', fontWeight: 700, letterSpacing: '.16em' }}
                      >
                        {featured.category}
                      </span>
                    )}
                    <h3
                      className="display mt-3"
                      style={{ fontSize: 'clamp(2rem,5vw,3.4rem)', lineHeight: 0.9, letterSpacing: '-.01em' }}
                    >
                      {featured.title}
                    </h3>
                    {featured.excerpt && (
                      <p
                        className="mt-4 font-medium"
                        style={{ color: NAVY_70, fontSize: 'clamp(1rem,1.7vw,1.2rem)', lineHeight: 1.5, maxWidth: '54ch' }}
                      >
                        {featured.excerpt}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2" style={metaRow}>
                      {featured.author_name && <span>{featured.author_name}</span>}
                      {featured.published_at && (
                        <time dateTime={featured.published_at}>
                          {new Date(featured.published_at).toLocaleDateString('en-US')}
                        </time>
                      )}
                    </div>
                    <span className="art-read mt-4">
                      Read the guide <span className="arr">&rarr;</span>
                    </span>
                  </div>
                </Link>
              </article>
            )}

            {/* Post grid — preserves category, title, excerpt, author, date, read-time */}
            {gridPosts.length > 0 ? (
              <div className="art-grid">
                {gridPosts.map((post) => (
                  <article key={post.id} className="art-card">
                    <Link href={`/blog/${post.slug}`} className="flex h-full flex-col">
                      <div className="art-media">
                        {post.hero_image_url ? (
                          <Image
                            src={post.hero_image_url}
                            alt={post.title || 'Blog post image'}
                            fill
                            className="art-img object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        ) : (
                          <span className="art-noimg" aria-hidden="true" />
                        )}
                        {post.category ? <span className="art-date mono-num">{post.category}</span> : null}
                      </div>
                      <div className="art-body">
                        <h3 className="art-title display">{post.title}</h3>
                        {post.excerpt && <p className="art-excerpt">{post.excerpt}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" style={metaRow}>
                          {post.author_name && <span>{post.author_name}</span>}
                          {post.published_at && (
                            <time dateTime={post.published_at}>
                              {new Date(post.published_at).toLocaleDateString('en-US')}
                            </time>
                          )}
                          <span>{estimateReadTime(null)} min read</span>
                        </div>
                        <span className="art-read">
                          Read the guide <span className="arr">&rarr;</span>
                        </span>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p className="py-10 font-medium" style={{ color: NAVY_70, fontSize: '1.05rem' }}>
                No posts in this category yet.{' '}
                <Link href="/blog" className="underline" style={{ color: NAVY, textUnderlineOffset: 3 }}>
                  View all posts
                </Link>
                .
              </p>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-12 flex flex-wrap items-center justify-center gap-4" aria-label="Pagination">
                {page > 1 && (
                  <Link
                    href={`/blog?page=${page - 1}${category !== 'All' ? `&category=${encodeURIComponent(category)}` : ''}`}
                    className="btn alt"
                  >
                    Previous
                  </Link>
                )}
                <span
                  className="uppercase tabular-nums"
                  style={{ color: NAVY_70, fontSize: '.72rem', fontWeight: 700, letterSpacing: '.14em' }}
                >
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/blog?page=${page + 1}${category !== 'All' ? `&category=${encodeURIComponent(category)}` : ''}`}
                    className="btn alt"
                  >
                    Next
                  </Link>
                )}
              </nav>
            )}

            {/* Popular posts */}
            {popularSlugs.length > 0 ? (
              <aside className="mt-14 pt-6" style={{ borderTop: EDGE_NAVY }} aria-labelledby="blog-popular-h">
                <h3
                  id="blog-popular-h"
                  className="uppercase"
                  style={{ color: NAVY_70, fontSize: '.7rem', fontWeight: 700, letterSpacing: '.18em' }}
                >
                  Popular posts
                </h3>
                <ul className="mt-4 flex list-none flex-col" style={{ borderTop: `1px solid ${NAVY_12}` }}>
                  {popularSlugs.slice(0, 5).map((slug) => {
                    const title = slug
                      .replace(/-/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                    return (
                      <li key={slug} style={{ borderBottom: `1px solid ${NAVY_12}` }}>
                        <Link
                          href={`/blog/${slug}`}
                          className="block py-3.5 text-base font-semibold transition-[padding] hover:pl-2 focus-visible:pl-2 focus-visible:outline-none"
                          style={{ color: NAVY }}
                        >
                          {title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </aside>
            ) : null}
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
