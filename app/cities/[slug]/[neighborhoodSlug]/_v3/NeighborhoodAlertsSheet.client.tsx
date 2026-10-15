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
 * THE ALERT IS THIS NEIGHBORHOOD, BY LOCATION (Matt 2026-10-14: "all the
 * listings for that area"). A Bend district passes `areaSlug`, its boundary
 * slug (`bend-river-west`), and the filter is `{ neighborhoodSlug }`: the search
 * matches it by the listing's point inside the district polygon
 * (search_listings_advanced p_neighborhood_slug -> listing_boundary_xref_mv,
 * refreshed every 15 minutes by pg_cron), not by an MLS subdivision name, so it
 * is the location of the address (AGENTS.md 22), never an invented narrowing.
 * A neighborhood with no district polygon keeps the old city scope, and the
 * promise names the city with the neighborhood included. No property type
 * (every type) and `frequency: 'daily'`; the first email goes at signup. The
 * two side effects run on success in the same order as before: the guest-watch
 * residual, then the `alert_create` measurement event, carrying which mount
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
import { submitSearchAlertSignup } from '@/lib/analytics/submit-alert-signup'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import { newestFirstHref, placeAlertsCopy, placeAlertsStickyNote } from '@/lib/site/place-alerts'
import { NeighborhoodTypeCombobox } from './NeighborhoodTypeCombobox.client'

const TRAP = { name: 'company', label: 'Company' } as const

type Props = {
  /** The section id. The page passes it so the contract's `#alerts` resolves in the page source (ci:page-purpose). */
  id: string
  /** The city. The alert's scope when the neighborhood has no district polygon. */
  cityName: string
  /**
   * The Bend district boundary slug (`bend-river-west`) when the neighborhood
   * has one (lib/neighborhood-areas.ts BEND_DISTRICTS), else null. Present
   * means the alert sends this neighborhood alone.
   */
  areaSlug: string | null
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
  areaSlug,
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
        filters: areaSlug ? { neighborhoodSlug: areaSlug } : { city: cityName },
        frequency: 'daily',
        // The trap's own answer, never a constant. See the header.
        company: input.company,
        sessionId: readRrSessionId(), // hydration-safe
      })
      if (!result.ok) return result
      rememberGuestWatch( // hydration-safe: event/effect storage only
        buildGuestWatchFromPlace({
          communityName: areaSlug ? neighborhoodName : cityName,
          ...(areaSlug ? { extraFilters: { neighborhoodSlug: areaSlug } } : { city: cityName }),
        }),
      )
      fireSearchEvent('alert_create', { ...buildAlertCreatePayload('daily'), placement: input.placement })
      return result
    },
    [areaSlug, cityName, neighborhoodName],
  )

  const copy = placeAlertsCopy({
    placeName: neighborhoodName,
    scopeName: areaSlug ? neighborhoodName : cityName,
    newCount30d,
    geoType: 'neighborhood',
    geoSlug,
  })

  return (
    <V3AlertsStrip
      {...copy}
      id={id}
      href={newestFirstHref(browseHref)}
      promise={`We'll email you every new listing${copy.promiseScope ? ` in ${copy.promiseScope}` : ''}, every property type, each morning, with any price change on those homes in the same email. Unsubscribe any time.`}
      stickyNote={placeAlertsStickyNote(copy.scopeLine, 'Every new listing, every property type, each morning. Unsubscribe any time.')}
      updatedAt={updatedAt}
      trap={TRAP}
      emphasis="primary"
      types={types}
      // SITE-104: the place picker is the installed beUI combobox, not two flat
      // rectangles. The barrel owns the markup (V3TypeCombobox), the strip keeps
      // owning the selection, and this route hands the control down — the same
      // seam the city uses. See NeighborhoodTypeCombobox.client.tsx.
      renderTypes={({ options, value, onChange }) => (
        <NeighborhoodTypeCombobox
          label={`Property type in ${neighborhoodName}`}
          options={options}
          value={value}
          onChange={onChange}
        />
      )}
      onSubmit={submit}
    />
  )
}
