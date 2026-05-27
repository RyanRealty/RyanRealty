import Link from 'next/link'
import {
  Body,
  Container,
  Eyebrow,
  Grid,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'

/**
 * Site v2 price-range tiles — 4 buyer entry tiles by price band, on a muted
 * surface. Mirrors design_system/ryan-realty/ui_kits/website/index.html §price-range.
 *
 * Per brand voice rule: no fabricated counts. Subtitles describe the band,
 * not a number we can't verify in real time.
 *
 * Lifted onto Wave 2 Layer 1 primitives 2026-05-27. En-dashes in the
 * price labels swapped for the word "to" per brand voice §6.1
 * (en-dashes banned in body prose).
 */
const RANGES = [
  {
    href: '/search?maxPrice=600000',
    range: 'Under $600k',
    sub: 'Entry-level homes and condos',
  },
  {
    href: '/search?minPrice=600000&maxPrice=900000',
    range: '$600k to $900k',
    sub: 'Move-up homes',
  },
  {
    href: '/search?minPrice=900000&maxPrice=1500000',
    range: '$900k to $1.5M',
    sub: 'Premium properties',
  },
  {
    href: '/search?minPrice=1500000',
    range: '$1.5M and up',
    sub: 'Larger homes and estates',
  },
] as const

function PriceTile({ href, range, sub }: { href: string; range: string; sub: string }) {
  return (
    <Link
      href={href}
      className="group bg-card border border-border rounded-[14px] p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xl font-bold tracking-[-0.01em] text-foreground">
            {range}
          </div>
          <div className="text-[13px] text-muted-foreground mt-1">{sub}</div>
        </div>
        <span
          aria-hidden
          className="text-muted-foreground group-hover:text-primary transition translate-y-0.5"
        >
          →
        </span>
      </div>
    </Link>
  )
}

export default function PriceRangeTiles() {
  return (
    <Section padding="default" tone="muted" divider>
      <Container>
        <Stack gap="tight" className="mb-6">
          <Eyebrow>Inventory</Eyebrow>
          <H2>Browse by price range</H2>
          <Body size="small" tone="muted">
            Quickly find homes within your budget.
          </Body>
        </Stack>

        <Grid cols={4} gap="default">
          {RANGES.map((tile) => (
            <PriceTile key={tile.href} {...tile} />
          ))}
        </Grid>
      </Container>
    </Section>
  )
}
