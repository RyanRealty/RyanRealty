import Link from 'next/link'
import {
  Body,
  Container,
  CTAButton,
  Eyebrow,
  Grid,
  H2,
  Price,
  Section,
  Stack,
  TabularNumber,
} from '@/components/site/primitives'

/**
 * Site v2 social-proof block — quantitative trust signals (families
 * served, closed-deal counts, average DOM) and recent-closing
 * highlights. Per plan §9 Layer 3.
 *
 * Different from TestimonialBlock (direct quotes). Use SocialProofBlock
 * for the brokerage's verifiable track-record numbers and recent-sold
 * cards. Every figure is a verified stat, not a claim — Data Accuracy
 * mandate applies (CLAUDE.md §0).
 *
 * Two pieces, both optional:
 *   - stats:    headline metrics (families served, total volume, etc.)
 *   - sales:    recent-sold cards (address + close price + month closed)
 *
 * The agent stays brand-voice clean — no "top producing" / "premier
 * brokerage" / "we are passionate about" framing. Numbers do the work.
 *
 * Example:
 *   <SocialProofBlock
 *     eyebrow="Track record"
 *     title="Recent work across Central Oregon"
 *     stats={[
 *       { label: 'Closed transactions', value: 142 },
 *       { label: 'Total volume closed', value: 89_000_000, kind: 'price' },
 *       { label: 'Median days to pending', value: 38, kind: 'days' },
 *     ]}
 *     sales={[
 *       { address: '12345 NW Ridgeline', closePrice: 875000, monthClosed: 'May 2026' },
 *     ]}
 *     cta={{ href: '/sold', label: 'See recent sales' }}
 *   />
 */

export type SocialProofStat = {
  label: string
  value: number | null
  /** How to format the value. Default "count" (raw integer). */
  kind?: 'count' | 'price' | 'days'
  /** Optional descriptor under the stat. */
  sub?: string
}

export type SocialProofSale = {
  address: string
  closePrice: number | null
  /** Free-form month/date string ("May 2026", "Last week", etc.). */
  monthClosed?: string
  /** Optional href to the listing detail or sold-detail page. */
  href?: string
}

type Props = {
  stats?: ReadonlyArray<SocialProofStat>
  sales?: ReadonlyArray<SocialProofSale>
  eyebrow?: string
  title?: string
  intro?: string
  /** Trailing CTA button under the content. */
  cta?: { href: string; label: string }
  /** Section tone — default light bg; pass "muted" for the cream surface. */
  tone?: 'default' | 'muted'
  className?: string
}

function StatTile({ stat }: { stat: SocialProofStat }) {
  const valueNode =
    stat.kind === 'price' ? (
      <Price value={stat.value} compact />
    ) : stat.kind === 'days' ? (
      <TabularNumber value={stat.value} />
    ) : (
      <TabularNumber value={stat.value} />
    )
  return (
    <div className="bg-card border border-border rounded-[14px] p-5 shadow-sm">
      <div className="text-[28px] font-bold tracking-[-0.01em] text-foreground">
        {valueNode}
        {stat.kind === 'days' ? <span className="text-base font-normal text-muted-foreground"> days</span> : null}
      </div>
      <div className="text-[13px] font-medium text-foreground mt-1">{stat.label}</div>
      {stat.sub ? (
        <div className="text-xs text-muted-foreground mt-0.5">{stat.sub}</div>
      ) : null}
    </div>
  )
}

function SaleTile({ sale }: { sale: SocialProofSale }) {
  const body = (
    <>
      <div className="text-[15px] font-bold tracking-[-0.01em] text-foreground truncate">
        {sale.address}
      </div>
      <div className="text-[14px] text-muted-foreground mt-0.5">
        Closed <Price value={sale.closePrice} />
        {sale.monthClosed ? <span className="text-muted-foreground/80"> · {sale.monthClosed}</span> : null}
      </div>
    </>
  )
  if (sale.href) {
    return (
      <Link
        href={sale.href}
        className="block bg-card border border-border rounded-[14px] p-4 shadow-sm hover:border-primary/30 hover:shadow-md transition"
      >
        {body}
      </Link>
    )
  }
  return (
    <div className="bg-card border border-border rounded-[14px] p-4 shadow-sm">
      {body}
    </div>
  )
}

export function SocialProofBlock({
  stats,
  sales,
  eyebrow,
  title,
  intro,
  cta,
  tone = 'default',
  className,
}: Props) {
  if ((!stats || stats.length === 0) && (!sales || sales.length === 0)) {
    return null
  }

  const statCols: 2 | 3 | 4 = stats && stats.length >= 4 ? 4 : (stats?.length === 3 ? 3 : 2)
  const saleCols: 2 | 3 | 4 = sales && sales.length >= 4 ? 4 : (sales?.length === 3 ? 3 : 2)

  return (
    <Section padding="default" tone={tone} divider className={className}>
      <Container>
        {(eyebrow || title || intro) ? (
          <Stack gap="tight" className="mb-8 max-w-[60ch]">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            {title ? <H2>{title}</H2> : null}
            {intro ? (
              <Body size="default" tone="muted">
                {intro}
              </Body>
            ) : null}
          </Stack>
        ) : null}

        {stats && stats.length > 0 ? (
          <Grid cols={statCols} gap="default" className="mb-6">
            {stats.map((s, i) => (
              <StatTile key={`stat-${i}`} stat={s} />
            ))}
          </Grid>
        ) : null}

        {sales && sales.length > 0 ? (
          <Grid cols={saleCols} gap="tight">
            {sales.map((sale, i) => (
              <SaleTile key={`sale-${i}-${sale.address}`} sale={sale} />
            ))}
          </Grid>
        ) : null}

        {cta ? (
          <div className="mt-8">
            <CTAButton href={cta.href} tone="primary" size="md">
              {cta.label}
            </CTAButton>
          </div>
        ) : null}
      </Container>
    </Section>
  )
}
