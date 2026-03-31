'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthModal from '@/components/auth/AuthModal'
import { trackEvent } from '@/lib/tracking'
import { listingDetailPath, listingsBrowsePath } from '@/lib/slug'
import { Button } from "@/components/ui/button"

type ValuationData = {
  estimatedValue: number
  valueLow: number
  valueHigh: number
  confidence: 'high' | 'medium' | 'low'
  compCount: number
  methodology: string
}

type Props = {
  listingKey: string
  propertyId: string
  valuation: ValuationData
  signedIn: boolean
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function ListingValuation({ listingKey, propertyId, valuation, signedIn }: Props) {
  const [authOpen, setAuthOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!signedIn) {
      setAuthOpen(true)
      return
    }
    setDownloading(true)
    try {
      const res = await fetch('/api/pdf/cma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? res.statusText)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cma-${listingKey.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      trackEvent('cma_downloaded', { listing_key: listingKey, property_id: propertyId })
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  const confidenceColor =
    valuation.confidence === 'high'
      ? 'text-success bg-success/15'
      : valuation.confidence === 'medium'
        ? 'text-warning bg-warning/15'
        : 'text-muted-foreground bg-muted'

  return (
    <section className="mb-8 rounded-lg border border-border bg-card p-6 shadow-sm" aria-labelledby="valuation-heading">
      <h2 id="valuation-heading" className="mb-4 text-lg font-semibold text-foreground">
        Estimated Value
      </h2>
      <p className="text-2xl font-bold text-primary">
        {formatPrice(valuation.estimatedValue)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Range: {formatPrice(valuation.valueLow)} — {formatPrice(valuation.valueHigh)}
      </p>
      <span
        className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${confidenceColor}`}
      >
        {valuation.confidence.charAt(0).toUpperCase() + valuation.confidence.slice(1)} confidence
      </span>
      <p className="mt-3 text-sm text-muted-foreground">
        Based on {valuation.compCount} comparable sale{valuation.compCount !== 1 ? 's' : ''} nearby.
      </p>
      <Link
        href={listingsBrowsePath()}
        className="mt-2 inline-block text-sm text-accent-foreground hover:underline"
      >
        How we calculate value
      </Link>
      <div className="mt-4">
        <Button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-accent/90 disabled:opacity-70"
        >
          {downloading ? 'Preparing…' : 'Download Full Value Report'}
        </Button>
        {!signedIn && (
          <p className="mt-2 text-xs text-muted-foreground">
            Sign in to download the full CMA PDF (lead magnet).
          </p>
        )}
      </div>
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => handleDownload()}
        next={typeof window !== 'undefined' ? window.location.pathname : listingDetailPath(listingKey)}
      />
    </section>
  )
}
