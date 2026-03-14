/**
 * Follow Up Boss Events API — server-side only.
 * Pushes events to FUB with system "ryan-realty-platform" and source from site URL.
 */

const FUB_EVENTS_URL = 'https://api.followupboss.com/v1/events'

export interface FubPerson {
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
  /** FUB custom fields (see docs/FUB_CUSTOM_FIELDS.md). */
  customFields?: Record<string, string | number | boolean | null>
}

/**
 * Push an event to Follow Up Boss. Server-side only; use from API routes or server actions.
 * Uses FOLLOWUPBOSS_API_KEY and NEXT_PUBLIC_SITE_URL for source.
 */
export async function pushToFub(
  eventType: string,
  person: FubPerson,
  properties?: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.FOLLOWUPBOSS_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, error: 'FOLLOWUPBOSS_API_KEY is not set' }
  }

  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty-platform'

  const personPayload: {
    emails?: Array<{ value: string }>
    firstName?: string
    lastName?: string
    phones?: Array<{ value: string }>
  } = {}
  if (person.email?.trim()) {
    personPayload.emails = [{ value: person.email.trim() }]
  }
  if (person.firstName?.trim()) personPayload.firstName = person.firstName.trim()
  if (person.lastName?.trim()) personPayload.lastName = person.lastName.trim()
  if (person.phone?.trim()) {
    personPayload.phones = [{ value: person.phone.trim() }]
  }
  const personWithCustom = { ...personPayload, ...(person.customFields && Object.keys(person.customFields).length > 0 ? person.customFields : {}) }

  const body = {
    type: eventType,
    source,
    system: 'ryan-realty-platform',
    person: personWithCustom,
    ...(properties && Object.keys(properties).length > 0 ? properties : {}),
  }

  const res = await fetch(FUB_EVENTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
    },
    body: JSON.stringify(body),
  })

  if (res.status === 204 || res.ok) {
    return { ok: true }
  }

  let error: string
  try {
    const data = (await res.json()) as { error?: string; message?: string }
    error = data.error ?? data.message ?? res.statusText
  } catch {
    error = res.statusText
  }
  return { ok: false, error: `${res.status}: ${error}` }
}
