/**
 * ReviewsBlock — brokerage social proof from verified Google reviews.
 *
 * Shows the Ryan Realty Google rating badge (average + count) and a set of
 * real review quotes. Used on /team, /about, and each broker landing page so a
 * newer broker rides the firm's reputation (Matt: use brokerage-level review
 * language, not per-broker stats).
 *
 * The review text is REAL, DB-sourced (public.reviews, source='google',
 * is_hidden=false) — never hardcoded marketing prose, so brand-voice scanning
 * does not apply to a reviewer's own words.
 */
import { Container, Eyebrow, H2, Body, Section, Grid, Stack } from '@/components/site/primitives'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ReviewsSummary } from '@/lib/data'

type Props = {
  data: ReviewsSummary
  eyebrow?: string
  title?: string
  tone?: 'default' | 'muted'
  max?: number
}

/** Cap a long review for a uniform card, breaking on a word boundary. */
function clampQuote(text: string, max = 320): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  // Render all five glyphs so a partial rating reads clearly: filled stars in
  // brand navy (visible on cream — the prior `text-accent` was near-white and
  // invisible), the remainder muted. tracking-wide keeps them from touching.
  const full = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <span aria-label={`${rating} out of 5 stars`} className={cn('tracking-wide', className)}>
      <span aria-hidden className="text-primary">{'★'.repeat(full)}</span>
      <span aria-hidden className="text-muted-foreground/30">{'★'.repeat(5 - full)}</span>
    </span>
  )
}

export function ReviewsBlock({
  data,
  eyebrow = 'Reviews',
  title = 'What our clients say',
  tone = 'muted',
  max = 6,
}: Props) {
  if (!data || data.count === 0) return null
  const cards = data.reviews.slice(0, max)

  return (
    <Section padding="default" tone={tone} divider>
      <Container>
        <Stack gap="tight" className="mb-8 max-w-prose">
          <Eyebrow>{eyebrow}</Eyebrow>
          <H2>{title}</H2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-3xl leading-none text-foreground tabular-nums">
              {data.averageRating.toFixed(1)}
            </span>
            <Stars rating={data.averageRating} className="text-xl" />
            <Body size="small" tone="muted">
              {data.count} verified reviews on Google
            </Body>
          </div>
        </Stack>

        {cards.length > 0 ? (
          <Grid cols={3} gap="default">
            {cards.map((review, i) => (
              <Card key={i} className="p-6">
                <CardContent className="p-0">
                  <figure className="flex flex-col">
                    <Stars rating={review.rating} className="text-base" />
                    <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {clampQuote(review.text)}
                    </blockquote>
                    <figcaption className="mt-4 text-sm font-semibold text-foreground">
                      {review.reviewerName ?? 'Verified client'}
                    </figcaption>
                  </figure>
                </CardContent>
              </Card>
            ))}
          </Grid>
        ) : null}
      </Container>
    </Section>
  )
}
