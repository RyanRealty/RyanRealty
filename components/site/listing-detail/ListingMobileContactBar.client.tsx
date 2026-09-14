'use client'

import { ActionSwapText } from '@/components/motion/action-swap'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import type { Broker } from '@/lib/data/types/broker'

/**
 * Mobile sticky contact bar — always visible at 390. Tour | Call | Text.
 * Cookies must not hide this (PAGE_INVENTORY ask). Desktop uses the sidebar.
 *
 * SITE-99: this is the installed shadcn ButtonGroup demo (connected outline
 * Buttons, shared edges). Not leftover filled Tour chips.
 *
 * SITE-21 — WHY THE OFF-MARKET BRANCH IS HERE AND NOT IN THE PAGE.
 * This component builds its `tel:` and `sms:` hrefs in the BROWSER, from a
 * broker object the server hands it as a prop. A server-side grep for "tel:"
 * on the rendered page therefore says nothing about what a phone visitor is
 * offered — the page could withhold every ask in the strip above and this row
 * would still put "Call" and "Text" about a home that sold across the bottom
 * of the screen, which is where a phone reader's thumb lives. So the branch is
 * in the file that owns the hrefs: off market, the two contact URIs are never
 * constructed at all, and the row carries the two doors that go somewhere —
 * the active homes in this city and the saved search.
 */

export default function ListingMobileContactBar({
  broker,
  listingKey,
  offMarket = false,
  similarHref = '#similar',
  alertsHref = '#listing-like-alerts',
}: {
  broker: Broker
  listingKey: string
  /** Closed, Expired, Canceled or Withdrawn — isPublicOffMarketStatus. */
  offMarket?: boolean
  /** The active-inventory rail on this page. */
  similarHref?: string
  /** The saved-search capture on this page. */
  alertsHref?: string
}) {
  const firstName = broker.fullName.split(/\s+/)[0]

  if (offMarket) {
    return (
      <div className="listing-mobile-cta" data-shown="true" data-off-market="true">
        <div className="listing-mobile-cta-inner">
          <ButtonGroup aria-label="Homes like this" className="w-full">
            <Button variant="outline" size="lg" className="rounded-none first:rounded-l-lg last:rounded-r-lg" asChild>
              <a href={similarHref}>
                <ActionSwapText value="homes">Homes for sale</ActionSwapText>
              </a>
            </Button>
            <Button variant="outline" size="lg" className="rounded-none first:rounded-l-lg last:rounded-r-lg" asChild>
              <a href={alertsHref}>Get alerts</a>
            </Button>
          </ButtonGroup>
        </div>
      </div>
    )
  }

  const phone = broker.phoneDirect ?? broker.phoneFub ?? null
  const tel = phone ? phone.replace(/[^\d]/g, '') : null
  const tourHref = `/contact?listingKey=${encodeURIComponent(listingKey)}&intent=tour`

  return (
    <div className="listing-mobile-cta" data-shown="true">
      <div className="listing-mobile-cta-inner">
        <ButtonGroup aria-label="Contact about this listing" className="w-full">
          <Button variant="outline" size="lg" className="rounded-none first:rounded-l-lg last:rounded-r-lg" asChild>
            <a href={tourHref}>
              <ActionSwapText value="tour">Tour</ActionSwapText>
            </a>
          </Button>
          {tel ? (
            <Button variant="outline" size="lg" className="rounded-none first:rounded-l-lg last:rounded-r-lg" asChild>
              <a href={`tel:${tel}`} aria-label={`Call ${firstName}`}>
                Call
              </a>
            </Button>
          ) : null}
          {tel ? (
            <Button variant="outline" size="lg" className="rounded-none first:rounded-l-lg last:rounded-r-lg" asChild>
              <a href={`sms:${tel}`} aria-label={`Text ${firstName}`}>
                Text
              </a>
            </Button>
          ) : null}
        </ButtonGroup>
      </div>
    </div>
  )
}
