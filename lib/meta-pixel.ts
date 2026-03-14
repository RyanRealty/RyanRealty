/**
 * Meta Pixel client helpers. Use from client components; pixel loads after marketing consent.
 * Step 19. Standard events (PageView, ViewContent, Lead, etc.) are in lib/tracking.ts.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export function trackMetaCustomEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.fbq) return
  if (params) window.fbq('trackCustom', eventName, params)
  else window.fbq('trackCustom', eventName)
}

export function trackCMADownload(params?: { content_name?: string; value?: number }) {
  trackMetaCustomEvent('CMADownload', params)
}

export function trackOpenHouseRSVP(params?: { content_name?: string }) {
  trackMetaCustomEvent('OpenHouseRSVP', params)
}

export function trackComparisonView(params?: { listing_ids?: string[] }) {
  trackMetaCustomEvent('ComparisonView', params)
}
