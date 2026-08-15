// @no-parity — place-family index, reuses the /cities KB index language
/**
 * Neighborhoods index — same KB index language as /cities.
 * Each row opens the existing neighborhood detail at /cities/{city}/{slug}.
 */

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  getBendNeighborhoodLedger,
  getNeighborhoodDirectory,
  getSurfaceImages,
  pickSurfaceImage,
} from '@/lib/data'
import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/getBendNeighborhoodLedger'
import { cityHero } from '@/lib/geo-images'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { MarketSources } from '@/components/site/MarketSources'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type { SchemaInput } from '@/lib/site/json-ld'
import '@/components/site/kb/kb.css'

export const revalidate = 1800

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  title: 'Bend neighborhoods: Awbrey Butte, Larkspur, Old Bend',
  description:
    'City of Bend neighborhood districts with live single-family inventory and list prices from the regional MLS.',
  path: '/neighborhoods',
})

const NEIGHBORHOOD_SENTENCE: Record<string, string> = {
  'awbrey-butte': 'West-side volcanic butte above downtown Bend, with Cascade views from the ridge.',
  'boyd-acres': 'North Bend district between the parkway and the Deschutes.',
  'century-west': 'West Bend along Century Drive, toward Mt. Bachelor.',
  larkspur: 'East Bend around Larkspur Trail and the county fairgrounds.',
  'mountain-view': 'Northeast Bend, toward Pilot Butte and the parkway.',
  'old-bend': 'The original townsite south of downtown, along the Deschutes.',
  'old-farm-district': 'Southeast Bend between the parkway and the Badlands.',
  'orchard-district': 'East-central Bend between downtown and the parkway.',
  'river-west': 'West of the Deschutes through downtown, including Drake Park.',
  'southeast-bend': 'South and east of the parkway, toward Knott Road.',
  'southern-crossing': 'South Bend around the parkway crossing at Reed Market.',
  'southwest-bend': 'Southwest Bend toward the Deschutes National Forest.',
  'summit-west': 'Far west Bend around Summit High and Shevlin Park.',
}

function fmtMedian(n: number | null | undefined): string | null {
  return n != null && Number.isFinite(n)
    ? `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
    : null
}

export default async function NeighborhoodsPage() {
  const [directory, ledger, heroPhotoPool] = await Promise.all([
    getNeighborhoodDirectory(),
    getBendNeighborhoodLedger(),
    getSurfaceImages('hero'),
  ])

  const ledgerByHref = new Map(ledger.map((row) => [row.href, row]))

  const source =
    directory.length > 0
      ? directory.map((d) => ({
          slug: d.neighborhoodSlug,
          name: d.neighborhoodName,
          citySlug: d.citySlug,
          cityName: d.cityName,
        }))
      : BEND_NEIGHBORHOOD_DISTRICTS.map((n) => ({
          slug: n.slug,
          name: n.label,
          citySlug: 'bend',
          cityName: 'Bend',
        }))

  const featured = source.map((n) => {
    const href = `/cities/${n.citySlug}/${n.slug}`
    const stats = ledgerByHref.get(href)
    const hero = cityHero(n.citySlug)
    const photoSrc =
      pickSurfaceImage(heroPhotoPool, {
        geoTags: [n.citySlug],
        seed: n.slug,
        fallback: hero.src,
      }) ?? hero.src
    return {
      slug: n.slug,
      name: n.name,
      citySlug: n.citySlug,
      cityName: n.cityName,
      href,
      sentence: NEIGHBORHOOD_SENTENCE[n.slug] ?? null,
      photoSrc,
      photoAlt: `${n.name}, ${n.cityName} Oregon`,
      photoIsPlace: photoSrc !== hero.src,
      activeCount: stats?.activeCount ?? 0,
      medianListPrice: stats?.medianListPrice ?? null,
    }
  })

  const totalActive = featured.reduce((sum, n) => sum + n.activeCount, 0)

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Neighborhoods', url: '/neighborhoods' },
      ],
    },
  ]

  return (
    <main className="kb-root">
      <KbSectionTracker pageType="index" />
      <MetadataBlock schemas={schemas} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Bend neighborhoods',
            description:
              'City of Bend neighborhood districts with live single-family inventory from the regional MLS.',
            url: `${siteUrl}/neighborhoods`,
            publisher: { '@type': 'Organization', name: 'Ryan Realty' },
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: featured.map((n, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: `${n.name}, ${n.cityName}, Oregon`,
                url: `${siteUrl}${n.href}`,
              })),
            },
          }),
        }}
      />

      <KbBreadcrumb
        overlay
        trail={[{ label: 'Home', href: '/' }, { label: 'Neighborhoods' }]}
      />

      <SmoothScrollProvider>
        <section
          className="section region"
          id="neighborhoods-pulse"
          aria-label="Bend neighborhoods market pulse"
          style={{ paddingTop: 'clamp(128px, 18vh, 170px)' }}
        >
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index mkt-live">
                <span className="dot" aria-hidden />
                Live market
              </span>
              <h1 className="sec-title display">
                Bend,<br />neighborhood by neighborhood.
              </h1>
            </div>
            <p className="neigh-sub" style={{ marginTop: '20px' }}>
              The City of Bend neighborhood districts. Live single-family inventory
              from the regional MLS, refreshed through the day.
            </p>
            <div className="region-grid" style={{ marginTop: '26px' }}>
              <div className="stat-cell">
                <span className="stat-num mono-num">
                  {totalActive > 0 ? totalActive.toLocaleString() : '-'}
                </span>
                <span className="stat-label">Active homes across these districts</span>
              </div>
              <div className="stat-cell">
                <span className="stat-num mono-num">{featured.length.toLocaleString()}</span>
                <span className="stat-label">Neighborhood districts</span>
              </div>
            </div>
            <div className="region-foot">
              <p className="note">
                Single-family homes only. Figures come from the regional MLS.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <Link href="/cities" className="btn ghost">
                  All cities <span className="arr">→</span>
                </Link>
                <Link href="/cities/bend" className="btn">
                  Bend guide <span className="arr">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section towns" id="bend-neighborhoods">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">City of Bend</span>
              <h2 className="sec-title display">
                Pick a district.<br />See what is listed.
              </h2>
            </div>
            <div>
              {featured.map((n, i) => (
                <article
                  key={n.href}
                  className="py-8 md:py-10 first:pt-8"
                  style={{ borderBottom: 'var(--edge) solid var(--navy)' }}
                >
                  <div className="grid gap-5 md:grid-cols-12 md:items-center md:gap-10">
                    <a
                      href={n.href}
                      className={`relative block aspect-[16/10] overflow-hidden md:col-span-5 md:aspect-[4/3] ${
                        i % 2 === 1 ? 'md:order-2' : ''
                      }`}
                      style={{ border: 'var(--edge) solid var(--navy)' }}
                      aria-label={`Homes for sale in ${n.name}, ${n.cityName} Oregon`}
                    >
                      <Image
                        src={n.photoSrc}
                        alt={n.photoAlt}
                        fill
                        sizes="(max-width: 768px) 100vw, 42vw"
                        className="object-cover transition-transform duration-500 hover:scale-[1.03]"
                        priority={i < 2}
                      />
                      {n.photoIsPlace ? null : (
                        <span className="hero-caption">Area view · {n.cityName}</span>
                      )}
                    </a>
                    <div className={`md:col-span-7 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                      <a href={n.href} className="group inline-block">
                        <h3
                          className="display"
                          style={{ fontSize: 'clamp(2rem, 4.4vw, 3.4rem)', lineHeight: 0.92 }}
                        >
                          {n.name}
                        </h3>
                      </a>
                      <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '10px' }}>
                        {n.cityName} · Oregon
                      </p>
                      {n.sentence ? (
                        <p
                          className="mt-3 max-w-prose"
                          style={{
                            color: 'var(--navy-70)',
                            fontSize: 'clamp(.95rem,1.5vw,1.1rem)',
                            lineHeight: 1.5,
                          }}
                        >
                          {n.sentence}
                        </p>
                      ) : null}
                      {n.activeCount > 0 || n.medianListPrice != null ? (
                        <div className="mt-6 flex flex-wrap items-baseline gap-x-9 gap-y-4">
                          <div>
                            <p
                              className="display mono-num"
                              style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}
                            >
                              {n.activeCount > 0 ? n.activeCount.toLocaleString() : '-'}
                            </p>
                            <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                              Active
                            </p>
                          </div>
                          <div>
                            <p
                              className="display mono-num"
                              style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}
                            >
                              {fmtMedian(n.medianListPrice) ?? '-'}
                            </p>
                            <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                              Median list
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '24px' }}>
                          No active listings right now.{' '}
                          <a href={n.href} style={{ color: 'var(--navy)', textDecoration: 'underline' }}>
                            See the district
                          </a>
                          .
                        </p>
                      )}
                      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
                        <a
                          href={n.href}
                          className="underline-offset-4 hover:underline"
                          style={{ color: 'var(--navy)' }}
                        >
                          {n.name} guide
                        </a>
                        <a
                          href={`/homes-for-sale/${n.citySlug}`}
                          className="underline-offset-4 hover:underline"
                          style={{ color: 'var(--navy)' }}
                        >
                          Homes for sale in {n.cityName}
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section region" id="neighborhoods-cta" aria-label="Search Bend listings">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon</span>
              <h2 className="sec-title display">
                Search every listing<br />in Central Oregon
              </h2>
            </div>
            <div className="max-w-xl pt-6 pb-12">
              <p className="neigh-sub" style={{ margin: 0 }}>
                Filter by price, beds, and location across every city on the list.
              </p>
              <div className="sec-cta" style={{ gap: '12px', flexWrap: 'wrap', display: 'flex' }}>
                <Link href="/search" className="btn">
                  Search all listings <span className="arr">→</span>
                </Link>
                <Link href="/communities" className="btn ghost">
                  Communities
                </Link>
                <Link href="/subdivisions" className="btn ghost">
                  Recorded plats
                </Link>
              </div>
            </div>
          </div>
        </section>

        <MarketSources sources={['ods']} />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
