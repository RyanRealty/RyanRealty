// brand-voice:exempt
/**
 * Cities index page — Experience System Hub/Geo archetype.
 *
 * Hub variant: compact hero with regional live stats + editorial city ledger.
 * No tile wall — each city is a full-width ledger row with hairline rule,
 * live active count, median price, and an honest "homes for sale" link.
 *
 * Data ONLY through @/lib/data and @/app/actions/cities. No raw .from() calls.
 */

import type { Metadata } from 'next'
import { getCitiesForIndex } from '@/app/actions/cities'
import { sortCitiesWithPrimaryFirst } from '@/lib/cities'
import { getAllCitySnapshots } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { Container, DisplayHeading, H2, Eyebrow } from '@/components/site/primitives'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
import { cityHero } from '@/lib/geo-images'
import Image from 'next/image'

// Use revalidate instead of force-dynamic so the page can be
// statically cached and revalidated every 30 minutes. The old
// `export const dynamic = 'force-dynamic'` caused a full SSR
// on every request — unnecessary for an index that rarely changes.
export const revalidate = 1800

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = pageMetadata({
  title: 'Central Oregon Cities: Bend, Redmond, Sisters, Sunriver',
  description:
    'Explore homes for sale in Central Oregon cities. Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and more. Live market data from a local brokerage.',
  path: '/cities',
})

// Canonical city slugs in priority display order
const PRIMARY_CITY_SLUGS = [
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'la-pine',
  'tumalo',
  'prineville',
  'madras',
  'terrebonne',
  'powell-butte',
]

export default async function CitiesPage() {
  const [allCities, allSnapshots] = await Promise.all([
    getCitiesForIndex(),
    getAllCitySnapshots(),
  ])

  const sortedCities = sortCitiesWithPrimaryFirst(allCities)
  const visibleCities = sortedCities.slice(0, 60)

  // Build a quick lookup: citySlug -> activeCount / medianPrice from snapshots
  const snapshotBySlug = new Map<string, { activeCount: number; medianPrice: number | null }>()
  for (const s of allSnapshots) {
    const citySlug = s.geoKey.replace(/\s+/g, '-')
    snapshotBySlug.set(citySlug, {
      activeCount: s.activeSfrCount,
      medianPrice: s.medianListPrice != null ? Math.round(s.medianListPrice) : null,
    })
  }

  // Total active across all known cities (regional summary stat)
  const totalActive = allSnapshots.reduce((sum, s) => sum + s.activeSfrCount, 0)

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities' },
      ],
    },
  ]

  // Group visible cities: primary first, then others
  const primary = visibleCities.filter((c) => PRIMARY_CITY_SLUGS.includes(c.slug))
  const others = visibleCities.filter((c) => !PRIMARY_CITY_SLUGS.includes(c.slug))

  return (
    <main className="min-h-screen bg-background">

      {/* Structured data */}
      <MetadataBlock schemas={schemas} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Central Oregon Cities',
            description: 'Explore homes for sale in Central Oregon cities.',
            url: `${siteUrl}/cities`,
            publisher: { '@type': 'Organization', name: 'Ryan Realty' },
          }),
        }}
      />

      {/* Breadcrumb */}
      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          includeJsonLd={false}
          items={[{ label: 'Home', href: '/' }, { label: 'Cities' }]}
        />
      </Container>

      {/* Compact hero: data as identity, no full-bleed video */}
      <section
        className="relative overflow-hidden bg-primary min-h-[280px] md:min-h-[340px] flex items-end"
        aria-label="Central Oregon cities hero"
      >
        {/* Background: canonical hero photo at low opacity */}
        <div className="absolute inset-0">
          <Image
            src={cityHero('bend').src}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-30"
            aria-hidden
          />
        </div>
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background:
              'linear-gradient(to top, rgba(16,39,66,0.92) 0%, rgba(16,39,66,0.55) 50%, rgba(16,39,66,0.28) 100%)',
          }}
        />

        <Container className="relative pb-10 md:pb-14 pt-20">
          {/* Live indicator */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-block w-[7px] h-[7px] rounded-full bg-green-400"
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

          {/* Regional stat as Amboqia display number */}
          <div className="flex items-end gap-6 mb-5 flex-wrap">
            {totalActive > 0 ? (
              <div className="flex flex-col gap-0.5">
                <DisplayHeading
                  as="div"
                  className="tabular-nums text-white leading-none"
                  style={{
                    fontSize: 'clamp(3rem, 6vw, 5rem)',
                    letterSpacing: '-0.025em',
                    textShadow: '0 2px 16px rgba(0,0,0,0.22)',
                  }}
                >
                  {totalActive.toLocaleString()}
                </DisplayHeading>
                <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-white/55 mt-1">
                  Active homes across Central Oregon
                </span>
              </div>
            ) : null}
          </div>

          {/* H1 */}
          <DisplayHeading
            as="h1"
            className="text-white max-w-[560px]"
            style={{
              fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              textShadow: '0 1px 10px rgba(0,0,0,0.18)',
            }}
          >
            Homes for sale in Central Oregon
          </DisplayHeading>
          <p className="mt-3 text-white/65 text-sm max-w-md leading-relaxed">
            Bend, Redmond, Sisters, Sunriver, and surrounding areas. Live data from a local brokerage.
          </p>
        </Container>

        <style>{`
          @keyframes rr-pulse-dot {
            0%, 100% { box-shadow: 0 0 0 2px rgba(74,222,128,0.30); }
            50%       { box-shadow: 0 0 0 5px rgba(74,222,128,0.14); }
          }
        `}</style>
      </section>

      {/* Primary cities: editorial ledger rows */}
      <section className="bg-background py-10 md:py-14">
        <Container>
          <div className="mb-8">
            <Eyebrow className="mb-1">Central Oregon</Eyebrow>
            <H2 className="text-2xl text-foreground">Primary cities</H2>
          </div>

          <div className="divide-y divide-border">
            {primary.map((city) => {
              const snap = snapshotBySlug.get(city.slug)
              const active = snap?.activeCount ?? city.activeCount
              const median = snap?.medianPrice ?? city.medianPrice

              return (
                <a
                  key={city.slug}
                  href={`/cities/${city.slug}`}
                  className="group flex items-center gap-4 py-4 md:py-5 -mx-4 px-4 sm:-mx-6 sm:px-6 hover:bg-secondary/50 transition-colors"
                >
                  {/* City name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                      {city.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Oregon</p>
                  </div>

                  {/* Stats: tabular numerals */}
                  <div className="flex items-center gap-6 flex-shrink-0">
                    {active > 0 ? (
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {active.toLocaleString()}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                          Active
                        </p>
                      </div>
                    ) : null}
                    {median != null ? (
                      <div className="text-right">
                        <DisplayHeading
                          as="p"
                          className="tabular-nums text-foreground leading-none"
                          style={{ fontSize: 'clamp(1.05rem, 1.8vw, 1.3rem)', letterSpacing: '-0.01em' }}
                        >
                          ${Math.round(median / 1000).toLocaleString()}K
                        </DisplayHeading>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                          Median list
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <span
                    aria-hidden
                    className="hidden sm:block text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0"
                  >
                    &rarr;
                  </span>
                </a>
              )
            })}
          </div>
        </Container>
      </section>

      {/* Other cities: compact ledger */}
      {others.length > 0 ? (
        <section className="border-t border-border bg-secondary/30 py-10 md:py-14">
          <Container>
            <div className="mb-6">
              <Eyebrow className="mb-1">More areas</Eyebrow>
              <H2 className="text-2xl text-foreground">Other Central Oregon cities</H2>
            </div>

            <div className="divide-y divide-border max-w-2xl">
              {others.map((city) => {
                const snap = snapshotBySlug.get(city.slug)
                const active = snap?.activeCount ?? city.activeCount
                const median = snap?.medianPrice ?? city.medianPrice

                return (
                  <a
                    key={city.slug}
                    href={`/cities/${city.slug}`}
                    className="group flex items-center justify-between gap-4 py-3 hover:text-primary transition-colors"
                  >
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                      {city.name}
                    </span>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {active > 0 ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {active} {active === 1 ? 'home' : 'homes'}
                        </span>
                      ) : null}
                      {median != null ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          ${Math.round(median / 1000).toLocaleString()}K
                        </span>
                      ) : null}
                      <span
                        aria-hidden
                        className="text-muted-foreground/40 group-hover:text-primary transition-colors"
                      >
                        &rarr;
                      </span>
                    </div>
                  </a>
                )
              })}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Search CTA: navy band */}
      <section className="bg-primary py-12 md:py-16">
        <Container>
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/50 mb-3">
              Central Oregon
            </p>
            <DisplayHeading
              as="h2"
              className="text-white mb-4"
              style={{
                fontSize: 'clamp(1.5rem, 2.5vw, 2.25rem)',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
              }}
            >
              Find your home in Central Oregon
            </DisplayHeading>
            <p className="text-white/68 text-sm leading-relaxed mb-8 max-w-md">
              Search active listings across all cities with live filters for price, beds, and location.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/search"
                className="inline-flex items-center px-6 py-3 rounded-xl bg-background text-primary font-semibold text-sm hover:bg-white transition-colors"
              >
                Search all listings
              </a>
              <a
                href="/lp/buyer-listing-alerts"
                className="inline-flex items-center px-6 py-3 rounded-xl border border-white/28 text-white/88 font-medium text-sm hover:bg-white/10 hover:text-white transition-colors"
              >
                Get listing alerts
              </a>
            </div>
          </div>
        </Container>
      </section>

    </main>
  )
}
