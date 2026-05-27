import dynamic from 'next/dynamic'
import {
  Body,
  Container,
  Eyebrow,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'
import type { PriceHistoryPoint } from '@/lib/data/types/market'

/**
 * Site v2 price chart block — section chrome + dynamic-imported
 * recharts AreaChart for median sale price over time. Per plan §9
 * Layer 3.
 *
 * Server-safe wrapper: this file is a server component that lays out
 * the Section + Container + heading region and lazy-loads the actual
 * recharts implementation from PriceChart.client.tsx via next/dynamic
 * with `ssr: false`. The recharts bundle (~90 kB) only ships on routes
 * that render a chart, never on the homepage or other chart-less
 * routes.
 *
 * Data accuracy: callers pass `data: PriceHistoryPoint[]` from
 * `getPriceHistory()` (lib/data/market/getPriceHistory) — the cache-
 * backed DAL function. Per CLAUDE.md §0, this block never aggregates
 * raw `listings`; the chart only renders pre-aggregated, verified
 * `market_stats_cache` rows.
 *
 * Example:
 *   const points = await getPriceHistory({
 *     geoType: 'city', geoSlug: 'bend', periodType: 'monthly', limit: 24,
 *   })
 *   <PriceChart
 *     eyebrow="Trend"
 *     title="Bend median sale price"
 *     intro="Last 24 months. Source: Oregon Data Share."
 *     data={points}
 *   />
 */

const PriceChartClient = dynamic(() => import('./PriceChart.client'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="bg-card rounded-[14px] border border-border p-4 shadow-sm h-[300px] animate-pulse"
    />
  ),
})

type Props = {
  data: ReadonlyArray<PriceHistoryPoint>
  eyebrow?: string
  title?: string
  intro?: string
  /** Chart height in px. Default 280. */
  height?: number
  /** Section tone — default light bg; pass "muted" for the cream surface. */
  tone?: 'default' | 'muted'
  className?: string
}

export function PriceChart({
  data,
  eyebrow,
  title,
  intro,
  height = 280,
  tone = 'default',
  className,
}: Props) {
  if (data.length === 0) return null

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
        <PriceChartClient data={data} height={height} />
      </Container>
    </Section>
  )
}
