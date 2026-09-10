'use client'

/**
 * ZIP listing-alert capture as V3AlertsStrip (SITE-73). Keeps the ZipAlertsSheet
 * export name for parity / page tests. Capture contract unchanged:
 * submitSearchAlertSignup with { city, propertyType: 'A', postalCode: zip }.
 */

import { useCallback } from 'react'
import {
  V3AlertsStrip,
  type V3AlertsSubmit,
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

type Props = {
  id?: string
  zip: string
  area: string
  city: string
  newCount30d: number | null
  updatedAt?: string | null
  browseHref: string
  /** ghost when the opening already carries a primary ask (MOS / claim). */
  demote?: boolean
}

export function ZipAlertsSheet({
  id = 'alerts',
  zip,
  area,
  city,
  newCount30d,
  updatedAt = null,
  browseHref,
  demote = false,
}: Props) {
  const submit = useCallback<V3AlertsSubmit>(
    async (input) => {
      const result = await submitSearchAlertSignup({
        email: input.email,
        filters: { city, propertyType: 'A', postalCode: zip },
        company: input.company,
        sessionId: readRrSessionId(), // hydration-safe
      })
      if (!result.ok) return result
      rememberGuestWatch( // hydration-safe: event/effect storage only
        buildGuestWatchFromPlace({
          communityName: `ZIP ${zip}`,
          city,
          extraFilters: { propertyType: 'A', postalCode: zip },
        }),
      )
      fireSearchEvent('alert_create', {
        ...buildAlertCreatePayload('daily'),
        placement: input.placement,
      })
      return result
    },
    [city, zip],
  )

  const copy = placeAlertsCopy({
    placeName: zip,
    scopeName: zip,
    newCount30d,
    geoType: 'zip',
    geoSlug: zip,
  })

  return (
    <V3AlertsStrip
      {...copy}
      id={id}
      eyebrow={`New listings · ${zip}`}
      href={newestFirstHref(browseHref)}
      promise={`Every new listing in ${zip}, by email. Price changes on those homes come in the same email. Unsubscribe any time.`}
      stickyNote={placeAlertsStickyNote(copy.scopeLine, 'Every new listing by email. Unsubscribe any time.')}
      stickyAfter="atlas"
      updatedAt={updatedAt}
      trap={{ name: 'company', label: 'Company' }}
      emphasis={demote ? 'ghost' : 'primary'}
      onSubmit={submit}
    />
  )
}
