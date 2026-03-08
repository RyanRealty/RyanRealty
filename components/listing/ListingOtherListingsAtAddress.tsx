'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ListingTileRow } from '@/app/actions/listings'
type Props = {
  addressLabel: string
  activeListings: ListingTileRow[]
  allListings: ListingTileRow[]
}

function statusBadge(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase()
  if (!s || s.includes('active') || s.includes('for sale') || s.includes('coming soon')) return 'bg-emerald-100 text-emerald-800'
  if (s.includes('pending')) return 'bg-amber-100 text-amber-800'
  if (s.includes('closed')) return 'bg-zinc-200 text-zinc-700'
  return 'bg-zinc-100 text-zinc-700'
}

export default function ListingOtherListingsAtAddress({
  addressLabel,
  activeListings,
  allListings,
}: Props) {
  const [showPast, setShowPast] = useState(false)
  const pastListings = allListings.filter(
    (l) => !activeListings.some((a) => (a.ListNumber ?? a.ListingKey) === (l.ListNumber ?? l.ListingKey))
  )
  const hasPast = pastListings.length > 0

  if (activeListings.length === 0 && !hasPast) return null

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-zinc-900">Other listings at this address</h3>
      <p className="mt-1 text-sm text-zinc-600">
        {addressLabel}. There {activeListings.length + pastListings.length === 1 ? 'is' : 'are'} {activeListings.length + pastListings.length} other listing{activeListings.length + pastListings.length !== 1 ? 's' : ''} at this address.
      </p>
      <ul className="mt-4 space-y-3">
        {activeListings.map((l) => {
          const key = (l.ListNumber ?? l.ListingKey ?? '').toString().trim()
          const href = key ? `/listing/${encodeURIComponent(key)}` : null
          const status = l.StandardStatus ?? 'Active'
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2">
              <div className="min-w-0">
                {href ? (
                  <Link href={href} className="font-medium text-zinc-900 hover:text-emerald-700 hover:underline">
                    ${Number(l.ListPrice ?? 0).toLocaleString()}
                    {l.BedroomsTotal != null || l.BathroomsTotal != null ? (
                      <span className="ml-2 text-zinc-600">
                        {[l.BedroomsTotal != null && `${l.BedroomsTotal} bed`, l.BathroomsTotal != null && `${l.BathroomsTotal} bath`].filter(Boolean).join(', ')}
                      </span>
                    ) : null}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-900">
                    ${Number(l.ListPrice ?? 0).toLocaleString()}
                  </span>
                )}
                <span className="ml-2 text-xs text-zinc-500">MLS# {key}</span>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge(status)}`}>
                {status}
              </span>
            </li>
          )
        })}
        {showPast && hasPast && pastListings.map((l) => {
          const key = (l.ListNumber ?? l.ListingKey ?? '').toString().trim()
          const href = key ? `/listing/${encodeURIComponent(key)}` : null
          const status = l.StandardStatus ?? 'Closed'
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2">
              <div className="min-w-0">
                {href ? (
                  <Link href={href} className="font-medium text-zinc-900 hover:text-emerald-700 hover:underline">
                    ${Number(l.ListPrice ?? 0).toLocaleString()}
                    {l.BedroomsTotal != null || l.BathroomsTotal != null ? (
                      <span className="ml-2 text-zinc-600">
                        {[l.BedroomsTotal != null && `${l.BedroomsTotal} bed`, l.BathroomsTotal != null && `${l.BathroomsTotal} bath`].filter(Boolean).join(', ')}
                      </span>
                    ) : null}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-900">
                    ${Number(l.ListPrice ?? 0).toLocaleString()}
                  </span>
                )}
                <span className="ml-2 text-xs text-zinc-500">MLS# {key}</span>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge(status)}`}>
                {status}
              </span>
            </li>
          )
        })}
      </ul>
      {hasPast && !showPast && (
        <button
          type="button"
          onClick={() => setShowPast(true)}
          className="mt-4 text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
        >
          Show {pastListings.length} past listing{pastListings.length !== 1 ? 's' : ''} at this address
        </button>
      )}
    </div>
  )
}
