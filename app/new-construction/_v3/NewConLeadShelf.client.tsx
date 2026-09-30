'use client'

/**
 * Live Bend new-construction homes on the listing dial.
 *
 * WHAT IT WAS. Catalog job `shadcn-carousel`: the installed carousel with the
 * /buy house card face, one track of today's photographed homes, each card
 * carrying its builder concession under the copy.
 *
 * WHAT IT IS (Matt 2026-09-24, "Let's get all of those carousels in place").
 * V3ListingDial: one home large with its photograph and the card's copy (the
 * ask, beds, baths, sqft, the address, a door to the listing), the rest as
 * thumbnails on the dial's rail, "03 / 12" at its head. The same homes in the
 * same order (lowest ask first, from load-lead-shelf), the same see-all door.
 *
 * THE CONCESSION STAYS ON THE HOME (SITE-151). A concession sits on the home
 * when public remarks or that builder's published page name one; otherwise
 * the builder's name does. The dial's card has no slot for it, so it sits
 * directly under the dial and turns with it: one note per home, all in the
 * served HTML, only the one for the home the dial shows visible (the dial's
 * onIndexChange says which one that is).
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Button, V3ListingDial } from '@/components/site/v3'
import { listingRowFromRailCard } from '@/app/_v3/home-rail-items'
import type { NewConHomeCard } from './load-lead-shelf'
import './new-con-lead-shelf.css'

const DIAL_ID = 'newcon-lead-dial'

function CardConcession({ card, index, shown }: { card: NewConHomeCard; index: number; shown: boolean }) {
  const concession = card.concession
  if (!concession && !card.builderName) return null
  return (
    <div
      className="newcon-lead__card-offer"
      hidden={!shown}
      data-listing-key={card.listingKey}
      data-dial-index={index}
    >
      {concession ? (
        <>
          <p className="newcon-lead__card-whose">{concession.whose}</p>
          <p className="newcon-lead__card-what">{concession.what}</p>
          {concession.extra ? <p className="newcon-lead__card-extra">{concession.extra}</p> : null}
          {concession.sourceHref ? (
            <a className="newcon-lead__card-source" href={concession.sourceHref}>
              {concession.source}
            </a>
          ) : (
            <p className="newcon-lead__card-source">{concession.source}</p>
          )}
        </>
      ) : (
        <p className="newcon-lead__card-whose">Built by {card.builderName}</p>
      )}
    </div>
  )
}

export function NewConLeadShelf({
  heading,
  note,
  cards,
  seeAllHref,
}: {
  heading: string
  note: string
  cards: readonly NewConHomeCard[]
  seeAllHref: string
}) {
  // The dial opens on its first home and reports every turn.
  const [turned, setTurned] = useState(0)
  const index = cards.length < 2 ? 0 : Math.min(turned, cards.length - 1)
  const headingId = 'newcon-lead-heading'

  if (cards.length === 0) return null

  return (
    <section
      id="affordable"
      className={cn(V3_ROOT_CLASS, 'newcon-lead')}
      aria-labelledby={headingId}
    >
      <div className="newcon-lead__head">
        <h2 id={headingId} className="newcon-lead__title">
          {heading}
        </h2>
        <p className="newcon-lead__note">{note}</p>
      </div>
      <V3ListingDial
        id={DIAL_ID}
        label={heading}
        listings={cards.map(listingRowFromRailCard)}
        onIndexChange={setTurned}
        className="newcon-lead__dial"
      />
      <div className="newcon-lead__offers">
        {cards.map((card, i) => (
          <CardConcession key={card.listingKey} card={card} index={i} shown={i === index} />
        ))}
      </div>
      <V3Button href={seeAllHref} variant="ghost" className="newcon-lead__see-all">
        See all Bend new construction
      </V3Button>
    </section>
  )
}
