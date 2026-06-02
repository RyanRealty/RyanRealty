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
 * ZIP-level market snapshot — four stat cards per the /zip mockup
 * (design_system/ryan-realty/ui_kits/zip/index.html §market-stats).
 *
 * Data accuracy (CLAUDE.md §0): ZIP codes have NO market_pulse_live /
 * market_stats_cache rows (those are keyed by city + region only), so every
 * figure here is derived live, at request time, from the listing_tile_mv
 * tiles the page already fetched via getZipListings(zip, {propertyType:'A'}).
 * That MV is the same verified primary source every other surface uses.
 * Any value that cannot be derived renders as an em-dash, never a guess.
 */

export type ZipMarketStatsData = {
  zip: string
  activeCount: number
  medianListPrice: number | null
  medianPricePerSqft: number | null
  newLast30Days: number | null
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="bg-card border border-border rounded-[14px] p-6 shadow-sm">
      <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  )
}

export function ZipMarketStats({ stats }: { stats: ZipMarketStatsData }) {
  // No active inventory means no honest snapshot — render nothing.
  if (stats.activeCount === 0) return null

  return (
    <Section padding="default" tone="muted" divider>
      <Container>
        <Stack gap="tight" className="mb-6 max-w-prose">
          <Eyebrow>ZIP-level snapshot</Eyebrow>
          <H2>{stats.zip} market right now</H2>
          <Body size="small" tone="muted">
            Aggregated live from active single-family listings in this ZIP. ZIP codes carry no
            cached market row, so these figures come straight from the current MLS tiles.
          </Body>
        </Stack>
        <Grid cols={4} gap="default">
          <StatCard
            label="Active single-family"
            value={<TabularNumber value={stats.activeCount} />}
            sub="Condos and manufactured excluded"
          />
          <StatCard
            label="Median list price"
            value={<Price value={stats.medianListPrice} />}
            sub="Single-family only"
          />
          <StatCard
            label="Median price per sqft"
            value={
              stats.medianPricePerSqft != null
                ? `$${Math.round(stats.medianPricePerSqft).toLocaleString()}`
                : '—'
            }
            sub="Median of per-listing list price per sqft"
          />
          <StatCard
            label="New past 30 days"
            value={<TabularNumber value={stats.newLast30Days ?? 0} />}
            sub="Listed in the last 30 days"
          />
        </Grid>
      </Container>
    </Section>
  )
}
