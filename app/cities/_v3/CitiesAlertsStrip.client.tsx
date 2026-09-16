'use client'

/**
 * The /cities index's listing-alert capture, bound to the barrel's
 * V3AlertsStrip (site queue SITE-92, taste table: "house-alerts is not in the
 * first viewport"). Same component as the city route's CityAlertsStrip
 * (app/cities/[slug]/_v3/CityAlertSheet.client.tsx), REGION-scoped: the figure
 * and the filter both cover every city in Central Oregon, not one of them.
 *
 * THE CAPTURE CONTRACT IS CARRIED ACROSS, unchanged from the city binder and
 * from the bottom-of-page Sheet this page already runs
 * (app/central-oregon/_v3/RegionalAlertSheet.client.tsx, which keeps its own
 * mount here — do not touch it, it is a second, independent ask). Same server
 * action, `submitSearchAlertSignup` in app/actions/search-alert-capture.ts,
 * same field name (`email`), same filter map the Sheet already sends for the
 * whole-region case: `{ city: '', propertyType: 'A' }`. An EMPTY city string
 * is not "no filter" — `hasNarrowingFilter` inside the action still requires
 * `propertyType` — it is the region: every city, single-family. The two side
 * effects of a successful capture are unchanged and fire in the same order:
 * the F2 guest-watch residual through `buildGuestWatchFromPlace` +
 * `rememberGuestWatch`, then the `alert_create` search event with
 * `buildAlertCreatePayload('daily')`, carrying which of the two mounts sent
 * it (`placement`) so the callout and the sticky repeat can be measured apart.
 *
 * THE HONEYPOT IS THE STRIP'S `trap`, named `company`. Its own value rides in
 * the submit input and is forwarded to the action. Hardcoding `company: ''`
 * is the same as having no trap.
 *
 * THE FIGURE IS REGIONAL, NOT THE FEATURED ROWS ON THIS PAGE. `newCount30d` is
 * the same Market Truth region read the page's own drawing uses
 * (getDetachedOverlays({geoType:'region', geoSlug:'central-oregon'}) →
 * leftoverHudKpis, §0 SFR-only convention), never a sum of the featured or
 * visible city rows — the directory only lists 60 of the region's cities, so
 * summing the rows would silently undercount the region the filter actually
 * captures. Passed in as a number or null; this file invents no figure when
 * the caller could not verify one (§0).
 *
 * THE SCOPE LINE SAYS WHAT THE FILTER REALLY SENDS. The directory above shows
 * a bounded list of cities (featured + the visible slice); the alert itself
 * is not bounded to that list — `city: ''` matches every city Oregon Data
 * Share carries, including any city the directory truncated. So unlike the
 * city route (where scope IS the place and the line stays the cadence
 * sentence alone), this mount states the scope explicitly, the way
 * `placeAlertsStickyNote` composes a scope line ahead of the cadence sentence
 * for a wider-than-figure scope (lib/site/place-alerts.ts).
 *
 * The disclosure a licensed broker's capture form owes the visitor stays in
 * copy a visitor reads: how often the email comes and how to stop it
 * (ci:alert-capture-disclosure). See lib/site/place-alerts.ts.
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
import {
  earnsDisplayFigure,
  joinClaimParts,
  newestFirstHref,
  placeAlertsClaimParts,
  placeAlertsStickyNote,
  publishableNewCount,
} from '@/lib/site/place-alerts'
import { formatCount } from '@/lib/format/count'
import { REGIONAL_SEARCH_HREF } from '@/lib/search/publish-regional-search-href'

const TRAP = { name: 'company', label: 'Company' } as const

/** Region name a visitor reads. Not a route param — this page has one region. */
const REGION_NAME = 'Central Oregon'

/** The one alert filter this capture adds: single family (§0, PropertyType A). */
const REGION_ALERT_PROPERTY_TYPE = 'A'

/** The whole-region MLS filter this mount sends: every city, no narrower key. */
const REGION_CITY_FILTER = ''

type Props = {
  /** The section id. Defaults away from `alerts` — the bottom Sheet on this
   *  page (RegionalAlertSheet) already renders `id="alerts"`, and two equal
   *  ids on one page collide both in the DOM and in the sticky's own
   *  per-id session-dismiss key. */
  id?: string
  /** Market Truth new_listings_30d for the whole region, or null when withheld. */
  newCount30d: number | null
  /** The page's Market Truth stamp, the same one its market figures carry. */
  updatedAt: string | null
  /** The regional browse path; the strip adds the newest sort. */
  browseHref: string
  types?: readonly V3AlertsTypeOption[]
}

export function CitiesAlertsStrip({ id = 'regional-alerts', newCount30d, updatedAt, browseHref, types }: Props) {
  const submit = useCallback<V3AlertsSubmit>(async (input) => {
    const result = await submitSearchAlertSignup({
      email: input.email,
      filters: { city: REGION_CITY_FILTER, propertyType: REGION_ALERT_PROPERTY_TYPE },
      // The trap's own answer, never a constant. See the header.
      company: input.company,
      sessionId: readRrSessionId(), // hydration-safe
    })
    if (!result.ok) return result
    rememberGuestWatch( // hydration-safe: event/effect storage only
      buildGuestWatchFromPlace({
        communityName: REGION_NAME,
        city: REGION_CITY_FILTER,
        extraFilters: { propertyType: REGION_ALERT_PROPERTY_TYPE },
      }),
    )
    fireSearchEvent('alert_create', { ...buildAlertCreatePayload('daily'), placement: input.placement })
    return result
  }, [])

  const n = publishableNewCount(newCount30d)
  const claimParts = placeAlertsClaimParts(REGION_NAME, REGION_NAME, n)
  const claim = joinClaimParts(claimParts)
  const count = earnsDisplayFigure(n) ? formatCount(n) : null
  // See header: the directory above is a bounded list, the filter is not.
  const scopeLine = 'The alert covers every city in Central Oregon, not just the ones listed above.'
  const source =
    n == null
      ? undefined
      : `${formatCount(n)} houses: regional MLS through Oregon Data Share, Market Truth new listings in the ` +
        'last 30 days across Central Oregon (detached single-family; Coming Soon excluded). The alert follows ' +
        "this page's filter, every city in the region."
  const href = newestFirstHref((browseHref ?? '').trim() || REGIONAL_SEARCH_HREF)

  return (
    <V3AlertsStrip
      id={id}
      eyebrow={`New listings · ${REGION_NAME}`}
      count={count}
      claim={claim}
      scopeLine={scopeLine}
      href={href}
      browseLabel={`See the newest ${REGION_NAME} listings`}
      stickyClaim={claimParts}
      stickyNote={placeAlertsStickyNote(scopeLine, 'Every new listing by email. Unsubscribe any time.')}
      promise={`Every new listing across ${REGION_NAME}, by email. Price changes on those homes come in the same email. Unsubscribe any time.`}
      submitLabel="Email me each one"
      sent={{
        heading: `Set. New ${REGION_NAME} listings land by email when they hit the market.`,
        body: 'Price changes on those homes come in the same email. Pause or unsubscribe from any alert email.',
      }}
      source={source}
      updatedAt={updatedAt}
      stickyAfter="atlas"
      stickyLabel={`${REGION_NAME} listing alerts`}
      trap={TRAP}
      emphasis="primary"
      types={types}
      onSubmit={submit}
    />
  )
}
