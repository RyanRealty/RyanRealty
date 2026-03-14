/**
 * FollowUp Boss API – used to find/sync people when they sign in (e.g. with Google).
 * Auth: Basic with API key as username, password empty.
 * Optional: X-System and X-System-Key from https://apps.followupboss.com/system-registration
 */

const FUB_BASE = 'https://api.followupboss.com/v1'

function getAuth(): { apiKey: string; system?: string; systemKey?: string } | null {
  const apiKey = process.env.FOLLOWUPBOSS_API_KEY?.trim()
  if (!apiKey) return null
  return {
    apiKey,
    system: process.env.FOLLOWUPBOSS_SYSTEM?.trim() || undefined,
    systemKey: process.env.FOLLOWUPBOSS_SYSTEM_KEY?.trim() || undefined,
  }
}

function fubHeaders(auth: { apiKey: string; system?: string; systemKey?: string }): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${auth.apiKey}:`).toString('base64')}`,
  }
  if (auth.system) headers['X-System'] = auth.system
  if (auth.systemKey) headers['X-System-Key'] = auth.systemKey
  return headers
}

export type FubPerson = {
  id: number
  firstName?: string
  lastName?: string
  name?: string
  emails?: Array<{ value: string }>
}

/**
 * Search for a person by email. Returns the first match or null.
 */
export async function findPersonByEmail(email: string): Promise<FubPerson | null> {
  const auth = getAuth()
  if (!auth) return null
  const q = new URLSearchParams({ email: email.trim(), limit: '1', fields: 'id,firstName,lastName,name,emails' })
  const res = await fetch(`${FUB_BASE}/people?${q}`, {
    headers: fubHeaders(auth),
    next: { revalidate: 0 },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { people?: FubPerson[] }
  const people = data.people
  return Array.isArray(people) && people.length > 0 ? people[0] : null
}

export type FubEventPerson = {
  id?: number
  firstName?: string
  lastName?: string
  emails?: Array<{ value: string }>
  phones?: Array<{ value: string }>
}

export type FubProperty = {
  street?: string
  city?: string
  state?: string
  code?: string
  mlsNumber?: string
  price?: number
  url?: string
  bedrooms?: string
  bathrooms?: string
  area?: string
}

export type SendEventParams = {
  type: 'Registration' | 'General Inquiry' | 'Property Inquiry' | 'Viewed Property' | 'Saved Property' | 'Visited Website' | 'Property Search' | 'Saved Property Search' | 'Viewed Page' | 'Seller Inquiry' | 'Visited Open House' | 'Incoming Call' | 'Unsubscribed'
  person: FubEventPerson
  source: string
  system?: string
  sourceUrl?: string
  message?: string
  property?: FubProperty
  pageUrl?: string
  pageTitle?: string
}

/**
 * Send an event to FollowUp Boss (creates or updates the person and triggers automations).
 * Use type "Registration" for sign-ups; FUB matches by email to avoid duplicates.
 */
export async function sendEvent(params: SendEventParams): Promise<{ ok: true; status: number } | { ok: false; status?: number; error?: string }> {
  const auth = getAuth()
  if (!auth) return { ok: false, error: 'FollowUp Boss not configured' }
  const body = {
    type: params.type,
    source: params.source,
    system: params.system ?? 'Ryan Realty Website',
    person: params.person,
    ...(params.sourceUrl && { sourceUrl: params.sourceUrl }),
    ...(params.message && { message: params.message }),
    ...(params.property && Object.keys(params.property).length > 0 && { property: params.property }),
    ...(params.pageUrl && { pageUrl: params.pageUrl }),
    ...(params.pageTitle && { pageTitle: params.pageTitle }),
  }
  const res = await fetch(`${FUB_BASE}/events`, {
    method: 'POST',
    headers: fubHeaders(auth),
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  })
  if (res.status === 204) return { ok: true, status: 204 }
  if (res.ok) return { ok: true, status: res.status }
  let error: string | undefined
  try {
    const data = await res.json() as { error?: string; message?: string }
    error = data.error ?? data.message ?? res.statusText
  } catch {
    error = res.statusText
  }
  return { ok: false, status: res.status, error }
}

/**
 * After a user signs in (e.g. Google), find them in FUB by email and send a Registration
 * event so they're created/updated and tracked as coming from your website.
 */
export async function trackSignedInUser(params: {
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  sourceUrl?: string
  /** e.g. "Signed in (Google)", "Signed in (email)" — used for FUB; merges by email if person exists. */
  message?: string
}): Promise<void> {
  const auth = getAuth()
  if (!auth) return
  const email = params.email?.trim()
  if (!email) return

  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'

  let firstName = params.firstName?.trim()
  let lastName = params.lastName?.trim()
  if ((!firstName || !lastName) && params.fullName?.trim()) {
    const parts = String(params.fullName).trim().split(/\s+/)
    firstName = firstName ?? parts[0]
    lastName = lastName ?? (parts.length > 1 ? parts.slice(1).join(' ') : '')
  }

  const existing = await findPersonByEmail(email)
  const person: FubEventPerson = existing
    ? { id: existing.id }
    : {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        emails: [{ value: email }],
      }

  const message = params.message?.trim() || (existing ? 'Signed in again' : 'Signed up')
  await sendEvent({
    type: 'Registration',
    person,
    source,
    system: 'Ryan Realty Website',
    sourceUrl: params.sourceUrl,
    message,
  })
}

/**
 * Call when a user views a listing. Sends "Viewed Property" to FUB.
 * Use either user.email (signed-in) or fubPersonId (from email-click identity bridge cookie).
 */
export async function trackListingView(params: {
  user?: { email?: string | null }
  /** When set, event is attached to this FUB contact (e.g. from email-click cookie). */
  fubPersonId?: number | null
  listingUrl: string
  property: {
    street?: string
    city?: string
    state?: string
    code?: string
    mlsNumber?: string
    price?: number
    bedrooms?: number
    bathrooms?: number
    area?: number
  }
}): Promise<void> {
  const auth = getAuth()
  if (!auth) return
  const email = params.user?.email?.trim()
  const fubId = params.fubPersonId
  let person: FubEventPerson
  if (email) {
    const existing = await findPersonByEmail(email)
    person = existing ? { id: existing.id } : { emails: [{ value: email }] }
  } else if (fubId != null && fubId > 0) {
    person = { id: fubId }
  } else {
    return
  }

  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'

  await sendEvent({
    type: 'Viewed Property',
    person,
    source,
    system: 'Ryan Realty Website',
    sourceUrl: params.listingUrl,
    property: {
      street: params.property.street,
      city: params.property.city,
      state: params.property.state,
      code: params.property.code,
      mlsNumber: params.property.mlsNumber,
      price: params.property.price,
      url: params.listingUrl,
      bedrooms: params.property.bedrooms != null ? String(params.property.bedrooms) : undefined,
      bathrooms: params.property.bathrooms != null ? String(params.property.bathrooms) : undefined,
      area: params.property.area != null ? String(params.property.area) : undefined,
    },
  })
}

/**
 * Call when a user clicks a listing tile (card) anywhere on the site. Sends "Viewed Property" to FUB
 * with sourceUrl = page they clicked from (home, search, etc.). Silent, fire-and-forget from client.
 * If userEmail is provided, event is attached to that person; otherwise FUB may still record property/source.
 */
export async function trackListingTileClick(params: {
  listingKey: string
  listingUrl: string
  sourcePage: string
  userEmail?: string | null
  /** When set, event is attached to this FUB contact (e.g. from email-click cookie). */
  fubPersonId?: number | null
  property: {
    street?: string
    city?: string
    state?: string
    mlsNumber?: string
    price?: number
    bedrooms?: number
    bathrooms?: number
  }
}): Promise<void> {
  const auth = getAuth()
  if (!auth) return

  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'

  const email = params.userEmail?.trim()
  const fubId = params.fubPersonId
  let person: FubEventPerson
  if (email) {
    const existing = await findPersonByEmail(email)
    person = existing ? { id: existing.id } : { emails: [{ value: email }] }
  } else if (fubId != null && fubId > 0) {
    person = { id: fubId }
  } else {
    person = {}
  }

  await sendEvent({
    type: 'Viewed Property',
    person,
    source,
    system: 'Ryan Realty Website',
    sourceUrl: params.sourcePage,
    pageUrl: params.sourcePage,
    property: {
      street: params.property.street,
      city: params.property.city,
      state: params.property.state,
      mlsNumber: params.property.mlsNumber,
      price: params.property.price,
      url: params.listingUrl,
      bedrooms: params.property.bedrooms != null ? String(params.property.bedrooms) : undefined,
      bathrooms: params.property.bathrooms != null ? String(params.property.bathrooms) : undefined,
    },
  })
}

/**
 * Call when a user saves a listing (like/save). Sends "Saved Property" to FUB. Fire after save succeeds.
 */
export async function trackSavedProperty(params: {
  userEmail: string
  listingKey: string
  listingUrl: string
  sourcePage?: string
  property: {
    street?: string
    city?: string
    state?: string
    mlsNumber?: string
    price?: number
    bedrooms?: number
    bathrooms?: number
  }
}): Promise<void> {
  const auth = getAuth()
  if (!auth) return
  const email = params.userEmail?.trim()
  if (!email) return

  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'

  const existing = await findPersonByEmail(email)
  const person: FubEventPerson = existing ? { id: existing.id } : { emails: [{ value: email }] }

  await sendEvent({
    type: 'Saved Property',
    person,
    source,
    system: 'Ryan Realty Website',
    sourceUrl: params.sourcePage ?? params.listingUrl,
    property: {
      street: params.property.street,
      city: params.property.city,
      state: params.property.state,
      mlsNumber: params.property.mlsNumber,
      price: params.property.price,
      url: params.listingUrl,
      bedrooms: params.property.bedrooms != null ? String(params.property.bedrooms) : undefined,
      bathrooms: params.property.bathrooms != null ? String(params.property.bathrooms) : undefined,
    },
  })
}

/**
 * Call when a user initiates contact about a listing (e.g. clicks "Send an email" in Contact agent).
 * Sends "Property Inquiry" to FUB so the contact is attributed to this listing.
 * Use userEmail (signed-in) or fubPersonId (from email-click cookie) when available so FUB knows who inquired.
 */
export async function trackContactAgentInquiry(params: {
  listingUrl: string
  userEmail?: string | null
  fubPersonId?: number | null
  property: {
    street?: string
    city?: string
    state?: string
    mlsNumber?: string
    price?: number
    bedrooms?: number
    bathrooms?: number
  }
  message?: string
}): Promise<void> {
  const auth = getAuth()
  if (!auth) return
  const email = params.userEmail?.trim()
  const fubId = params.fubPersonId
  let person: FubEventPerson
  if (email) {
    const existing = await findPersonByEmail(email)
    person = existing ? { id: existing.id } : { emails: [{ value: email }] }
  } else if (fubId != null && fubId > 0) {
    person = { id: fubId }
  } else {
    person = {}
  }
  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'
  await sendEvent({
    type: 'Property Inquiry',
    person,
    source,
    system: 'Ryan Realty Website',
    sourceUrl: params.listingUrl,
    message: params.message ?? 'Contact agent - email',
    property: {
      street: params.property.street,
      city: params.property.city,
      state: params.property.state,
      mlsNumber: params.property.mlsNumber,
      price: params.property.price,
      url: params.listingUrl,
      bedrooms: params.property.bedrooms != null ? String(params.property.bedrooms) : undefined,
      bathrooms: params.property.bathrooms != null ? String(params.property.bathrooms) : undefined,
    },
  })
}

/**
 * Fire-and-forget page view: calls trackPageView when session or fubPersonId is available.
 * Use in server components so analytics never block the response.
 */
export function trackPageViewIfPossible(params: {
  sessionUser?: { email?: string | null } | null
  fubPersonId?: number | null
  pageUrl: string
  pageTitle?: string
}): void {
  if (params.sessionUser?.email) {
    trackPageView({ user: params.sessionUser, pageUrl: params.pageUrl, pageTitle: params.pageTitle }).catch(() => {})
  } else if (params.fubPersonId != null && params.fubPersonId > 0) {
    trackPageView({ fubPersonId: params.fubPersonId, pageUrl: params.pageUrl, pageTitle: params.pageTitle }).catch(() => {})
  }
}

/**
 * Call when a user views a page (e.g. search, home). Sends "Viewed Page" to FUB.
 * Use either user.email (signed-in) or fubPersonId (from email-click identity bridge cookie).
 */
export async function trackPageView(params: {
  user?: { email?: string | null }
  /** When set, event is attached to this FUB contact (e.g. from email-click cookie). */
  fubPersonId?: number | null
  pageUrl: string
  pageTitle?: string
}): Promise<void> {
  const auth = getAuth()
  if (!auth) return
  const email = params.user?.email?.trim()
  const fubId = params.fubPersonId
  let person: FubEventPerson
  if (email) {
    const existing = await findPersonByEmail(email)
    person = existing ? { id: existing.id } : { emails: [{ value: email }] }
  } else if (fubId != null && fubId > 0) {
    person = { id: fubId }
  } else {
    return
  }

  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'

  await sendEvent({
    type: 'Viewed Page',
    person,
    source,
    system: 'Ryan Realty Website',
    sourceUrl: params.pageUrl,
    pageUrl: params.pageUrl,
    pageTitle: params.pageTitle,
  })
}

/**
 * Call when a returning visitor is detected (e.g. same user, session or cookie older than 24h).
 * Sends "Visited Website" with message "return" so FUB can tag or segment return traffic.
 */
export async function trackReturnVisit(params: {
  userEmail: string
  pageUrl: string
  pageTitle?: string
}): Promise<void> {
  const auth = getAuth()
  if (!auth) return
  const email = params.userEmail?.trim()
  if (!email) return

  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'

  const existing = await findPersonByEmail(email)
  const person: FubEventPerson = existing ? { id: existing.id } : { emails: [{ value: email }] }

  await sendEvent({
    type: 'Visited Website',
    person,
    source,
    system: 'Ryan Realty Website',
    sourceUrl: params.pageUrl,
    pageUrl: params.pageUrl,
    pageTitle: params.pageTitle,
    message: 'return',
  })
}
