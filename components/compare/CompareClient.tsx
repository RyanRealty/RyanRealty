'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useComparison } from '@/contexts/ComparisonContext'
import { trackEvent } from '@/lib/tracking'
import { HugeiconsIcon } from '@hugeicons/react'
import { LinkSquare01Icon, Cancel01Icon, Download01Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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

const rows: RowDef[] = [
  { label: 'Price', key: 'price', format: (v) => fmtPrice(v as number), best: 'low' },
  { label: 'Beds', key: 'beds', format: (v) => fmt(v as number), best: 'high' },
  { label: 'Baths', key: 'baths', format: (v) => fmt(v as number), best: 'high' },
  { label: 'Sq Ft', key: 'sqft', format: (v) => fmt(v as number), best: 'high' },
  { label: 'Price/Sq Ft', key: 'price', format: () => '', best: 'low' }, // computed below
  { label: 'Lot (acres)', key: 'lotSizeAcres', format: (v) => (v != null ? (v as number).toFixed(2) : '—'), best: 'high' },
  { label: 'Year Built', key: 'yearBuilt', format: (v) => (v != null ? String(v) : '—'), best: 'high' },
  { label: 'Garage', key: 'garageSpaces', format: (v) => fmt(v as number) },
  { label: 'HOA/mo', key: 'hoa', format: (v) => fmtPrice(v as number), best: 'low' },
  { label: 'Taxes/yr', key: 'taxes', format: (v) => fmtPrice(v as number), best: 'low' },
  { label: 'Days on Market', key: 'dom', format: (v) => fmt(v as number), best: 'low' },
  { label: 'Status', key: 'status', format: (v) => (v as string) ?? '—' },
  { label: 'Type', key: 'propertyType', format: (v) => (v as string) ?? '—' },
  { label: 'Community', key: 'subdivision', format: (v) => (v as string) ?? '—' },
]

function bestIndex(listings: CompareListingData[], key: keyof CompareListingData, direction: 'low' | 'high'): number | null {
  let bestIdx: number | null = null
  let bestVal: number | null = null
  listings.forEach((l, i) => {
    const v = l[key]
    if (typeof v !== 'number' || v == null) return
    if (bestVal == null || (direction === 'low' ? v < bestVal : v > bestVal)) {
      bestVal = v
      bestIdx = i
    }
  })
  return bestIdx
}

export default function CompareClient({ listings }: { listings: CompareListingData[] }) {
  const { removeFromComparison, clearComparison } = useComparison()
  const [pdfLoading, setPdfLoading] = useState(false)

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
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold text-primary mb-4">No Listings to Compare</h1>
        <p className="text-muted-foreground mb-6">Add listings from the search page to compare them side by side.</p>
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
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Compare Properties</h1>
          <p className="text-muted-foreground mt-1">{listings.length} {listings.length === 1 ? 'property' : 'properties'} selected</p>
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
              className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label={`Remove ${l.address} from comparison`}
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
            </Button>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <Link href={`/listing/${encodeURIComponent(l.listingKey)}`} className="text-white text-sm font-semibold hover:underline line-clamp-2">
                {l.address}
              </Link>
              <p className="text-white/90 text-lg font-bold mt-0.5">{fmtPrice(l.price)}</p>
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
              const best = row.best ? bestIndex(listings, row.key, row.best) : null
              const isPricePerSqft = row.label === 'Price/Sq Ft'

              return (
                <TableRow key={row.label} className={ri % 2 === 0 ? 'bg-card' : 'bg-muted/50'}>
                  <TableCell className="sticky left-0 bg-inherit px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{row.label}</TableCell>
                  {listings.map((l, i) => {
                    let value: string
                    let isBest = false

                    if (isPricePerSqft) {
                      const ppsf = l.price && l.sqft ? Math.round(l.price / l.sqft) : null
                      value = ppsf != null ? `$${ppsf.toLocaleString()}` : '—'
                      // Compute best for price/sqft separately
                      const ppsfValues = listings.map((ll) => (ll.price && ll.sqft ? ll.price / ll.sqft : null))
                      const validPpsf = ppsfValues.filter((v): v is number => v != null)
                      if (validPpsf.length > 1 && ppsf != null) {
                        const minPpsf = Math.min(...validPpsf)
                        isBest = ppsf === minPpsf
                      }
                    } else {
                      value = row.format ? row.format(l[row.key]) : String(l[row.key] ?? '—')
                      isBest = best === i && listings.filter((ll) => ll[row.key] != null).length > 1
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

      {/* Map */}
      {listings.some((l) => l.latitude && l.longitude) && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-primary mb-3">Locations</h2>
          <div className="rounded-lg overflow-hidden border border-border h-[300px] sm:h-[400px]">
            {/* Google Static Map with pins */}
            {process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ? (
              <iframe
                title="Comparison map"
                className="w-full h-full border-0"
                loading="lazy"
                src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&q=${listings.filter((l) => l.latitude && l.longitude).map((l) => `${l.latitude},${l.longitude}`).join('|')}&zoom=11`}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted text-muted-foreground text-sm">
                Map unavailable — configure Google Maps API key
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
