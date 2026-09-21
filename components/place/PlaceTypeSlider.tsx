import Link from 'next/link'
import type { PlaceTypeCard } from '@/lib/place/publish-place-type-cards'
import { LISTING_FIELD_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'
import '@/components/search/search-ledger.css'

/** Horizontal type cards. House stills open the listing; the KPI opens the type. */
export function PlaceTypeSlider({
  cards,
  label,
}: {
  cards: readonly PlaceTypeCard[]
  label: string
}) {
  if (cards.length === 0) return null
  return (
    <section className="place-type-slider" aria-label={label}>
      <div className="place-type-slider__track no-scrollbar">
        {cards.map((card) => {
          const listingHref = card.listingHref?.trim() || null
          const photoUrl = card.photoUrl?.trim() || null
          const listingLabel = [card.listingStreet, card.listingPrice].filter(Boolean).join(', ')
          return (
            <article
              key={card.key}
              className={card.active ? 'place-type-card is-active' : 'place-type-card'}
              data-type={card.key}
            >
              {listingHref && photoUrl ? (
                <Link
                  href={listingHref}
                  className="place-type-card__thumb"
                  aria-label={listingLabel ? `Open ${listingLabel}` : 'Open listing'}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={listingRowPhotoSrc(photoUrl, LISTING_FIELD_LEAD_PHOTO_SIZE)}
                    alt={card.listingStreet ?? ''}
                  />
                  {card.listingPrice ? (
                    <span className="place-type-card__ask">{card.listingPrice}</span>
                  ) : null}
                </Link>
              ) : (
                <div className="place-type-card__thumb" aria-hidden="true" />
              )}
              <Link href={card.href} className="place-type-card__body">
                {card.count ? <div className="place-type-card__count">{card.count}</div> : null}
                <div className="place-type-card__title">{card.title}</div>
                {card.bits.map((bit) => (
                  <div key={bit} className="place-type-card__bit">
                    {bit}
                  </div>
                ))}
              </Link>
            </article>
          )
        })}
      </div>
    </section>
  )
}
