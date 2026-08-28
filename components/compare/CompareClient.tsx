'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useComparison } from '@/contexts/ComparisonContext'
import { trackEvent } from '@/lib/tracking'
import { HugeiconsIcon } from '@hugeicons/react'
import { LinkSquare01Icon, Cancel01Icon, Download01Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"
import { listingDetailPath } from '@/lib/slug'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { H1, H2, H3 } from '@/components/site/primitives'
import { V3SourceLine } from '@/components/site/v3'

export type CompareListingData = {
  listingKey: string
  address: string
  city: string | null
  state: string | null
  postalCode: string | null
  subdivision: string | null
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  lotSizeAcres: number | null
  yearBuilt: number | null
  garageSpaces: number | null
  hoa: number | null
  taxes: number | null
  dom: number | null
  status: string | null
  propertyType: string | null
  photoUrl: string | null
  latitude: number | null
  longitude: number | null
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

type RowDef = { label: string; key: keyof CompareListingData; format?: (v: unknown) => string; best?: 'low' | 'high' }

// best-in-class highlighting is restricted to rows where "best" is objective
// for every buyer: lowest price, lowest $/sqft, highest sqft, lowest HOA,
// lowest taxes, newest year built. Beds/baths/lot size/days-on-market are
// subjective (more bedrooms or a slower sale is not objectively "better" for
// every buyer) and carry no `best` direction, so they are never highlighted
// (2026-08-27 audit: the contract's "best-in-class highlighting" claim).
const rows: RowDef[] = [
  { label: 'Price', key: 'price', format: (v) => fmtPrice(v as number), best: 'low' },
  { label: 'Beds', key: 'beds', format: (v) => fmt(v as number) },
  { label: 'Baths', key: 'baths', format: (v) => fmt(v as number) },
  { label: 'Sq Ft', key: 'sqft', format: (v) => fmt(v as number), best: 'high' },
  { label: 'Price/Sq Ft', key: 'price', format: () => '', best: 'low' }, // computed below
  { label: 'Lot (acres)', key: 'lotSizeAcres', format: (v) => (v != null ? (v as number).toFixed(2) : '—') },
  { label: 'Year Built', key: 'yearBuilt', format: (v) => (v != null ? String(v) : '—'), best: 'high' },
  { label: 'Garage', key: 'garageSpaces', format: (v) => fmt(v as number) },
  { label: 'HOA/mo', key: 'hoa', format: (v) => fmtPrice(v as number), best: 'low' },
  { label: 'Taxes/yr', key: 'taxes', format: (v) => fmtPrice(v as number), best: 'low' },
  {
    label: 'Days on Market',
    key: 'dom',
    // 0 is "listed today", not a figure that reads as missing data (2026-08-27 audit).
    format: (v) => (v === 0 ? 'Listed today' : fmt(v as number)),
  },
  { label: 'Status', key: 'status', format: (v) => (v as string) ?? '—' },
  {
    label: 'Type',
    key: 'propertyType',
    // Never the raw MLS letter: 'A' is a mixed bucket (MARKET_TRUTH D1) and a
    // consumer-facing table printed it verbatim until the 2026-08-27 audit.
    format: (v) => {
      const raw = (v as string) ?? ''
      const MLS_TYPE: Record<string, string> = {
        A: 'Residential',
        B: 'Multifamily',
        C: 'Multifamily',
        D: 'Manufactured',
        E: 'Land',
        F: 'Commercial',
        G: 'Farm and ranch',
        H: 'Business',
      }
      return MLS_TYPE[raw] ?? (raw || '—')
    },
  },
  { label: 'Community', key: 'subdivision', format: (v) => (v as string) ?? '—' },
]

/**
 * Every index that holds the best value for a row, not just the first one
 * found — a tie (two homes at the identical lowest price) marks BOTH cells.
 * A missing value is never a candidate, so a row where only one listing
 * published the figure marks that listing alone and every em-dash stays
 * unmarked (2026-08-27 audit: "Ties: mark all tied cells. Missing values
 * never win.").
 */
function bestIndexSet(listings: CompareListingData[], key: keyof CompareListingData, direction: 'low' | 'high'): Set<number> {
  const numericCount = listings.filter((l) => typeof l[key] === 'number').length
  // Need at least two published values to have a "best" at all.
  if (numericCount < 2) return new Set()
  let bestVal: number | null = null
  listings.forEach((l) => {
    const v = l[key]
    if (typeof v !== 'number') return
    if (bestVal == null || (direction === 'low' ? v < bestVal : v > bestVal)) {
      bestVal = v
    }
  })
  const winners = new Set<number>()
  listings.forEach((l, i) => {
    const v = l[key]
    if (typeof v === 'number' && v === bestVal) winners.add(i)
  })
  return winners
}

export default function CompareClient({
  listings,
  unresolvedIds = [],
  hasQueryIds = true,
  dataUpdatedAt = null,
}: {
  listings: CompareListingData[]
  unresolvedIds?: string[]
  /**
   * Whether the page's ?ids= param carried at least one id. When it did NOT,
   * the page already rendered V3Quiet's #compare-empty state (heading, prose,
   * "Search homes" exit) — this component must not repeat that same ask with
   * a second label ("Browse Homes") for one empty-page-load case (2026-08-27
   * audit: the empty state shipped twice). This component keeps its own
   * empty rendering only for the two cases V3Quiet does not cover: a
   * transient client-side redirect from locally-stored comparisonItems, and
   * a real ?ids= that resolved to zero listings (every id was stale).
   */
  hasQueryIds?: boolean
  /** Newest MLS modification timestamp across the compared listings, for the V3SourceLine stamp. */
  dataUpdatedAt?: string | null
}) {
  const { comparisonItems, removeFromComparison } = useComparison()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    if (listings.length > 0) return
    if (comparisonItems.length === 0) return
    const currentIds = (searchParams?.get('ids') ?? '').trim()
    const nextIds = comparisonItems.join(',')
    if (currentIds === nextIds || !nextIds) return
    router.replace(`/compare?ids=${encodeURIComponent(nextIds)}`)
  }, [comparisonItems, listings.length, router, searchParams])

  const handleShare = () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    navigator.clipboard?.writeText(url)
    trackEvent('compare_share', { count: listings.length })
  }

  const handleDownloadPdf = async () => {
    setPdfLoading(true)
    trackEvent('compare_pdf_download', { count: listings.length })
    try {
      const res = await fetch('/api/pdf/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingIds: listings.map((l) => l.listingKey) }),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'property-comparison.pdf'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      // Silent fail — user can retry
    } finally {
      setPdfLoading(false)
    }
  }

  const handleRemove = (key: string) => {
    removeFromComparison(key)
  }

  if (listings.length === 0) {
    if (comparisonItems.length > 0) {
      // Transient: a locally-stored comparison list is redirecting this page
      // to its own ?ids=. Neither V3Quiet's "no ids" copy nor a "Browse
      // Homes" CTA applies here — it is not empty, it is loading.
      return (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">Loading your selected homes...</p>
        </div>
      )
    }
    if (!hasQueryIds) {
      // The page already rendered V3Quiet's #compare-empty state (the one
      // "Search homes" ask) directly above this section. A second empty
      // state here would be the duplicate the 2026-08-27 audit flagged.
      return null
    }
    // ids were given but none resolved (every home is off-market or the id
    // was stale) — distinct from the "no ids" case, so its own message.
    return (
      <div className="py-20 text-center">
        <H2 className="text-2xl text-primary mb-4">No Listings to Compare</H2>
        <p className="text-muted-foreground mb-6">
          None of the homes you added could be found. They may be off-market.
        </p>
        <Button asChild>
          <Link href="/homes-for-sale">
            Browse Homes
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <H1 className="text-2xl sm:text-3xl text-primary">Compare Properties</H1>
          <p className="text-muted-foreground mt-1">{listings.length} {listings.length === 1 ? 'property' : 'properties'} selected</p>
          {unresolvedIds.length > 0 ? (
            <p className="text-muted-foreground mt-1 text-sm">
              {unresolvedIds.length === 1
                ? `One home you added (${unresolvedIds[0]}) is no longer available to compare and was left out.`
                : `${unresolvedIds.length} homes you added (${unresolvedIds.join(', ')}) are no longer available to compare and were left out.`}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleShare}
            variant="outline"
            size="sm"
          >
            <HugeiconsIcon icon={LinkSquare01Icon} className="h-4 w-4" />
            Copy Link
          </Button>
          <Button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            size="sm"
          >
            <HugeiconsIcon icon={Download01Icon} className="h-4 w-4" />
            {pdfLoading ? 'Generating…' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* Photo row */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `repeat(${listings.length}, minmax(0, 1fr))` }}>
        {listings.map((l) => (
          <div key={l.listingKey} className="relative rounded-lg overflow-hidden bg-muted aspect-[4/3]">
            {l.photoUrl ? (
              <Image src={l.photoUrl} alt={l.address} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No Photo</div>
            )}
            <Button
              type="button"
              onClick={() => handleRemove(l.listingKey)}
              className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground/50 text-primary-foreground hover:bg-foreground/70 transition-colors"
              aria-label={`Remove ${l.address} from comparison`}
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
            </Button>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-foreground/70 to-transparent p-3">
              <Link href={listingDetailPath(l.listingKey, { city: l.city, state: l.state, postalCode: l.postalCode })} className="text-primary-foreground text-sm font-semibold hover:underline line-clamp-2">
                {l.address}
              </Link>
              <p className="text-primary-foreground/90 text-lg font-bold mt-0.5">{fmtPrice(l.price)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="w-full text-sm">
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="sticky left-0 bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feature</TableHead>
              {listings.map((l) => (
                <TableHead key={l.listingKey} className="px-4 py-3 text-left text-xs font-semibold text-primary min-w-[140px]">
                  {l.address.split(',')[0]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, ri) => {
              const isPricePerSqft = row.label === 'Price/Sq Ft'
              // Price/Sq Ft is derived (price ÷ sqft), not a stored field, so it
              // gets its own rounded-value best-set — compared on the same
              // whole-dollar figure the cell displays, so a tie in the rendered
              // text is always a tie in the highlight too.
              const ppsfByIndex = listings.map((l) => (l.price != null && l.sqft ? Math.round(l.price / l.sqft) : null))
              const ppsfBest = (() => {
                const valid = ppsfByIndex.filter((v): v is number => v != null)
                if (valid.length < 2) return new Set<number>()
                const min = Math.min(...valid)
                const winners = new Set<number>()
                ppsfByIndex.forEach((v, i) => {
                  if (v === min) winners.add(i)
                })
                return winners
              })()
              const bestSet = isPricePerSqft
                ? ppsfBest
                : row.best
                  ? bestIndexSet(listings, row.key, row.best)
                  : new Set<number>()

              return (
                <TableRow key={row.label} className={ri % 2 === 0 ? 'bg-card' : 'bg-muted/50'}>
                  <TableCell className="sticky left-0 bg-inherit px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{row.label}</TableCell>
                  {listings.map((l, i) => {
                    let value: string
                    const isBest = bestSet.has(i)

                    if (isPricePerSqft) {
                      const ppsf = ppsfByIndex[i]
                      value = ppsf != null ? `$${ppsf.toLocaleString()}` : '—'
                    } else {
                      value = row.format ? row.format(l[row.key]) : String(l[row.key] ?? '—')
                    }

                    return (
                      <TableCell
                        key={l.listingKey}
                        className={[
                          'px-4 py-2.5 text-primary',
                          isBest ? 'font-semibold text-success' : '',
                        ].join(' ')}
                      >
                        <span className="flex items-center gap-1">
                          {value}
                          {isBest && (
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3.5 w-3.5 text-success flex-shrink-0" />
                          )}
                        </span>
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <V3SourceLine
        className="mt-2"
        source="Oregon Data Share (MLS), live listing tiles and detail records"
        updatedAt={dataUpdatedAt}
      />

      {/* Map */}
      {listings.some((l) => l.latitude && l.longitude) && (
        <div className="mt-8">
          <H3 className="text-lg text-primary mb-3">Locations</H3>
          <div className="rounded-lg overflow-hidden border border-border h-[300px] sm:h-[400px]">
            {/* Google Static Map with pins */}
            {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
              <iframe
                title="Comparison map"
                className="w-full h-full border-0"
                loading="lazy"
                src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${listings.filter((l) => l.latitude && l.longitude).map((l) => `${l.latitude},${l.longitude}`).join('|')}&zoom=11`}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted text-muted-foreground text-sm">
                Map unavailable. Configure Google Maps API key.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
