'use client'

/**
 * ZIP listing-alert capture as V3AlertsStrip (SITE-73). Keeps the ZipAlertsSheet
 * export name for parity / page tests. Capture contract unchanged:
 * submitSearchAlertSignup with { city, propertyType: 'A', postalCode: zip }.
 */

import { useCallback, useMemo } from 'react'
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
  placeAlertsStickyNote,
  publishableNewCount,
} from '@/lib/site/place-alerts'

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
  /** Property-type options + proof listings (price + beds/baths/sqft). */
  types?: readonly V3AlertsTypeOption[]
  /**
   * MOS homes-for-sale already printed in the figure column. When the 30-day
   * new count equals that inventory figure, drop the Broadside numeral and keep
   * the digit inline so two identical 43s do not collide (SITE-73 defect).
   */
  mosHomes?: number | null
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
  types,
  mosHomes = null,
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

  const copy = useMemo(() => {
    const base = placeAlertsCopy({
      placeName: zip,
      scopeName: zip,
      newCount30d,
      geoType: 'zip',
      geoSlug: zip,
    })
    const n = publishableNewCount(newCount30d)
    // Same digit as MOS inventory — keep the fact, drop the competing numeral.
    if (mosHomes != null && n != null && n === mosHomes) {
      const unit = n === 1 ? 'house' : 'houses'
      return {
        ...base,
        count: null,
        claim: `${formatCount(n)} ${unit} came on the market in ${zip} in the last 30 days.`,
        stickyClaim: {
          before: `${formatCount(n)} ${unit} came on the market in`,
          place: zip,
          after: 'in the last 30 days.',
        },
      }
    }
    return base
  }, [zip, newCount30d, mosHomes])

  return (
    <V3AlertsStrip
      {...copy}
      id={id}
      eyebrow={`New listings · ${zip}${area ? ` · ${area}` : ''}`}
      href={newestFirstHref(browseHref)}
      promise={`Every new listing in ${zip}, by email. Price changes on those homes come in the same email. Unsubscribe any time.`}
      stickyNote={placeAlertsStickyNote(copy.scopeLine, 'Every new listing by email. Unsubscribe any time.')}
      stickyAfter="atlas"
      updatedAt={updatedAt}
      trap={{ name: 'company', label: 'Company' }}
      emphasis={demote ? 'ghost' : 'primary'}
      types={types}
      onSubmit={submit}
    />
  )
}
