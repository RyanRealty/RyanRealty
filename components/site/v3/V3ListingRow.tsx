/**
 * V3ListingRow — one live listing as a dense ledger row. THE LOOK (Matt
 * 2026-08-26) puts search on the Ledger register: 13px working text, Geist
 * Mono tabular figures, photography as a small thumb, hairline separations,
 * radius 0, no elevation shadow. This is the barrel's listing unit for those
 * surfaces; the flat-register ListingCard stays what it is for the pages that
 * still wear other languages, and this component takes the same data shape so
 * a consumer swaps an import, not a mapper.
 *
 * Not a seventh pattern: a composition unit the search surfaces stack inside
 * their own list/rail chrome, the way V3PlaceDocuments composes Ledger.
 *
 * Barrel law honored here:
 *  - No import from the deleted KB register, components/site (flat),
 *    components/site/primitives, components/site/explore, or components/ui.
 *    Only ./atoms, ./tokens.css, and lib helpers.
 *  - No raw color: every visual value reaches this row through var(--v3-*).
 *  - The register is read, never branched on: under `.v3--ledger` the tokens
 *    make this row dense and mono; the component carries V3_ROOT_CLASS itself
 *    so the token scope always resolves.
 *
 * ONE deliberate departure from the "figures arrive preformatted" data rule,
 * stated here so it is a decision and not a drift: the ask and the price per
 * square foot are published by the lib publishers (formatPublishedSaleAsk,
 * publishListingShareKind, publishListingSharePricePerSqft) INSIDE this
 * component, exactly as ListingCard does and for the reason its header
 * documents at length — a caller that can omit the fractional-share label or
 * the commercial-lease guard is a caller that will, and both defects shipped
 * before the guards moved into the card. The section 0 guard outranks the
 * convention. The AST gate (check-public-v3.mjs rule 3) polices formatting
 * calls in this file itself; the publishers live in lib and stay the one
 * definition of what an ask means.
 */
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import {
  publishListingShareKind,
  publishListingSharePricePerSqft,
} from '@/lib/listing/publish-listing-share'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3ListingRow.css'

export type V3ListingRowBadge = 'hot' | 'new' | 'drop' | 'open' | 'sold' | 'pending' | 'video'

/**
 * Structurally identical to the flat register's ListingCardData ON PURPOSE
 * (not imported — the barrel is standalone): every mapper that feeds
 * ListingCard feeds this row unchanged, so the search surfaces restyle by
 * swapping an import. The required-not-optional fields carry the same
 * section 0 rationale as the original: `propertyType`, `propertySubType`,
 * `subdivisionName`, `city`, and `listNumber` exist so the ask and the $/sqft
 * publishers always know what kind of listing they are drawing. `null` is a
 * legitimate value; leaving the key out is not.
 */
export type V3ListingRowData = {
  listingKey: string
  href: string
  photoUrl?: string | null
  price: number | null
  /** Top line of address (e.g. "2732 NW Ordway Ave"). */
  addressLine: string
  /** City/state/zip + neighborhood (e.g. "Bend, OR 97703 · Awbrey Butte"). */
  cityLine: string
  beds: number | null
  baths: number | null
  sqft: number | null
  /** Whole-dollar price per living sqft; rendered only with `showPricePerSqft`. */
  pricePerSqft?: number | null
  propertyType: string | null
  propertySubType: string | null
  subdivisionName: string | null
  city: string | null
  listNumber: string | null
  tourUrl?: string | null
  hasTour?: boolean
  badge?: { kind: V3ListingRowBadge; label: string }
  /** Overlay pills. When set, this is the whole set; `badge` is ignored. */
  badges?: Array<{ kind: V3ListingRowBadge; label: string }>
}

/** Badge kinds that print solid navy; the rest are hairline outline tags. */
const SOLID_BADGE: Record<V3ListingRowBadge, boolean> = {
  hot: true,
  drop: true,
  sold: true,
  pending: true,
  new: false,
  open: true,
  video: false,
}

/** beds · baths · sqft · $/sqft — only the values the listing actually has.
 *  No placeholder dashes for land/estate parcels with no living-area stats. */
function metaParts(listing: V3ListingRowData, showPricePerSqft: boolean): string[] {
  const parts: string[] = []
  if (listing.beds != null) parts.push(`${Math.round(listing.beds).toLocaleString()} bd`)
  if (listing.baths != null) parts.push(`${Math.round(listing.baths).toLocaleString()} ba`)
  if (listing.sqft != null) parts.push(`${Math.round(listing.sqft).toLocaleString()} sqft`)
  if (showPricePerSqft) {
    const published = publishListingSharePricePerSqft({
      propertyType: listing.propertyType,
      propertySubType: listing.propertySubType,
      subdivisionName: listing.subdivisionName,
      city: listing.city,
      listNumber: listing.listNumber,
      pricePerSqft: listing.pricePerSqft ?? null,
    })
    if (published != null && published > 0) {
      parts.push(`$${Math.round(published).toLocaleString()}/sqft`)
    }
  }
  return parts
}

export function V3ListingRow({
  listing,
  showPricePerSqft = false,
  priority = false,
  className,
  onOpenTour,
}: {
  listing: V3ListingRowData
  /** Opt-in: append "$X/sqft" to the figure column (search results). */
  showPricePerSqft?: boolean
  /** LCP: pass for the first few above-the-fold rows. */
  priority?: boolean
  /** Extra row classes — `is-hot` / `is-active` for the split view's map sync. */
  className?: string
  /** 3D badge opens the on-site tour viewer. */
  onOpenTour?: () => void
}) {
  // A row may not show a fractional ask unlabelled (decided 2026-08-19): the
  // share label is computed HERE from the subject the row already carries,
  // never passed in beside `badge`. See the header.
  const shareKind = publishListingShareKind({
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
  })
  // Sale-aware ask: on MLS PropertyType 'G' (Commercial Lease) ListPrice is
  // rent per square foot, and the publisher declines to print it as an ask.
  const ask = formatPublishedSaleAsk({
    price: listing.price,
    propertyType: listing.propertyType,
  })
  const meta = metaParts(listing, showPricePerSqft)
  const splitThumb = typeof className === 'string' && className.includes('v3-lrow--split')
  const tags = listing.badges ?? (listing.badge ? [listing.badge] : [])
  const photoTags = tags.filter((tag) => tag.kind !== 'video')
  const hasTour = Boolean(listing.tourUrl) || listing.hasTour === true

  const photo = (
    <>
      {listing.photoUrl ? (
        <Image
          src={listing.photoUrl}
          alt=""
          fill
          priority={priority}
          sizes={splitThumb ? '200px' : '72px'}
        />
      ) : null}
      {photoTags.length > 0 ? (
        <span className="v3-lrow__photo-tags">
          {photoTags.map((tag) => (
            <span
              key={`${tag.kind}-${tag.label}`}
              className={cn('v3-lrow__tag', SOLID_BADGE[tag.kind] && 'v3-lrow__tag--solid')}
            >
              {tag.label}
            </span>
          ))}
        </span>
      ) : null}
      {hasTour ? (
        onOpenTour ? (
          <button
            type="button"
            className="v3-lrow__tour"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenTour()
            }}
          >
            3D tour
          </button>
        ) : (
          <span className="v3-lrow__tour">3D tour</span>
        )
      ) : null}
      <span className="v3-lrow__addr-tip">{listing.addressLine}</span>
    </>
  )

  if (splitThumb) {
    return (
      <article className={cn(V3_ROOT_CLASS, 'v3-lrow', className)}>
        <div className="v3-lrow__media" aria-hidden={!onOpenTour}>
          {photo}
        </div>
        <Link href={listing.href} className="v3-lrow__copy">
          <span className="v3-lrow__price">{ask ?? '—'}</span>
          {shareKind ? <span className="v3-lrow__tag">{shareKind}</span> : null}
          {meta.length > 0 ? <span className="v3-lrow__meta">{meta.join(' · ')}</span> : null}
          <span className="v3-lrow__addr">{listing.addressLine}</span>
          <span className="v3-lrow__city">{listing.cityLine}</span>
        </Link>
      </article>
    )
  }

  return (
    <Link href={listing.href} className={cn(V3_ROOT_CLASS, 'v3-lrow', className)}>
      <span className="v3-lrow__media" aria-hidden>
        {photo}
      </span>
      <span className="v3-lrow__body">
        <span className="v3-lrow__addr">{listing.addressLine}</span>
        <span className="v3-lrow__city">{listing.cityLine}</span>
      </span>
      <span className="v3-lrow__figures">
        <span className="v3-lrow__price">{ask ?? '—'}</span>
        {shareKind ? <span className="v3-lrow__tag">{shareKind}</span> : null}
        {meta.length > 0 ? <span className="v3-lrow__meta">{meta.join(' · ')}</span> : null}
      </span>
    </Link>
  )
}
