import Link from 'next/link'
import { getCitiesForIndex } from '@/app/actions/cities'
import {
  Body,
  Container,
  Eyebrow,
  Grid,
  H2,
  MiddleDot,
  Price,
  Section,
  Stack,
  TabularNumber,
} from '@/components/site/primitives'

/**
 * Site v2 city grid — 8 city cards with median + active count + community
 * count. Mirrors design_system/ryan-realty/ui_kits/website/index.html §cities.
 *
 * Data accuracy: every figure traces to geo_snapshot_mv via getCitiesForIndex().
 * Unavailable values render as em-dash via the Price primitive's fallback.
 *
 * Lifted onto Wave 2 Layer 1 primitives 2026-05-27. fmtMoneyRound1k() retired
 * in favor of <Price>; raw count formatting moved to <TabularNumber>; the
 * stats-line separator moved to <MiddleDot>.
 */

// 8 mockup-aligned cities. Order matches market relevance for Central Oregon.
const CITY_ORDER = [
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'la-pine',
  'tumalo',
  'prineville',
  'terrebonne',
] as const

function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

type CityCardData = {
  slug: string
  name: string
  medianPrice: number | null
  activeCount: number
  communityCount: number
}

function CityCard({ city }: { city: CityCardData }) {
  return (
    <Link
      href={`/cities/${city.slug}`}
      className="group bg-card border border-border rounded-[14px] p-[18px] flex flex-col gap-1.5 shadow-sm hover:border-primary/30 hover:shadow-md transition"
    >
      <div className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.01em] text-foreground">
        <span className="text-primary">
          <PinIcon />
        </span>
        {city.name}
      </div>
      <div className="text-[15px] font-semibold text-foreground mt-0.5">
        <Price value={city.medianPrice} />
      </div>
      <div className="text-xs text-muted-foreground">
        {city.activeCount > 0 ? (
          <>
            <TabularNumber value={city.activeCount} /> active
          </>
        ) : (
          'No active listings'
        )}
        {city.communityCount > 0 ? (
          <>
            {' '}
            <MiddleDot className="text-muted-foreground/60" />{' '}
            <TabularNumber value={city.communityCount} /> communities
          </>
        ) : null}
      </div>
    </Link>
  )
}

export default async function CityGrid() {
  const cities = await getCitiesForIndex().catch(() => [])
  const bySlug = new Map(cities.map((c) => [c.slug, c]))
  const ordered = CITY_ORDER.map((slug) => bySlug.get(slug)).filter(
    (c): c is NonNullable<typeof c> => c != null,
  )

  // If geo_snapshot_mv is empty for some reason, fall back to whatever we got.
  const shown = ordered.length > 0 ? ordered : cities.slice(0, 8)

  if (shown.length === 0) {
    return null
  }

  return (
    <Section padding="default" tone="muted" divider>
      <Container>
        <Stack gap="tight" className="mb-6">
          <Eyebrow>Communities</Eyebrow>
          <H2>Search by city</H2>
          <Body size="small" tone="muted">
            Eleven Central Oregon communities. Median prices refreshed daily.
          </Body>
        </Stack>

        <Grid cols={4} gap="default">
          {shown.map((c) => (
            <CityCard key={c.slug} city={c} />
          ))}
        </Grid>
      </Container>
    </Section>
  )
}
