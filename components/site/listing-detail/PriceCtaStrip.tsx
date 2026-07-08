'use client'

import { useState } from 'react'
import {
  DisplayHeading,
  MiddleDot,
  Price,
  TabularNumber,
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import { displaySubdivision } from '@/lib/slug'
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
  /** Save handler — caller wires to saved_listings table. Returns needsAuth=true
   *  for a signed-out visitor so the strip can route them to sign-in. */
  onSave?: (listingKey: string) => Promise<{ saved: boolean; needsAuth?: boolean }>
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

// KB pill registry. Brutalist navy-on-cream chips: a filled navy chip for
// the live/active states (the strongest visual weight), a cream chip with a
// 2px navy edge for everything else. `filled` flips the chip to navy ground.
const PILL_TONE: Record<string, { filled: boolean }> = {
  Active: { filled: true },
  'Coming Soon': { filled: true },
  'Active Under Contract': { filled: false },
  Pending: { filled: true },
  Closed: { filled: false },
  Withdrawn: { filled: false },
  Expired: { filled: false },
  Canceled: { filled: false },
}

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
  // MLS feeds mask private fields with `********` and stamp absent ones as
  // "N/A"; displaySubdivision() collapses every such sentinel to null so the
  // address never renders "Bend, OR 97703 · N/A".
  const cleanSubdivision = displaySubdivision(listing.subdivisionName)
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
    scheduleHref ?? `/contact?listingKey=${encodeURIComponent(listing.listingKey)}&intent=tour`
  const askHrefResolved =
    askHref ?? `/contact?listingKey=${encodeURIComponent(listing.listingKey)}&intent=question`

  async function handleSave() {
    if (!onSave || saveState === 'saving') return
    setSaveState('saving')
    try {
      const res = await onSave(listing.listingKey)
      if (res.needsAuth) {
        // Signed-out: send them to sign in (and back), the save→account capture path.
        const back = typeof window !== 'undefined' ? window.location.pathname : '/'
        window.location.href = `/account?signin=1&returnUrl=${encodeURIComponent(back)}`
        return
      }
      setSaveState(res.saved ? 'saved' : 'idle')
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
    <div
      className={cn(className)}
      style={{
        borderBottom: '3px solid var(--navy)',
        paddingBottom: '1.5rem',
        paddingTop: '1.5rem',
      }}
    >
      <DisplayHeading
        as="h1"
        className="text-4xl leading-none tracking-tight"
        style={{ color: 'var(--navy)' }}
      >
        <Price value={headlinePrice} />
      </DisplayHeading>
      {street ? (
        <div className="mt-1 text-lg" style={{ color: 'var(--navy)' }}>
          {street}
        </div>
      ) : null}
      {cityWithCommunity ? (
        <div className="mt-0.5 text-sm" style={{ color: 'rgba(16,39,66,0.72)' }}>
          {cityWithCommunity}
        </div>
      ) : null}

      {drop ? (
        <div className="mt-2 text-sm" style={{ color: 'rgba(16,39,66,0.72)' }}>
          Down <Price value={drop} /> from original list price{' '}
          <span style={{ color: 'rgba(16,39,66,0.72)' }}>
            <Price value={listing.originalListPrice} className="line-through" />
          </span>
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
                timeZone: 'America/Los_Angeles',
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
            <Price value={listing.pricePerSqft} exact />/sqft
          </Pill>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {/* Primary action — navy-filled KB button (.btn.alt) on the cream strip. */}
        <a href={tourHref} className="btn alt">
          Schedule a tour <span className="arr">→</span>
        </a>
        {/* Secondary actions — outlined navy KB buttons on cream. */}
        <a href={askHrefResolved} className="btn" style={OUTLINE_BTN_STYLE}>
          Ask a question
        </a>
        <button
          type="button"
          className="btn"
          style={OUTLINE_BTN_STYLE}
          onClick={handleSave}
          disabled={saveState === 'saving'}
          aria-pressed={saveState === 'saved'}
        >
          {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="btn" style={OUTLINE_BTN_STYLE} onClick={handleShare}>
          Share
        </button>
      </div>
    </div>
  )
}

// Outlined-on-cream variant of the KB .btn. The base .btn ships a cream
// ground + cream edge (built for navy surfaces); on this cream strip we flip
// it to a transparent ground with a 2px navy edge + navy text so the
// secondary actions read as outlined brutalist chips next to the navy-filled
// primary (.btn.alt).
const OUTLINE_BTN_STYLE: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--navy)',
  borderColor: 'var(--navy)',
}

function Pill({
  kind,
  children,
}: {
  kind: keyof typeof PILL_TONE | 'dom' | 'psqft'
  children: React.ReactNode
}) {
  // dom + psqft are always quiet cream chips; status chips can flip to a
  // filled navy ground for the live/active states.
  const filled = kind === 'dom' || kind === 'psqft' ? false : (PILL_TONE[kind]?.filled ?? false)
  const navy = 'var(--navy)'
  const cream = 'var(--cream)'
  return (
    <span
      className="mono-lab"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        // Square brutalist chip — hard 2px navy edge, no rounding.
        border: `2px solid ${navy}`,
        background: filled ? navy : 'transparent',
        color: filled ? cream : navy,
        // mono-lab ships a cream tone for dark surfaces; force the on-cream values.
        padding: '5px 11px',
        fontSize: '0.62rem',
        letterSpacing: '0.14em',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}
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
