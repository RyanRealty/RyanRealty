/**
 * Communities index — KB (kinetic-brutalist) design, Phase 9 page-class migration.
 *
 * RESTYLED IN PLACE. Every piece of the prior Geo-hub index is preserved —
 * nothing dropped, only the presentation moved onto the KB visual language
 * (navy #102742 + cream #faf8f4 surfaces, Amboqia display community names,
 * hard 1px/3px --edge borders, .mono-num stats, the .section / .wrap rhythm).
 * Content kept:
 *
 *   1. Compact navy hero — the live aggregate is the identity (total active
 *      across the registry communities + community count). Honest em-dash empties.
 *   2. Resort + master-planned community editorial rows (the 14 registry
 *      communities, curated order) — full-bleed alternating photo/content,
 *      curated communityImage() with labeled cityHero() fallback, one honest
 *      editorial sentence (getResortCommunityContent), the City · Oregon
 *      sublabel, a live stat band (active / median / pending) with
 *      geo_snapshot_mv + index fallback, and the two links per community
 *      (community guide / homes for sale in city).
 *   3. Every community, A to Z — the interactive CommunityIndexBrowser
 *      (search + collapsed alphabetical index). Kept fully working: every
 *      /communities/<slug> URL stays server-rendered in the DOM.
 *   4. Navy search CTA band (Search all listings / What is your home worth).
 *
 * Section telemetry now via KbSectionTracker (every .kb-root section[id]).
 * All figures from the DAL — no invented numbers, em-dash when unavailable.
 *
 * KbNav + KbFooter carry the chrome (default SiteHeader/SiteFooter hidden for
 * /communities via HideChrome — managed by the orchestrator, not this file).
 */

import type { Metadata } from 'next'
import Image from 'next/image'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getAllCommunitySnapshots, getAllCitySnapshots } from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { communityImage, cityHero } from '@/lib/geo-images'
import { getSurfaceImages, pickSurfaceImage } from '@/lib/data'
import { subdivisionEntityKey } from '@/lib/slug'
import CommunityIndexBrowser from '@/components/community/CommunityIndexBrowser'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

// Statically cached, revalidated every 30 minutes (was force-dynamic — the
// page reads only cached DAL data, so per-request rendering bought nothing
// except a slower TTFB on a 60k-pixel page).
export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Communities in Central Oregon | Bend, Redmond, Sisters',
  description:
    'Explore communities and neighborhoods in Central Oregon. Find homes in Bend, Redmond, Sisters, Sunriver, and surrounding areas.',
  alternates: { canonical: `${siteUrl}/communities` },
  openGraph: {
    title: 'Communities in Central Oregon | Ryan Realty',
    description: 'Explore communities and neighborhoods in Central Oregon.',
    url: `${siteUrl}/communities`,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: `${siteUrl}/api/og?type=default`, width: 1200, height: 630, alt: 'Communities in Central Oregon' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [`${siteUrl}/api/og?type=default`],
  },
}

type RegistryCommunity = {
  slug: string
  label: string
  city: string
  city_slug: string
  is_resort: boolean
}

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.?](?=\s|$)/)
  return (m ? m[0] : text).trim()
}

/** Brand-spec currency: rounded to the nearest thousand, full form ($1,425,000). */
function fmtPrice(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}

export default async function CommunitiesPage() {
  const registry = resortCommunitiesRegistry.communities as ReadonlyArray<RegistryCommunity>

  const [allCommunities, snapshots, citySnapshots, heroPhotoPool] = await Promise.all([
    getCommunitiesForIndex(),
    getAllCommunitySnapshots(),
    getAllCitySnapshots(),
    getSurfaceImages('hero'),
  ])

  // geo_snapshot_mv keys: lowercase "city:subdivision" with spaces preserved
  // (e.g. "powell butte:brasada ranch") — same construction the community
  // detail page uses, so index numbers and detail-page numbers agree.
  const snapByKey = new Map(snapshots.map((s) => [s.geoKey, s]))
  // Fallbacks (design-audit P1 — 11 of 19 flagship rows rendered em-dashes):
  // 1. label-only: the registry city and the MLS "City" field disagree for some
  //    resorts (e.g. Brasada rows carry Powell Butte). Pick the busiest row.
  // 2. city row: Sunriver / Black Butte Ranch / Crooked River Ranch are CITIES
  //    in the MLS, so their inventory lives on a city row, not city:subdivision.
  const snapByLabel = new Map<string, (typeof snapshots)[number]>()
  for (const s of snapshots) {
    const label = s.geoKey.split(':')[1] ?? ''
    const prev = snapByLabel.get(label)
    if (!prev || s.activeSfrCount > prev.activeSfrCount) snapByLabel.set(label, s)
  }
  const cityByKey = new Map(citySnapshots.map((s) => [s.geoKey, s]))
  const indexByEntityKey = new Map(allCommunities.map((c) => [c.entityKey, c]))

  // The 14 registry communities — the editorial layer. Registry order is
  // curated (data/resort-communities.json is the source of truth).
  const resorts = await Promise.all(
    registry.map(async (r) => {
      const labelKey = r.label.toLowerCase().trim()
      const geoKey = `${r.city.toLowerCase().trim()}:${labelKey}`
      const snap = snapByKey.get(geoKey) ?? snapByLabel.get(labelKey) ?? cityByKey.get(labelKey) ?? null
      const idx = indexByEntityKey.get(subdivisionEntityKey(r.city, r.label)) ?? null
      const content = await getResortCommunityContent(r.slug)
      const sentence = content?.aboutProse?.[0] ? firstSentence(content.aboutProse[0]) : null
      const curated = communityImage(r.slug)
      const fallbackHero = cityHero(r.city_slug)
      // Four consecutive rows with no curated photo of their own (Mt Bachelor
      // Village, Inn of the 7th Mountain, Rivers Edge, Mountain High) all fell
      // back to the SAME single cityHero() image, reading as duplicate
      // template filler (design-audit P2). pickSurfaceImage spreads them
      // across the real, approved Bend-area photo pool instead — seeded by
      // slug so each community's fallback is still stable across renders.
      const pooledFallback = pickSurfaceImage(heroPhotoPool, {
        geoTags: [r.city_slug],
        seed: r.slug,
        fallback: fallbackHero.src,
      })
      return {
        slug: r.slug,
        name: r.label,
        city: r.city,
        citySlug: r.city_slug,
        sentence,
        photoSrc: curated ?? pooledFallback ?? fallbackHero.src,
        // Honest alt: a curated photo shows the community itself, the city
        // fallback's alt describes what the photo actually shows.
        photoAlt: curated ? `${r.label}, ${r.city} Oregon` : fallbackHero.alt,
        photoIsCommunity: curated != null,
        // Registry resorts are permanent fixtures: no snapshot row means zero
        // current inventory (the shared fetch drops 0-count rows), and "0
        // active" is the honest ledger — an em-dash read as broken data.
        activeCount: snap?.activeSfrCount ?? idx?.activeCount ?? 0,
        pendingCount: snap?.pendingCount ?? null,
        medianPrice: snap?.medianListPrice ?? idx?.medianPrice ?? null,
      }
    }),
  )

  // Long tail: every community the index knows, alphabetical (already sorted
  // by getCommunitiesForIndex). Resorts stay in the index too so the A-to-Z
  // list is complete and every community URL is in the DOM.
  const indexItems = allCommunities.map((c) => ({
    slug: c.slug,
    name: c.subdivision,
    city: c.city,
    activeCount: c.activeCount,
  }))

  const totalActive = allCommunities.reduce((sum, c) => sum + c.activeCount, 0)
  const communityCount = allCommunities.length

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="index" />

      {/* Structured data: CollectionPage + ItemList of the 14 registry communities */}
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Communities', url: '/communities' },
            ],
          },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Communities in Central Oregon',
            description: 'Explore communities and neighborhoods in Central Oregon.',
            url: `${siteUrl}/communities`,
            publisher: { '@type': 'Organization', name: 'Ryan Realty' },
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: resorts.map((r, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: `${r.name}, ${r.city}, Oregon`,
                url: `${siteUrl}/communities/${r.slug}`,
              })),
            },
          }),
        }}
      />

      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Communities' },
        ]}
      />

      <SmoothScrollProvider>
        {/* Compact navy hero — the live aggregate is the identity (Hub archetype) */}
        {/* Extra top padding clears the fixed nav + overlay crumbs — this compact
            hero starts content at the top (full-viewport heroes bottom-anchor). */}
        <section className="section region" id="communities-pulse" aria-label="Central Oregon communities market pulse" style={{ paddingTop: 'clamp(128px, 18vh, 170px)' }}>
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index mkt-live">
                <span className="dot" aria-hidden />
                Live market
              </span>
              <h1 className="sec-title display">Communities in<br />Central Oregon</h1>
            </div>

            <p className="neigh-sub" style={{ marginTop: '20px' }}>
              Resort and master-planned communities, neighborhoods, and subdivisions
              across Bend, Redmond, Sisters, Sunriver, and the high desert towns
              between them. Live inventory from the regional MLS.
            </p>

            <div className="region-grid" style={{ marginTop: '26px' }}>
              <div className="stat-cell">
                <span className="stat-num mono-num">
                  {totalActive > 0 ? totalActive.toLocaleString() : '—'}
                </span>
                <span className="stat-label">Homes for sale across these communities</span>
              </div>
              <div className="stat-cell">
                <span className="stat-num mono-num">{communityCount.toLocaleString()}</span>
                <span className="stat-label">Communities</span>
              </div>
            </div>
            <div className="region-foot">
              <p className="note">
                Single-family active inventory across every Central Oregon community we track. Figures from the MLS.
              </p>
              <a href="/search" className="btn">
                Search all listings <span className="arr">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* Resort + master-planned communities — full-width editorial ledger rows */}
        <section className="section towns" id="resort-communities">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Resort communities</span>
              <h2 className="sec-title display">Resort &amp;<br />master-planned</h2>
            </div>

            <div>
              {resorts.map((r, i) => (
                <article
                  key={r.slug}
                  className="py-8 md:py-10 first:pt-8"
                  style={{ borderBottom: 'var(--edge) solid var(--navy)' }}
                >
                  <div className="grid gap-5 md:grid-cols-12 md:items-center md:gap-10">
                    {/* Photo — alternates sides on desktop for editorial rhythm */}
                    <a
                      href={`/communities/${r.slug}`}
                      className={`relative block aspect-[16/10] overflow-hidden md:col-span-5 md:aspect-[4/3] ${
                        i % 2 === 1 ? 'md:order-2' : ''
                      }`}
                      style={{ border: 'var(--edge) solid var(--navy)' }}
                      aria-label={`Homes for sale in ${r.name}, ${r.city} Oregon`}
                    >
                      <Image
                        src={r.photoSrc}
                        alt={r.photoAlt}
                        fill
                        sizes="(max-width: 768px) 100vw, 42vw"
                        className="object-cover transition-transform duration-500 hover:scale-[1.03]"
                        priority={i < 2}
                      />
                      {r.photoIsCommunity ? null : (
                        <span className="hero-caption">Area view · {r.city}</span>
                      )}
                    </a>

                    {/* Editorial content */}
                    <div className={`md:col-span-7 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                      <a href={`/communities/${r.slug}`} className="group inline-block">
                        <h3
                          className="display"
                          style={{ fontSize: 'clamp(2rem, 4.4vw, 3.4rem)', lineHeight: 0.92 }}
                        >
                          {r.name}
                        </h3>
                      </a>
                      <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '10px' }}>
                        {r.city} · Oregon
                      </p>

                      {r.sentence ? (
                        <p
                          className="mt-3 max-w-prose"
                          style={{ color: 'var(--navy-70)', fontSize: 'clamp(.95rem,1.5vw,1.1rem)', lineHeight: 1.5 }}
                        >
                          {r.sentence}
                        </p>
                      ) : null}

                      {/* Live stat band — tabular numerals, honest em-dash empties.
                          "0 active" is itself the honest, verified figure
                          (activeCount always resolves through a `?? 0`
                          upstream, never truly unknown here) — treating 0 the
                          same as "data missing" contradicted the same zero-
                          inventory case rendering as "0 Active" everywhere
                          else on the site (design-audit P3, one convention). */}
                      <div className="mt-6 flex flex-wrap items-baseline gap-x-9 gap-y-4">
                        <div>
                          <p className="display mono-num" style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}>
                            {r.activeCount != null ? r.activeCount.toLocaleString() : '—'}
                          </p>
                          <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                            Active
                          </p>
                        </div>
                        <div>
                          <p className="display mono-num" style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}>
                            {fmtPrice(r.medianPrice) ?? '—'}
                          </p>
                          <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                            Median list
                          </p>
                        </div>
                        {r.pendingCount != null && r.pendingCount > 0 ? (
                          <div>
                            <p className="display mono-num" style={{ fontSize: 'clamp(1.6rem,4vw,2.3rem)', lineHeight: 1 }}>
                              {r.pendingCount.toLocaleString()}
                            </p>
                            <p className="mono-lab" style={{ color: 'var(--navy-70)', marginTop: '7px' }}>
                              Pending
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {/* Links into the community */}
                      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
                        {/* First link is the editorial guide, not listings — the
                            old label "{name} homes for sale" promised inventory
                            and delivered a guide page (design-audit P2). */}
                        <a
                          href={`/communities/${r.slug}`}
                          className="underline-offset-4 hover:underline"
                          style={{ color: 'var(--navy)' }}
                        >
                          {r.name} guide
                        </a>
                        <a
                          href={`/homes-for-sale/${r.citySlug}`}
                          className="underline-offset-4 hover:underline"
                          style={{ color: 'var(--navy)' }}
                        >
                          Homes for sale in {r.city}
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Every community — search + collapsed alphabetical index */}
        <section
          className="section towns"
          id="all-communities"
          style={{ background: 'rgba(16,39,66,0.04)' }}
        >
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">The full index</span>
              <h2 className="sec-title display">Every community,<br />A to Z</h2>
            </div>
            <p
              className="mt-4 max-w-prose"
              style={{ color: 'var(--navy-70)', fontSize: 'clamp(.95rem,1.5vw,1.05rem)', lineHeight: 1.5 }}
            >
              {communityCount.toLocaleString()} neighborhoods and subdivisions across
              Central Oregon. Search by name or city, or browse the index. Each links
              to live listings and market data.
            </p>
            <div className="pt-2">
              <CommunityIndexBrowser items={indexItems} />
            </div>
          </div>
        </section>

        {/* Search CTA: navy band */}
        <section className="section region" id="communities-cta" aria-label="Search Central Oregon communities">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon</span>
              <h2 className="sec-title display">Find your place<br />in Central Oregon</h2>
            </div>
            <div className="max-w-xl pt-6 pb-12">
              <p className="neigh-sub" style={{ margin: 0 }}>
                Search active listings across every community with live filters for
                price, beds, and location. Or start with what your current home is worth.
              </p>
              <div className="sec-cta" style={{ gap: '12px', flexWrap: 'wrap', display: 'flex' }}>
                <a href="/search" className="btn">
                  Search all listings <span className="arr">→</span>
                </a>
                <a href="/sell/valuation" className="btn ghost">
                  What is your home worth
                </a>
              </div>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
