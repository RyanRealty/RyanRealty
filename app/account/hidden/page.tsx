// @no-parity — private /account/* page (noindex), no public mockup contract;
// matches the existing /account section pattern (saved-homes, saved-cities).
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { getListingTiles, type ListingTile } from '@/lib/data'
import { listingDetailPath, displaySubdivision, listingsBrowsePath } from '@/lib/slug'
import ListingCard from '@/components/site/ListingCard'
import UnhideButton from './UnhideButton'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Hidden homes',
  description: 'Homes you have hidden from your search results and alert emails.',
}

// No static rendering: getSession() reads cookies, which already opts this
// route out of prerendering on every request (same effect as forcing it).

export default async function HiddenHomesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const hiddenKeys = await getHiddenListingKeys()
  // DAL-first read (G8). Rows are canonical-ListingKey-keyed (hideListing
  // resolves before write), but the resolver falls back to the raw input when
  // a lookup misses, so query BOTH identifier forms and dedupe — the same
  // dual-form contract getListingsByKeys uses.
  const [byListingKey, byListNumber] = hiddenKeys.length > 0
    ? await Promise.all([
        getListingTiles({ listingKeys: hiddenKeys, status: 'all', sort: 'newest', limit: 500 }),
        getListingTiles({ listNumbers: hiddenKeys, status: 'all', sort: 'newest', limit: 500 }),
      ])
    : [[], []]
  const tileByHiddenKey = new Map<string, ListingTile>()
  for (const tile of [...byListingKey, ...byListNumber]) {
    for (const k of [tile.listingKey, tile.listNumber]) {
      const key = (k ?? '').toString().trim()
      if (key && !tileByHiddenKey.has(key)) tileByHiddenKey.set(key, tile)
    }
  }
  const resolved = hiddenKeys
    .map((key) => ({ key: key.trim(), tile: tileByHiddenKey.get(key.trim()) }))
    .filter((entry): entry is { key: string; tile: ListingTile } => Boolean(entry.tile))
  // Keys whose listing no longer resolves to a tile (off-market, purged feed
  // row). Still listed so the user can always unhide — a hidden row must never
  // become unremovable just because the listing left the feed.
  const unresolvedKeys = hiddenKeys.map((k) => k.trim()).filter((k) => k && !tileByHiddenKey.has(k))

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Hidden homes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            These homes stay out of your search results and alert emails. Unhide any to bring it back.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={listingsBrowsePath()}>Browse homes</Link>
        </Button>
      </header>

      {/* ── Hidden listings grid ── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">
          {hiddenKeys.length > 0 ? `${hiddenKeys.length} home${hiddenKeys.length === 1 ? '' : 's'}` : 'Hidden'}
        </h2>
        {hiddenKeys.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No hidden homes.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Use the hide control on any search result to keep a home out of your results and alert emails.
            </p>
            <Button asChild size="sm">
              <Link href={listingsBrowsePath()}>Browse homes</Link>
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resolved.map(({ key, tile }) => {
                const urlKey = (tile.listNumber ?? tile.listingKey ?? key).toString().trim()
                const href = listingDetailPath(
                  urlKey,
                  {
                    streetNumber: tile.streetNumber,
                    streetName: tile.streetName,
                    city: tile.city,
                    state: 'OR',
                    postalCode: tile.postalCode,
                  },
                  { city: tile.city, subdivision: tile.subdivisionName },
                  { mlsNumber: tile.listNumber ?? null },
                )
                const cityParts = [tile.city, 'OR'].filter(Boolean).join(', ')
                const cityZip = [cityParts, tile.postalCode].filter(Boolean).join(' ').trim()
                const subdivision = displaySubdivision(tile.subdivisionName)
                const cityLine = subdivision ? `${cityZip} · ${subdivision}` : cityZip
                const addressLine =
                  [tile.streetNumber, tile.streetName, tile.streetSuffix].filter(Boolean).join(' ').trim() ||
                  cityParts ||
                  'Listing'
                return (
                  <div key={key} className="flex flex-col">
                    <ListingCard
                      listing={{
                        listingKey: urlKey,
                        href,
                        photoUrl: tile.photoUrl,
                        price: tile.listPrice,
                        addressLine,
                        cityLine,
                        beds: tile.beds,
                        baths: tile.baths,
                        sqft: tile.sqft,
                      }}
                    />
                    {/* Unhide with the STORED key so the exact row clears. */}
                    <UnhideButton listingKey={key} />
                  </div>
                )
              })}
            </div>

            {unresolvedKeys.length > 0 ? (
              <div className="mt-6 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {unresolvedKeys.length === 1
                    ? 'One hidden home is no longer on the market.'
                    : `${unresolvedKeys.length} hidden homes are no longer on the market.`}
                </p>
                <div className="space-y-2">
                  {unresolvedKeys.map((key) => (
                    <Card key={key} className="flex flex-row items-center justify-between gap-3 px-4 py-3">
                      <span className="truncate text-sm text-muted-foreground tabular-nums">Listing {key}</span>
                      <UnhideButton listingKey={key} />
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
