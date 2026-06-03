/**
 * /schools/[slug] — school detail page.
 *
 * Shows the REAL active single-family homes that feed this school (from our own
 * MLS listings), on a map and as listing cards, plus district context and
 * nearby schools. Academic stats are intentionally absent unless the registry
 * carries a verified value (CLAUDE.md §0 — never invented).
 *
 * Structure mirrors the city content-page template (app/cities/[slug]/page.tsx):
 * BreadcrumbNav, hero heading, stat band, NeighborhoodMap, ListingCard grid,
 * cross-links, CTA. Data ONLY through @/lib/data (Gate G8).
 *
 * The map frames the school's primary-city boundary polygon (shared DAL,
 * getGeoBoundaryMapData) and renders the school's own feeding-home pins inside
 * it. If a school has zero feeding homes, the homes + map sections are omitted.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  getSchoolDetail,
  getGeoBoundaryMapData,
  type SchoolHomeTile,
} from '@/lib/data'
import { CO_SCHOOLS, slugifySchoolName, type SchoolLevel } from '@/data/co-schools'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { NeighborhoodMap } from '@/components/site/NeighborhoodMap'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { CTABar } from '@/components/site/CTABar'
import {
  Body,
  Caption,
  Container,
  Eyebrow,
  Grid,
  H1,
  H2,
  Price,
  Section,
  Stack,
  TabularNumber,
  TextLink,
} from '@/components/site/primitives'
import type { SchemaInput } from '@/lib/site/json-ld'

export const dynamicParams = false
export const revalidate = 300

const LEVEL_LABEL: Record<SchoolLevel, string> = {
  high: 'High school',
  middle: 'Middle school',
  elementary: 'Elementary school',
}

/** schema.org educational subtype per level (all are Place subtypes). */
const SCHOOL_SCHEMA_TYPE: Record<SchoolLevel, 'ElementarySchool' | 'MiddleSchool' | 'HighSchool'> = {
  high: 'HighSchool',
  middle: 'MiddleSchool',
  elementary: 'ElementarySchool',
}

const MAX_CARDS = 12

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_SCHOOLS.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const detail = await getSchoolDetail(slug)
  if (!detail) notFound()

  const { school } = detail
  const levelLabel = LEVEL_LABEL[school.level].toLowerCase()
  const desc = `${school.name} is a ${levelLabel} in ${school.city}, part of ${school.district}. See the homes for sale that feed this school from Ryan Realty, a local Central Oregon brokerage.`

  return pageMetadata({
    title: `${school.name} | Central Oregon Schools`,
    description: desc,
    path: `/schools/${slug}`,
  })
}

function homeToCard(home: SchoolHomeTile): ListingCardData {
  return {
    listingKey: home.listingKey,
    href: home.href,
    photoUrl: home.photoUrl,
    price: home.price,
    addressLine: home.addressLine,
    cityLine: home.cityLine,
    beds: home.beds,
    baths: home.baths,
    sqft: home.sqft,
  }
}

export default async function SchoolDetailPage({ params }: Props) {
  const { slug } = await params

  const detail = await getSchoolDetail(slug)
  if (!detail) notFound()

  const { school, homes, stats, nearby } = detail

  // Frame the map on the school's primary-city boundary polygon (shared DAL),
  // then render the school's own feeding-home pins inside it. The polygon is
  // just the frame; the pins are the verified homes that feed this school.
  const citySlug = slugifySchoolName(school.city)
  const boundary =
    homes.length > 0
      ? await getGeoBoundaryMapData({ geoType: 'city', geoSlug: citySlug }).catch(() => ({
          polygon: null,
          pins: [],
        }))
      : { polygon: null, pins: [] }

  const mapPins = homes
    .filter((h) => typeof h.lat === 'number' && typeof h.lng === 'number')
    .map((h) => ({
      lat: h.lat as number,
      lng: h.lng as number,
      href: h.href,
      price: h.price,
    }))

  const levelLabel = LEVEL_LABEL[school.level]

  // Verified academic stats — render ONLY the fields the registry actually
  // carries (enriched from cited sources; never invented per CLAUDE.md §0).
  const academicStats: Array<{ label: string; value: string }> = []
  if (school.grades) academicStats.push({ label: 'Grades', value: school.grades })
  if (typeof school.enrollment === 'number') {
    academicStats.push({ label: 'Enrollment', value: school.enrollment.toLocaleString() })
  }
  if (typeof school.studentTeacherRatio === 'number') {
    academicStats.push({ label: 'Student-teacher ratio', value: `${school.studentTeacherRatio}:1` })
  }
  if (typeof school.greatSchoolsRating === 'number') {
    academicStats.push({ label: 'GreatSchools rating', value: `${school.greatSchoolsRating}/10` })
  }
  const hasAbout = Boolean(school.blurb) || academicStats.length > 0

  // "See all homes" → search pre-filtered to the school's city + the school
  // name as a keyword (the search route has no dedicated school filter).
  const seeAllHref = `/search?city=${encodeURIComponent(school.city)}&keywords=${encodeURIComponent(
    school.name,
  )}`

  const cards = homes.slice(0, MAX_CARDS)

  // ── Structured data: School + BreadcrumbList. additionalProperty carries
  //    only the verified home-feeding numbers (never academic stats we lack). ──
  const additionalProperty: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Homes for sale that feed this school', value: stats.count },
  ]
  if (stats.medianListPrice != null) {
    additionalProperty.push({
      name: 'Median list price of feeding homes',
      value: stats.medianListPrice,
      unitText: 'USD',
    })
  }

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Schools', url: '/schools' },
        { name: school.name, url: `/schools/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: SCHOOL_SCHEMA_TYPE[school.level],
      name: school.name,
      description: `${school.name}, a ${levelLabel.toLowerCase()} in ${school.city}, ${school.district}.`,
      url: `/schools/${slug}`,
      address: { city: school.city, state: 'OR', country: 'US' },
      containedInPlace: school.district,
      additionalProperty,
    },
  ]

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock schemas={schemas} />

      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          includeJsonLd={false}
          items={[
            { label: 'Home', href: '/' },
            { label: 'Schools', href: '/schools' },
            { label: school.name },
          ]}
        />
      </Container>

      {/* Hero heading */}
      <Section padding="default">
        <Container>
          <Stack gap="default" className="max-w-prose">
            <Eyebrow>
              {levelLabel} · {school.city}
            </Eyebrow>
            <H1>{school.name}</H1>
            <Body tone="muted">
              {school.name} is part of {school.district}. Below are the active single-family homes
              for sale that feed this school, from our own listings.
            </Body>
          </Stack>
        </Container>
      </Section>

      {/* About — verified academic stats (blurb + stat row), rendered only
          where the registry carries cited values. Source-attributed below. */}
      {hasAbout ? (
        <Section padding="default" divider>
          <Container>
            <Stack gap="loose">
              <div>
                <Eyebrow>About this school</Eyebrow>
                <H2 className="mt-1.5">About {school.name}</H2>
                {school.blurb ? (
                  <Body tone="muted" className="mt-2 max-w-prose">
                    {school.blurb}
                  </Body>
                ) : null}
              </div>

              {academicStats.length > 0 ? (
                <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
                  {academicStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-border bg-card p-5 shadow-sm"
                    >
                      <Eyebrow className="text-muted-foreground">{stat.label}</Eyebrow>
                      <div className="mt-1.5 text-2xl font-bold tracking-[-0.01em] tabular-nums text-foreground">
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <Caption tone="muted">
                School data: GreatSchools, NCES
                {school.sourceUrl ? (
                  <>
                    {' · '}
                    <TextLink href={school.sourceUrl} external>
                      View source
                    </TextLink>
                  </>
                ) : null}
              </Caption>
            </Stack>
          </Container>
        </Section>
      ) : null}

      {/* Stat band — verified home-feeding numbers only */}
      <Section padding="tight" tone="muted" divider>
        <Container>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <Eyebrow className="text-muted-foreground">Homes for sale</Eyebrow>
              <div className="mt-1.5 text-3xl font-bold tracking-[-0.01em] text-foreground">
                <TabularNumber value={stats.count} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Active single-family homes that feed this school
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <Eyebrow className="text-muted-foreground">Median list price</Eyebrow>
              <div className="mt-1.5 text-3xl font-bold tracking-[-0.01em] text-foreground">
                <Price value={stats.medianListPrice} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Across those homes, rounded to the nearest thousand
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Map — city polygon frame + the school's feeding-home pins */}
      {boundary.polygon && mapPins.length > 0 ? (
        <NeighborhoodMap
          eyebrow={school.city}
          title={`Where ${school.name} homes are`}
          intro={`Active single-family homes for sale that feed ${school.name}, on the map.`}
          polygons={[
            {
              slug: citySlug,
              name: school.city,
              geometry: boundary.polygon,
            },
          ]}
          listings={mapPins}
          zoom={12}
          height={520}
          tone="default"
        />
      ) : null}

      {/* Home cards */}
      {cards.length > 0 ? (
        <Section padding="default" tone="muted" divider>
          <Container>
            <Stack gap="loose">
              <div>
                <Eyebrow>Homes for sale</Eyebrow>
                <H2 className="mt-1.5">Homes that feed {school.name}</H2>
              </div>
              <Grid cols={3} gap="loose" className="w-full">
                {cards.map((home) => (
                  <ListingCard key={home.listingKey} listing={homeToCard(home)} />
                ))}
              </Grid>
              {stats.count > cards.length ? (
                <TextLink href={seeAllHref}>
                  See all {stats.count.toLocaleString()} homes in {school.city} →
                </TextLink>
              ) : null}
            </Stack>
          </Container>
        </Section>
      ) : (
        <Section padding="default" divider>
          <Container>
            <Stack gap="default" className="max-w-prose">
              <H2>No active homes feed this school right now</H2>
              <Body tone="muted">
                There are no active single-family listings tied to {school.name} at the moment.
                Inventory changes often. Browse current homes in {school.city} to see what is on the
                market today.
              </Body>
              <TextLink href={`/search?city=${encodeURIComponent(school.city)}`}>
                Browse homes in {school.city} →
              </TextLink>
            </Stack>
          </Container>
        </Section>
      )}

      {/* District context + nearby schools */}
      <Section padding="default" divider>
        <Container>
          <Stack gap="loose">
            <div>
              <Eyebrow>School district</Eyebrow>
              <H2 className="mt-1.5">{school.district}</H2>
              <Body tone="muted" className="mt-2">
                {school.name} is one of the {school.district} schools. Explore the others at this
                level below.
              </Body>
            </div>

            {nearby.length > 0 ? (
              <Stack gap="default" className="w-full">
                <Eyebrow>Nearby schools</Eyebrow>
                <ul className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {nearby.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={`/schools/${s.slug}`}
                        className="block rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                      >
                        <div className="text-base font-bold tracking-[-0.01em] text-foreground">
                          {s.name}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{s.city}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Stack>
            ) : null}

            <TextLink href="/schools">All Central Oregon schools →</TextLink>
          </Stack>
        </Container>
      </Section>

      <CTABar
        eyebrow={`Buying near ${school.name}`}
        title="Local brokers. Specific numbers. No pressure."
        body={`We work across ${school.city} and the rest of Central Oregon. Tell us what matters for your family and we will show you the homes that fit, near the schools you want.`}
        primary={{ href: '/contact', label: 'Meet the team' }}
        secondary={{ href: 'tel:5412136706', label: 'Call 541.213.6706' }}
        tone="navy"
      />
    </main>
  )
}
