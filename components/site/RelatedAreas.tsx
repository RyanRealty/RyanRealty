import Link from 'next/link'
import {
  Container,
  Eyebrow,
  Grid,
  H2,
  Section,
  Stack,
  TabularNumber,
} from '@/components/site/primitives'

/**
 * Site v2 related-areas grid — 4 to 8 cards linking to sibling
 * cities / communities / zip codes from a city or community page. Per
 * plan §9 Layer 3.
 *
 * For internal cross-navigation between geo pages so a viewer landing
 * on /cities/bend can hop to /cities/redmond or /communities/tetherow
 * without backtracking to the index page.
 *
 * Active count is rendered through TabularNumber so the figure aligns
 * across cards. The whole card is a click target; arrow on the right
 * mirrors the CityGrid pattern.
 *
 * Example:
 *   <RelatedAreas
 *     title="Nearby cities"
 *     items={[
 *       { name: 'Redmond', href: '/cities/redmond', activeCount: 241 },
 *       { name: 'Sisters', href: '/cities/sisters', activeCount: 96 },
 *       { name: 'Sunriver', href: '/cities/sunriver', activeCount: 64 },
 *     ]}
 *   />
 */

export type RelatedAreaItem = {
  name: string
  href: string
  /** Optional active-listing count rendered as "N active" under the name. */
  activeCount?: number | null
}

type Props = {
  items: ReadonlyArray<RelatedAreaItem>
  title?: string
  eyebrow?: string
  /** Section tone — default light bg; pass "muted" for the cream surface. */
  tone?: 'default' | 'muted'
  /** Grid columns at the largest breakpoint. */
  cols?: 2 | 3 | 4
  className?: string
}

function AreaTile({ item }: { item: RelatedAreaItem }) {
  return (
    <Link
      href={item.href}
      className="group bg-card border border-border rounded-[14px] px-5 py-4 flex items-center justify-between gap-3 shadow-sm hover:border-primary/40 hover:shadow-md transition"
    >
      <div className="min-w-0">
        <div className="text-[15px] font-bold tracking-[-0.01em] text-foreground truncate">
          {item.name}
        </div>
        {typeof item.activeCount === 'number' ? (
          <div className="text-xs text-muted-foreground mt-0.5">
            <TabularNumber value={item.activeCount} /> active
          </div>
        ) : null}
      </div>
      <span
        aria-hidden
        className="text-muted-foreground group-hover:text-primary transition shrink-0"
      >
        →
      </span>
    </Link>
  )
}

export function RelatedAreas({
  items,
  title = 'Related areas',
  eyebrow,
  tone = 'muted',
  cols = 4,
  className,
}: Props) {
  if (items.length === 0) return null

  return (
    <Section padding="default" tone={tone} divider className={className}>
      <Container>
        <Stack gap="tight" className="mb-6">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <H2>{title}</H2>
        </Stack>

        <Grid cols={cols} gap="default">
          {items.map((item) => (
            <AreaTile key={item.href} item={item} />
          ))}
        </Grid>
      </Container>
    </Section>
  )
}
