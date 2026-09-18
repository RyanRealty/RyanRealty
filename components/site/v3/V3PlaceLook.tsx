/**
 * V3PlaceLook — the place-page first look: a real map, ONE place boundary,
 * price pins, and listing photograph cards. Cos rematch 2026-09-18 #1.
 *
 * Figures on the cards arrive preformatted. This primitive does not format
 * money or invent a second ring.
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SparkSafeImage } from '@/lib/listing/SparkSafeImage'
import { V3_ROOT_CLASS, V3Eyebrow } from './atoms'
import { listingPhotoAlt } from './listing-photo-alt'
import { V3PlaceLookMap, type V3PlaceLookMapProps } from './V3PlaceLookMap.client'
import './tokens.css'
import './V3PlaceLook.css'

export type V3PlaceLookCard = {
  href: string
  photoSrc: string
  title: string
  price: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
}

export type V3PlaceLookProps = V3PlaceLookMapProps & {
  id?: string
  headline: string
  claim?: string
  source?: string
  photoCards: readonly V3PlaceLookCard[]
  className?: string
}

function cardMeta(card: V3PlaceLookCard): string | null {
  const parts = [
    card.beds != null ? `${card.beds} bd` : null,
    card.baths != null ? `${card.baths} ba` : null,
    card.sqft != null && card.sqft > 0 ? `${card.sqft.toLocaleString('en-US')} sqft` : null,
  ].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(' · ') : null
}

export function V3PlaceLook({
  id,
  headline,
  claim,
  source,
  listings,
  boundaryGeojson,
  placeQuery,
  photoCards,
  className,
}: V3PlaceLookProps) {
  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'v3-place-look', className)}>
      <header className="v3-place-look__head">
        <V3Eyebrow>{headline}</V3Eyebrow>
        {claim ? <p className="v3-place-look__claim">{claim}</p> : null}
      </header>
      <div className="v3-place-look__stage">
        <div className="v3-place-look__map">
          <V3PlaceLookMap
            listings={listings}
            boundaryGeojson={boundaryGeojson}
            placeQuery={placeQuery}
          />
        </div>
        {photoCards.length > 0 ? (
          <ul className="v3-place-look__cards">
            {photoCards.map((card, index) => {
              const meta = cardMeta(card)
              return (
                <li key={card.href}>
                  <Link href={card.href} className="v3-place-look__card">
                    <span className="v3-place-look__still">
                      <SparkSafeImage
                        className="v3-place-look__photo"
                        src={card.photoSrc}
                        alt={listingPhotoAlt({ addressLine: card.title })}
                        fill
                        priority={index < 2}
                        sizes="(min-width: 64rem) 22vw, 50vw"
                      />
                    </span>
                    <span className="v3-place-look__copy">
                      {card.price ? <span className="v3-place-look__price">{card.price}</span> : null}
                      <span className="v3-place-look__street">{card.title}</span>
                      {meta ? <span className="v3-place-look__meta">{meta}</span> : null}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
      {source ? <p className="v3-place-look__source">{source}</p> : null}
    </section>
  )
}
