import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getListingsByKeys } from '@/app/actions/listings'
import { getAdminSyncCounts } from '@/app/actions/listings'

export const metadata: Metadata = {
  title: 'Listing',
  description: 'Admin listing detail.',
}

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ listingKey: string }> }

function formatPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default async function AdminListingDetailPage({ params }: Props) {
  const { listingKey } = await params
  const key = decodeURIComponent(listingKey)
  if (!key) notFound()

  const [listings, counts] = await Promise.all([
    getListingsByKeys([key]),
    getAdminSyncCounts(),
  ])
  const listing = listings[0]
  if (!listing) notFound()

  const address = [
    listing.StreetNumber,
    listing.StreetName,
    listing.City,
    listing.State,
    listing.PostalCode,
  ].filter(Boolean).join(', ')

  return (
    <main className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin/listings" className="text-sm text-muted-foreground hover:text-muted-foreground">
          ← Listings
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">{address || key}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatPrice(listing.ListPrice)} · {listing.StandardStatus ?? '—'} · {listing.BedroomsTotal ?? '—'} beds, {listing.BathroomsTotal ?? '—'} baths
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-semibold text-foreground">Sync info</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Listing key: <code className="rounded bg-muted px-1">{key}</code>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Last modified: {listing.ModificationTimestamp ? new Date(listing.ModificationTimestamp).toLocaleString() : '—'}
          </p>
        </section>
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-semibold text-foreground">Database summary</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Active: {counts.activeCount} · Total: {counts.totalListings}
          </p>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/listing/${key}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          View on site
        </Link>
        <Link href="/admin/sync" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
          Sync status
        </Link>
      </div>
    </main>
  )
}
