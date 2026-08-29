import Link from 'next/link'
import type { PlaceTypeCard } from '@/lib/place/publish-place-type-cards'
import '@/components/search/search-ledger.css'

/** Horizontal type cards. Each card is leftover/segment data, miss omitted. */
export function PlaceTypeSlider({
  cards,
  label,
}: {
  cards: readonly PlaceTypeCard[]
  label: string
}) {
  if (cards.length < 2) return null
  return (
    <section className="place-type-slider" aria-label={label}>
      <div className="place-type-slider__track">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            scroll={false}
            className={card.active ? 'place-type-card is-active' : 'place-type-card'}
          >
            {card.photoUrl ? (
              <div className="place-type-card__thumb" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.photoUrl} alt="" />
              </div>
            ) : null}
            {card.count ? <div className="place-type-card__count">{card.count}</div> : null}
            <div className="place-type-card__title">{card.title}</div>
            {card.bits.map((bit) => (
              <div key={bit} className="place-type-card__bit">
                {bit}
              </div>
            ))}
          </Link>
        ))}
      </div>
    </section>
  )
}
