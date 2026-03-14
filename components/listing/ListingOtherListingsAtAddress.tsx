'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ListingTileRow } from '@/app/actions/listings'
import { Button } from "@/components/ui/button"
type Props = {
  addressLabel: string
  activeListings: ListingTileRow[]
  allListings: ListingTileRow[]
}

function statusBadge(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase()
  if (!s || s.includes('active') || s.includes('for sale') || s.includes('coming soon')) return 'bg-success/15 text-success'
  if (s.includes('pending')) return 'bg-warning/15 text-warning'
  if (s.includes('closed')) return 'bg-border text-muted-foreground'
  return 'bg-muted text-muted-foreground'
}

export default function ListingOtherListingsAtAddress({
  addressLabel,
  activeListings,
  allListings,
}: Props) {
  const [showPast, setShowPast] = useState(false)
  const pastListings = useMemo(
    () =>
      allListings.filter(
        (l) => !activeListings.some((a) => (a.ListNumber ?? a.ListingKey) === (l.ListNumber ?? l.ListingKey))
      ),
    [allListings, activeListings]
  )
  const hasPast = pastListings.length > 0

  function parseDate(s: string | null | undefined): Date | null {
    if (!s) return null
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }

  function formatDate(s: string | null | undefined): string | null {
    const d = parseDate(s)
    if (!d) return null
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  function getListDate(l: ListingTileRow): string | null {
    return formatDate(l.OnMarketDate ?? l.ModificationTimestamp ?? null)
  }

  function getSoldDate(l: ListingTileRow): string | null {
    const closeDate = (l as { CloseDate?: string | null }).CloseDate ?? null
    return formatDate(closeDate)
  }

  function getSoldPrice(l: ListingTileRow): number | null {
    const close = (l as { ClosePrice?: number | null }).ClosePrice
    if (close != null && Number.isFinite(close)) return Number(close)
    const status = (l.StandardStatus ?? '').toLowerCase()
    if (status.includes('closed')) {
      const lp = Number(l.ListPrice ?? 0)
      return Number.isFinite(lp) && lp > 0 ? lp : null
    }
    return null
  }

  function getDomForSold(l: ListingTileRow): number | null {
    const start = parseDate(l.OnMarketDate ?? null)
    const end = parseDate((l as { CloseDate?: string | null }).CloseDate ?? null)
    if (!start || !end) return null
    const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    return days >= 0 ? days : null
  }

  const sortedActive = useMemo(
    () =>
      [...activeListings].sort((a, b) => {
        const da = parseDate(a.OnMarketDate ?? a.ModificationTimestamp ?? null)
        const db = parseDate(b.OnMarketDate ?? b.ModificationTimestamp ?? null)
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        return db.getTime() - da.getTime()
      }),
    [activeListings]
  )

  const sortedPast = useMemo(
    () =>
      [...pastListings].sort((a, b) => {
        const da =
          parseDate((a as { CloseDate?: string | null }).CloseDate ?? null) ??
          parseDate(a.ModificationTimestamp ?? null)
        const db =
          parseDate((b as { CloseDate?: string | null }).CloseDate ?? null) ??
          parseDate(b.ModificationTimestamp ?? null)
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        return db.getTime() - da.getTime()
      }),
    [pastListings]
  )

  if (activeListings.length === 0 && !hasPast) return null

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Other listings at this address</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {addressLabel}. There {activeListings.length + pastListings.length === 1 ? 'is' : 'are'} {activeListings.length + pastListings.length} other listing{activeListings.length + pastListings.length !== 1 ? 's' : ''} at this address.
      </p>
      <ul className="mt-4 space-y-3">
        {sortedActive.map((l) => {
          const key = (l.ListNumber ?? l.ListingKey ?? '').toString().trim()
          const href = key ? `/listing/${encodeURIComponent(key)}` : null
          const status = l.StandardStatus ?? 'Active'
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <div className="min-w-0">
                {href ? (
                  <Link href={href} className="font-medium text-foreground hover:text-success hover:underline">
                    ${Number(l.ListPrice ?? 0).toLocaleString()}
                    {l.BedroomsTotal != null || l.BathroomsTotal != null ? (
                      <span className="ml-2 text-muted-foreground">
                        {[l.BedroomsTotal != null && `${l.BedroomsTotal} bed`, l.BathroomsTotal != null && `${l.BathroomsTotal} bath`].filter(Boolean).join(', ')}
                      </span>
                    ) : null}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">
                    ${Number(l.ListPrice ?? 0).toLocaleString()}
                  </span>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>MLS# {key}</span>
                  {getListDate(l) && <span>Listed {getListDate(l)}</span>}
                </div>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge(status)}`}>
                {status}
              </span>
            </li>
          )
        })}
        {showPast && hasPast && sortedPast.map((l) => {
          const key = (l.ListNumber ?? l.ListingKey ?? '').toString().trim()
          const href = key ? `/listing/${encodeURIComponent(key)}` : null
          const status = l.StandardStatus ?? 'Closed'
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <div className="min-w-0">
                {href ? (
                  <Link href={href} className="font-medium text-foreground hover:text-success hover:underline">
                    ${Number(l.ListPrice ?? 0).toLocaleString()}
                    {l.BedroomsTotal != null || l.BathroomsTotal != null ? (
                      <span className="ml-2 text-muted-foreground">
                        {[l.BedroomsTotal != null && `${l.BedroomsTotal} bed`, l.BathroomsTotal != null && `${l.BathroomsTotal} bath`].filter(Boolean).join(', ')}
                      </span>
                    ) : null}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">
                    ${Number(l.ListPrice ?? 0).toLocaleString()}
                  </span>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>MLS# {key}</span>
                  {getListDate(l) && <span>Listed {getListDate(l)}</span>}
                  {getSoldDate(l) && <span>Sold {getSoldDate(l)}</span>}
                  {getDomForSold(l) != null && <span>{getDomForSold(l)} days to sell</span>}
                </div>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge(status)}`}>
                {status}
              </span>
            </li>
          )
        })}
      </ul>
      {hasPast && !showPast && (
        <Button
          type="button"
          onClick={() => setShowPast(true)}
          className="mt-4 text-sm font-medium text-success hover:text-success hover:underline"
        >
          Show {pastListings.length} past listing{pastListings.length !== 1 ? 's' : ''} at this address
        </Button>
      )}
    </div>
  )
}
