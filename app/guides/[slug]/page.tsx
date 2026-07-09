/**
 * /guides/[slug] — single guide detail.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior card layout. Every piece of content is preserved:
 *   - Article (BlogPosting) JSON-LD + BreadcrumbList JSON-LD
 *   - guide.title + meta_description
 *   - BOTH AdUnits (slots 4004001001 + 4004001002) around the body
 *   - guide.content_html rendered as rich prose
 *   - CityClusterNav (when guide.city) for topic-cluster internal linking
 *   - related guides grid (same city OR same category, up to 4)
 *   - HomeValuationCta lead-capture block
 *   - generateMetadata (async) for SEO
 *   - both DAL reads (getGuideBySlug, getPublishedGuides)
 *
 * Only the presentation changed: KB shell (KbNav, KbBreadcrumb, KbFooter,
 * SmoothScrollProvider, KbSectionTracker), Amboqia display headings, hard-edge
 * cream surfaces. The interactive AdUnit / HomeValuationCta clients keep their
 * logic intact.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'
import CityClusterNav from '@/components/CityClusterNav'
import { getGuideBySlug, getPublishedGuides } from '@/lib/data'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { generateBreadcrumbSchema, generateBlogSchema } from '@/lib/structured-data'
import { cityEntityKey } from '@/lib/slug'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = await getGuideBySlug(slug)
  if (!guide) return {}
  const _siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const _ogImage = `${_siteUrl}/api/og?type=default`
  return {
    title: guide.title,
    description: guide.meta_description ?? undefined,
    alternates: { canonical: `${_siteUrl}/guides/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.meta_description ?? undefined,
      url: `${_siteUrl}/guides/${guide.slug}`,
      type: 'article',
      images: [{ url: _ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.title,
      description: guide.meta_description ?? undefined,
      images: [_ogImage],
    },
  }
}

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [guide, session, fubPersonId] = await Promise.all([
    getGuideBySlug(slug),
    getSession(),
    getFubPersonIdFromCookie(),
  ])
  if (!guide) notFound()
  const related = (await getPublishedGuides(200))
    .filter((row) => row.slug !== guide.slug && (row.city === guide.city || row.category === guide.category))
    .slice(0, 4)

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

  // F12: track page view in FUB CRM, mirroring the pattern used in /blog/[slug]
  trackPageViewIfPossible({
    sessionUser: session?.user ?? undefined,
    fubPersonId,
    pageUrl: `${siteUrl}/guides/${encodeURIComponent(guide.slug)}`,
    pageTitle: `${guide.title} | Ryan Realty Guides`,
  })

  // Article JSON-LD built from live guide data — no fabricated fields.
  // generateBlogSchema emits BlogPosting which is a sub-type of Article; the
  // same function is used by app/blog/[slug]/page.tsx and already carries
  // dateModified for the AI/Google recency signal.
  const articleSchema = generateBlogSchema({
    title: guide.title,
    slug: `guides/${guide.slug}`,
    excerpt: guide.meta_description ?? null,
    published_at: (guide as Record<string, unknown>).published_at as string | null ?? null,
    updated_at: (guide as Record<string, unknown>).updated_at as string | null ?? null,
  })

  return (
    <main className="kb-root">
      {/* solid — guide detail pages have no dark hero; the transparent bar rendered
          white links + a white wordmark on cream (invisible) at scroll 0. Same fix
          as app/blog/[slug]/page.tsx. */}
      <KbNav solid />
      <KbSectionTracker pageType="guides" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Guides', url: `${siteUrl}/guides` },
              { name: guide.title, url: `${siteUrl}/guides/${guide.slug}` },
            ])
          ),
        }}
      />
      <KbBreadcrumb
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Guides', href: '/guides' },
          { label: guide.title },
        ]}
      />
      <SmoothScrollProvider>
        {/* Article header + body */}
        <section className="section" id="guide" aria-label="Guide">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">
                {guide.category?.trim() || 'Guide'}
                {guide.city ? ` · ${guide.city}` : ''}
              </span>
            </div>
            <article className="mx-auto w-full max-w-3xl pt-7">
              <h1 className="display" style={{ fontSize: 'clamp(2.1rem,6vw,4rem)', lineHeight: 0.95 }}>
                {guide.title}
              </h1>
              {guide.meta_description && (
                <p
                  className="mt-4"
                  style={{
                    color: 'var(--navy-70)',
                    fontSize: 'clamp(1.05rem,1.6vw,1.3rem)',
                    lineHeight: 1.45,
                    maxWidth: '60ch',
                  }}
                >
                  {guide.meta_description}
                </p>
              )}

              {/* Top ad slot — interactive client, consent-gated. Preserved. */}
              <div className="mt-7">
                <AdUnit slot="4004001001" format="horizontal" />
              </div>

              {/* Rich guide body. The kb-root reset zeroes margins on every
                  element, so the rendered HTML gets explicit important spacing
                  + a navy-on-cream prose treatment scoped to this container. */}
              <div
                className="kb-guide-body mt-7 max-w-none [&_h2]:text-[clamp(1.5rem,3vw,2.1rem)] [&_h2]:leading-tight [&_h2]:font-semibold [&_h2]:mt-10! [&_h2]:mb-3! [&_h3]:font-semibold [&_h3]:text-lg [&_h3]:mt-8! [&_h3]:mb-2! [&_p]:my-4! [&_p]:leading-[1.65] [&_p]:text-[1.02rem] [&_ul]:my-4! [&_ul]:pl-6! [&_ul]:list-disc [&_ol]:my-4! [&_ol]:pl-6! [&_ol]:list-decimal [&_li]:my-1.5! [&_li]:leading-[1.6] [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_img]:my-6! [&_img]:rounded-md"
                style={{ color: 'var(--navy)' }}
                dangerouslySetInnerHTML={{ __html: guide.content_html }}
              />

              {/* Bottom ad slot — preserved. */}
              <div className="mt-8">
                <AdUnit slot="4004001002" format="horizontal" />
              </div>
            </article>
          </div>
        </section>

        {/* City topic-cluster nav — internal linking, preserved verbatim. */}
        {guide.city && (
          <section className="section" id="city-cluster" aria-label="Explore this city">
            <div className="wrap">
              <div className="mx-auto w-full max-w-3xl">
                <CityClusterNav
                  cityName={guide.city}
                  citySlug={cityEntityKey(guide.city)}
                  activePage="guide"
                  guideSlug={guide.slug}
                />
              </div>
            </div>
          </section>
        )}

        {/* Related guides — same city OR category. Up to 4. Preserved. */}
        {related.length > 0 && (
          <section className="section" id="more-guides" aria-label="More guides">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Keep reading</span>
                <h2 className="sec-title display">More guides</h2>
              </div>
              <div className="grid gap-px mt-0 sm:grid-cols-2" style={{ borderTop: 'var(--edge) solid var(--navy)' }}>
                {related.map((row) => (
                  <a
                    key={row.slug}
                    href={`/guides/${row.slug}`}
                    className="group flex items-center justify-between gap-4 px-2 py-6"
                    style={{ borderBottom: 'var(--edge) solid var(--navy)' }}
                  >
                    <span className="display" style={{ fontSize: 'clamp(1.2rem,2.6vw,1.7rem)', lineHeight: 1.05 }}>
                      {row.title}
                    </span>
                    <span className="arr" style={{ fontSize: '1.4rem', transition: 'transform .18s ease' }}>
                      →
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Home valuation lead-capture block — interactive client, preserved. */}
        <section className="section" id="valuation-cta" aria-label="Home valuation">
          <div className="wrap">
            <div className="mx-auto w-full max-w-3xl">
              <HomeValuationCta />
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
