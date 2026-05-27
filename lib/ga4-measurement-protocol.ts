/**
 * GA4 Measurement Protocol v2 — server-side event firing.
 *
 * Mirrors critical conversion events from server actions so they survive
 * client-side ad blockers. Each fire happens AFTER the upstream success
 * (FUB person created, CMA row inserted, lead webhook processed) so we
 * never report a conversion that didn't actually happen.
 *
 * Auth:
 *   - GA4_MEASUREMENT_ID — same as NEXT_PUBLIC_GA4_MEASUREMENT_ID (G-ST40W4WM6T)
 *   - GA4_API_SECRET     — Matt generates in GA4 Admin → Data Streams →
 *                          Measurement Protocol API secrets
 *
 * If GA4_API_SECRET is missing, every call short-circuits with a warning
 * and returns ok=false. No production code path blocks on this.
 *
 * Reference:
 *   https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events
 *
 * Client_id continuity:
 *   The GA4 web SDK stores a client_id in the `_ga` cookie (format `GA1.x.<random>.<timestamp>`).
 *   When we have a Request available, we parse the cookie and extract the client_id portion.
 *   If absent, we generate a stable random uuid. The same uuid is reused per call within
 *   the same server action by accepting an explicit `clientId` argument.
 *
 * Brand voice note: this file is internal — log messages may use any phrasing.
 * Public-facing payloads (customData) carry plain English values only — no banned
 * words slip through (we send slugs, classifications, and numbers, not prose).
 */
import { randomUUID } from 'node:crypto'

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect'
const GA4_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect'

export interface Ga4MpFireParams {
  /** GA4 event name. Must match a known event (generate_lead, valuation_requested, etc.). */
  eventName: string
  /** Stable per-user identifier. Reuse the client_id from the `_ga` cookie when present. */
  clientId?: string
  /** User-properties scoped values (assigned_broker, lead_status). Stable, low-cardinality. */
  userProperties?: Record<string, string | number>
  /** Event-scoped params (lp_variant, lp_source, lp_campaign, broker_slug, ...). */
  eventParams?: Record<string, string | number | boolean | undefined | null>
  /** Force debug endpoint (echoes validation result; does NOT count). Defaults to false. */
  debug?: boolean
}

export type Ga4MpFireResult =
  | { ok: true; clientId: string; status: number }
  | { ok: false; error: string }

function getCreds(): { measurementId: string; apiSecret: string } | null {
  const measurementId = (process.env.GA4_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '').trim()
  const apiSecret = (process.env.GA4_API_SECRET || '').trim()
  if (!measurementId || !apiSecret) return null
  return { measurementId, apiSecret }
}

/**
 * Parse the GA4 `_ga` cookie value and return the client_id portion.
 * Cookie format: `GA1.x.<random>.<timestamp>` — client_id is `<random>.<timestamp>`.
 * Returns null if the cookie is missing or malformed.
 */
export function clientIdFromGaCookie(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null
  const m = cookieValue.match(/^GA\d\.\d\.(\d+\.\d+)$/)
  if (!m) return null
  return m[1]
}

/**
 * Sanitize event params for the Measurement Protocol. GA4 rejects:
 *   - null / undefined values (we strip them)
 *   - keys longer than 40 chars (we truncate)
 *   - string values longer than 100 chars (we truncate)
 *   - more than 25 params per event (we trim to 25)
 *
 * Boolean values are coerced to 1/0 since GA4 doesn't support bool params.
 */
function sanitizeParams(params: Record<string, string | number | boolean | undefined | null>): Record<string, string | number> {
  const cleaned: Record<string, string | number> = {}
  for (const [rawKey, rawVal] of Object.entries(params)) {
    if (rawVal === undefined || rawVal === null || rawVal === '') continue
    const key = rawKey.slice(0, 40)
    if (typeof rawVal === 'boolean') {
      cleaned[key] = rawVal ? 1 : 0
    } else if (typeof rawVal === 'number') {
      if (Number.isFinite(rawVal)) cleaned[key] = rawVal
    } else {
      cleaned[key] = String(rawVal).slice(0, 100)
    }
    if (Object.keys(cleaned).length >= 25) break
  }
  return cleaned
}

function sanitizeUserProperties(props: Record<string, string | number>): Record<string, { value: string | number }> {
  const out: Record<string, { value: string | number }> = {}
  for (const [rawKey, rawVal] of Object.entries(props)) {
    if (rawVal === undefined || rawVal === null || rawVal === '') continue
    const key = rawKey.slice(0, 24) // GA4 user property name max 24 chars
    const value =
      typeof rawVal === 'number'
        ? Number.isFinite(rawVal) ? rawVal : null
        : String(rawVal).slice(0, 36)
    if (value !== null) out[key] = { value }
    if (Object.keys(out).length >= 25) break
  }
  return out
}

/**
 * Fire a single GA4 event via Measurement Protocol v2.
 *
 * Non-blocking: always returns a promise that resolves (never rejects). Callers
 * should `void` the result if they don't care, since the failure mode is a
 * console.warn — never a thrown error that crashes the upstream action.
 */
export async function fireGa4Event(params: Ga4MpFireParams): Promise<Ga4MpFireResult> {
  const creds = getCreds()
  if (!creds) {
    console.warn('[ga4-mp] skipping fire — GA4_API_SECRET or GA4_MEASUREMENT_ID not configured')
    return { ok: false, error: 'GA4_API_SECRET_MISSING' }
  }

  // Country filter — mirror of the client-side filter in
  // components/GoogleAnalytics.tsx. Ryan Realty serves Central Oregon;
  // non-US events are overwhelmingly bot traffic from datacenter IPs.
  // Best-effort: only enforces when the middleware-set x-country-code
  // header is present on the request. Server actions called outside a
  // request context (crons, scripts) bypass this and fire normally —
  // those are intentional automation, not visitor pageviews.
  try {
    const { headers } = await import('next/headers')
    const headerStore = await headers()
    const country = headerStore.get('x-country-code')?.toUpperCase()
    if (country && country !== 'US') {
      return { ok: false, error: `country_filtered:${country}` }
    }
  } catch {
    // Not in a request context (cron / script / build). Fall through.
  }

  const clientId = params.clientId?.trim() || randomUUID()
  const eventParams = sanitizeParams(params.eventParams || {})
  const userProperties = params.userProperties ? sanitizeUserProperties(params.userProperties) : undefined

  const payload: Record<string, unknown> = {
    client_id: clientId,
    events: [
      {
        name: params.eventName,
        params: {
          // engagement_time_msec is required for GA4 to recognize the event
          // as engaged user activity. 100ms is a safe baseline.
          engagement_time_msec: 100,
          ...eventParams,
        },
      },
    ],
  }
  if (userProperties && Object.keys(userProperties).length > 0) {
    payload.user_properties = userProperties
  }

  const endpoint = params.debug ? GA4_DEBUG_ENDPOINT : GA4_ENDPOINT
  const url = `${endpoint}?measurement_id=${encodeURIComponent(creds.measurementId)}&api_secret=${encodeURIComponent(creds.apiSecret)}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (params.debug) {
      const debugBody = await res.text()
      console.log(`[ga4-mp] debug response for ${params.eventName}:`, debugBody)
    }
    // The production /mp/collect endpoint returns 204 on success. Anything
    // 2xx is acceptable. 4xx/5xx is a real problem we want to log.
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, clientId, status: res.status }
    }
    const body = await res.text().catch(() => '')
    console.warn(`[ga4-mp] non-2xx for ${params.eventName} (HTTP ${res.status}): ${body.slice(0, 200)}`)
    return { ok: false, error: `HTTP ${res.status}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[ga4-mp] fetch failed for ${params.eventName}: ${msg}`)
    return { ok: false, error: msg }
  }
}

/**
 * Convenience: read the `_ga` cookie from a Next.js cookies() object.
 * Use when you have access to Next.js headers/cookies in a server action.
 *
 * @example
 *   import { cookies } from 'next/headers'
 *   const cookieStore = await cookies()
 *   const clientId = readGa4ClientIdFromCookies(cookieStore)
 */
export function readGa4ClientIdFromCookies(cookieStore: { get(name: string): { value: string } | undefined }): string | null {
  const value = cookieStore.get('_ga')?.value
  return clientIdFromGaCookie(value)
}
