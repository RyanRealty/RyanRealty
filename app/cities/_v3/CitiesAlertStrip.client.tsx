'use client'

/**
 * Regional listing-alert capture on /cities, bound to V3AlertsStrip so the
 * ask sits in the first viewport (SITE-92). Same action and trap as
 * RegionalAlertSheet: submitSearchAlertSignup, city empty, propertyType A,
 * company trap forwarded — never hardcoded.
 */
import { useCallback } from 'react'
import { V3AlertsStrip, type V3AlertsSubmit } from '@/components/site/v3/V3AlertsStrip.client'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import {
  joinClaimParts,
  placeAlertsClaimParts,
  placeAlertsStickyNote,
} from '@/lib/site/place-alerts'

const TRAP = { name: 'company', label: 'Company' } as const
const PROPERTY_TYPE = 'A'
const PLACE = 'Central Oregon'

type Props = {
  id: string
  newCount30d: number | null
  countLabel: string | null
  source: string | undefined
  updatedAt: string | null
  browseHref: string
}

export function CitiesAlertStrip({
  id,
  newCount30d,
  countLabel,
  source,
  updatedAt,
  browseHref,
}: Props) {
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
        communityName: PLACE,
        city: '',
        extraFilters: { propertyType: PROPERTY_TYPE },
      }),
    )
    fireSearchEvent('alert_create', { ...buildAlertCreatePayload('daily'), placement: input.placement })
    return result
  }, [])

  const parts = placeAlertsClaimParts(PLACE, PLACE, newCount30d)

  return (
    <V3AlertsStrip
      id={id}
      eyebrow={`New listings · ${PLACE}`}
      count={countLabel}
      claim={joinClaimParts(parts)}
      stickyClaim={parts}
      href={browseHref}
      browseLabel={`See the newest ${PLACE} listings`}
      stickyNote={placeAlertsStickyNote(null, 'Every new listing by email. Unsubscribe any time.')}
      promise="Every new listing in Central Oregon, by email. Price changes on those homes come in the same email. Unsubscribe any time."
      submitLabel="Email me each one"
      sent={{
        heading: 'Set. New Central Oregon listings land by email when they hit the market.',
        body: 'Price changes on those homes come in the same email. Pause or unsubscribe from any alert email.',
      }}
      source={source}
      updatedAt={updatedAt}
      trap={TRAP}
      emphasis="primary"
      stickyAfter="featured-cities"
      onSubmit={submit}
    />
  )
}
