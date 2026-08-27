/**
 * /account/hidden — private Saved affordance, on the v3 barrel.
 *
 * Saved is an affordance, not a sixth marketing destination. No Stage, no
 * Instrument, no capture Sheet, no invented homepage. Dual objectives
 *: visitor: review hidden homes and un-hide any.
 * machine: keep search results honest to expressed taste. Exits: listing
 * detail, /homes-for-sale.
 *
 * THE PAGE CONTRACT, carried across: getSession gate, getHiddenListingKeys,
 * dual-form getListingTiles (listingKeys + listNumbers) so a stored key still
 * resolves, unresolved keys stay unhidable, UnhideButton uses the stored key,
 * noindex via account layout.
 *
 * Chrome: root layout mounts V3Chrome. This page does not remount it. V3Footer
 * sits outside <main> via AccountFrame. No V3Breadcrumb (AccountNav is the trail).
 * No on-page Value my home: the sticky chrome already carries that ask.
 *
 * KB-era deletion: ListingCard from the legacy components/site register. Homes
 * are Ledger doors. Unhide stays a working control on the stored key.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { getListingTiles, type ListingTile } from '@/lib/data'
import { listingsBrowsePath } from '@/lib/slug'
import { v3Text, V3Ledger, V3Quiet } from '@/components/site/v3'
import UnhideButton from './UnhideButton'
import { AccountFrame } from '@/app/account/_v3/AccountFrame'
import { tileLabel, tileToSavedLedgerRow } from '@/app/account/_v3/listing-rows'

export const metadata: Metadata = {
  title: 'Hidden homes',
  description: 'Homes you have hidden from your search results and alert emails.',
}

export default async function HiddenHomesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const hiddenKeys = await getHiddenListingKeys()
  // DAL-first read (G8). Rows are canonical-ListingKey-keyed (hideListing
  // resolves before write), but the resolver falls back to the raw input when
  // a lookup misses, so query BOTH identifier forms and dedupe — the same
  // dual-form contract getListingsByKeys uses.
  const [byListingKey, byListNumber] =
    hiddenKeys.length > 0
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

  const ledgerRows = resolved
    .map(({ tile }) => tileToSavedLedgerRow(tile))
    .filter((row): row is NonNullable<typeof row> => row !== null)
  const [firstRow, ...restRows] = ledgerRows
  const countHeading =
    hiddenKeys.length > 0
      ? `${hiddenKeys.length} home${hiddenKeys.length === 1 ? '' : 's'}`
      : 'Hidden'

  return (
    <AccountFrame>
      <V3Quiet
        id="hidden"
        eyebrow="Your search"
        heading="Hidden homes"
        headingLevel={1}
        items={[
          {
            kind: 'prose',
            body: 'These homes stay out of your search results and alert emails. Unhide any to bring it back.',
          },
          { label: 'Browse homes', href: listingsBrowsePath() },
          { label: 'Saved homes', href: '/account/saved-homes' },
        ]}
      />

      {firstRow ? (
        <V3Ledger id="list" heading={v3Text(countHeading)} rows={[firstRow, ...restRows]} />
      ) : (
        <V3Ledger
          id="list"
          heading={v3Text(countHeading)}
          rows={[]}
          emptyMessage={v3Text(
            hiddenKeys.length === 0
              ? 'No hidden homes. Use hide on any search result to keep a home out of results and alert emails.'
              : 'These hidden homes did not return an address in this refresh. Unhide still clears the stored row.',
          )}
        />
      )}

      {resolved.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {resolved.map(({ key, tile }) => (
            <li key={key} className="flex min-h-11 items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-muted-foreground">{tileLabel(tile)}</span>
              <UnhideButton listingKey={key} />
            </li>
          ))}
        </ul>
      ) : null}

      {unresolvedKeys.length > 0 ? (
        <V3Quiet
          id="unresolved"
          heading={
            unresolvedKeys.length === 1
              ? 'One hidden home is no longer on the market'
              : `${unresolvedKeys.length} hidden homes are no longer on the market`
          }
          items={[{ kind: 'prose', body: 'Unhide still clears the stored row.' }]}
        />
      ) : null}

      {unresolvedKeys.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {unresolvedKeys.map((key) => (
            <li key={key} className="flex min-h-11 items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm tabular-nums text-muted-foreground">Listing {key}</span>
              <UnhideButton listingKey={key} />
            </li>
          ))}
        </ul>
      ) : null}
    </AccountFrame>
  )
}
