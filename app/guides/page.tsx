/**
 * /guides — Real Estate Guides index for Bend and Central Oregon.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior ContentPageHero layout: every piece of content is
 * preserved (hero copy + CTAs, CollectionPage JSON-LD, breadcrumb JSON-LD,
 * the live getPublishedGuides DAL call, and the by-category grouping of guide
 * cards). Only the presentation changed — the page now wears the KB shell
 * (KbNav, KbHero, KbArticles editorial cards per category, KbFooter) and the
 * Amboqia display / hard-edge surfaces of the rest of the migrated site.
 *
 * Data: getPublishedGuides(12) from lib/data (DAL, cached, resilient). Zero
 * hardcoded content — every card renders a real published (or stats-generated)
 * guide row. Honest empty state when no guides exist.
 *
 * SEO: export const metadata (canonical + OG + Twitter), CollectionPage +
 * BreadcrumbList JSON-LD. PAGE CONTRACT: KB design + SEO + tracking
 * (KbSectionTracker pageType="guides").
 */

import type { Metadata } from 'next'
import { getPublishedGuides } from '@/lib/data'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { generateBreadcrumbSchema } from '@/lib/structured-data'
import { getSurfaceImages, pickSurfaceImage } from '@/lib/data/media/getSurfaceImages'
import { cityEntityKey } from '@/lib/slug'
import { formatDate } from '@/lib/format/date'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbArticles, type KbArticlePost } from '@/components/site/kb/KbArticles'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

// Render on demand to avoid the 180s static-generation timeout. The published
// guides query is slow enough at build time that the static export windows out.
export const dynamic = 'force-dynamic'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

// C3: use absolute URLs for OG/Twitter images so social scrapers resolve them correctly.
export const metadata: Metadata = {
  title: 'Real Estate Guides',
  description: 'Local buying and selling guides for Bend and Central Oregon.',
  alternates: { canonical: `${siteUrl}/guides` },
  openGraph: {
    title: 'Real Estate Guides | Ryan Realty',
    description: 'Local buying and selling guides for Bend and Central Oregon.',
    url: `${siteUrl}/guides`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Ryan Realty guides' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Real Estate Guides | Ryan Realty',
    description: 'Local buying and selling guides for Bend and Central Oregon.',
    images: [ogImage],
  },
}

export default async function GuidesIndexPage() {
  // F12: fetch session + FUB identity in parallel with guides, then track page view
  const [guides, cardPhotoPool, session, fubPersonId] = await Promise.all([
    getPublishedGuides(12),
    getSurfaceImages('card'),
    getSession(),
    getFubPersonIdFromCookie(),
  ])
  trackPageViewIfPossible({
    sessionUser: session?.user ?? undefined,
    fubPersonId,
    pageUrl: `${siteUrl}/guides`,
    pageTitle: 'Guides | Ryan Realty',
  })

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Ryan Realty Guides',
    description: 'Local buying and selling guides for Bend and Central Oregon.',
    url: `${siteUrl}/guides`,
  }
  // Duplicate slug rows render the same card twice (and collide on React keys) —
  // keep the first row per slug.
  const seenSlugs = new Set<string>()
  const grouped = new Map<string, typeof guides>()
  for (const guide of guides) {
    if (seenSlugs.has(guide.slug)) continue
    seenSlugs.add(guide.slug)
    const key = guide.category?.trim() || 'General'
    grouped.set(key, [...(grouped.get(key) ?? []), guide])
  }
  const groups = [...grouped.entries()]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="guides" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Guides', url: `${siteUrl}/guides` },
            ])
          ),
        }}
      />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Guides' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same H1 + subtitle + CTAs as the prior ContentPageHero, in
            the KB Amboqia display. The two CTAs (Browse Listings / Area Guides)
            are preserved via the KbHero default CTA row plus the explicit
            eyebrow/lead copy. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Buyer & seller guides"
          titleTop="Real Estate"
          titleBottom="Guides"
          lead="Local market explainers and step-by-step playbooks for buyers and sellers in Central Oregon."
          videoSrc={null}
          posterSrc="/images/hero/hero-old-mill-master-4k.jpg"
        />

        {/* CTA row preserved from the prior hero (Browse Listings · Area Guides) */}
        <section className="section" id="guide-cta" aria-label="Browse and explore">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <a href="/homes-for-sale" className="btn alt">
                Browse listings <span className="arr">→</span>
              </a>
              <a href="/area-guides" className="btn alt" style={{ background: 'transparent', color: 'var(--navy)' }}>
                Area guides <span className="arr">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* Guides grouped by category — each group is an editorial KB article
            set. Every published (or stats-generated) guide row is rendered;
            nothing is dropped. */}
        {groups.length > 0 ? (
          groups.map(([category, rows]) => {
            const posts: KbArticlePost[] = rows.map((guide) => ({
              title: guide.title,
              href: `/guides/${guide.slug}`,
              excerpt: guide.meta_description || 'Read the full guide',
              // design-audit #141: every card previously rendered a blank navy
              // placeholder (no imageUrl was ever passed in). Same city-tagged
              // photo pool + deterministic-seed pattern used on /communities.
              imageUrl: pickSurfaceImage(cardPhotoPool, {
                geoTags: guide.city ? [cityEntityKey(guide.city)] : [],
                seed: guide.slug,
              }),
              // design-audit #151: cards had no date/update signal alongside
              // excerpts that promise "current" data.
              dateLabel: guide.updated_at ? formatDate(guide.updated_at) : null,
            }))
            return (
              <KbArticles
                key={category}
                posts={posts}
                eyebrow="Guides"
                heading={category}
              />
            )
          })
        ) : (
          <section className="section" id="guides-empty" aria-label="No guides yet">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Central Oregon</span>
                <h2 className="sec-title display">Guides<br />coming soon</h2>
              </div>
              <p className="ov-prose-wide" style={{ color: 'var(--navy-70)', maxWidth: '54ch' }}>
                We are writing the next round of local buying and selling guides. In the meantime,
                browse active homes or explore Central Oregon by area.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-6">
                <a href="/homes-for-sale" className="btn alt">
                  Browse listings <span className="arr">→</span>
                </a>
                <a href="/area-guides" className="btn alt" style={{ background: 'transparent', color: 'var(--navy)' }}>
                  Area guides <span className="arr">→</span>
                </a>
              </div>
            </div>
          </section>
        )}

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
