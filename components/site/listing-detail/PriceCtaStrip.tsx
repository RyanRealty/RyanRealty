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
import { redirectToLoginForSave } from '@/lib/pending-save'
import { useResumePendingSave } from '@/lib/hooks/useResumePendingSave'
import type { ListingDetail } from '@/lib/data/types/listing'
import { publishListingDrop, publishListingHistoryPrices, publishListingSaleAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind, publishListingSharePricePerSqft } from '@/lib/listing/publish-listing-share'
import { publishWholePropertyAmount } from '@/lib/listing/publish-listing-figure'
import { listingContactHref, publishListingContactKey } from '@/lib/listing/publish-listing-contact-key'
import { publishStreetLine } from '@/lib/listing/publish-street-line'

/**
 * PriceCtaStrip — price + address + pill row + CTA hierarchy under the hero.
 *
 * Hierarchy (E4 craft):
 *   1. Price (Layer A H1, address in sr-only + visible lines) — honest MLS numbers only
 *   2. Primary: Schedule a tour (navy-filled, full-width on mobile)
 *   3. Secondary: Ask / Save / Share (outlined, 44px hit targets)
 *   4. Tertiary: Get alerts for homes like this → #listing-like-alerts
 *
 * Spec source:
 *   design_system/ryan-realty/ui_kits/listing-detail/index.html §ld-price-block
 *   design_system/ryan-realty/ui_kits/listing-detail/parity.json "PriceCtaStrip"
 */

type SaveState = 'idle' | 'saving' | 'saved'

type Props = {
  listing: Pick<
    ListingDetail,
    | 'listingKey'
    | 'listNumber'
    | 'listPrice'
    | 'closePrice'
    | 'closeDate'
    | 'status'
    | 'dom'
    | 'pricePerSqft'
    | 'propertySubType'
    | 'propertyType'
    | 'streetNumber'
    | 'streetName'
    | 'streetSuffix'
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
  /** Prices already on the listing-history rail. Drop withholds without them. */
  historyPrices?: ReadonlyArray<number | null | undefined>
  /** History rows from the listing rail. Mapped to prices when historyPrices is omitted. */
  history?: ReadonlyArray<{ price?: number | null } | null | undefined> | null
  className?: string
}

// KB pill registry. Brutalist navy-on-cream chips: a filled navy chip for
// the live/active states (the strongest visual weight), a cream chip with a
// 2px navy edge for everything else. `filled` flips the chip to navy ground.
const PILL_TONE: Record<string, { filled: boolean }> = {
  Active: { filled: true },
  'Active Under Contract': { filled: false },
  Pending: { filled: true },
  Closed: { filled: false },
  Withdrawn: { filled: false },
  Expired: { filled: false },
  Canceled: { filled: false },
}

export function PriceCtaStrip({
  listing,
  onSave,
  initialSaved = false,
  onShare,
  scheduleHref,
  askHref,
  historyPrices,
  history,
  className,
}: Props) {
  const railPrices =
    historyPrices ?? (history !== undefined ? publishListingHistoryPrices(history) : undefined)
  const [saveState, setSaveState] = useState<SaveState>(initialSaved ? 'saved' : 'idle')

  // RC7 resume: complete a save this listing was bounced to login for (the hook
  // owns the idempotent save + re-stash; this is the detail page's real save CTA).
  useResumePendingSave({
    listingKey: listing.listingKey,
    alreadySaved: saveState === 'saved',
    onSaved: () => setSaveState('saved'),
  })

  const isClosed = listing.status === 'Closed'
  const publishedAsk = publishListingSaleAsk({
    price: isClosed ? listing.closePrice : listing.listPrice,
    propertyType: listing.propertyType,
  })
  const headlinePrice = publishedAsk?.ask ?? null
  const shareKind = publishListingShareKind(listing.propertySubType)
  // The alert this strip points at bands on the whole-home price, so the copy
  // may promise a price band only when one exists. 735 Purcell (a commercial
  // sublease publishing no price) and MLS 220190868 (a $1 fractional interest)
  // both read "…lists in this city near this price" over a band built from a
  // rent rate and a share.
  const alertBandIsPublished =
    publishWholePropertyAmount({
      price: isClosed ? listing.closePrice : listing.listPrice,
      propertyType: listing.propertyType,
      propertySubType: listing.propertySubType,
    }) != null
  const publishedPpsf = publishListingSharePricePerSqft({
    propertyType: listing.propertyType,
    propertySubType: listing.propertySubType,
    pricePerSqft: listing.pricePerSqft,
  })
  const publishedDrop = isClosed
    ? null
    : publishListingDrop({
        listPrice: listing.listPrice,
        originalListPrice: listing.originalListPrice,
        historyPrices: railPrices,
      })
  const contactKey = publishListingContactKey({
    listNumber: listing.listNumber,
    listingKey: listing.listingKey,
  })
  const street = publishStreetLine({ streetNumber: listing.streetNumber, streetName: listing.streetName, streetSuffix: listing.streetSuffix }) ?? ''
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

  // Accessible names for the Save + Share controls. The visible labels are bare
  // verbs ("Save", "Share"), so a screen-reader visitor heard an action with no
  // object and no state. Name the property and reflect saved vs not, matching
  // components/listing/SaveListingButton.tsx ("Save to saved homes" /
  // "Remove from saved homes") with the address added.
  const propertyName = street || 'this home'
  const saveAriaLabel =
    saveState === 'saved'
      ? `Remove ${propertyName} from your saved homes`
      : saveState === 'saving'
        ? `Saving ${propertyName} to your saved homes`
        : `Save ${propertyName} to your saved homes`

  const tourHref =
    scheduleHref ?? listingContactHref(contactKey, 'tour') ?? `/contact?intent=tour`
  const askHrefResolved =
    askHref ?? listingContactHref(contactKey, 'question') ?? `/contact?intent=question`

  async function handleSave() {
    if (!onSave || saveState === 'saving') return
    setSaveState('saving')
    try {
      const res = await onSave(listing.listingKey)
      if (res.needsAuth) {
        // Signed-out: stash the intent + send them to sign in (and back), so the
        // save→account capture path completes itself on return (RC7).
        redirectToLoginForSave(listing.listingKey) // hydration-safe: click handler only
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
        paddingTop: '1.25rem',
      }}
    >
      {/* Layer A: one H1. Visible price is the money signal; address names it
          for screen readers. Do not poetry-rewrite this shell. */}
      <DisplayHeading
        as="h1"
        className="text-4xl leading-none tracking-tight sm:text-5xl"
        style={{ color: 'var(--navy)' }}
      >
        {street ? <span className="sr-only">{[street, cityWithCommunity].filter(Boolean).join(', ')} </span> : null}
        <Price value={headlinePrice} exact />
      </DisplayHeading>
      {street ? (
        <div className="mt-1.5 text-lg font-medium sm:text-xl" style={{ color: 'var(--navy)' }}>
          {street}
        </div>
      ) : null}
      {cityWithCommunity ? (
        <div className="mt-0.5 text-sm" style={{ color: 'rgba(16,39,66,0.72)' }}>
          {cityWithCommunity}
        </div>
      ) : null}

      {publishedDrop ? (
        <div className="mt-2 text-sm" style={{ color: 'rgba(16,39,66,0.72)' }}>
          Down <Price value={publishedDrop.drop} exact /> from original list price{' '}
          <span style={{ color: 'rgba(16,39,66,0.72)' }}>
            <Price value={publishedDrop.original} exact className="line-through" />
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
          <span aria-hidden>●</span>{' '}
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
        {shareKind ? <Pill kind="dom">{shareKind}</Pill> : null}
        {publishedPpsf != null ? (
          <Pill kind="psqft">
            <Price value={publishedPpsf} exact />/sqft
          </Pill>
        ) : null}
      </div>

      {/* CTA hierarchy: primary full-width on mobile, secondaries even 3-col.
          Desktop keeps the inline wrap. */}
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-stretch">
        <a
          href={tourHref}
          className="btn alt w-full text-center sm:w-auto"
          style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          Schedule a tour <span className="arr">→</span>
        </a>
        <div className="grid grid-cols-3 gap-2.5 sm:contents">
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
            aria-label={saveAriaLabel}
          >
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            className="btn"
            style={OUTLINE_BTN_STYLE}
            onClick={handleShare}
            aria-label={`Share ${propertyName}`}
          >
            Share
          </button>
        </div>
      </div>

      {/* Alert path: full-width outline control (was text link only — too easy to
          miss vs Tour/Ask/Save). Jumps to B1 #listing-like-alerts capture. */}
      <a
        href="#listing-like-alerts"
        className="btn mt-3 w-full text-center sm:w-auto"
        style={OUTLINE_BTN_STYLE}
        aria-label="Get free email alerts for homes like this"
      >
        Get free alerts for homes like this <span className="arr">→</span>
      </a>
      <p className="mt-2 text-xs" style={{ color: 'rgba(16,39,66,0.72)' }}>
        {alertBandIsPublished
          ? 'Free email when a new home lists in this city near this price. Unsubscribe any time.'
          : 'Free email when a new home lists in this city. Unsubscribe any time.'}
      </p>
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
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
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
        border: `2px solid ${navy}`,
        background: filled ? navy : 'transparent',
        color: filled ? cream : navy,
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
