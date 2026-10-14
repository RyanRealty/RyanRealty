'use client'

/**
 * The one listing-alert strip for an area page that has no figure of its own
 * (Matt 2026-10-14: every city, neighborhood, community, subdivision and
 * similar page carries a quick "get new listings for this area" signup).
 *
 * The node pages (city, neighborhood, community, subdivision, ZIP) keep their
 * own binders because each pairs the strip with a Market Truth count and a
 * property-type picker. The pages that mount this one (a city or community's
 * type pages, its buyer-answer pages, its market page, a plat page with no
 * map) carry no such count, so the strip leads with the sentence:
 * "Get every new listing in Bend in your inbox each morning."
 *
 * THE CAPTURE. `submitSearchAlertSignup` with the area's own filter (no
 * property type: every type) and `frequency: 'daily'`. The action sends the
 * first email at signup, and the cron sends the rest at the morning slot. The
 * caller passes the filter because the area's key differs by page (`city`,
 * `city` + `subdivision`, `neighborhoodSlug`); this file never widens it.
 *
 * THE DISCLOSURE stays a literal here, in the file that calls the capture
 * action (ci:alert-capture-disclosure): how often, and how to stop.
 *
 * THE HONEYPOT is the strip's `trap`, named `company`, its own value forwarded.
 */

import { useCallback } from 'react'
import { V3AlertsStrip, type V3AlertsSubmit } from '@/components/site/v3/V3AlertsStrip.client'
import { submitSearchAlertSignup } from '@/lib/analytics/submit-alert-signup'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import { newestFirstHref, placeAlertsCopy, placeAlertsStickyNote, type PlaceAlertsGeoType } from '@/lib/site/place-alerts'

const TRAP = { name: 'company', label: 'Company' } as const

/** The area keys this strip may send. Each one narrows (hasNarrowingFilter). */
export type PlaceAlertFilters =
  | { city: string; subdivision?: string }
  | { neighborhoodSlug: string }
  | { postalCode: string }

type Props = {
  /** The section id. Defaults to `alerts`. */
  id?: string
  /** The place the visitor is standing in. Named in the sentence. */
  placeName: string
  /** The area the alert really sends, when wider than the place (a city around its type page). */
  scopeName?: string
  filters: PlaceAlertFilters
  /** The newest-first browse path for the area; the strip adds the sort. */
  browseHref: string
  /** For the trace only. */
  geoType?: PlaceAlertsGeoType
  geoSlug?: string
  /** primary when this is the page's one ask; ghost when the opening already carries one. */
  emphasis?: 'primary' | 'ghost'
  /** The section the sticky repeat appears after. Omit to keep the strip inline only. */
  stickyAfter?: string
}

export function PlaceAlertsStrip({
  id = 'alerts',
  placeName,
  scopeName,
  filters,
  browseHref,
  geoType = 'city',
  geoSlug = '',
  emphasis = 'primary',
  stickyAfter,
}: Props) {
  const scope = scopeName?.trim() || placeName
  const submit = useCallback<V3AlertsSubmit>(
    async (input) => {
      const result = await submitSearchAlertSignup({
        email: input.email,
        filters,
        frequency: 'daily',
        // The trap's own answer, never a constant. See the header.
        company: input.company,
        sessionId: readRrSessionId(), // hydration-safe
      })
      if (!result.ok) return result
      rememberGuestWatch( // hydration-safe: event/effect storage only
        buildGuestWatchFromPlace({
          communityName: scope,
          ...('city' in filters
            ? { city: filters.city, subdivision: filters.subdivision || undefined }
            : { extraFilters: { ...filters } }),
        }),
      )
      fireSearchEvent('alert_create', { ...buildAlertCreatePayload('daily'), placement: input.placement })
      return result
    },
    [filters, scope],
  )

  const copy = placeAlertsCopy({
    placeName,
    scopeName: scope,
    newCount30d: null,
    geoType,
    geoSlug,
  })

  return (
    <V3AlertsStrip
      {...copy}
      id={id}
      href={newestFirstHref(browseHref)}
      promise={`We'll email you every new listing${copy.promiseScope ? ` in ${copy.promiseScope}` : ''}, every property type, each morning, with any price change on those homes in the same email. Unsubscribe any time.`}
      stickyNote={placeAlertsStickyNote(copy.scopeLine, 'Every new listing, every property type, each morning. Unsubscribe any time.')}
      stickyEnabled={Boolean(stickyAfter)}
      {...(stickyAfter ? { stickyAfter } : {})}
      placeholder=""
      trap={TRAP}
      emphasis={emphasis}
      onSubmit={submit}
    />
  )
}
