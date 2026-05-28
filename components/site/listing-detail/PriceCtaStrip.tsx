'use client'

import { useState } from 'react'
import {
  CTAButton,
  DisplayHeading,
  MiddleDot,
  Price,
  TabularNumber,
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import type { ListingDetail } from '@/lib/data/types/listing'

/**
 * PriceCtaStrip — the price + address + pill row + 4-button CTA row
 * directly under the photo hero.
 *
 * Spec source:
 *   design_system/ryan-realty/ui_kits/listing-detail/index.html §ld-price-block
 *   design_system/ryan-realty/ui_kits/listing-detail/parity.json "PriceCtaStrip"
 *
 * Replaces the simpler PriceBlock. Three-pill row carries the
 * fundamentals (status · DOM · $/sqft); the 4-button CTA row carries
 * the conversion actions (Schedule a tour, Ask a question, Save,
 * Share). Save + Share are client-side actions per the mockup; this
 * scaffold wires the UI + onClick handlers, persistence ties in via
 * Wave 3 callbacks the page passes through.
 *
 * Per CLAUDE.md brand voice — no banned tokens, sentence-case labels,
 * Amboqia on the price headline (DisplayHeading).
 */

type SaveState = 'idle' | 'saving' | 'saved'

type Props = {
  listing: Pick<
    ListingDetail,
    | 'listingKey'
    | 'listPrice'
    | 'closePrice'
    | 'closeDate'
    | 'status'
    | 'dom'
    | 'pricePerSqft'
    | 'streetNumber'
    | 'streetName'
    | 'city'
    | 'postalCode'
    | 'subdivisionName'
    | 'originalListPrice'
    | 'priceDropCount'
  >
  /** Save handler — caller wires to saved_listings table (or local store). */
  onSave?: (listingKey: string) => Promise<{ saved: boolean }>
  /** Initial saved state, hydrated by the server. */
  initialSaved?: boolean
  /** Share handler — caller wires to Web Share API or fallback toast. */
  onShare?: (listingKey: string) => void
  /** Override the default contact-tour href. */
  scheduleHref?: string
  /** Override the default ask-question href. */
  askHref?: string
  className?: string
}

const PILL_TONE = {
  Active: 'bg-success/12 text-[oklch(0.35_0.15_149)] border-success/25',
  'Coming Soon': 'bg-warning/15 text-foreground border-warning/25',
  'Active Under Contract': 'bg-warning/15 text-foreground border-warning/25',
  Pending: 'bg-primary text-white border-transparent',
  Closed: 'bg-muted text-foreground border-border',
  Withdrawn: 'bg-muted text-foreground border-border',
  Expired: 'bg-muted text-foreground border-border',
  Canceled: 'bg-muted text-foreground border-border',
} as const

function statusDot(status: string): string {
  if (status === 'Active' || status === 'Coming Soon') return '●'
  if (status === 'Active Under Contract' || status === 'Pending') return '●'
  return '●'
}

export function PriceCtaStrip({
  listing,
  onSave,
  initialSaved = false,
  onShare,
  scheduleHref,
  askHref,
  className,
}: Props) {
  const [saveState, setSaveState] = useState<SaveState>(initialSaved ? 'saved' : 'idle')

  const isClosed = listing.status === 'Closed'
  const headlinePrice = isClosed ? listing.closePrice : listing.listPrice
  const street = [listing.streetNumber, listing.streetName].filter(Boolean).join(' ').trim()
  const cityLine = [listing.city ? `${listing.city}, OR` : null, listing.postalCode]
    .filter(Boolean)
    .join(' ')
  // MLS feeds mask private fields with `********`; treat that as
  // "no subdivision" rather than rendering asterisks in the address.
  const cleanSubdivision =
    listing.subdivisionName && !listing.subdivisionName.startsWith('***')
      ? listing.subdivisionName
      : null
  const cityWithCommunity = cleanSubdivision
    ? [cityLine, cleanSubdivision].filter(Boolean).join(' · ')
    : cityLine

  const drop =
    listing.listPrice != null &&
    listing.originalListPrice != null &&
    listing.originalListPrice > listing.listPrice
      ? listing.originalListPrice - listing.listPrice
      : null

  const tourHref =
    scheduleHref ?? `/contact?listingKey=${encodeURIComponent(listing.listingKey)}`
  const askHrefResolved =
    askHref ?? `/contact?listingKey=${encodeURIComponent(listing.listingKey)}&intent=question`

  async function handleSave() {
    if (!onSave || saveState === 'saving') return
    setSaveState('saving')
    try {
      const { saved } = await onSave(listing.listingKey)
      setSaveState(saved ? 'saved' : 'idle')
    } catch {
      setSaveState('idle')
    }
  }

  function handleShare() {
    if (onShare) {
      onShare(listing.listingKey)
      return
    }
    // Default: Web Share API with same-origin fallback to copy.
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const title = street || `Listing ${listing.listingKey}`
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: Navigator['share'] }) : null
    if (nav?.share) {
      nav.share({ title, url }).catch(() => {
        if (nav.clipboard) {
          nav.clipboard.writeText(url).catch(() => {})
        }
      })
      return
    }
    if (nav?.clipboard) {
      nav.clipboard.writeText(url).catch(() => {})
    }
  }

  return (
    <div className={cn('border-b border-border pb-5 pt-6', className)}>
      <DisplayHeading
        as="h1"
        className="text-foreground text-[clamp(2.2rem,4vw,2.75rem)] leading-none tracking-[-0.02em]"
      >
        <Price value={headlinePrice} />
      </DisplayHeading>
      {street ? (
        <div className="mt-1 text-[18px] text-foreground">{street}</div>
      ) : null}
      {cityWithCommunity ? (
        <div className="mt-0.5 text-sm text-muted-foreground">{cityWithCommunity}</div>
      ) : null}

      {drop ? (
        <div className="mt-2 text-[13px] text-muted-foreground">
          Down <Price value={drop} /> from original list price{' '}
          <Price
            value={listing.originalListPrice}
            className="line-through text-muted-foreground/70"
          />
          {listing.priceDropCount && listing.priceDropCount > 1 ? (
            <> after {listing.priceDropCount} price changes.</>
          ) : (
            <>.</>
          )}
        </div>
      ) : null}

      <div className="mt-3.5 flex flex-wrap gap-2">
        <Pill kind={listing.status}>
          <span aria-hidden>{statusDot(listing.status)}</span>{' '}
          {isClosed && listing.closeDate
            ? `Closed ${new Date(listing.closeDate).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}`
            : listing.status}
        </Pill>
        {listing.dom != null ? (
          <Pill kind="dom">
            <TabularNumber value={listing.dom} /> days on market
          </Pill>
        ) : null}
        {listing.pricePerSqft != null ? (
          <Pill kind="psqft">
            <Price value={Math.round(listing.pricePerSqft)} compact />/sqft
          </Pill>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <CTAButton href={tourHref} tone="primary" size="lg">
          Schedule a tour
        </CTAButton>
        <CTAButton href={askHrefResolved} tone="outline" size="lg">
          Ask a question
        </CTAButton>
        <CTAButton
          tone="outline"
          size="lg"
          onClick={handleSave}
          disabled={saveState === 'saving'}
          aria-pressed={saveState === 'saved'}
        >
          {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : 'Save'}
        </CTAButton>
        <CTAButton tone="outline" size="lg" onClick={handleShare}>
          Share
        </CTAButton>
      </div>
    </div>
  )
}

function Pill({
  kind,
  children,
}: {
  kind: keyof typeof PILL_TONE | 'dom' | 'psqft'
  children: React.ReactNode
}) {
  let cls: string
  if (kind === 'dom') {
    cls = 'bg-muted text-foreground border-border'
  } else if (kind === 'psqft') {
    cls = 'bg-primary/8 text-primary border-primary/20'
  } else {
    cls = (PILL_TONE as Record<string, string>)[kind] ?? 'bg-muted text-foreground border-border'
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-[5px] text-xs font-semibold tabular-nums',
        cls,
      )}
    >
      {children}
    </span>
  )
}

// Silence unused import warning — MiddleDot is part of the v2 type
// surface used inside the subdivision separator (we currently use a
// plain ' · ' string for the city line; keeping the import for the
// future when we move to <MiddleDot /> for tabular precision).
void MiddleDot
