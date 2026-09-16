'use client'

/**
 * SITE-92 — alerts sentence in the cities-index first viewport.
 *
 * Same capture as RegionalAlertSheet: submitSearchAlertSignup with city empty
 * and propertyType A, company trap. The strip is the layout-lock sentence
 * beside the drawing; the sheet stays further down as the parity ask.
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
import { formatCount } from '@/lib/format/count'
import { newestFirstHref, placeAlertsStickyNote, PLACE_ALERTS_FIGURE_MIN } from '@/lib/site/place-alerts'

const TRAP = { name: 'company', label: 'Company' } as const
const PROPERTY_TYPE = 'A'

const ALERT_SOURCE =
  'Market Truth new_listings_30d for Central Oregon, detached, definition mt-v1. The count is houses that came on the market in the last 30 days. The alert filter is every new single-family listing in the region.'

type Props = {
  id?: string
  newCount30d: number | null
  updatedAt: string | null
}

export function CitiesAlertsStrip({ id = 'fold-alerts', newCount30d, updatedAt }: Props) {
  const submit = useCallback<V3AlertsSubmit>(async (input) => {
    const result = await submitSearchAlertSignup({
      email: input.email,
      filters: { city: '', propertyType: PROPERTY_TYPE },
      company: input.company,
      sessionId: readRrSessionId(), // hydration-safe
    })
    if (!result.ok) return result
    rememberGuestWatch( // hydration-safe: event/effect storage only
      buildGuestWatchFromPlace({
        communityName: 'Central Oregon',
        city: '',
        extraFilters: { propertyType: PROPERTY_TYPE },
      }),
    )
    fireSearchEvent('alert_create', { ...buildAlertCreatePayload('daily'), placement: input.placement })
    return result
  }, [])

  const count =
    newCount30d != null && newCount30d >= PLACE_ALERTS_FIGURE_MIN ? formatCount(newCount30d) : null
  const claim =
    newCount30d != null
      ? newCount30d >= PLACE_ALERTS_FIGURE_MIN
        ? 'houses came on the market in Central Oregon in the last 30 days.'
        : `${formatCount(newCount30d)} houses came on the market in Central Oregon in the last 30 days.`
      : 'Hear about new listings in Central Oregon the day they hit the market.'

  return (
    <V3AlertsStrip
      id={id}
      eyebrow="New listings"
      count={count}
      claim={claim}
      href={newestFirstHref('/search')}
      browseLabel="See the newest Central Oregon listings"
      stickyClaim={{
        before: 'Hear about new listings in',
        place: 'Central Oregon',
        after: 'the day they hit the market.',
      }}
      stickyNote={placeAlertsStickyNote(
        null,
        'Every new listing, with its price changes. Unsubscribe any time.',
      )}
      promise="We'll email you every new listing in Central Oregon as it comes on the market, with any price change on those homes in the same email. Unsubscribe any time."
      submitLabel="Send me new listings"
      sent={{
        heading: "You're set. We'll email you when something new lists in Central Oregon.",
        body: 'One email when something new lists, with any price change on those homes in the same note. Unsubscribe any time.',
      }}
      source={newCount30d != null ? ALERT_SOURCE : undefined}
      updatedAt={updatedAt}
      trap={TRAP}
      emphasis="primary"
      stickyAfter="atlas"
      stickyLabel="Central Oregon listing alerts"
      onSubmit={submit}
    />
  )
}
