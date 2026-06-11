/**
 * /schools — Central Oregon schools index.
 *
 * Lists every verified school in the registry (data/co-schools.ts) grouped by
 * district, then by level, each linking to its /schools/[slug] detail page.
 *
 * Data ONLY through @/lib/data (Gate G8). Design-system primitives match the
 * city content-page template (app/cities/[slug]/page.tsx).
 *
 * Academic stats are intentionally absent here — the registry leaves them
 * nullable and they get enriched later from a verified source (CLAUDE.md §0).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getSchools, getSchoolsCount } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import {
  BadgePill,
  Body,
  Container,
  Eyebrow,
  H1,
  H2,
  H3,
  Section,
  Stack,
} from '@/components/site/primitives'
import type { SchoolLevel } from '@/data/co-schools'

export const revalidate = 3600

const LEVEL_LABEL: Record<SchoolLevel, string> = {
  high: 'High schools',
  middle: 'Middle schools',
  elementary: 'Elementary schools',
}

const LEVEL_ORDER: SchoolLevel[] = ['high', 'middle', 'elementary']

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Central Oregon Schools',
    description:
      'Browse Central Oregon schools by district. See the homes for sale that feed each elementary, middle, and high school across Bend, Redmond, Sisters, and beyond.',
    path: '/schools',
  })
}

export default function SchoolsIndexPage() {
  const districts = getSchools()
  const total = getSchoolsCount()

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Schools', url: '/schools' },
            ],
          },
          {
            type: 'webPage',
            name: 'Central Oregon Schools',
            description:
              'Central Oregon schools by district, with the homes for sale that feed each one.',
            url: '/schools',
          },
        ]}
      />

      <PageBreadcrumb trail={[{ label: 'Schools' }]} includeJsonLd={false} />

      <Section padding="default">
        <Container>
          <Stack gap="default" className="max-w-prose">
            <Eyebrow>Central Oregon</Eyebrow>
            <H1>Central Oregon schools</H1>
            <Body tone="muted">
              {total} schools across {districts.length} districts, from Bend to Madras. Pick a
              school to see the active homes for sale that feed it, on a map and as listings, with
              district context.
            </Body>
          </Stack>
        </Container>
      </Section>

      {districts.map((district, i) => (
        <Section
          key={district.districtSlug}
          padding="default"
          tone={i % 2 === 1 ? 'muted' : 'default'}
          divider
        >
          <Container>
            <Stack gap="loose">
              <div>
                <Eyebrow>School district</Eyebrow>
                <H2 className="mt-1.5">{district.district}</H2>
              </div>

              {LEVEL_ORDER.map((level) => {
                const schools = district.byLevel[level]
                if (schools.length === 0) return null
                return (
                  <Stack key={level} gap="default" className="w-full">
                    <H3>{LEVEL_LABEL[level]}</H3>
                    <ul className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {schools.map((school) => (
                        <li key={school.slug}>
                          <Link
                            href={`/schools/${school.slug}`}
                            className="block rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                          >
                            <div className="text-base font-bold tracking-[-0.01em] text-foreground">
                              {school.name}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{school.city}</span>
                              {school.grades ? (
                                <span className="tabular-nums">· {school.grades}</span>
                              ) : null}
                              {typeof school.greatSchoolsRating === 'number' ? (
                                <BadgePill tone="navy" className="tabular-nums">
                                  {school.greatSchoolsRating}/10
                                </BadgePill>
                              ) : null}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Stack>
                )
              })}
            </Stack>
          </Container>
        </Section>
      ))}
    </main>
  )
}
