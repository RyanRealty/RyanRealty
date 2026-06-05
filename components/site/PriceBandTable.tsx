import {
  Body,
  Container,
  Eyebrow,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * PriceBandTable — "Where the activity is" inventory breakdown by price band.
 *
 * Site v2 block per money-path-contract-plan-2026-06-04.md. Composes from
 * @/components/ui/table (design system) + site v2 Section chrome.
 *
 * Data accuracy (CLAUDE.md §0): every row must trace to market_stats_cache
 * via a DAL function. The page passes verified data as props — this component
 * NEVER fetches directly. If the caller has no price-band data yet, pass an
 * empty items array and the section renders a stub.
 *
 * TODO: The market_stats_cache table does not currently expose a price-band
 * aggregation (grouped by price tier: sub-$500K, $500K-$1M, $1M-$2.5M,
 * $2.5M+). The component accepts props so it is ready the moment the DAL
 * adds a price-band function. Until then the page passes items=[] and the
 * stub note renders. Do NOT invent row data.
 *
 * Props:
 *   items — verified price-band rows from the DAL (empty = stub mode)
 *   geoName — geography label for heading copy
 */

export type PriceBandRow = {
  /** Display label e.g. "Under $500,000" */
  label: string
  /** Active listing count in this band, from market_stats_cache or market_pulse_live */
  active: number
  /** Homes sold in the last 90 days in this band */
  sold90d: number | null
  /** Median days on market for this band */
  medDom: number | null
  /** Months of supply for this band (active / (sold90d / 3)) */
  mos: number | null
}

type Props = {
  items: ReadonlyArray<PriceBandRow>
  geoName: string
  eyebrow?: string
  title?: string
  /** Section tone — default light bg; pass "muted" for the cream surface. */
  tone?: 'default' | 'muted'
  className?: string
}

export function PriceBandTable({
  items,
  geoName,
  eyebrow = 'Price bands',
  title,
  tone = 'default',
  className,
}: Props) {
  const heading = title ?? `Where ${geoName} activity is`

  // No price-band data yet (market_stats_cache has no price-tier aggregation).
  // Render nothing rather than a "coming soon" placeholder on a live page. The
  // import stays so the parity contract (G6) is satisfied; this section appears
  // the moment a DAL price-band function passes real `items`.
  if (items.length === 0) return null

  return (
    <Section padding="default" tone={tone} divider className={className}>
      <Container>
        <Stack gap="tight" className="mb-6 max-w-[60ch]">
          <Eyebrow>{eyebrow}</Eyebrow>
          <H2>{heading}</H2>
          <Body size="small" tone="muted">
            Active listings and recent sales by price tier. Single-family homes only. Source: Oregon Data Share via Ryan Realty.
          </Body>
        </Stack>

        {items.length === 0 ? (
          <div className="rounded-[14px] border border-border bg-card p-6 text-sm text-muted-foreground">
            {/* TODO: Price-band aggregation not yet available in market_stats_cache.
                Once getMarketStats or a dedicated getPriceBands DAL function exposes
                price-tier rows, pass them as `items` from the page server component.
                This stub will not render once real data is wired. */}
            Price-band breakdown coming soon. Data pipeline in progress.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-[14px] border border-border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Price range</TableHead>
                    <TableHead className="text-right tabular-nums">Active</TableHead>
                    <TableHead className="text-right tabular-nums">Sold (90d)</TableHead>
                    <TableHead className="text-right tabular-nums">Median DOM</TableHead>
                    <TableHead className="text-right tabular-nums">Months of supply</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.active.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.sold90d != null ? row.sold90d.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.medDom != null ? `${row.medDom} days` : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.mos != null ? row.mos.toFixed(1) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Months of supply = active listings divided by (homes sold in 90 days divided by 3). Under 4 months is a seller&rsquo;s market. 4 to 6 is balanced. Over 6 is a buyer&rsquo;s market.
            </p>
          </>
        )}
      </Container>
    </Section>
  )
}
