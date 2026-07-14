/**
 * /resources — Buyer and seller resources for Central Oregon real estate.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior ContentPageHero + shadcn Card grid. Every piece of
 * content is preserved:
 *   - All 6 resource links (Market reports, Housing market hub, Area guides,
 *     Property comparison, Appreciation calculator, Live market activity) with
 *     their titles, descriptions, and hrefs.
 *   - The CollectionPage JSON-LD.
 *   - The hero copy + both CTAs (View Market Reports / Search Listings).
 *   - The AdUnit (consent-gated AdSense slot) — preserved untouched.
 *   - The HomeValuationCta — preserved untouched.
 *
 * Only the presentation changed — the page now wears the KB shell (KbNav,
 * KbHero, KbFooter, SmoothScrollProvider, KbSectionTracker) and the Amboqia
 * display / hard-edge cream surfaces of the rest of the migrated site. The
 * resource grid is now a hard navy-bordered ledger of tiles.
 *
 * SEO: export const metadata (canonical + OG + Twitter) preserved. JSON-LD
 * preserved. PAGE CONTRACT: KB design + SEO + tracking (KbSectionTracker
 * pageType="info").
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'
import { listingsBrowsePath } from '@/lib/slug'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

const resources = [
  {
    title: 'Market reports',
    description: 'City and community trends with pricing, inventory, and pace insights.',
    href: '/housing-market/reports',
  },
  {
    title: 'Housing market hub',
    description: 'Evergreen market pages and regional Central Oregon market context.',
    href: '/housing-market',
  },
  {
    title: 'Area guides',
    description: 'Neighborhood and relocation guides for buyers planning a move.',
    href: '/guides',
  },
  {
    title: 'Property comparison',
    description: 'Compare up to four listings side by side before scheduling tours.',
    href: '/compare',
  },
  {
    title: 'Appreciation calculator',
    description: 'Project potential value growth and equity over time.',
    href: '/tools/appreciation',
  },
  {
    title: 'Live market activity',
    description: 'Follow new listings, pending updates, and closed activity in real time.',
    href: '/activity',
  },
]

export const metadata: Metadata = {
  title: 'Buyer and Seller Resources',
  description: 'Explore guides, market tools, and report resources for Central Oregon real estate decisions.',
  alternates: { canonical: `${siteUrl}/resources` },
  openGraph: {
    title: 'Buyer and Seller Resources | Ryan Realty',
    description: 'Guides, market tools, and report resources for Central Oregon buyers and sellers.',
    url: `${siteUrl}/resources`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary',
    title: 'Buyer and Seller Resources | Ryan Realty',
    description: 'Guides, market tools, and report resources for Central Oregon buyers and sellers.',
    images: [ogImage],
  },
}

export default function ResourcesPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Buyer and Seller Resources',
    url: `${siteUrl}/resources`,
    description: 'Guides, reports, and planning tools for Central Oregon real estate decisions.',
  }

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="info" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Resources' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same H1 + subtitle as the prior ContentPageHero. The two CTAs
            (View Market Reports / Search Listings) are preserved in the CTA row
            below. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Tools & market data"
          titleTop="Buyer & seller"
          titleBottom="resources"
          lead="Tools, market data, and guides to help you make confident decisions in Central Oregon real estate."
          videoSrc={null}
          posterSrc="/images/kb/redmond-downtown-aerial.jpg"
        />

        {/* CTA row preserved from the prior hero. */}
        <section className="section" id="resources-cta" aria-label="Reports and listings">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <Link href="/housing-market/reports" className="btn alt">
                View market reports <span className="arr">→</span>
              </Link>
              <Link
                href={listingsBrowsePath()}
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                Search listings <span className="arr">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Resource ledger — every resource preserved as a hard-edge KB tile that
            links to its destination. */}
        <section className="section" id="resource-grid" aria-label="Resources">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Plan your next move</span>
              <h2 className="sec-title display">Guides, tools<br />and reports</h2>
            </div>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              style={{ borderColor: 'var(--navy)', borderTopWidth: 'var(--edge)', borderLeftWidth: 'var(--edge)', marginTop: '28px' }}
            >
              {resources.map((resource) => (
                <Link
                  key={resource.href}
                  href={resource.href}
                  className="group flex flex-col gap-3 p-6 transition-colors hover:bg-[color:var(--navy)] hover:text-[color:var(--cream)]"
                  style={{ borderColor: 'var(--navy)', borderRightWidth: 'var(--edge)', borderBottomWidth: 'var(--edge)' }}
                >
                  <h3 className="font-display text-2xl leading-none">{resource.title}</h3>
                  <p
                    className="text-sm leading-relaxed text-[color:var(--navy-70)] group-hover:text-[color:var(--cream-70)]"
                  >
                    {resource.description}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                    Open resource <span className="arr">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* AdSense slot — consent-gated AND self-collapsing (design-audit STA-2):
            AdUnit renders nothing when there's no consent or no ad inventory, and
            without the `.section` padding an absent ad leaves zero dead space, so
            the old empty "Sponsored" box on this first-party hub is gone. When an
            ad does serve it carries its own vertical margin. */}
        <div className="wrap">
          <AdUnit slot="1001003003" format="horizontal" className="my-10" />
        </div>

        {/* Home valuation CTA — preserved untouched (carries LP/UTM attribution). */}
        <section className="section" id="resource-valuation" aria-label="What is your home worth">
          <div className="wrap">
            <HomeValuationCta />
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
