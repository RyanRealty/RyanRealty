'use client'

/**
 * Plat-grain listing-alert capture bound to V3AlertsStrip (SITE-86).
 * Filter is this subdivision + city — never a parent-city pulse count.
 * The 30-day numeral is THIS plat's houses, or omitted honestly.
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
import { formatCount } from '@/lib/format/count'
import {
  newestFirstHref,
  placeAlertsCopy,
  placeAlertsSource,
  placeAlertsStickyNote,
  publishableNewCount,
  type PlaceAlertsStickyClaim,
} from '@/lib/site/place-alerts'

const TRAP = { name: 'company', label: 'Company' } as const

/** Promote small counts to V3Number (same pattern as community SITE-87). */
function promoteAlertFigure(
  claim: string,
  stickyClaim: PlaceAlertsStickyClaim,
  count: string | null,
  placeName: string,
): { count: string | null; claim: string; stickyClaim: PlaceAlertsStickyClaim } {
  if (count) return { count, claim, stickyClaim }
  const match = claim.match(
    /^(\d[\d,]*)\s+(\S+)\s+came on the market in\s+(.+)\s+in the last 30 days\.$/,
  )
  if (!match) return { count, claim, stickyClaim }
  const [, digits, unit, place] = match
  const nextSticky: PlaceAlertsStickyClaim = {
    before: `${unit} came on the market in`,
    place: place || placeName,
    after: 'in the last 30 days.',
  }
  return {
    count: digits,
    claim: `${nextSticky.before} ${nextSticky.place} ${nextSticky.after}`,
    stickyClaim: nextSticky,
  }
}

type Props = {
  id: string
  placeName: string
  city: string
  subdivision: string
  geoSlug: string
  /** This plat's houses that came on market in 30 days, or null when omitted. */
  newCount30d: number | null
  updatedAt: string | null
  browseHref: string
  types?: readonly V3AlertsTypeOption[]
}

export function SubdivisionAlertsStrip({
  id,
  placeName,
  city,
  subdivision,
  geoSlug,
  newCount30d,
  updatedAt,
  browseHref,
  types,
}: Props) {
  const submit = useCallback<V3AlertsSubmit>(
    async (input) => {
      const filters: Record<string, string> = {
        city,
        ...(subdivision ? { subdivision } : {}),
        propertyType: 'A',
      }
      const result = await submitSearchAlertSignup({
        email: input.email,
        filters,
        company: input.company,
        sessionId: readRrSessionId(), // hydration-safe
      })
      if (!result.ok) return result
      rememberGuestWatch( // hydration-safe: event/effect storage only
        buildGuestWatchFromPlace({
          communityName: placeName,
          city,
          subdivision: subdivision || undefined,
          extraFilters: { propertyType: 'A' },
        }),
      )
      fireSearchEvent('alert_create', {
        ...buildAlertCreatePayload('daily'),
        placement: input.placement,
      })
      return result
    },
    [city, placeName, subdivision],
  )

  const copy = placeAlertsCopy({
    placeName,
    scopeName: placeName,
    newCount30d,
    geoType: 'neighborhood',
    geoSlug,
    matchNames: subdivision ? [subdivision] : [],
  })

  const n = publishableNewCount(newCount30d)
  const houseNoun = n === 1 ? 'house' : 'houses'
  const figure =
    n != null && !copy.count
      ? {
          count: formatCount(n),
          claim: `${houseNoun} came on the market in ${placeName} in the last 30 days.`,
          stickyClaim: {
            before: `${houseNoun} came on the market in`,
            place: placeName,
            after: 'in the last 30 days.',
          } satisfies PlaceAlertsStickyClaim,
        }
      : promoteAlertFigure(copy.claim, copy.stickyClaim, copy.count, placeName)

  const figuredTypes = types?.map((option) => {
    const next = promoteAlertFigure(option.claim, option.stickyClaim, option.count, placeName)
    return { ...option, ...next }
  })

  const source =
    n == null
      ? undefined
      : placeAlertsSource({
          count: n,
          geoType: 'neighborhood',
          geoSlug,
          placeName,
          table: 'listing_tile_mv',
        })

  return (
    <V3AlertsStrip
      {...copy}
      {...figure}
      source={source}
      id={id}
      href={newestFirstHref(browseHref)}
      promise={`Every new listing${copy.promiseScope ? ` in ${copy.promiseScope}` : ''}, by email. Price changes on those homes come in the same email. Unsubscribe any time.`}
      stickyNote={placeAlertsStickyNote(
        copy.scopeLine,
        'Every new listing by email. Unsubscribe any time.',
      )}
      updatedAt={updatedAt}
      trap={TRAP}
      emphasis="primary"
      types={figuredTypes}
      onSubmit={submit}
    />
  )
}
