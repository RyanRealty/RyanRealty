// @no-parity — place-family index, reuses the /communities KB index language
/**
 * Subdivisions index — same KB index language as /communities.
 * Featured rows and the A-to-Z list are recorded child plats from the
 * community registry (not marketing community slugs). The county-wide
 * indexable set still feeds the sitemap. It is too heavy to render here.
 */

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  getSurfaceImages,
  pickSurfaceImage,
} from '@/lib/data'
import {
  getRegistryPlatPublicInventory,
  registryChildPlats,
} from '@/lib/data/geo/plat-public-inventory'
import { communityImage, cityHero } from '@/lib/geo-images'
import { publishFeaturedPlats } from '@/lib/market/publish-featured-plat-inventory'
import { formatIndexMedianUsd } from '@/lib/market/publish-index-median'
import { pageMetadata } from '@/lib/site/page-metadata'
import CommunityIndexBrowser from '@/components/community/CommunityIndexBrowser'
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
  title: 'Central Oregon subdivisions and recorded plats',
  description:
    'Recorded plats across Central Oregon with live single-family inventory from the regional MLS.',
  path: '/subdivisions',
})

function fmtPrice(n: number | null | undefined): string | null {
  return formatIndexMedianUsd(n)
}

export default async function SubdivisionsPage() {
  const childPlats = registryChildPlats()

  const [inventory, heroPhotoPool] = await Promise.all([
    getRegistryPlatPublicInventory(),
    getSurfaceImages('hero'),
  ])
  const inventoryOk = inventory.length > 0
  const invByKey = new Map(inventory.map((row) => [row.key, row]))
  const countByKey = new Map(inventory.map((row) => [row.key, row.activeCount]))
  const featuredSeeds = publishFeaturedPlats(childPlats, countByKey, {
    inventoryOk,
    cap: 12,
  })

  const featured = featuredSeeds.map((p) => {
    const inv = invByKey.get(`${p.citySlug}:${p.slug}`) ?? null
    const curated = communityImage(p.parentSlug)
    const fallbackHero = cityHero(p.citySlug)
    const pooled = pickSurfaceImage(heroPhotoPool, {
      geoTags: [p.citySlug],
      seed: p.slug,
      fallback: curated ?? fallbackHero.src,
    })
    return {
      ...p,
      href: `/subdivisions/${p.slug}`,
      sentence: `${p.name} is a recorded plat in ${p.parent}, ${p.city}.`,
      photoSrc: pooled ?? curated ?? fallbackHero.src,
      photoAlt: curated ? `${p.name}, ${p.city} Oregon` : fallbackHero.alt,
      photoIsPlat: curated != null,
      activeCount: inventoryOk ? (inv?.activeCount ?? 0) : null,
      medianPrice: inventoryOk ? (inv?.medianListPrice ?? null) : null,
    }
  })

  const azSeen = new Set<string>()
  const azSource = childPlats.flatMap((p) => {
    if (azSeen.has(p.slug)) return []
    azSeen.add(p.slug)
    const inv = invByKey.get(`${p.citySlug}:${p.slug}`) ?? null
    return [
      {
        slug: p.slug,
        name: p.name,
        city: p.city,
                activeCount: inventoryOk ? (inv?.activeCount ?? 0) : 0,
                href: `/subdivisions/${p.slug}`,
      },
    ]
  })

  const totalActive = inventoryOk
    ? azSource.reduce((sum, p) => sum + (p.activeCount ?? 0), 0)
    : null
  const platCount = azSource.length

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Subdivisions', url: '/subdivisions' },
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
            name: 'Central Oregon subdivisions',
            description:
              'Recorded plats across Central Oregon, with live MLS inventory.',
            url: `${siteUrl}/subdivisions`,
            publisher: { '@type': 'Organization', name: 'Ryan Realty' },
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: featured.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: `${p.name}, ${p.city}, Oregon`,
                url: `${siteUrl}${p.href}`,
              })),
            },
          }),
        }}
      />

      <KbBreadcrumb
        overlay
        trail={[{ label: 'Home', href: '/' }, { label: 'Subdivisions' }]}
      />

      <SmoothScrollProvider>
        <section
          className="section region"
          id="subdivisions-pulse"
          aria-label="Central Oregon subdivisions market pulse"
          style={{ paddingTop: 'clamp(128px, 18vh, 170px)' }}
        >
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index mkt-live">
                <span className="dot" aria-hidden />
                Live market
              </span>
              <h1 className="sec-title display">
                Recorded plats across<br />Central Oregon.
              </h1>
            </div>
            <p className="neigh-sub" style={{ marginTop: '20px' }}>
              County plats with live single-family inventory. Each name opens the
              listings and sales history for that plat.
            </p>
            <div className="region-grid" style={{ marginTop: '26px' }}>
              <div className="stat-cell">
                <span className="stat-num mono-num">
                  {totalActive != null && totalActive > 0 ? totalActive.toLocaleString() : '-'}
                </span>
                <span className="stat-label">Homes for sale across these plats</span>
              </div>
              <div className="stat-cell">
                <span className="stat-num mono-num">{platCount.toLocaleString()}</span>
                <span className="stat-label">Community plats in this index</span>
              </div>
            </div>
            <div className="region-foot">
              <p className="note">
                Single-family active inventory on recorded plats inside the
                known communities. Figures from the regional MLS.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <Link href="/communities" className="btn ghost">
                  Communities <span className="arr">→</span>
                </Link>
                <Link href="/search" className="btn">
                  Search all listings <span className="arr">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section towns" id="featured-plats">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Recorded plats</span>
              <h2 className="sec-title display">
                Plats inside the<br />known communities
              </h2>
            </div>
            <div>
              {featured.map((p, i) => (
                <article
                  key={p.slug}
                  className="py-8 md:py-10 first:pt-8"
                  style={{ borderBottom: 'var(--edge) solid var(--navy)' }}
                >
                  <div className="grid gap-5 md:grid-cols-12 md:items-center md:gap-10">
                    <a
                      href={p.href}
                      className={`relative block aspect-[16/10] overflow-hidden md:col-span-5 md:aspect-[4/3] ${
                        i % 2 === 1 ? 'md:order-2' : ''
                      }`}
                      style={{ border: 'var(--edge) solid var(--navy)' }}
                      aria-label={`Homes for sale in ${p.name}, ${p.city} Oregon`}
                    >
                      <Image
                        src={p.photoSrc}
                        alt={p.photoAlt}
                        fill
                        sizes="(max-width: 768px) 100vw, 42vw"
                        className="object-cover transition-transform duration-500 hover:scale-[1.03]"
                        priority={i < 2}
                      />
                      {p.photoIsPlat ? null : (
                        <span className="hero-caption">Area view · {p.city}</span>
                      )}
                    </a>
                    <div className={`md:col-span-7 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                      <a href={p.href} className="group inline-block">
                        <h3
                          className="display"
                          style={{ fontSize: 'clamp(2rem, 4.4vw, 3.4rem)', lineHeight: 0.92 }}
                        >
                          {p.name}
                        </h3>
                      </a>
                      <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '10px' }}>
                        {p.parent} · {p.city} · Oregon
                      </p>
                      <p
                        className="mt-3 max-w-prose"
                        style={{
                          color: 'var(--navy-70)',
                          fontSize: 'clamp(.95rem,1.5vw,1.1rem)',
                          lineHeight: 1.5,
                        }}
                      >
                        {p.sentence}
                      </p>
                      <div className="mt-6 flex flex-wrap items-baseline gap-x-9 gap-y-4">
                        <div>
                          <p
                            className="display mono-num"
                            style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}
                          >
                            {p.activeCount != null ? p.activeCount.toLocaleString() : '-'}
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
                            {fmtPrice(p.medianPrice) ?? '-'}
                          </p>
                          <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                            Median list
                          </p>
                        </div>
                      </div>
                      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
                        <a
                          href={p.href}
                          className="underline-offset-4 hover:underline"
                          style={{ color: 'var(--navy)' }}
                        >
                          {p.name} plat
                        </a>
                        <a
                          href={`/communities/${p.parentSlug}`}
                          className="underline-offset-4 hover:underline"
                          style={{ color: 'var(--navy)' }}
                        >
                          {p.parent} guide
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="section towns"
          id="all-plats"
          style={{ background: 'rgba(16,39,66,0.04)' }}
        >
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">The full index</span>
              <h2 className="sec-title display">
                Community plats,<br />A to Z
              </h2>
            </div>
            <p
              className="mt-4 max-w-prose"
              style={{
                color: 'var(--navy-70)',
                fontSize: 'clamp(.95rem,1.5vw,1.05rem)',
                lineHeight: 1.5,
              }}
            >
              {`${platCount.toLocaleString()} recorded plats inside the known communities. Search by name or city.`}
            </p>
            <div className="pt-2">
              <CommunityIndexBrowser
                items={azSource}
                searchLabel="Search plats by name or city"
                searchPlaceholder="Search by plat or city name"
                emptyLabel="No plats match your search."
                countNoun={{ singular: 'plat', plural: 'plats' }}
              />
            </div>
          </div>
        </section>

        <section className="section region" id="subdivisions-cta" aria-label="Search Central Oregon plats">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon</span>
              <h2 className="sec-title display">
                Find a home, or<br />price the one you have.
              </h2>
            </div>
            <div className="max-w-xl pt-6 pb-12">
              <p className="neigh-sub" style={{ margin: 0 }}>
                Search active listings across every city, or start with what your
                home is worth today.
              </p>
              <div className="sec-cta" style={{ gap: '12px', flexWrap: 'wrap', display: 'flex' }}>
                <Link href="/search" className="btn">
                  Search all listings <span className="arr">→</span>
                </Link>
                <Link href="/neighborhoods" className="btn ghost">
                  Neighborhoods
                </Link>
                <Link href="/sell/valuation" className="btn ghost">
                  Value my home
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
