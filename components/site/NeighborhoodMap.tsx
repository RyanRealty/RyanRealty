import dynamic from 'next/dynamic'
import {
  Body,
  Container,
  Eyebrow,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'
import type { NeighborhoodPolygon } from './NeighborhoodMap.client'

/**
 * Site v2 neighborhood map block — section chrome + dynamic-imported
 * Google Maps with PostGIS polygon overlay. Per plan §9 Layer 3.
 *
 * Server-safe wrapper: this file is a server component that lays out
 * the Section + Container + heading region and lazy-loads the actual
 * map implementation from NeighborhoodMap.client.tsx via next/dynamic
 * with `ssr: false`. The @react-google-maps/api + Maps JS bundle only
 * ships on routes that render a map.
 *
 * Data accuracy per CLAUDE.md GIS rule: polygons MUST come from
 * authoritative sources (City of Bend GIS, Deschutes County DIAL,
 * Oregon GEO, Census TIGER) via the `boundaries` table. This block
 * never approximates a polygon or LLM-generates a bounding box.
 *
 * Polygons with an `href` are clickable and route to that path; ones
 * without are informational only (e.g. unselectable parent boundary).
 *
 * Example:
 *   const polygons = await getCommunityPolygons('bend')
 *   <NeighborhoodMap
 *     eyebrow="Communities"
 *     title="Where to live in Bend"
 *     intro="14 master-planned communities and city neighborhoods."
 *     polygons={polygons}
 *     center={{ lat: 44.052, lng: -121.32 }}
 *     zoom={11.4}
 *     height={520}
 *   />
 */

export type { NeighborhoodPolygon } from './NeighborhoodMap.client'

const NeighborhoodMapClient = dynamic(() => import('./NeighborhoodMap.client'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="bg-card rounded-[14px] border border-border h-[480px] animate-pulse"
    />
  ),
})

type Props = {
  polygons: ReadonlyArray<NeighborhoodPolygon>
  eyebrow?: string
  title?: string
  intro?: string
  /** Map center. Defaults to downtown Bend. */
  center?: { lng: number; lat: number }
  /** Initial zoom. Default 11. */
  zoom?: number
  /** Map container height in px. Default 480. */
  height?: number
  /** Section tone — default light bg; pass "muted" for the cream surface. */
  tone?: 'default' | 'muted'
  className?: string
}

export function NeighborhoodMap({
  polygons,
  eyebrow,
  title,
  intro,
  center,
  zoom,
  height,
  tone = 'default',
  className,
}: Props) {
  if (polygons.length === 0) return null

  return (
    <Section padding="default" tone={tone} divider className={className}>
      <Container>
        {(eyebrow || title || intro) ? (
          <Stack gap="tight" className="mb-6 max-w-[60ch]">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            {title ? <H2>{title}</H2> : null}
            {intro ? (
              <Body size="small" tone="muted">
                {intro}
              </Body>
            ) : null}
          </Stack>
        ) : null}
        <NeighborhoodMapClient
          polygons={polygons}
          center={center}
          zoom={zoom}
          height={height}
        />
      </Container>
    </Section>
  )
}
