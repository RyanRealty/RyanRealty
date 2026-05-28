import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { Eyebrow, Grid, H2, Stack } from '@/components/site/primitives'
import type { ListingTile } from '@/lib/data/types/listing'

/**
 * Listing-detail SimilarListings — renders the nearest-comparables grid
 * fed by the already-shipped getSimilarListings DAL function (which
 * reads from similar_listings_mv).
 *
 * Per CLAUDE.md §0 Data Accuracy: similar listings come from the
 * precomputed MV; the page never re-aggregates raw listings at request
 * time. The MV is refreshed nightly via /api/cron/refresh-similar-listings.
 *
 * Layout: 4-card responsive grid (3 at md, 2 at sm). Cards use the
 * shared Layer-1 ListingCard so the visual treatment matches the
 * homepage Featured / Open Houses grids.
 *
 * Per plan §9 Layer 4.
 */

type Props = {
  similar: ReadonlyArray<ListingTile>
  className?: string
}

function tileToCard(tile: ListingTile): ListingCardData {
  const street = [tile.streetNumber, tile.streetName].filter(Boolean).join(' ').trim()
  const cityParts: string[] = []
  if (tile.city) cityParts.push(tile.city)
  const cityLine = [cityParts.join(', '), tile.postalCode, tile.subdivisionName]
    .filter(Boolean)
    .join(' · ')
  return {
    listingKey: tile.listingKey,
    href: `/listing/${tile.listingKey}`,
    photoUrl: tile.photoUrl,
    price: tile.listPrice,
    addressLine: street || 'Address available',
    cityLine,
    beds: tile.beds,
    baths: tile.baths,
    sqft: tile.sqft,
  }
}

export function SimilarListings({ similar, className }: Props) {
  if (similar.length === 0) return null
  const top = similar.slice(0, 4)

  return (
    <Stack gap="default" className={className}>
      <div>
        <Eyebrow>Comparables</Eyebrow>
        <H2 className="mt-1.5">Similar homes nearby</H2>
      </div>
      <Grid cols={4} gap="default">
        {top.map((t) => (
          <ListingCard key={t.listingKey} listing={tileToCard(t)} />
        ))}
      </Grid>
    </Stack>
  )
}
