import {
  Container,
  Eyebrow,
  Grid,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'

/**
 * Site v2 testimonial block — client quotes with attribution. Per plan
 * §9 Layer 3.
 *
 * Each testimonial is a Quote + Attribution pair (name + optional city +
 * optional closed-deal year). Brand voice is honest and grateful — Matt's
 * canonical phrase "It was genuinely a pleasure working with you" is the
 * template the agent encouraged in voice_guidelines.md §4.6.
 *
 * Layout switches by item count:
 *   1 item    — single centered "hero" quote (large display Body)
 *   2-4 items — Grid with 2-4 columns
 *
 * No star ratings, no review platform logos, no fake humility brag
 * (banned trope per §6.4). Show, don't tell.
 *
 * Example:
 *   <TestimonialBlock
 *     eyebrow="From clients"
 *     title="What people say"
 *     items={[
 *       { quote: '...', name: 'A. Johnson', city: 'Bend', year: 2025 },
 *     ]}
 *   />
 */

export type Testimonial = {
  quote: string
  name: string
  /** City / community / neighborhood the client closed in. */
  city?: string
  /** Year the deal closed. Tabular numerals. */
  year?: number
}

type Props = {
  items: ReadonlyArray<Testimonial>
  eyebrow?: string
  title?: string
  /** Section tone — default light bg; pass "muted" for the cream surface. */
  tone?: 'default' | 'muted'
  className?: string
}

function TestimonialCard({ t, tone }: { t: Testimonial; tone: 'default' | 'muted' }) {
  return (
    <figure
      className={
        tone === 'muted'
          ? 'bg-card border border-border rounded-[14px] p-6 shadow-sm'
          : 'bg-muted/40 border border-border rounded-[14px] p-6'
      }
    >
      <blockquote className="text-foreground leading-[1.55] text-[15px]">
        “{t.quote}”
      </blockquote>
      <figcaption className="mt-4 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{t.name}</span>
        {t.city ? `, ${t.city}` : ''}
        {t.year ? (
          <>
            {' · '}
            <span className="tabular-nums">{t.year}</span>
          </>
        ) : null}
      </figcaption>
    </figure>
  )
}

function HeroQuote({ t }: { t: Testimonial }) {
  return (
    <figure className="max-w-[68ch] mx-auto text-center">
      <blockquote className="text-foreground leading-[1.45] text-[22px] sm:text-[26px] font-medium">
        “{t.quote}”
      </blockquote>
      <figcaption className="mt-5 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{t.name}</span>
        {t.city ? `, ${t.city}` : ''}
        {t.year ? (
          <>
            {' · '}
            <span className="tabular-nums">{t.year}</span>
          </>
        ) : null}
      </figcaption>
    </figure>
  )
}

export function TestimonialBlock({
  items,
  eyebrow,
  title,
  tone = 'muted',
  className,
}: Props) {
  if (items.length === 0) return null

  const cardCount = items.length
  const gridCols: 2 | 3 | 4 = cardCount >= 4 ? 4 : (cardCount === 3 ? 3 : 2)

  return (
    <Section padding="default" tone={tone} divider className={className}>
      <Container>
        {(eyebrow || title) ? (
          <Stack gap="tight" className="mb-8 max-w-[60ch]">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            {title ? <H2>{title}</H2> : null}
          </Stack>
        ) : null}

        {cardCount === 1 ? (
          <HeroQuote t={items[0]} />
        ) : (
          <Grid cols={gridCols} gap="default">
            {items.map((t, i) => (
              <TestimonialCard key={`${i}-${t.name}`} t={t} tone={tone} />
            ))}
          </Grid>
        )}
      </Container>
    </Section>
  )
}

