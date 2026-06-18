import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { Grid } from '@/components/site/primitives'
import type { ListingTile } from '@/lib/data/types/listing'
import { listingTileHref } from '@/lib/slug'
import { cn } from '@/lib/utils'

/**
 * SimilarListings — KB section style.
 * Navy sec-head, Amboqia heading. Listing card grid preserved.
 *
 * Per CLAUDE.md §0: similar listings from the precomputed MV only.
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
    href: listingTileHref(tile),
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
    <section className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Comparables</div>
          <h2 className="sec-title display">Similar homes</h2>
        </div>
      </div>

      <div style={{ marginTop: 'clamp(22px,3vw,36px)' }}>
        <Grid cols={4} gap="default">
          {top.map((t) => (
            <ListingCard key={t.listingKey} listing={tileToCard(t)} />
          ))}
        </Grid>
      </div>
    </section>
  )
}
