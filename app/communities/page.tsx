import type { Metadata } from 'next'
import Image from 'next/image'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getAllCommunitySnapshots } from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { communityImage, cityHero } from '@/lib/geo-images'
import { subdivisionEntityKey } from '@/lib/slug'
import CommunityIndexBrowser from '@/components/community/CommunityIndexBrowser'
import { Container, DisplayHeading, H2, Eyebrow } from '@/components/site/primitives'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { EngagedSection } from '@/components/site/experience'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

// Statically cached, revalidated every 30 minutes (was force-dynamic — the
// page reads only cached DAL data, so per-request rendering bought nothing
// except a slower TTFB on a 60k-pixel page).
export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Communities in Central Oregon | Bend, Redmond, Sisters | Ryan Realty',
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

  const [allCommunities, snapshots] = await Promise.all([
    getCommunitiesForIndex(),
    getAllCommunitySnapshots(),
  ])

  // geo_snapshot_mv keys: lowercase "city:subdivision" with spaces preserved
  // (e.g. "powell butte:brasada ranch") — same construction the community
  // detail page uses, so index numbers and detail-page numbers agree.
  const snapByKey = new Map(snapshots.map((s) => [s.geoKey, s]))
  const indexByEntityKey = new Map(allCommunities.map((c) => [c.entityKey, c]))

  // The 14 registry communities — the editorial layer. Registry order is
  // curated (data/resort-communities.json is the source of truth).
  const resorts = await Promise.all(
    registry.map(async (r) => {
      const geoKey = `${r.city.toLowerCase().trim()}:${r.label.toLowerCase().trim()}`
      const snap = snapByKey.get(geoKey) ?? null
      const idx = indexByEntityKey.get(subdivisionEntityKey(r.city, r.label)) ?? null
      const content = await getResortCommunityContent(r.slug)
      const sentence = content?.aboutProse?.[0] ? firstSentence(content.aboutProse[0]) : null
      const curated = communityImage(r.slug)
      const fallbackHero = cityHero(r.city_slug)
      return {
        slug: r.slug,
        name: r.label,
        city: r.city,
        citySlug: r.city_slug,
        sentence,
        photoSrc: curated ?? fallbackHero.src,
        // Honest alt: a curated photo shows the community itself, the city
        // fallback's alt describes what the photo actually shows.
        photoAlt: curated ? `${r.label}, ${r.city} Oregon` : fallbackHero.alt,
        photoIsCommunity: curated != null,
        activeCount: snap?.activeSfrCount ?? idx?.activeCount ?? null,
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
    <main className="min-h-screen bg-background">
      <PageBreadcrumb trail={[{ label: 'Communities' }]} />

      {/* Structured data: CollectionPage + ItemList of the 14 registry communities */}
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

      {/* Compact navy hero — the live aggregate is the identity (Hub archetype) */}
      <section className="relative overflow-hidden bg-primary" aria-label="Central Oregon communities hero">
        <Container className="relative py-12 md:py-16">
          <div className="mb-5 flex items-center gap-2">
            <span
              className="inline-block h-[7px] w-[7px] rounded-full bg-green-400"
              style={{
                boxShadow: '0 0 0 2px rgba(74,222,128,0.30)',
                animation: 'rr-pulse-dot 2s ease-in-out infinite',
              }}
              aria-hidden
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-white/70">
              Live market
            </span>
          </div>

          <DisplayHeading
            as="h1"
            className="text-white"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)', letterSpacing: '-0.015em', lineHeight: 1.12 }}
          >
            Communities in Central Oregon
          </DisplayHeading>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/65 md:text-[15px]">
            Resort and master-planned communities, neighborhoods, and subdivisions
            across Bend, Redmond, Sisters, Sunriver, and the high desert towns
            between them. Live inventory from the regional MLS.
          </p>

          <div className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-5">
            <div className="flex flex-col gap-0.5">
              <span
                className="font-display tabular-nums leading-none text-white"
                style={{ fontSize: 'clamp(2.75rem, 7vw, 4.5rem)', letterSpacing: '-0.02em' }}
              >
                {totalActive > 0 ? totalActive.toLocaleString() : '—'}
              </span>
              <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.09em] text-white/55">
                Homes for sale across these communities
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className="font-display tabular-nums leading-none text-white"
                style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', letterSpacing: '-0.015em' }}
              >
                {communityCount.toLocaleString()}
              </span>
              <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.09em] text-white/55">
                Communities
              </span>
            </div>
          </div>
        </Container>

        <style>{`
          @keyframes rr-pulse-dot {
            0%, 100% { box-shadow: 0 0 0 2px rgba(74,222,128,0.30); }
            50%       { box-shadow: 0 0 0 5px rgba(74,222,128,0.14); }
          }
        `}</style>
      </section>

      {/* Resort + master-planned communities — full-width editorial ledger rows */}
      <EngagedSection id="resort-communities" pageType="geo-hub" position={1} className="bg-background">
        <Container>
          <div className="pt-10 pb-2 md:pt-14">
            <Eyebrow className="mb-1">The fourteen</Eyebrow>
            <H2 className="text-2xl text-foreground">Resort and master-planned communities</H2>
          </div>

          <div>
            {resorts.map((r, i) => (
              <article
                key={r.slug}
                className="border-b border-border py-8 first:mt-6 first:border-t md:py-10"
              >
                <div className="grid gap-5 md:grid-cols-12 md:items-center md:gap-10">
                  {/* Photo — alternates sides on desktop for editorial rhythm */}
                  <a
                    href={`/communities/${r.slug}`}
                    className={`relative block aspect-[16/10] overflow-hidden rounded-xl md:col-span-5 md:aspect-[4/3] ${
                      i % 2 === 1 ? 'md:order-2' : ''
                    }`}
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
                      <span
                        className="absolute bottom-2 right-2 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white/80"
                        style={{ background: 'rgba(16,39,66,0.55)' }}
                      >
                        Area view · {r.city}
                      </span>
                    )}
                  </a>

                  {/* Editorial content */}
                  <div className={`md:col-span-7 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                    <a href={`/communities/${r.slug}`} className="group inline-block">
                      <DisplayHeading
                        as="h3"
                        className="text-foreground transition-colors group-hover:text-primary"
                        style={{ fontSize: 'clamp(1.75rem, 3.4vw, 2.5rem)', letterSpacing: '-0.015em', lineHeight: 1.1 }}
                      >
                        {r.name}
                      </DisplayHeading>
                    </a>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {r.city} · Oregon
                    </p>

                    {r.sentence ? (
                      <p className="mt-2.5 max-w-prose text-[15px] leading-relaxed text-muted-foreground">
                        {r.sentence}
                      </p>
                    ) : null}

                    {/* Live stat band — tabular numerals, honest em-dash empties */}
                    <div className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-3">
                      <div>
                        <p className="font-display text-xl leading-none tabular-nums text-foreground md:text-2xl">
                          {r.activeCount != null && r.activeCount > 0
                            ? r.activeCount.toLocaleString()
                            : '—'}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          Active
                        </p>
                      </div>
                      <div>
                        <p className="font-display text-xl leading-none tabular-nums text-foreground md:text-2xl">
                          {fmtPrice(r.medianPrice) ?? '—'}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          Median list
                        </p>
                      </div>
                      {r.pendingCount != null && r.pendingCount > 0 ? (
                        <div>
                          <p className="font-display text-xl leading-none tabular-nums text-foreground md:text-2xl">
                            {r.pendingCount.toLocaleString()}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            Pending
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {/* Links into the community */}
                    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
                      <a
                        href={`/communities/${r.slug}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {r.name} guide
                      </a>
                      <a
                        href={`/homes-for-sale/${r.citySlug}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Homes for sale in {r.city}
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </EngagedSection>

      {/* Every community — search + collapsed alphabetical index */}
      <EngagedSection
        id="all-communities"
        pageType="geo-hub"
        position={2}
        className="border-t border-border bg-secondary/30 py-10 md:py-14"
      >
        <Container>
          <div className="mb-4">
            <Eyebrow className="mb-1">The full index</Eyebrow>
            <H2 className="text-2xl text-foreground">Every community, A to Z</H2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              {communityCount.toLocaleString()} neighborhoods and subdivisions across
              Central Oregon. Search by name or city, or browse the index. Each links
              to live listings and market data.
            </p>
          </div>
          <CommunityIndexBrowser items={indexItems} />
        </Container>
      </EngagedSection>

      {/* Search CTA: navy band */}
      <EngagedSection id="communities-cta" pageType="geo-hub" position={3} className="bg-primary py-12 md:py-16">
        <Container>
          <div className="max-w-xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.10em] text-white/50">
              Central Oregon
            </p>
            <DisplayHeading
              as="h2"
              className="mb-4 text-white"
              style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.25rem)', letterSpacing: '-0.01em', lineHeight: 1.2 }}
            >
              Find your place in Central Oregon
            </DisplayHeading>
            <p className="mb-8 max-w-md text-sm leading-relaxed text-white/68">
              Search active listings across every community with live filters for
              price, beds, and location. Or start with what your current home is worth.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/search"
                className="inline-flex items-center rounded-xl bg-background px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-white"
              >
                Search all listings
              </a>
              <a
                href="/sell/valuation"
                className="inline-flex items-center rounded-xl border border-white/28 px-6 py-3 text-sm font-medium text-white/88 transition-colors hover:bg-white/10 hover:text-white"
              >
                What is your home worth
              </a>
            </div>
          </div>
        </Container>
      </EngagedSection>
    </main>
  )
}
