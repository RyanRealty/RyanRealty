'use client'

/**
 * One horizontal house rail for the homepage. Cards reuse SplitCardMedia
 * (badges, photo, 3D) and the same ask/meta publishers as Field Split cards.
 * Save/heart rides the existing saved-listings action.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import {
  publishListingShareKind,
  publishListingSharePricePerSqft,
} from '@/lib/listing/publish-listing-share'
import { V3_ROOT_CLASS, V3Button } from '@/components/site/v3'
import { SplitCardMedia } from '@/components/site/v3/SplitCardMedia'
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
  priority,
}: {
  card: HomeRailCard
  saved: boolean
  signedIn: boolean
  onSavedChange: (key: string, next: boolean) => void
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

  const onSave = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (!signedIn) {
        redirectToLoginForSave(card.listingKey)
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
    },
    [busy, card.listingKey, onSavedChange, signedIn],
  )

  return (
    <article className={cn(V3_ROOT_CLASS, 'v3-lrow', 'v3-lrow--card', 'home-rail__card')}>
      <div className="home-rail__media">
        <SplitCardMedia
          urls={card.photoUrls}
          tags={card.badges}
          hasTour={card.hasTour}
          addressLine={card.addressLine}
          priority={priority}
          tourLabel={card.tourLabel}
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

export function HomeListingRail({ row }: { row: HomeRailRow }) {
  const [signedIn, setSignedIn] = useState(false)
  const [saved, setSaved] = useState(() => new Set<string>())

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
        <h2 id={`${row.id}-heading`} className="home-rail__title">
          {row.heading}
        </h2>
        <V3Button href={row.seeAll.href} variant="ghost">
          {row.seeAll.label}
        </V3Button>
      </div>
      <div className="home-rail__track" role="list">
        {row.cards.map((card, index) => (
          <div key={card.listingKey} className="home-rail__item" role="listitem">
            <HomeRailCardFace
              card={card}
              saved={saved.has(card.listingKey)}
              signedIn={signedIn}
              priority={index < 2}
              onSavedChange={(key, next) => {
                setSaved((prev) => {
                  const copy = new Set(prev)
                  if (next) copy.add(key)
                  else copy.delete(key)
                  return copy
                })
              }}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
