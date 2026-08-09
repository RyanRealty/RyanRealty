// @no-parity — internal admin surface, no public mockup contract
//
// One listing — 11D: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the getSession → getAdminRoleForEmail → superuser
// guard and its /admin/access-denied redirect, the awaited `params` promise and
// the decodeURIComponent(listingKey) lookup, all three notFound() branches
// (empty key · no listing · no editable data), the parallel
// getListingsByKeys / getAdminSyncCounts / getAdminListingEditableData reads,
// the address join order (StreetNumber, StreetName, City, State, PostalCode),
// the listingDetailPath() argument shape, target="_blank" rel="noopener
// noreferrer", the /admin/listings and /admin/sync hrefs, the metadata block,
// `export const dynamic = 'force-dynamic'`, and the AdminListingEditor island
// with the same initialData prop.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell
// owns that landmark), the raw <h1> became EntityTitle — this IS an entity
// page, so acceptance-bar rule 1 grants it the property's own address — and
// the two <h2> section cards became SectionHead lanes.
//
// TWO LABELS MATCH THEIR QUERY. 11C narrowed the words to fit the data: the
// card said "Active: N" while `counts.activeCount` was a top-50-city snapshot
// sum of active SINGLE-FAMILY rows, so it became "Active single-family, top 50
// city snapshots" — true, but a caption nobody could act on.
//
// 11F fixed the SOURCE instead (see getAdminSyncCounts): activeCount is now
// getActiveBucketCount(), a plain service-role count of the active bucket in
// `listings`, and totalListings is getAllListingsCount(), an estimated all-row
// count. So the labels widen back to what a broker actually reads them as.
// "Estimated" stays in the words because the count genuinely is planner
// reltuples — an exact count times out on a 594k-row table.
//
// FORMATTERS. The local formatPrice was `Intl.NumberFormat(en-US, currency USD,
// maximumFractionDigits 0)`; it is now formatPriceExact from lib/format/money,
// which is that same formatter — verified byte-identical on real list prices
// ($350,000 · $949,808 · $399,995 · $1,295,000 · $259,900) and on null → "—".
// formatPrice (no Exact) was NOT used: it rounds to the nearest $1,000 and
// would print $949,808 as $950,000. "Last modified" keeps
// `new Date(x).toLocaleString()` unchanged: formatDateTime pins
// America/Los_Angeles and drops seconds, so on 2026-08-07T18:47:16Z the old
// call prints "8/7/2026, 6:47:16 PM" on a UTC server and the helper prints
// "Aug 7, 2026, 11:47 AM". Those differ, so the old one stays and the
// server/client zone split is reported as a defect rather than swapped in here.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getListingsByKeys } from '@/app/actions/listings'
import { getAdminSyncCounts } from '@/app/actions/listings'
import { getAdminListingEditableData } from '@/app/actions/admin-listing-detail'
import { listingDetailPath } from '@/lib/slug'
import { formatPriceExact } from '@/lib/format/money'
import { EntityTitle, SectionHead } from '@/components/admin/v2'
import AdminListingEditor from './AdminListingEditor'

export const metadata: Metadata = {
  title: 'Listing',
  description: 'Admin listing detail.',
}

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ listingKey: string }> }

export default async function AdminListingDetailPage({ params }: Props) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') {
    redirect('/admin/access-denied')
  }

  const { listingKey } = await params
  const key = decodeURIComponent(listingKey)
  if (!key) notFound()

  const [listings, counts, editableData] = await Promise.all([
    getListingsByKeys([key]),
    getAdminSyncCounts(),
    getAdminListingEditableData(key),
  ])
  const listing = listings[0]
  if (!listing) notFound()
  if (!editableData) notFound()

  const address = [
    listing.StreetNumber,
    listing.StreetName,
    listing.City,
    listing.State,
    listing.PostalCode,
  ].filter(Boolean).join(', ')

  const quiet = { fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 4px' } as const

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 12px' }}>
        <Link href="/admin/listings" style={{ color: 'var(--a-accent)', fontSize: 'var(--a-text-sm)' }}>
          &larr; Listings
        </Link>
      </p>

      <EntityTitle>{address || key}</EntityTitle>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '4px 0 16px' }}>
        {formatPriceExact(listing.ListPrice)} · {listing.StandardStatus ?? '—'} ·{' '}
        {listing.BedroomsTotal ?? '—'} beds, {listing.BathroomsTotal ?? '—'} baths
      </p>

      <div className="av2-wordrow" style={{ margin: '0 0 8px' }}>
        <Link
          href={listingDetailPath(
            key,
            { streetNumber: listing.StreetNumber, streetName: listing.StreetName, city: listing.City, state: listing.State, postalCode: listing.PostalCode },
            { city: listing.City, subdivision: listing.SubdivisionName }
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="av2-btn"
          style={{ textDecoration: 'none' }}
        >
          View on site
        </Link>
        <Link href="/admin/sync" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          Sync status
        </Link>
      </div>

      <SectionHead>Sync info</SectionHead>
      <p style={quiet}>
        Listing key:{' '}
        <span style={{ fontFamily: 'var(--a-font-mono)', overflowWrap: 'anywhere' }}>{key}</span>
      </p>
      <p style={quiet}>
        Last modified:{' '}
        {listing.ModificationTimestamp
          ? new Date(listing.ModificationTimestamp).toLocaleString()
          : '—'}
      </p>

      <SectionHead>Feed totals — not this listing</SectionHead>
      <p style={quiet}>Active listings, every property type: {counts.activeCount}</p>
      <p style={quiet}>
        Listing rows, every status (estimated): {counts.totalListings}
      </p>

      <div style={{ marginTop: 24 }}>
        <AdminListingEditor initialData={editableData} />
      </div>
    </div>
  )
}
