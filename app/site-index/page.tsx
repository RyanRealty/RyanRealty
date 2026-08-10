// @no-parity — derived site-index page (no standalone mockup; reuses KB section library)
/**
 * /site-index — the ONE crawlable HTML index of the site's browse-URL families
 * (W3.4 internal-link layer).
 *
 * Purpose: the thousands of programmatic pages (city browse, city + preset
 * searches, communities, subdivisions) need real HTML anchor links from a
 * crawlable hub — the XML sitemap submits URLs but passes no internal link
 * equity. This page enumerates the families with real <a> links, grouped and
 * capped, every group AUTO-DERIVED from live inventory via getSiteIndexLinks
 * (ranked by active-listing count, 6h revalidation window). No hand-curated
 * link lists — the page tracks the market on its own.
 *
 * §0 note: ranking counts are used to ORDER links only and are never rendered,
 * so the page carries no market stats to trace.
 *
 * KB shell (KbNav + KbFooter + KbSectionTracker + metadata) per the page
 * contract. Registered in lib/site/chrome-routes.ts KB_ROUTES so the default
 * chrome is suppressed (single-nav rule). Linked from the site footer legal row.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { getSiteIndexLinks } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

export const revalidate = 3600

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  title: 'Site index',
  description:
    'Browse pages on ryan-realty.com in one place. Cities, communities, subdivisions, and searches, ordered by live inventory.',
  path: '/site-index',
})

const edgeBox = {
  borderColor: 'var(--navy)',
  borderTopWidth: 'var(--edge)',
  borderLeftWidth: 'var(--edge)',
} as const

const edgeCell = {
  borderColor: 'var(--navy)',
  borderRightWidth: 'var(--edge)',
  borderBottomWidth: 'var(--edge)',
} as const

export default async function SiteIndexPage() {
  const data = await getSiteIndexLinks()
  // Resilience fallback (no derivation available): keep this render out of the
  // ISR cache so a transient blip is never persisted as an empty index page.
  if (data.generatedAt === null) noStore()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Site index',
    url: `${siteUrl}/site-index`,
    description:
      'Directory of city, community, subdivision, and search pages on ryan-realty.com.',
  }

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="site_index" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <KbBreadcrumb
        belowNav
        trail={[{ label: 'Home', href: '/' }, { label: 'Site index' }]}
      />
      {/* Intro */}
      <section className="section" id="site-index-intro" aria-label="Site index">
        <div className="wrap">
          <div className="sec-head">
            <span className="sec-index">ryan-realty.com directory</span>
            <h1 className="sec-title display">Site index</h1>
          </div>
          <p
            className="mt-4 text-base leading-relaxed"
            style={{ maxWidth: '62ch', color: 'var(--navy-70)' }}
          >
            The browse pages on ryan-realty.com, grouped by city, community,
            subdivision, and search. Each group is ordered by live active-listing
            inventory and refreshes through the day.
          </p>
        </div>
      </section>

      {/* Cities */}
      {data.cities.length > 0 && (
        <section className="section" id="site-index-cities" aria-label="Cities">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Cities</span>
              <h2 className="sec-title display">Homes by city</h2>
            </div>
            <ul
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              style={{ ...edgeBox, marginTop: '28px' }}
            >
              {data.cities.map((city) => (
                <li key={city.slug} className="flex flex-col gap-1.5 p-6" style={edgeCell}>
                  <Link
                    href={city.browseHref}
                    className="font-display text-2xl leading-none hover:underline"
                  >
                    {city.name} homes for sale
                  </Link>
                  <span className="text-sm" style={{ color: 'var(--navy-70)' }}>
                    <Link href={city.hubHref} className="underline underline-offset-2">
                      {city.name} city guide
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Searches by city */}
      {data.citySearches.length > 0 && (
        <section className="section" id="site-index-searches" aria-label="Searches by city">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Searches</span>
              <h2 className="sec-title display">Top searches by city</h2>
            </div>
            <div className="mt-2 flex flex-col gap-8">
              {data.citySearches.map((group) => (
                <div key={group.citySlug}>
                  <h3 className="font-display text-xl leading-none">
                    <Link href={group.cityHref} className="hover:underline">
                      {group.cityName}
                    </Link>
                  </h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="si-chip inline-block px-3 py-1.5 text-sm transition-colors"
                          style={{
                            borderColor: 'var(--navy)',
                            borderWidth: 'var(--edge)',
                          }}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Communities */}
      {data.communities.length > 0 && (
        <section className="section" id="site-index-communities" aria-label="Communities">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Communities</span>
              <h2 className="sec-title display">Resort and golf communities</h2>
            </div>
            <ul
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
              style={{ ...edgeBox, marginTop: '28px' }}
            >
              {data.communities.map((community) => (
                <li key={community.href} style={edgeCell}>
                  <Link
                    href={community.href}
                    className="si-chip block p-5 text-sm font-semibold transition-colors"
                  >
                    {community.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Subdivisions */}
      {data.subdivisions.length > 0 && (
        <section className="section" id="site-index-subdivisions" aria-label="Subdivisions">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Subdivisions</span>
              <h2 className="sec-title display">Top subdivisions</h2>
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.subdivisions.map((sub) => (
                <li key={sub.href}>
                  <Link
                    href={sub.href}
                    className="text-sm underline underline-offset-2 hover:no-underline"
                  >
                    {sub.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Always-on hubs, so the page is useful even on a fallback render. */}
      <section className="section" id="site-index-hubs" aria-label="Main hubs">
        <div className="wrap">
          <div className="sec-head">
            <span className="sec-index">Hubs</span>
            <h2 className="sec-title display">Main sections</h2>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {[
              { href: '/homes-for-sale', label: 'Homes for sale' },
              { href: '/cities', label: 'Cities' },
              { href: '/communities', label: 'Communities' },
              { href: '/housing-market', label: 'Housing market' },
              { href: '/open-houses', label: 'Open houses' },
              { href: '/price-drops', label: 'Price drops' },
              { href: '/sell/valuation', label: 'Home valuation' },
              { href: '/blog', label: 'Blog & guides' },
              { href: '/blog', label: 'Blog' },
            ].map((hub) => (
              <li key={hub.href}>
                <Link href={hub.href} className="underline underline-offset-2 hover:no-underline">
                  {hub.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <KbFooter towns={[]} />
    </main>
  )
}
