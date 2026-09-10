'use client'

/**
 * One horizontal house rail for the homepage. Cards reuse SplitCardMedia
 * (badges, photo carousel, 3D/video) and the same ask/meta publishers as Field Split cards.
 * Save/heart rides the existing saved-listings action.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import {
  publishListingShareKind,
  publishListingSharePricePerSqft,
} from '@/lib/listing/publish-listing-share'
import { publishTourEmbedFromUrl } from '@/lib/listing/publish-listing-hero-video'
import type { VideoEmbed } from '@/lib/data/types/video'
import { V3_ROOT_CLASS, V3Button, V3Carousel, V3Number } from '@/components/site/v3'
import type { HomeHeroLive } from './home-hero-inventory'
import {
  SplitCardMedia,
  SPLIT_CARD_MEDIA_SIZES_RAIL,
} from '@/components/site/v3/SplitCardMedia'
import { ListingTourOverlay } from '@/components/site/listing-detail/ListingTourOverlay'
import { HeartIcon } from '@/components/icons/ActionIcons'
import { toggleSavedListing } from '@/app/actions/saved-listings'
import { getViewerListingState } from '@/app/actions/viewer-listing-state'
import { redirectToLoginForSave } from '@/lib/pending-save'
import type { HomeRailCard, HomeRailRow } from './home-rail-items'
import '@/components/site/v3/V3ListingRow.css'
import './home-homes-rails.css'

function HomeRailCardFace({
  card,
  saved,
  signedIn,
  onSavedChange,
  onOpenTour,
  priority,
}: {
  card: HomeRailCard
  saved: boolean
  signedIn: boolean
  onSavedChange: (key: string, next: boolean) => void
  onOpenTour?: () => void
  priority?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const ask = formatPublishedSaleAsk({ price: card.price, propertyType: card.propertyType })
  const shareKind = publishListingShareKind({
    propertySubType: card.propertySubType,
    subdivisionName: card.subdivisionName,
    city: card.city,
    listNumber: card.listNumber,
  })
  const meta: string[] = []
  if (card.beds != null) meta.push(`${Math.round(card.beds).toLocaleString('en-US')} bd`)
  if (card.baths != null) meta.push(`${Math.round(card.baths).toLocaleString('en-US')} ba`)
  if (card.sqft != null) meta.push(`${Math.round(card.sqft).toLocaleString('en-US')} sqft`)
  if (card.statusLabel) meta.push(card.statusLabel)
  const publishedPpsf = publishListingSharePricePerSqft({
    propertyType: card.propertyType,
    propertySubType: card.propertySubType,
    subdivisionName: card.subdivisionName,
    city: card.city,
    listNumber: card.listNumber,
    pricePerSqft: card.pricePerSqft,
  })
  if (publishedPpsf != null && publishedPpsf > 0) {
    meta.push(`$${Math.round(publishedPpsf).toLocaleString('en-US')}/sqft`)
  }

  async function onSave(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (!signedIn) {
      redirectToLoginForSave(card.listingKey) // hydration-safe: click handler, never runs during render
      return
    }
    if (busy) return
    setBusy(true)
    try {
      const result = await toggleSavedListing(card.listingKey)
      if (!result.error) onSavedChange(card.listingKey, result.saved)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={cn(V3_ROOT_CLASS, 'v3-lrow', 'v3-lrow--card', 'home-rail__card')}>
      <div className="home-rail__media">
        <SplitCardMedia
          urls={card.photoUrls}
          tags={card.badges}
          hasTour={card.hasTour}
          onOpenTour={card.hasTour ? onOpenTour : undefined}
          addressLine={card.addressLine}
          priority={priority}
          tourLabel={card.tourLabel}
          sizes={SPLIT_CARD_MEDIA_SIZES_RAIL}
        />
        <V3Button
          type="button"
          variant="ghost"
          className={cn('home-rail__save', saved && 'home-rail__save--on')}
          ariaLabel={saved ? 'Remove saved home' : 'Save home'}
          ariaPressed={saved}
          disabled={busy}
          onClick={onSave}
        >
          <HeartIcon filled={saved} className="home-rail__save-icon" />
        </V3Button>
      </div>
      <Link href={card.href} className="v3-lrow__copy home-rail__copy">
        <span className="v3-lrow__price">{ask ?? 'Price on request'}</span>
        {shareKind ? <span className="v3-lrow__tag">{shareKind}</span> : null}
        {meta.length > 0 ? <span className="v3-lrow__meta">{meta.join(' · ')}</span> : null}
        <span className="v3-lrow__addr">{card.addressLine}</span>
        <span className="v3-lrow__city">{card.cityLine}</span>
      </Link>
    </article>
  )
}

export function HomeListingRail({
  row,
  live,
}: {
  row: HomeRailRow
  /** Optional animated regional count on the lead rail (Rare UI / beUI number). */
  live?: HomeHeroLive
}) {
  const [signedIn, setSignedIn] = useState(false)
  const [saved, setSaved] = useState(() => new Set<string>())
  const [tour, setTour] = useState<VideoEmbed | null>(null)

  useEffect(() => {
    let alive = true
    void getViewerListingState().then((state) => {
      if (!alive) return
      setSignedIn(state.signedIn)
      setSaved(new Set(state.savedListingKeys))
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <section
      id={row.id}
      className={cn(V3_ROOT_CLASS, 'home-rail')}
      aria-labelledby={`${row.id}-heading`}
    >
      <div className="home-rail__head">
        <div className="home-rail__head-copy">
          <h2 id={`${row.id}-heading`} className="home-rail__title">
            {row.heading}
          </h2>
          {live ? (
            <p className="home-rail__live">
              <V3Number value={live.forSale} formatted={live.forSaleLabel} />
              <span> homes for sale across Central Oregon</span>
            </p>
          ) : null}
        </div>
        <V3Button href={row.seeAll.href} variant="ghost">
          {row.seeAll.label}
        </V3Button>
      </div>
      <V3Carousel label={row.heading} mode="rail" className="home-rail__carousel">
        {row.cards.map((card, index) => (
          <HomeRailCardFace
            key={card.listingKey}
            card={card}
            saved={saved.has(card.listingKey)}
            signedIn={signedIn}
            priority={index < 2}
            onOpenTour={
              card.tourUrl || card.hasTour
                ? () => {
                    const embed = publishTourEmbedFromUrl(
                      card.tourUrl,
                      card.photoUrls[0] ?? null,
                    )
                    if (embed) setTour(embed)
                    else if (card.href) window.location.assign(`${card.href}#tour`)
                  }
                : undefined
            }
            onSavedChange={(key, next) => {
              setSaved((prev) => {
                const copy = new Set(prev)
                if (next) copy.add(key)
                else copy.delete(key)
                return copy
              })
            }}
          />
        ))}
      </V3Carousel>
      <ListingTourOverlay
        open={tour != null}
        video={tour}
        title="Listing tour"
        onClose={() => setTour(null)}
      />
    </section>
  )
}
