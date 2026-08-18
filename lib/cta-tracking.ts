'use client'

import { trackEvent } from '@/lib/tracking'
import { trackCtaClickAction } from '@/app/actions/track-cta-click'

type TrackCtaParams = {
  label: string
  destination: string
  context?: string
  brokerSlug?: string
}

/**
 * Unified CTA tracking:
 * - GA4/GTM via dataLayer
 * - CRM event for identified contacts
 */
export function trackCtaClick(params: TrackCtaParams): void {
  const label = params.label?.trim()
  const destination = params.destination?.trim()
  if (!label || !destination) return

  trackEvent('click_cta', {
    cta_label: label,
    cta_destination: destination,
    cta_context: params.context,
    broker_slug: params.brokerSlug,
  })

  const pageUrl = typeof window !== 'undefined' ? window.location.href : undefined
  void trackCtaClickAction({
    label,
    destination,
    pageUrl,
    context: params.context,
    brokerSlug: params.brokerSlug,
  }).catch(() => {})
}
