import Image from 'next/image'
import Link from 'next/link'
import { getGeoSnapshot } from '@/lib/data'
import { communityImage } from '@/lib/geo-images'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import {
  Body,
  Container,
  Eyebrow,
  Grid,
  H2,
  Price,
  Section,
  Stack,
  TabularNumber,
} from '@/components/site/primitives'

/**
 * Site v2 resort + master-planned communities grid — the homepage section the
 * design mockup (design_system/ryan-realty/ui_kits/website/index.html §resort)
 * specifies but that was never built live. Eight marquee resort communities as
 * photo cards: name + city overlay, golf/master-planned badge, live median +
 * active count, "Explore →" into the community detail page.
 *
 * DATA ACCURACY (CLAUDE.md §0): the mockup hardcodes median/active — we do NOT.
 * Every figure comes from geo_snapshot_mv via getGeoSnapshot() — one indexed,
 * sub-2ms, cached point-lookup per community (8 in parallel). We deliberately do
 * NOT call getCommunityBySlug (falls back to a 589K-row raw aggregation on a key
 * miss and was timing out ~40s — see W5) nor getAllCommunitySnapshots (a
 * 5000-row scan that timed out under build load). The exact (geoType, geoKey)
 * per community was VERIFIED against geo_snapshot_mv on 2026-06-01 — they encode
 * the real MLS city-tagging (Eagle Crest→Redmond, Caldera Springs→Bend) and the
 * fact that Sunriver / Black Butte Ranch are their own MLS cities. Unavailable
 * figures render as an em-dash; the active line degrades to a neutral CTA. If a
 * key ever goes stale the card simply shows the em-dash — never a wrong number.
 *
 * Slug/name/city for the link + label: data/resort-communities.json registry.
 * Imagery: communityImage() (Area-Guide dedicated photos + golf-community set).
 */

// Eight marquee resort/master-planned communities with real active inventory,
// in homepage display order. geoType+geoKey are verified geo_snapshot_mv keys.
const HOMEPAGE: ReadonlyArray<{
  slug: string
  name: string
  city: string
  golf: boolean
  geoType: 'city' | 'community'
  geoKey: string
}> = [
  { slug: 'sunriver', name: 'Sunriver', city: 'Sunriver', golf: true, geoType: 'city', geoKey: 'sunriver' },
  { slug: 'eagle-crest', name: 'Eagle Crest', city: 'Redmond', golf: true, geoType: 'community', geoKey: 'redmond:eagle crest' },
  { slug: 'caldera-springs', name: 'Caldera Springs', city: 'Sunriver', golf: true, geoType: 'community', geoKey: 'bend:caldera springs' },
  { slug: 'black-butte-ranch', name: 'Black Butte Ranch', city: 'Sisters', golf: true, geoType: 'city', geoKey: 'black butte ranch' },
  { slug: 'tetherow', name: 'Tetherow', city: 'Bend', golf: true, geoType: 'community', geoKey: 'bend:tetherow' },
  { slug: 'northwest-crossing', name: 'NorthWest Crossing', city: 'Bend', golf: false, geoType: 'community', geoKey: 'bend:northwest crossing' },
  { slug: 'broken-top', name: 'Broken Top', city: 'Bend', golf: true, geoType: 'community', geoKey: 'bend:broken top' },
  { slug: 'awbrey-glen', name: 'Awbrey Glen', city: 'Bend', golf: true, geoType: 'community', geoKey: 'bend:awbrey glen' },
]

type Stat = { activeCount: number; medianPrice: number | null }

function ResortCard({
  community,
  stat,
  imageUrl,
}: {
  community: (typeof HOMEPAGE)[number]
  stat: Stat | null
  imageUrl: string | null
}) {
  return (
    <Link
      href={`/communities/${community.slug}`}
      className="group block bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:border-primary/30 hover:shadow-md transition"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-primary">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`${community.name}, ${community.city}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/25 to-transparent" aria-hidden />
        <span className="absolute top-3 left-3 rounded-full bg-primary/80 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
          {community.golf ? 'Golf' : 'Master-planned'}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/85">{community.city}</div>
          <div className="text-lg font-bold tracking-tight text-white drop-shadow">{community.name}</div>
        </div>
      </div>
      <div className="p-4">
        <div className="text-sm font-semibold text-foreground">
          <Price value={stat?.medianPrice ?? null} /> median
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {stat && stat.activeCount > 0 ? (
            <>
              <TabularNumber value={stat.activeCount} /> active
            </>
          ) : (
            'See current inventory'
          )}
        </div>
        <div className="mt-2.5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Explore {community.name}
          <span aria-hidden>→</span>
        </div>
      </div>
    </Link>
  )
}

export default async function ResortCommunities() {
  const stats = await Promise.all(
    HOMEPAGE.map((c) =>
      withTimeoutFallback(
        getGeoSnapshot({ geoType: c.geoType, geoKey: c.geoKey }),
        null,
        2500,
        `resort:${c.slug}`,
      ).then((snap): Stat | null =>
        snap ? { activeCount: snap.activeSfrCount, medianPrice: snap.medianListPrice } : null,
      ),
    ),
  )

  return (
    <Section padding="default" tone="default" divider>
      <Container>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <Stack gap="tight">
            <Eyebrow>Resort + master-planned communities</Eyebrow>
            <H2>The neighborhoods Central Oregon is known for.</H2>
            <Body size="small" tone="muted">
              Resort and master-planned communities across Bend, Sunriver, Sisters, Redmond, and
              Powell Butte. Golf, gated, course-front, river-front. Every one has its own market.
            </Body>
          </Stack>
          <Link
            href="/area-guides"
            className="shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            View all communities →
          </Link>
        </div>

        <Grid cols={4} gap="default">
          {HOMEPAGE.map((community, i) => (
            <ResortCard
              key={community.slug}
              community={community}
              stat={stats[i] ?? null}
              imageUrl={communityImage(community.slug)}
            />
          ))}
        </Grid>
      </Container>
    </Section>
  )
}
