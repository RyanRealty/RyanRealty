'use client'

import { useState } from 'react'
import {
  MiddleDot,
  Price,
  TabularNumber,
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import { displaySubdivision, listingCanonicalHref } from '@/lib/slug'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { daysLiveOnMarket } from '@/lib/listing/days-live'
import { isPublicOffMarketStatus } from '@/lib/listing-status-public'
import { redirectToLoginForSave } from '@/lib/pending-save'
import { ListingGuestSaveSheet } from '@/components/site/listing-detail/ListingGuestSaveSheet.client'
import { ListingSaveButton, type ListingSaveState } from '@/components/site/listing-detail/ListingSaveButton'
import {
  ListingShareButton,
  ListingShareDialog,
} from '@/components/site/listing-detail/ListingShareButton'
import { useResumePendingSave } from '@/lib/hooks/useResumePendingSave'
import type { ListingDetail } from '@/lib/data/types/listing'
import { publishListingEstPayment } from '@/lib/listing/publish-listing-ask'
import {
  listingPublishesClosePrice,
  publishListingPublishedPrice,
  publishListingPublishedWholePropertyPrice,
} from '@/lib/listing/publish-listing-published-price'
import { publishListingHeroKeyStats } from '@/lib/listing/publish-listing-hero-stats'
import { publishListingShareKind, publishListingSharePricePerSqft } from '@/lib/listing/publish-listing-share'
import { listingContactHref, publishListingContactKey } from '@/lib/listing/publish-listing-contact-key'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { publishListingLastDrop } from '@/lib/listing/publish-listing-history'
import { publishListingListedBy } from '@/lib/listing/publish-listing-listed-by'
import { formatPriceCompact } from '@/lib/format/money'
import {
  publishListingDropMark,
  type PublishedListingDropMark,
} from '@/lib/listing/publish-listing-drop-mark'
import type { PublishedListingPillRead } from '@/lib/listing/publish-listing-pill-read'
import { ActionSwapText } from '@/components/motion/action-swap'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { PriceDropMark } from './PriceDropMark'

/**
 * PriceCtaStrip — price + address + pill row + CTA hierarchy under the hero.
 *
 * Hierarchy (E4 craft):
 *   1. Price (Layer A H1, address in sr-only + visible lines) — honest MLS numbers only
 *   2. Primary: Tour — the one ask beside the price (Matt / Critiquito
 *      2026-09-19). Call / Text live in Work with us / the agent card, not
 *      as equal verbs here or on a sticky bar.
 *   3. Secondary: Save / Share — always mounted (SITE-21 / SITE-99).
 *   4. Tertiary: Get alerts for homes like this → #listing-like-alerts
 *
 * Spec source:
 *   design_system/ryan-realty/ui_kits/listing-detail/index.html §ld-price-block
 *   design_system/ryan-realty/ui_kits/listing-detail/parity.json "PriceCtaStrip"
 */

type Props = {
  listing: Pick<
    ListingDetail,
    | 'listingKey'
    | 'listNumber'
    | 'onMarketDate'
    | 'listPrice'
    | 'closePrice'
    | 'closeDate'
    | 'status'
    | 'dom'
    | 'pricePerSqft'
    | 'propertySubType'
    | 'propertyType'
    | 'streetNumber'
    | 'streetDirPrefix'
    | 'streetName'
    | 'streetSuffix'
    | 'streetDirSuffix'
    | 'city'
    | 'postalCode'
    | 'subdivisionName'
    | 'originalListPrice'
    | 'priceDropCount'
    | 'beds'
    | 'baths'
    | 'sqft'
    | 'totalLivingAreaSqFt'
    | 'lotSizeAcres'
    | 'taxAnnualAmount'
    | 'hoaMonthly'
    | 'listAgentName'
    | 'listOfficeName'
    | 'listAgentPhone'
    | 'listOfficePhone'
    | 'lat'
    | 'lng'
  >
  /** Published listing-history rail — last drop on the face comes from here. */
  history?: ReadonlyArray<{
    event?: string | null
    event_date?: string | null
    price?: number | null
    price_change?: number | null
  }>
  /** Save handler — caller wires to saved_listings table. Returns needsAuth=true
   *  for a signed-out visitor so the strip can route them to sign-in. */
  onSave?: (listingKey: string) => Promise<{ saved: boolean; needsAuth?: boolean }>
  /** Initial saved state, hydrated by the server. */
  initialSaved?: boolean
  /**
   * Guest save must open the Sheet without waiting on a server action
   * (SITE-99 demo match). Signed-in visitors still hit onSave.
   */
  signedIn?: boolean
  /** Share handler — optional extra after the Dialog opens. */
  onShare?: (listingKey: string) => void
  /** Override the default contact-tour href. */
  scheduleHref?: string
  /** Override the default ask-question href. */
  askHref?: string
  /**
   * Seed 30-yr rate in PERCENT, same prop the payment calculator receives.
   * Omit / null → DEFAULT_PITI_RATE inside computeMonthlyPiti.
   */
  ratePct?: number | null
  /**
   * Face Est. $/mo leftover. The house page keeps the one number in Payment
   * (computeMonthlyPiti). Tests still render the face label by default.
   */
  showEstPayment?: boolean
  showAlerts?: boolean
  /**
   * Where the off-market ask sends a reader who wants a home they can actually
   * buy: the active-inventory rail on this page. Required for the branch to
   * render its primary door.
   */
  similarHref?: string
  /** The saved-search capture on this page. The off-market secondary. */
  alertsHref?: string
  /**
   * SITE-45 / Matt 2026-09-15. Dated cut from publishListingDropMark.
   * Omit to derive from `history`. Pass null to force no mark (tests).
   */
  dropMark?: PublishedListingDropMark | null
  /**
   * SITE-45. One plain sentence under the status pills reading the day count
   * and the $/sqft against the place's record (publishListingPillRead), with
   * its trace behind a disclosure. Null prints the pills alone.
   */
  read?: PublishedListingPillRead | null
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
  history,
  onSave,
  initialSaved = false,
  signedIn = false,
  onShare,
  scheduleHref,
  askHref,
  ratePct,
  showEstPayment = true,
  showAlerts = true,
  similarHref = '#similar',
  alertsHref = '#listing-like-alerts',
  dropMark,
  read = null,
  className,
}: Props) {
  // SITE-21. The four statuses under which nobody can buy this home. Read from
  // lib/listing-status-public.ts, which re-exports SITE-20's set — never from
  // the inverse of PUBLIC_ACTIVE_STATUSES, which would take the ask off every
  // Pending home on the site (a pending home takes backup offers and is a live
  // lead source).
  const offMarket = isPublicOffMarketStatus(listing.status)
  // See the pill below: one shared definition of days on market. It counts to
  // TODAY, which is a fact about a home that is still for sale and a fiction
  // about one that is not — an Expired 2022 listing read "1,153 days on
  // market". Off market, the day count is the sold instrument's, measured to
  // the close (lib/listing/days-live.ts daysOnMarketToClose), and this strip
  // publishes none.
  const daysLive = offMarket ? null : daysLiveOnMarket(listing.onMarketDate ?? null)
  const [saveState, setSaveState] = useState<ListingSaveState>(initialSaved ? 'saved' : 'idle')
  const [guestSaveOpen, setGuestSaveOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  // RC7 resume: complete a save this listing was bounced to login for (the hook
  // owns the idempotent save + re-stash; this is the detail page's real save CTA).
  useResumePendingSave({
    listingKey: listing.listingKey,
    alreadySaved: saveState === 'saved',
    onSaved: () => setSaveState('saved'),
  })

  // SITE-20: this strip's hand-written `isClosed ? closePrice : listPrice` was
  // the ONLY status branch on the page, which is how the H1 came out right and
  // the meta description, the share card, the JSON-LD, the hero caption and the
  // map card all came out wrong. The branch now lives in one publisher every
  // one of those surfaces calls; the pill below still reads the raw status.
  const isClosed = listingPublishesClosePrice(listing.status)
  const headlinePrice = publishListingPublishedPrice({
    status: listing.status,
    listPrice: listing.listPrice,
    closePrice: listing.closePrice,
    propertyType: listing.propertyType,
  })
  const shareSubject = {
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
  }
  const shareKind = publishListingShareKind(shareSubject)
  // The alert this strip points at bands on the whole-home price, so the copy
  // may promise a price band only when one exists. 735 Purcell (a commercial
  // sublease publishing no price) and MLS 220190868 (a $1 fractional interest)
  // both read "…lists in this city near this price" over a band built from a
  // rent rate and a share.
  const alertBandIsPublished =
    publishListingPublishedWholePropertyPrice({
      ...shareSubject,
      status: listing.status,
      listPrice: listing.listPrice,
      closePrice: listing.closePrice,
      propertyType: listing.propertyType,
    }) != null
  const publishedPpsf = publishListingSharePricePerSqft({
    ...shareSubject,
    propertyType: listing.propertyType,
    pricePerSqft: listing.pricePerSqft,
  })
  const livingSqft = listing.sqft ?? listing.totalLivingAreaSqFt ?? null
  const factsLine = publishListingHeroKeyStats({
    beds: listing.beds,
    baths: listing.baths,
    sqft: livingSqft,
    acres: listing.lotSizeAcres,
  }).join(' · ')
  const contactKey = publishListingContactKey({
    listNumber: listing.listNumber,
    listingKey: listing.listingKey,
  })
  const street = publishStreetLine({
    streetNumber: listing.streetNumber,
    streetDirPrefix: listing.streetDirPrefix,
    streetName: listing.streetName,
    streetSuffix: listing.streetSuffix,
    streetDirSuffix: listing.streetDirSuffix,
  }) ?? ''
  const cityLine = [listing.city ? `${listing.city}, OR` : null, listing.postalCode]
    .filter(Boolean)
    .join(' ')
  const estPayment = showEstPayment
    ? publishListingEstPayment({
        listPrice: headlinePrice,
        taxAnnual: listing.taxAnnualAmount,
        hoaMonthly: listing.hoaMonthly,
        mortgageRate: ratePct,
      })?.label ?? null
    : null
  const lastDrop = offMarket || !history ? null : publishListingLastDrop(history)
  const datedDrop = dropMark !== undefined ? dropMark : publishListingDropMark(history)
  const listedBy = publishListingListedBy({
    listAgentName: listing.listAgentName,
    listOfficeName: listing.listOfficeName,
    listAgentPhone: listing.listAgentPhone,
    listOfficePhone: listing.listOfficePhone,
  })
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
    if (saveState === 'saving') return
    if (!signedIn) {
      // Guest Sheet is the catalog demo. Do not wait on toggleSavedListing
      // or the save-open shot records a closed button.
      setGuestSaveOpen(true)
      return
    }
    if (!onSave) return
    setSaveState('saving')
    try {
      const res = await onSave(listing.listingKey)
      if (res.needsAuth) {
        setSaveState('idle')
        setGuestSaveOpen(true)
        return
      }
      setSaveState(res.saved ? 'saved' : 'idle')
    } catch {
      setSaveState('idle')
    }
  }

  function handleShare() {
    setShareOpen(true)
    onShare?.(listing.listingKey)
  }

  const shareUrl = `${getCanonicalSiteUrl()}${listingCanonicalHref({
    listingKey: listing.listingKey,
    listNumber: listing.listNumber,
    streetNumber: listing.streetNumber,
    streetName: listing.streetName,
    city: listing.city,
    subdivisionName: listing.subdivisionName,
  })}`
  const shareTitle = street || `Listing ${listing.listNumber ?? listing.listingKey}`

  return (
    <div className={cn('listing-face', className)}>
      <div>
      <h1 className="listing-ask">
        {street || `Listing ${listing.listNumber ?? listing.listingKey}`}
      </h1>
      <p className="listing-ask__price">
        <Price value={headlinePrice} exact />
        {estPayment ? <span className="listing-ask__est">{estPayment}</span> : null}
      </p>
      {datedDrop && !offMarket ? (
        /* The cut as two prices at rest, with the date (Matt 2026-09-15). */
        <div className="mt-1.5">
          <PriceDropMark
            mark={datedDrop}
            label={lastDrop?.label ?? `Price drop ${formatPriceCompact(datedDrop.drop)}`}
          />
        </div>
      ) : null}
      <div className="listing-face__price-row">
      <ButtonGroup aria-label="Save or share this listing" className="listing-face__keep gap-0">
        <ListingSaveButton saveState={saveState} onSave={handleSave} ariaLabel={saveAriaLabel} />
        <ListingShareButton
          onShare={handleShare}
          ariaLabel={`Share ${propertyName}`}
        />
      </ButtonGroup>
      {/* SITE-21 + Matt / Critiquito 2026-09-19: Tour is the one ask beside
          the price. Call / Text are not equal verbs here. Off market, the
          doors a broker can still fulfil are homes for sale and alerts. */}
      <ButtonGroup
        aria-label={offMarket ? 'Homes like this' : 'Tour this listing'}
        className="listing-ask-row listing-face__ask gap-0"
      >
        {offMarket ? (
          <>
            <Button variant="outline" size="lg" className="rounded-none first:rounded-l-lg last:rounded-r-lg" asChild>
              <a href={similarHref}>
                <ActionSwapText value="homes">Homes for sale</ActionSwapText>
              </a>
            </Button>
            <Button variant="outline" size="lg" className="rounded-none first:rounded-l-lg last:rounded-r-lg" asChild>
              <a href={alertsHref}>Get alerts</a>
            </Button>
          </>
        ) : (
          <Button size="lg" className="rounded-none first:rounded-l-lg last:rounded-r-lg" asChild>
            <a href={tourHref}>
              <ActionSwapText value="tour">Tour</ActionSwapText>
            </a>
          </Button>
        )}
      </ButtonGroup>
      </div>
      {factsLine ? (
        <div className="mt-1.5 text-lg font-medium sm:text-xl" style={{ color: 'var(--navy)' }}>
          {factsLine}
        </div>
      ) : null}
      {cityWithCommunity ? (
        <div className="mt-0.5 text-sm" style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
          {cityWithCommunity}
        </div>
      ) : null}
      {listedBy ? (
        <div className="mt-1 text-sm" style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
          {listedBy}
        </div>
      ) : null}

      <div className="mt-3.5 flex flex-nowrap gap-2 overflow-x-auto no-scrollbar">
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
        {/* Days live from OnMarketDate, never `listing.dom` — that is the MLS
            DaysOnMarket field, which is list-to-close and is banned as DOM
            (CLAUDE.md §7). The close section counts the same way from the same
            helper, so the two figures on this page cannot disagree. */}
        {daysLive != null ? (
          <Pill kind="dom">
            <TabularNumber value={daysLive} /> days on market
          </Pill>
        ) : null}
        {shareKind ? <Pill kind="dom">{shareKind}</Pill> : null}
        {publishedPpsf != null ? (
          <Pill kind="psqft">
            <Price value={publishedPpsf} exact />/sqft
          </Pill>
        ) : null}
      </div>
      {read ? (
        /* The pills' plain read (SITE-45): what the day count and the $/sqft
           mean against the place's own record, from the same Market Truth
           reads the instrument further down makes. The trace sits behind a
           disclosure so the sentence stays a sentence. */
        <div className="listing-read">
          <p className="listing-read__sentence">{read.sentence}</p>
          <details className="listing-read__source">
            <summary>Source</summary>
            <p>{read.source}</p>
          </details>
        </div>
      ) : null}
      </div>
      {/* No Google raster of this house here. Matt 2026-09-02: a listing page
          carries the living map only, and a 118px roadmap thumbnail above it
          was a second visual language for the same house — plus a paid static
          map request per view (evaluator round five, LISTING-NOBOUNDARY-6). */}
      <div className="listing-face__actions">
      {showAlerts ? (
        <>
      <a
        href="#listing-like-alerts"
        className="btn mt-3 w-full text-center sm:w-auto"
        style={OUTLINE_BTN_STYLE}
        aria-label="Get free email alerts for homes like this"
      >
        Get free alerts for homes like this <span className="arr">→</span>
      </a>
      <p className="mt-2 text-xs" style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
        {alertBandIsPublished
          ? 'Free email when a new home lists in this city near this price. Unsubscribe any time.'
          : 'Free email when a new home lists in this city. Unsubscribe any time.'}
      </p>
        </>
      ) : null}
      </div>
      <ListingShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        shareUrl={shareUrl}
        shareTitle={shareTitle}
      />
      <ListingGuestSaveSheet
        listingKey={listing.listingKey}
        addressLine={street || null}
        open={guestSaveOpen && saveState !== 'saved'}
        onOpenChange={setGuestSaveOpen}
        onUseGoogle={() => redirectToLoginForSave(listing.listingKey)} // hydration-safe: click callback, never runs during render
        onDone={() => {
          setGuestSaveOpen(false)
          setSaveState('saved')
        }}
      />
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
