'use client'

import { ActionSwapText } from '@/components/motion/action-swap'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  V3PhoneDockContacts,
  V3PhoneDockShell,
  V3WorkWithUs,
} from '@/components/site/v3/V3PhoneDock.client'
import type { Broker } from '@/lib/data/types/broker'

/**
 * Mobile sticky contact bar — always visible below 64rem. Desktop uses the
 * sidebar. Cookies must not hide this (PAGE_INVENTORY ask).
 *
 * SITE-99: the installed shadcn ButtonGroup demo (connected outline Buttons,
 * shared edges). SITE-122 (Matt 2026-09-16): the bar is the site's one phone
 * dock, composed here around the listing's own lead control:
 *
 *   active      [Tour] [Call] [Text] [Work with us]   on the attributed broker
 *   off market  [Call] [Text] [Work with us]              on the BROKERAGE
 *
 * A sold home has nothing to tour, so its bar is exactly the three controls
 * every other page carries and a thumb lands on the same thing everywhere. The
 * door to homes that ARE for sale is not lost: it is the sheet's "Buy a home",
 * and the page body still carries the last-known facts, the active rail and the
 * saved search that MASTER_SPEC section 4.9 asks for. It came out of the bar
 * because "Homes for sale" beside three more controls truncated to "Homes for
 * ..." at 375 (measured 2026-09-16), and a clipped label is not a door.
 *
 * SITE-21 — WHY THE OFF-MARKET BRANCH IS HERE AND NOT IN THE PAGE.
 * This component reads the broker's line in the BROWSER, from a broker object
 * the server hands it as a prop. A server-side grep of the rendered page says
 * nothing about what a phone visitor is offered, so the branch lives in the
 * file that reads the line: off market, the broker's line is never read at
 * all, and Call / Text are the brokerage's own number, labelled as the
 * brokerage — a visitor reaches Ryan Realty, not the agent who listed a home
 * that sold. ci:offmarket-listing-cta guards the two reads below.
 */

export default function ListingMobileContactBar({
  broker,
  listingKey,
  offMarket = false,
}: {
  broker: Broker
  listingKey: string
  /** Closed, Expired, Canceled or Withdrawn — isPublicOffMarketStatus. */
  offMarket?: boolean
  /** Kept for the page's call site; both doors live in the page body (SITE-21). */
  similarHref?: string
  alertsHref?: string
}) {
  if (offMarket) {
    return (
      <V3PhoneDockShell variant="page" surface="listing_off_market" className="listing-mobile-cta">
        <ButtonGroup aria-label="Reach Ryan Realty" className="v3-dock__group">
          <V3PhoneDockContacts surface="listing_off_market" />
          <V3WorkWithUs surface="listing_off_market" />
        </ButtonGroup>
      </V3PhoneDockShell>
    )
  }

  // The attributed broker's line, read only on a home that can still be bought.
  const line = broker.phoneDirect ?? broker.phoneFub ?? null
  const firstName = broker.fullName.split(/\s+/)[0] ?? null
  const tourHref = `/contact?listingKey=${encodeURIComponent(listingKey)}&intent=tour`

  return (
    <V3PhoneDockShell variant="page" surface="listing" className="listing-mobile-cta">
      <ButtonGroup aria-label="Contact about this listing" className="v3-dock__group">
        <Button variant="outline" size="lg" className="v3-dock__control" asChild>
          <a href={tourHref}>
            <ActionSwapText value="tour">Tour</ActionSwapText>
          </a>
        </Button>
        <V3PhoneDockContacts phone={line} name={firstName} surface="listing" />
        <V3WorkWithUs phone={line} name={firstName} surface="listing" />
      </ButtonGroup>
    </V3PhoneDockShell>
  )
}
