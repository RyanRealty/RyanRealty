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
  try {
    const q = new URLSearchParams({ email: email.trim(), limit: '1', fields: 'id,firstName,lastName,name,emails' })
    const res = await fetch(`${FUB_BASE}/people?${q}`, {
      headers: fubHeaders(auth),
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { people?: FubPerson[] }
    const people = data.people
    return Array.isArray(people) && people.length > 0 ? people[0] : null
  } catch (err) {
    console.error('[findPersonByEmail] Network error:', err)
    return null
  }
}

export type FubEventPerson = {
  id?: number
  firstName?: string
  lastName?: string
  emails?: Array<{ value: string }>
  phones?: Array<{ value: string }>
  assignedTo?: string
  assignedUserId?: number
  tags?: string[]
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
  brokerAttribution?: {
    brokerSlug: string
    brokerEmail?: string
  }
  campaign?: {
    source?: string
    medium?: string
    campaign?: string
    term?: string
    content?: string
  }
}

type FubUser = {
  id: number
  email?: string
  name?: string
}

const brokerUserIdCache = new Map<string, { id: number; source: 'env_map' | 'email_lookup' }>()

function parseBrokerUserMapFromEnv(): Record<string, number> {
  const raw = process.env.FOLLOWUPBOSS_BROKER_USER_MAP?.trim()
  if (!raw) return {}
  const parsed: Record<string, number> = {}
  for (const pair of raw.split(',')) {
    const [k, v] = pair.split(':')
    const key = (k ?? '').trim().toLowerCase()
    const value = Number((v ?? '').trim())
    if (!key || !Number.isFinite(value) || value <= 0) continue
    parsed[key] = value
  }
  return parsed
}

function getMappedUserIdForSlug(slug: string): number | null {
  const brokerSlug = slug.trim().toLowerCase()
  if (!brokerSlug) return null
  const mapped = parseBrokerUserMapFromEnv()[brokerSlug]
  return mapped && mapped > 0 ? mapped : null
}

function isBrokerAssignmentGuardrailEnabled(): boolean {
  const raw = process.env.FOLLOWUPBOSS_REQUIRE_BROKER_ASSIGNMENT?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

async function findUserByEmail(email: string): Promise<FubUser | null> {
  const auth = getAuth()
  if (!auth) return null
  try {
    const q = new URLSearchParams({
      email: email.trim(),
      limit: '1',
      fields: 'id,email,name',
    })
    const res = await fetch(`${FUB_BASE}/users?${q}`, {
      headers: fubHeaders(auth),
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { users?: FubUser[] }
    const users = data.users
    return Array.isArray(users) && users.length > 0 ? users[0] : null
  } catch (err) {
    console.error('[findUserByEmail] Network error:', err)
    return null
  }
}

async function getBrokerEmailBySlug(slug: string): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!baseUrl || !anonKey) return null
  const brokerSlug = slug.trim().toLowerCase()
  if (!brokerSlug) return null
  const url = new URL(`${baseUrl}/rest/v1/brokers`)
  url.searchParams.set('select', 'email')
  url.searchParams.set('slug', `eq.${brokerSlug}`)
  url.searchParams.set('is_active', 'eq.true')
  url.searchParams.set('limit', '1')
  const res = await fetch(url.toString(), {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) return null
  const data = (await res.json()) as Array<{ email?: string | null }>
  if (!Array.isArray(data) || data.length === 0) return null
  const email = data[0]?.email?.trim()
  return email || null
}

type ResolvedAssignedUser = {
  id: number | null
  source: 'env_map' | 'email_lookup' | 'none'
  brokerEmailUsed: string | null
}

async function resolveAssignedUserIdWithSource(
  brokerSlug: string,
  brokerEmail?: string
): Promise<ResolvedAssignedUser> {
  const slug = brokerSlug.trim().toLowerCase()
  if (!slug) {
    return { id: null, source: 'none', brokerEmailUsed: null }
  }
  const cached = brokerUserIdCache.get(slug)
  if (cached) {
    return { id: cached.id, source: cached.source, brokerEmailUsed: brokerEmail?.trim() || null }
  }

  const mapped = getMappedUserIdForSlug(slug)
  if (mapped) {
    brokerUserIdCache.set(slug, { id: mapped, source: 'env_map' })
    return { id: mapped, source: 'env_map', brokerEmailUsed: brokerEmail?.trim() || null }
  }

  const emailFromBroker = brokerEmail?.trim() || (await getBrokerEmailBySlug(slug))
  if (!emailFromBroker) {
    return { id: null, source: 'none', brokerEmailUsed: null }
  }

  const user = await findUserByEmail(emailFromBroker)
  if (!user?.id) {
    return { id: null, source: 'none', brokerEmailUsed: emailFromBroker }
  }
  brokerUserIdCache.set(slug, { id: user.id, source: 'email_lookup' })
  return { id: user.id, source: 'email_lookup', brokerEmailUsed: emailFromBroker }
}

async function resolveAssignedUserId(brokerSlug: string, brokerEmail?: string): Promise<number | null> {
  const resolved = await resolveAssignedUserIdWithSource(brokerSlug, brokerEmail)
  return resolved.id
}

async function resolvePersonId(person: FubEventPerson): Promise<number | null> {
  if (person.id && person.id > 0) return person.id
  const email = person.emails?.[0]?.value?.trim()
  if (!email) return null
  const existing = await findPersonByEmail(email)
  return existing?.id ?? null
}

async function updatePersonAttribution(params: {
  personId: number
  brokerSlug: string
  assignedUserId?: number | null
}): Promise<boolean> {
  const auth = getAuth()
  if (!auth) return false
  const slug = params.brokerSlug.trim().toLowerCase()
  if (!slug) return false
  const tags = [`broker:${slug}`]
  const body: Record<string, unknown> = { tags }
  if (params.assignedUserId && params.assignedUserId > 0) {
    body.assignedUserId = params.assignedUserId
  }
  const res = await fetch(`${FUB_BASE}/people/${params.personId}?mergeTags=true`, {
    method: 'PUT',
    headers: fubHeaders(auth),
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  }).catch(() => null)
  return !!res?.ok
}

type BrokerAttributionOutcome = {
  personId: number | null
  assignedUserId: number | null
  attributionUpdated: boolean
}

async function applyBrokerAttribution(params: {
  person: FubEventPerson
  brokerSlug: string
  brokerEmail?: string
}): Promise<BrokerAttributionOutcome> {
  const personId = await resolvePersonId(params.person)
  if (!personId) {
    return { personId: null, assignedUserId: null, attributionUpdated: false }
  }
  const assignedUserId = await resolveAssignedUserId(params.brokerSlug, params.brokerEmail)
  const attributionUpdated = await updatePersonAttribution({
    personId,
    brokerSlug: params.brokerSlug,
    assignedUserId,
  })
  return {
    personId,
    assignedUserId,
    attributionUpdated,
  }
}

export type BrokerAttributionDiagnostic = {
  brokerSlug: string
  brokerEmail: string | null
  mappedUserId: number | null
  resolvedAssignedUserId: number | null
  resolutionSource: 'env_map' | 'email_lookup' | 'none'
  brokerEmailUsed: string | null
  brokerTag: string
}

/**
 * Resolve how broker assignment would be applied in FUB for diagnostics in admin.
 */
export async function diagnoseBrokerAttribution(params: {
  brokerSlug: string
  brokerEmail?: string | null
}): Promise<BrokerAttributionDiagnostic> {
  const slug = params.brokerSlug.trim().toLowerCase()
  const email = params.brokerEmail?.trim() || null
  const resolved = await resolveAssignedUserIdWithSource(slug, email ?? undefined)
  return {
    brokerSlug: slug,
    brokerEmail: email,
    mappedUserId: getMappedUserIdForSlug(slug),
    resolvedAssignedUserId: resolved.id,
    resolutionSource: resolved.source,
    brokerEmailUsed: resolved.brokerEmailUsed,
    brokerTag: `broker:${slug}`,
  }
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
    ...(params.campaign && Object.values(params.campaign).some(Boolean) && { campaign: params.campaign }),
  }
  let res: Response
  try {
    res = await fetch(`${FUB_BASE}/events`, {
      method: 'POST',
      headers: fubHeaders(auth),
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    })
  } catch (err) {
    console.error('[sendEvent] Network error:', err)
    return { ok: false, error: 'FUB network error' }
  }
  if (res.status === 204) {
    if (params.brokerAttribution?.brokerSlug) {
      const attribution = await applyBrokerAttribution({
        person: params.person,
        brokerSlug: params.brokerAttribution.brokerSlug,
        brokerEmail: params.brokerAttribution.brokerEmail,
      })
      if (!attribution.assignedUserId || !attribution.attributionUpdated) {
        const message = `FUB broker attribution incomplete for "${params.brokerAttribution.brokerSlug}" (person=${attribution.personId ?? 'unknown'})`
        if (isBrokerAssignmentGuardrailEnabled()) {
          return { ok: false, status: 500, error: `${message}. Set FOLLOWUPBOSS_BROKER_USER_MAP or matching broker email.` }
        }
        console.error(message)
      }
    }
    return { ok: true, status: 204 }
  }
  if (res.ok) {
    if (params.brokerAttribution?.brokerSlug) {
      const attribution = await applyBrokerAttribution({
        person: params.person,
        brokerSlug: params.brokerAttribution.brokerSlug,
        brokerEmail: params.brokerAttribution.brokerEmail,
      })
      if (!attribution.assignedUserId || !attribution.attributionUpdated) {
        const message = `FUB broker attribution incomplete for "${params.brokerAttribution.brokerSlug}" (person=${attribution.personId ?? 'unknown'})`
        if (isBrokerAssignmentGuardrailEnabled()) {
          return { ok: false, status: 500, error: `${message}. Set FOLLOWUPBOSS_BROKER_USER_MAP or matching broker email.` }
        }
        console.error(message)
      }
    }
    return { ok: true, status: res.status }
  }
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
