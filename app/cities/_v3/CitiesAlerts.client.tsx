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
import { submitSearchAlertSignup } from '@/lib/analytics/submit-alert-signup'
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
  'Market Truth for Central Oregon detached homes. The count is houses that came on the market in the last 30 days. The alert is every new single-family listing in the region.'

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
      // Daily, first email at signup (Matt 2026-10-14). The region stays
      // houses: with no place and no type the filter would be the whole feed.
      frequency: 'daily',
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
      : 'Get every new Central Oregon house listing in your inbox each morning.'

  return (
    <V3AlertsStrip
      id={id}
      eyebrow="New listings"
      count={count}
      claim={claim}
      href={newestFirstHref('/search')}
      browseLabel="See the newest Central Oregon listings"
      stickyClaim={{
        before: 'Get every new house listing in',
        place: 'Central Oregon',
        after: 'in your inbox each morning.',
      }}
      stickyNote={placeAlertsStickyNote(
        null,
        'Every new house listing, each morning. Unsubscribe any time.',
      )}
      promise="We'll email you every new listing of a house in Central Oregon each morning, with any price change on those homes in the same email. Unsubscribe any time."
      submitLabel="Send me new listings"
      sent={{
        heading: "You're set. Watch your inbox for new Central Oregon listings.",
        body: 'One email each morning when a new house lists, with any price change on those homes in the same note. Unsubscribe any time.',
      }}
      source={newCount30d != null ? ALERT_SOURCE : undefined}
      updatedAt={updatedAt}
      trap={TRAP}
      emphasis="primary"
      stickyAfter="featured-cities"
      stickyLabel="Central Oregon listing alerts"
      onSubmit={submit}
    />
  )
}
