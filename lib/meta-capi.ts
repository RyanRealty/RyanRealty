/**
 * Meta Conversions API (CAPI) — server-side. Deduplicate with browser pixel via event_id.
 * Step 19.
 */

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN?.trim()

export type MetaCapiUserData = {
  em?: string // sha256 email
  ph?: string // sha256 phone
  fn?: string // sha256 first name
  ln?: string // sha256 last name
  client_ip_address?: string
  client_user_agent?: string
  fbc?: string
  fbp?: string
}

export type MetaCapiCustomData = Record<string, unknown>

/**
 * Send server event to Meta Conversions API. Call from API routes on key conversions.
 */
export async function sendServerEvent(
  eventName: string,
  userData: MetaCapiUserData,
  customData?: MetaCapiCustomData,
  eventId?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return { ok: false, error: 'META_CAPI_ACCESS_TOKEN or NEXT_PUBLIC_META_PIXEL_ID not set' }
  }
  const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`
  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId ?? `capi_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        user_data: userData,
        ...(customData && Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
        action_source: 'website',
      },
    ],
    access_token: ACCESS_TOKEN,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `${res.status}: ${text}` }
  }
  return { ok: true }
}
