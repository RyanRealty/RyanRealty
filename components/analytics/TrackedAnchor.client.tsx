'use client'

import type { AnchorHTMLAttributes } from 'react'
import { trackEvent, type EventName } from '@/lib/tracking'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** The dataLayer event this click pushes (GA4 sends it when it is in GA4_BROWSER_EVENTS). */
  event: EventName
  eventParams?: Record<string, unknown>
}

/**
 * A plain link that pushes one analytics event when clicked, so a server
 * component can track a CTA without becoming a client component. Works as the
 * child of `<Button asChild>`: Radix Slot passes className, ref and its own
 * onClick through these props onto the anchor.
 *
 * WHY. The listing page's Tour link (TextMattCTA) was a bare anchor to
 * /contact?intent=tour: the page's main ask sent no event at all, and
 * schedule_tour_click had no sender anywhere (2026-10-14 audit).
 */
export function TrackedAnchor({ event, eventParams, onClick, ...rest }: Props) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        try {
          trackEvent(event, eventParams)
        } catch {
          // tracking optional
        }
        onClick?.(e)
      }}
    />
  )
}
