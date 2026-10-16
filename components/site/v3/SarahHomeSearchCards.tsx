import type { HomeSearchCard } from '@/lib/sarah/home-search'
import './SarahHomeSearchCards.css'

function factsLine(card: HomeSearchCard): string {
  const parts: string[] = []
  if (card.beds != null) parts.push(`${card.beds} bd`)
  if (card.baths != null) parts.push(`${card.baths} ba`)
  if (card.sqft != null) parts.push(`${Math.round(card.sqft).toLocaleString('en-US')} sqft`)
  return parts.join(' · ')
}

export function SarahHomeSearchCards({
  cards,
  seeAll,
  onNavigate,
}: {
  cards: HomeSearchCard[]
  seeAll?: { href: string; label: string } | null
  onNavigate?: (href: string) => void
}) {
  if (cards.length === 0 && !seeAll) return null
  const go = (href: string, event: { preventDefault: () => void }) => {
    if (!onNavigate) return
    event.preventDefault()
    onNavigate(href)
  }
  return (
    <div className="v3-sarah-homes" data-sarah="home-cards">
      {cards.map((card) => (
        <a
          key={card.href}
          className="v3-sarah-homes__card"
          href={card.href}
          onClick={(event) => go(card.href, event)}
        >
          {card.photoUrl ? (
            <span
              className="v3-sarah-homes__photo"
              style={{ backgroundImage: `url(${card.photoUrl})` }}
              aria-hidden="true"
            />
          ) : (
            <span className="v3-sarah-homes__photo-fallback" aria-hidden="true" />
          )}
          <span className="v3-sarah-homes__body">
            <span className="v3-sarah-homes__price">{card.price}</span>
            {factsLine(card) ? <span className="v3-sarah-homes__facts">{factsLine(card)}</span> : null}
            <span className="v3-sarah-homes__addr">{card.address}</span>
          </span>
        </a>
      ))}
      {seeAll ? (
        <a
          className="v3-sarah-homes__see-all"
          href={seeAll.href}
          data-sarah="see-all"
          onClick={(event) => go(seeAll.href, event)}
        >
          {seeAll.label}
        </a>
      ) : null}
    </div>
  )
}
