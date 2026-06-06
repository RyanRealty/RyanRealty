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
import { Button } from '@/components/ui/button'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { CONTACT } from '@/lib/brand/contact'

/**
 * GolfHomesGrid — active golf-course homes section.
 *
 * Shows a Grid of ListingCard tiles from the `homes` prop.
 * When the grid is empty, renders a short honest empty state.
 * The primary "View all" Button links to allHomesHref.
 *
 * Design-system rules:
 *   - Button from @/components/ui/button (default = bg-primary)
 *   - ListingCard for each listing tile
 *   - No arbitrary bracket utilities, no hex, no custom primitives
 */

type Props = {
  homes: ListingCardData[]
  totalHomes: number
  allHomesHref: string
}

export function GolfHomesGrid({ homes, totalHomes, allHomesHref }: Props) {
  return (
    <Section tone="default" divider>
      <Container>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-8">
          <Stack gap="tight">
            <Eyebrow>For sale</Eyebrow>
            <H2>Active golf homes</H2>
          </Stack>
          <Link
            href={allHomesHref}
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
          >
            {totalHomes > 0 ? `View all ${totalHomes}` : 'Browse all'}
          </Link>
        </div>

        {homes.length > 0 ? (
          <>
            <Grid cols={3} gap="default">
              {homes.map((listing) => (
                <ListingCard key={listing.listingKey} listing={listing} />
              ))}
            </Grid>

            <div className="mt-10 flex justify-center">
              <Button asChild size="lg">
                <Link href={allHomesHref}>
                  {totalHomes > 0 ? `View all ${totalHomes} golf homes` : 'Browse all golf homes'}
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-muted px-6 py-12 text-center">
            <Body size="default" tone="muted">
              No active golf-course listings right now. Check back soon, or contact us at {CONTACT.phoneDirect} and we will keep an eye on the market for you.
            </Body>
            <div className="mt-4">
              <Button asChild>
                <Link href={allHomesHref}>Browse all golf results</Link>
              </Button>
            </div>
          </div>
        )}
      </Container>
    </Section>
  )
}
