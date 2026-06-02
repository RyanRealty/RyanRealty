/**
 * Meta Pixel client-side helpers: cookie management, event ID generation, and dual-track (fbq + CAPI).
 */

/**
 * Read _fbp and _fbc cookies set by Meta Pixel.
 */
export function getPixelCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === 'undefined') return {}

  const cookies: Record<string, string> = {}
  document.cookie.split(';').forEach((pair) => {
    const [key, val] = pair.split('=').map((s) => s.trim())
    if (key) cookies[key] = val
  })

  return {
    fbp: cookies._fbp,
    fbc: cookies._fbc,
  }
}

/**
 * Generate a UUID v4 event ID for deduplication.
 */
export function generateEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Fire event to both Meta Pixel (fbq) and Conversions API (server).
 * Deduplicates using a shared eventId.
 */
export async function trackEventWithCAPI(
  eventName: string,
  pixelData?: Record<string, unknown>,
  capiData?: {
    email?: string
    phone?: string
    firstName?: string
    lastName?: string
    customData?: Record<string, unknown>
  }
): Promise<{ eventId: string; pixelFired: boolean; capiSent: boolean }> {
  const eventId = generateEventId()
  let pixelFired = false
  let capiSent = false

  // Fire fbq
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      if (pixelData) {
        window.fbq('track', eventName, pixelData, { eventID: eventId })
      } else {
        window.fbq('track', eventName, {}, { eventID: eventId })
      }
      pixelFired = true
    } catch (err) {
      console.warn(`[Meta Pixel] fbq('${eventName}') failed:`, err)
    }
  }

  // ALWAYS mirror to CAPI for resilience + dedup — not just when we know the
  // visitor. The server route adds advanced matching from the _fbp/_fbc cookies
  // + IP/UA even for an anonymous browse; raw email/phone (forms, known users)
  // is included when available for full advanced matching. The shared eventId
  // de-duplicates the CAPI event against the browser Pixel fire above.
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/meta-capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          eventName,
          email: capiData?.email,
          phone: capiData?.phone,
          firstName: capiData?.firstName,
          lastName: capiData?.lastName,
          eventId,
          customData: capiData?.customData,
          eventSourceUrl: window.location.href,
        }),
      })
      capiSent = res.ok
      if (!res.ok) {
        const errText = await res.text()
        console.warn(`[Meta CAPI] Request failed (${res.status}):`, errText)
      }
    } catch (err) {
      console.warn('[Meta CAPI] Request failed:', err)
    }
  }

  return { eventId, pixelFired, capiSent }
}
