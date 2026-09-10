'use client'

/**
 * The neighborhood node's listing-alert capture, bound to the barrel's
 * V3AlertsStrip (site queue SITE-04, Matt 2026-09-07): the first callout after
 * the opening, with this neighborhood's real 30-day count as its claim, and the
 * sticky repeat past #atlas.
 *
 * THIS FILE KEEPS ITS NAME. ci:publish-median-caption pins
 * `app/cities/[slug]/[neighborhoodSlug]/_v3/NeighborhoodAlertsSheet.client.tsx`
 * as the neighborhood surface that publishes no median, and its assertion is on
 * the path. The component it exports is the strip; the sheet it replaced sat
 * after the open-house ledger, ten sections past the Atlas.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED, and it is city-scoped on purpose. It calls
 * the same server action the sheet called, `submitSearchAlertSignup`, with the
 * same payload shape and the same field name: `email`, under `filters` of
 * `{ city, propertyType: 'A' }` and no subdivision key. Neighborhood names are
 * not 1:1 with MLS subdivision tags, so a neighborhood filter would be an
 * invented narrowing (CLAUDE.md section 0). The copy therefore does two honest
 * things at once: the CLAIM counts this neighborhood (Market Truth
 * new_listings_30d at the neighborhood grain), and the PROMISE names the scope
 * the alert really sends, the city, with the neighborhood included. The two
 * side effects run on success in the same order as before: the guest-watch
 * residual, then the `alert_create` measurement event, now carrying which mount
 * sent it.
 *
 * THE HONEYPOT IS THE STRIP'S `trap`, named `company`, its own value forwarded.
 * THE PRICE-DROP ALERT IS THE SAME ROW: see CityAlertSheet.client.tsx for why a
 * second row is not honest today. The disclosure (frequency, unsubscribe) is
 * in lib/site/place-alerts.ts, in copy a visitor reads.
 *
 * THE STRIP'S ONE LINE CARRIES THE SCOPE. The cadence sentence stays a literal
 * here, where the gate reads it; placeAlertsStickyNote puts the scope line
 * ("The alert covers all of Bend, Awbrey Butte included.") in front of it, so a
 * visitor who only ever meets the sticky repeat learns what the callout tells
 * one who scrolled past it: the alert is wider than the count.
 */

import { useCallback } from 'react'
import {
  V3AlertsStrip,
  type V3AlertsSubmit,
  type V3AlertsTypeOption,
} from '@/components/site/v3/V3AlertsStrip.client'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import { newestFirstHref, placeAlertsCopy, placeAlertsStickyNote } from '@/lib/site/place-alerts'

const TRAP = { name: 'company', label: 'Company' } as const

type Props = {
  /** The section id. The page passes it so the contract's `#alerts` resolves in the page source (ci:page-purpose). */
  id: string
  /** The city the alert filter is scoped to. Named in the promise. */
  cityName: string
  /** The neighborhood the visitor is standing in. Named in the claim. */
  neighborhoodName: string
  /** The Market Truth neighborhood slug the 30-day count was read under. Trace only. */
  geoSlug: string
  /** Market Truth new_listings_30d for this neighborhood, or null when withheld. */
  newCount30d: number | null
  /** The page's Market Truth stamp, the same one its market figures carry. */
  updatedAt: string | null
  /** The browse path this page already links for the neighborhood; the strip adds the newest sort. */
  browseHref: string
  types?: readonly V3AlertsTypeOption[]
}

export function NeighborhoodAlertsStrip({
  id,
  cityName,
  neighborhoodName,
  geoSlug,
  newCount30d,
  updatedAt,
  browseHref,
  types,
}: Props) {
  const submit = useCallback<V3AlertsSubmit>(
    async (input) => {
      const result = await submitSearchAlertSignup({
        email: input.email,
        filters: { city: cityName, propertyType: 'A' },
        // The trap's own answer, never a constant. See the header.
        company: input.company,
        sessionId: readRrSessionId(), // hydration-safe
      })
      if (!result.ok) return result
      rememberGuestWatch( // hydration-safe: event/effect storage only
        buildGuestWatchFromPlace({
          communityName: cityName,
          city: cityName,
          extraFilters: { propertyType: 'A' },
        }),
      )
      fireSearchEvent('alert_create', { ...buildAlertCreatePayload('daily'), placement: input.placement })
      return result
    },
    [cityName],
  )

  const copy = placeAlertsCopy({
    placeName: neighborhoodName,
    scopeName: cityName,
    newCount30d,
    geoType: 'neighborhood',
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
      types={types}
      onSubmit={submit}
    />
  )
}
