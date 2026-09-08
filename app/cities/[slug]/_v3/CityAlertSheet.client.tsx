'use client'

/**
 * The city node's listing-alert capture, bound to the barrel's V3AlertsStrip
 * (site queue SITE-04, Matt 2026-09-07): the first callout after the opening,
 * with the real 30-day count as its promise, and the sticky repeat past #atlas.
 *
 * THIS FILE KEEPS ITS NAME. ci:publish-median-caption pins
 * `app/cities/[slug]/_v3/CityAlertSheet.client.tsx` as the city surface that
 * publishes no median, and its assertion is on the path. The component it
 * exports is the strip; the sheet it replaced sat after #about, seven sections
 * past the Atlas, on a page whose one on-page ask this is.
 *
 * THE CAPTURE CONTRACT IS CARRIED ACROSS. This calls the same server action the
 * sheet called, `submitSearchAlertSignup` in app/actions/search-alert-capture.ts,
 * with the same payload shape and the same field name: `email`, under the same
 * filter map this route always built, `{ city, propertyType: 'A' }` (no
 * `subdivision` key). The two side effects of a successful capture are
 * unchanged and fire in the same order: the F2 guest-watch residual through
 * `buildGuestWatchFromPlace` + `rememberGuestWatch`, then the `alert_create`
 * search event with `buildAlertCreatePayload('daily')`, now carrying which of
 * the two mounts sent it (`placement`) so the callout and the strip can be
 * measured apart. Nothing about what reaches `listing_alerts` or `crm_people`
 * moved.
 *
 * THE HONEYPOT IS THE STRIP'S `trap`, named `company`. Its own value rides in
 * the submit input and is forwarded to the action. Hardcoding `company: ''` is
 * the same as having no trap.
 *
 * THE PRICE-DROP ALERT IS THE SAME ROW. Every `listing_alerts` row this action
 * writes takes the table's default event toggles, and `price_change` is on by
 * default, so the engine (lib/alerts/event-detection.ts) already mails a price
 * change on any home it has told this subscriber about. The action exposes no
 * path to set the toggles, and the one price filter in the allowlist
 * (`priceReduced`) keys on a listings column the MLS feed stopped populating on
 * 2026-04-07 (lib/data/listings/getPriceDrops.ts), so a second "price drops"
 * row would be a filter the engine cannot honor. The promise names what the
 * row really sends and offers no toggle the system would ignore.
 *
 * The disclosure a licensed broker's capture form owes the visitor stays in
 * copy a visitor reads: how often the email comes and how to stop it
 * (ci:alert-capture-disclosure). See lib/site/place-alerts.ts.
 *
 * THE STRIP'S ONE LINE CARRIES THE SCOPE. The cadence sentence stays a literal
 * here, where the gate reads it; placeAlertsStickyNote puts the scope line in
 * front of it wherever the alert sends wider than the figure counts. This is
 * the city class, where the alert's scope IS the place, so the line stays the
 * cadence sentence alone.
 */

import { useCallback } from 'react'
import { V3AlertsStrip, type V3AlertsSubmit } from '@/components/site/v3'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import { newestFirstHref, placeAlertsCopy, placeAlertsStickyNote } from '@/lib/site/place-alerts'
import { CITY_ALERT_PROPERTY_TYPE } from './city-constants'

const TRAP = { name: 'company', label: 'Company' } as const

type Props = {
  /** The section id. The page passes it so the contract's `#alerts` resolves in the page source (ci:page-purpose). */
  id: string
  cityName: string
  /** The Market Truth city slug the 30-day count was read under. Trace only. */
  geoSlug: string
  /** Market Truth new_listings_30d for this city, or null when withheld. */
  newCount30d: number | null
  /** The page's Market Truth stamp, the same one its market figures carry. */
  updatedAt: string | null
  /** The browse path this page already links for the city; the strip adds the newest sort. */
  browseHref: string
}

export function CityAlertsStrip({ id, cityName, geoSlug, newCount30d, updatedAt, browseHref }: Props) {
  const submit = useCallback<V3AlertsSubmit>(
    async (input) => {
      const result = await submitSearchAlertSignup({
        email: input.email,
        filters: { city: cityName, propertyType: CITY_ALERT_PROPERTY_TYPE },
        // The trap's own answer, never a constant. See the header.
        company: input.company,
        sessionId: readRrSessionId(), // hydration-safe
      })
      if (!result.ok) return result
      rememberGuestWatch( // hydration-safe: event/effect storage only
        buildGuestWatchFromPlace({
          communityName: cityName,
          city: cityName,
          extraFilters: { propertyType: CITY_ALERT_PROPERTY_TYPE },
        }),
      )
      fireSearchEvent('alert_create', { ...buildAlertCreatePayload('daily'), placement: input.placement })
      return result
    },
    [cityName],
  )

  const copy = placeAlertsCopy({
    placeName: cityName,
    scopeName: cityName,
    newCount30d,
    geoType: 'city',
    geoSlug,
  })

  return (
    <V3AlertsStrip
      {...copy}
      id={id}
      href={newestFirstHref(browseHref)}
      promise={`Every new listing${copy.promiseScope ? ` in ${copy.promiseScope}` : ''}, by email. Price changes on those homes come in the same email. Unsubscribe any time.`}
      stickyNote={placeAlertsStickyNote(copy.scopeLine, 'Every new listing by email. Unsubscribe any time.')}
      updatedAt={updatedAt}
      trap={TRAP}
      emphasis="primary"
      onSubmit={submit}
    />
  )
}
