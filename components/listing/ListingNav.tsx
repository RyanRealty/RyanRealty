'use client'

import Link from 'next/link'

type Props = {
  listingKey: string
  prevKey: string | null
  nextKey: string | null
}

export default function ListingNav({ listingKey, prevKey, nextKey }: Props) {
  return (
    <nav className="flex items-center gap-2">
      {prevKey ? (
        <Link
          href={`/listing/${prevKey}`}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          ← Prev
        </Link>
      ) : (
        <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-400">
          ← Prev
        </span>
      )}
      {nextKey ? (
        <Link
          href={`/listing/${nextKey}`}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Next →
        </Link>
      ) : (
        <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-400">
          Next →
        </span>
      )}
    </nav>
  )
}
