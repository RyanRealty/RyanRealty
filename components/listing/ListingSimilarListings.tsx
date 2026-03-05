import Link from 'next/link'
import type { SimilarListingRow } from '../../app/actions/listings'

type Props = {
  subdivisionName: string
  listings: SimilarListingRow[]
}

export default function ListingSimilarListings({ subdivisionName, listings }: Props) {
  if (listings.length === 0) return null

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">
        Other homes for sale in {subdivisionName}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((row) => {
          const address = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ')
          return (
            <Link
              key={row.ListingKey}
              href={`/listing/${row.ListingKey}`}
              className="group overflow-hidden rounded-lg border border-zinc-100 transition hover:border-zinc-300 hover:shadow-md"
            >
              <div className="aspect-[4/3] bg-zinc-100">
                {row.PhotoURL ? (
                  <img
                    src={row.PhotoURL}
                    alt=""
                    width={400}
                    height={300}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-400">
                    No photo
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-semibold text-zinc-900">
                  ${Number(row.ListPrice ?? 0).toLocaleString()}
                </p>
                {(row.BedroomsTotal != null || row.BathroomsTotal != null) && (
                  <p className="text-sm text-zinc-600">
                    {[row.BedroomsTotal != null && `${row.BedroomsTotal} bed`, row.BathroomsTotal != null && `${row.BathroomsTotal} bath`].filter(Boolean).join(' · ')}
                  </p>
                )}
                {address && (
                  <p className="mt-1 truncate text-sm text-zinc-500">{address}</p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
