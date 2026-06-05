import Link from 'next/link'
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
 * CityComparisonTable — per-city market snapshot for "How {geoName} compares".
 *
 * Site v2 block per money-path-contract-plan-2026-06-04.md. Composes from
 * @/components/ui/table + site v2 Section chrome. Every figure traces to
 * market_pulse_live via getMarketPulseCitySnapshots — never hardcoded.
 *
 * Data accuracy (CLAUDE.md §0): the page server component fetches and
 * passes verified rows as `cities` props. This component is a pure
 * presenter — it owns zero data fetching. Each on-screen number is
 * exactly the number the caller received from the DAL.
 *
 * Currency is rounded to the nearest $1,000 per CLAUDE.md voice rules.
 * Tabular numerals are applied via CSS class so every digit column aligns.
 */

export type CityComparisonRow = {
  /** City slug for linking to /housing-market/<slug> */
  slug: string
  /** Display name e.g. "Bend" */
  label: string
  /** Active SFR listing count from market_pulse_live */
  activeCount: number
  /** Median list price in USD from market_pulse_live */
  medianListPrice: number | null
  /** Months of supply from market_pulse_live */
  monthsOfSupply: number | null
  /** Median days to pending from market_pulse_live */
  medianDaysToPending: number | null
}

type Props = {
  cities: ReadonlyArray<CityComparisonRow>
  /** Name of the current city (highlighted in the table) */
  currentCitySlug?: string
  eyebrow?: string
  title?: string
  /** Section tone — default light bg; pass "muted" for the cream surface. */
  tone?: 'default' | 'muted'
  className?: string
}

function fmtPrice(v: number | null): string {
  if (v == null) return '—'
  const rounded = Math.round(v / 1000) * 1000
  return `$${rounded.toLocaleString('en-US')}`
}

function fmtMos(v: number | null): string {
  if (v == null) return '—'
  return (Math.round(v * 10) / 10).toFixed(1)
}

function fmtDom(v: number | null): string {
  if (v == null) return '—'
  return `${Math.round(v)} days`
}

export function CityComparisonTable({
  cities,
  currentCitySlug,
  eyebrow = 'Central Oregon comparison',
  title = 'How cities compare',
  tone = 'muted',
  className,
}: Props) {
  if (cities.length === 0) return null

  return (
    <Section padding="default" tone={tone} divider className={className}>
      <Container>
        <Stack gap="tight" className="mb-6 max-w-[60ch]">
          <Eyebrow>{eyebrow}</Eyebrow>
          <H2>{title}</H2>
          <Body size="small" tone="muted">
            Live single-family market data from Oregon Data Share. Refreshed every 15 minutes.
          </Body>
        </Stack>

        <div className="overflow-x-auto rounded-[14px] border border-border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City</TableHead>
                <TableHead className="text-right tabular-nums">Active homes</TableHead>
                <TableHead className="text-right tabular-nums">Median list price</TableHead>
                <TableHead className="text-right tabular-nums">Months of supply</TableHead>
                <TableHead className="text-right tabular-nums">Days to pending</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cities.map((city) => {
                const isCurrentCity = city.slug === currentCitySlug
                return (
                  <TableRow
                    key={city.slug}
                    className={isCurrentCity ? 'bg-primary/5 font-semibold' : undefined}
                  >
                    <TableCell>
                      <Link
                        href={`/housing-market/${city.slug}`}
                        className="text-foreground underline-offset-2 hover:underline"
                      >
                        {city.label}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {city.activeCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtPrice(city.medianListPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMos(city.monthsOfSupply)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtDom(city.medianDaysToPending)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Single-family homes only. Months of supply = active listings divided by (closed last 30 days times 2). Source: market_pulse_live via Oregon Data Share.
        </p>
      </Container>
    </Section>
  )
}
