import Link from 'next/link'
import type { HomeTileRow } from '@/app/actions/listings'

type SoldRow = HomeTileRow & { ClosePrice?: number | null; CloseDate?: string | null }

type Props = {
  brokerFirstName: string
  soldListings: SoldRow[]
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDate(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function BrokerSoldHistory({ brokerFirstName, soldListings }: Props) {
  const displayList = soldListings.slice(0, 12)

  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-sold-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="broker-sold-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
          Recent Sales
        </h2>
        <p className="mt-1 text-[var(--text-secondary)]">{soldListings.length} sales (24 mo)</p>
        {displayList.length === 0 ? (
          <p className="mt-6 text-[var(--text-secondary)]">No recent sales to display.</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {displayList.map((listing) => {
                const key = listing.ListingKey ?? listing.ListNumber ?? ''
                return (
                  <Link
                    key={String(key)}
                    href={`/listing/${key}`}
                    className="rounded-xl border border-[var(--gray-border)] bg-[var(--gray-bg)] p-4 transition hover:shadow-md"
                  >
                    <p className="font-semibold text-[var(--brand-navy)]">
                      {[listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ')} {listing.City}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Sold {formatPrice(listing.ClosePrice)} · {formatDate(listing.CloseDate)}
                    </p>
                  </Link>
                )
              })}
            </div>
            {soldListings.length > 12 && (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                Showing 12 of {soldListings.length} recent sales.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
