/**
 * /parks — Central Oregon parks index.
 *
 * Lists every park in the registry (data/co-parks.ts) grouped by city, each
 * linking to its /parks/[slug] detail page. The data is verified + cited
 * (state-park polygons + facts from Oregon State Parks, city parks from BPRD /
 * city sites + OpenStreetMap) — nothing is invented (CLAUDE.md §0).
 *
 * Data ONLY through @/lib/data (Gate G8). Design-system primitives match the
 * /schools index + the city content-page template (app/cities/[slug]/page.tsx).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getParks, getParksCount } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import {
  BadgePill,
  Container,
  Eyebrow,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'
import type { ParkType } from '@/data/co-parks'

export const revalidate = 3600

const TYPE_LABEL: Record<ParkType, string> = {
  state: 'State park',
  city: 'City park',
  'natural-area': 'Natural area',
}

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Central Oregon Parks',
    description:
      'Browse the notable parks across Central Oregon, from Smith Rock and Tumalo to Drake Park and Shevlin. See the homes for sale near each park on a map, with trails, river access, and amenities.',
    path: '/parks',
  })
}

export default function ParksIndexPage() {
  const cities = getParks()
  const total = getParksCount()

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Parks', url: '/parks' },
            ],
          },
          {
            type: 'webPage',
            name: 'Central Oregon Parks',
            description:
              'Central Oregon parks by city, with the homes for sale near each one.',
            url: '/parks',
          },
        ]}
      />

      <PageBreadcrumb trail={[{ label: 'Parks' }]} includeJsonLd={false} />

      <ContentPageHero
        title="Central Oregon parks"
        subtitle={`${total} notable parks from Bend to Prineville, including the state parks at Smith Rock, Tumalo, and Lake Billy Chinook. Pick a park to see its boundary on a map, the active homes nearby, and what is there.`}
        imageUrl={CONTENT_HERO_IMAGES.parks}
        ctas={[
          { label: 'Search homes', href: '/search', primary: true },
          { label: 'Explore cities', href: '/cities', primary: false },
        ]}
      />

      {cities.map((group, i) => (
        <Section
          key={group.city}
          padding="default"
          tone={i % 2 === 1 ? 'muted' : 'default'}
          divider
        >
          <Container>
            <Stack gap="loose">
              <div>
                <Eyebrow>Parks in</Eyebrow>
                <H2 className="mt-1.5">{group.city}</H2>
              </div>

              <ul className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.parks.map((park) => (
                  <li key={park.slug}>
                    <Link
                      href={`/parks/${park.slug}`}
                      className="block rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="text-base font-bold tracking-[-0.01em] text-foreground">
                        {park.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <BadgePill tone="navy">{TYPE_LABEL[park.type]}</BadgePill>
                        {typeof park.acres === 'number' ? (
                          <span className="tabular-nums">
                            {park.acres.toLocaleString()} acres
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Stack>
          </Container>
        </Section>
      ))}
    </main>
  )
}
