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

function isRealtimeActivityAlertsEnabled(): boolean {
  const raw = process.env.FOLLOWUPBOSS_REALTIME_ACTIVITY_ALERTS?.trim().toLowerCase()
  if (!raw) return true
  return !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off')
}

function isRealtimeActivityTasksEnabled(): boolean {
  const raw = process.env.FOLLOWUPBOSS_REALTIME_ACTIVITY_TASKS?.trim().toLowerCase()
  if (!raw) return true
  return !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off')
}

type RealtimeTaskContext = {
  personId: number
  taskName: string
  taskType?: 'Follow Up' | 'Call' | 'Text' | 'Email'
  dueInMinutes?: number
}

async function getPersonAssignedUserId(personId: number): Promise<number | null> {
  const auth = getAuth()
  if (!auth) return null
  try {
    const query = new URLSearchParams({ fields: 'assignedUserId' })
    const res = await fetch(`${FUB_BASE}/people/${personId}?${query}`, {
      headers: fubHeaders(auth),
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { assignedUserId?: number | null }
    return data.assignedUserId && data.assignedUserId > 0 ? data.assignedUserId : null
  } catch {
    return null
  }
}

export async function createRealtimeTask(params: RealtimeTaskContext): Promise<boolean> {
  if (!isRealtimeActivityTasksEnabled()) return false
  const auth = getAuth()
  if (!auth) return false
  if (!Number.isFinite(params.personId) || params.personId <= 0) return false

  const dueInMinutes = Number.isFinite(params.dueInMinutes) ? Math.max(1, Number(params.dueInMinutes)) : 5
  const dueInSeconds = dueInMinutes * 60
  // Many mobile setups do not push for self-created tasks. Force a near-immediate
  // reminder so the assigned user still gets a phone alert shortly after creation.
  const remindSecondsBefore = Math.max(30, dueInSeconds - 30)
  const dueDateTime = new Date(Date.now() + dueInMinutes * 60 * 1000).toISOString()
  const assignedUserId =
    (await getPersonAssignedUserId(params.personId)) ??
    (() => {
      const fallback = Number(process.env.FOLLOWUPBOSS_DEFAULT_ASSIGNED_USER_ID ?? '')
      return Number.isFinite(fallback) && fallback > 0 ? fallback : null
    })()

  const body: Record<string, unknown> = {
    personId: params.personId,
    name: params.taskName.slice(0, 190),
    type: params.taskType ?? 'Call',
    dueDateTime,
    remindSecondsBefore,
  }
  if (assignedUserId) body.assignedUserId = assignedUserId

  try {
    const res = await fetch(`${FUB_BASE}/tasks`, {
      method: 'POST',
      headers: fubHeaders(auth),
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    })
    return res.ok
  } catch (error) {
    console.error('[createRealtimeTask] Network error:', error)
    return false
  }
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
 * Merge one or more tags onto an existing FUB person without removing existing
 * tags. Used by /api/fub/identify and /api/fub/track-page to attach intent
 * signals (e.g. "Seller Intent", "Buyer Intent", "Property View") and source
 * attribution (e.g. "src:facebook") to the person record so Matt can filter,
 * segment, and trigger FUB automations off them.
 *
 * mergeTags=true tells FUB to UNION with existing tags rather than replace.
 * Empty / falsy tags are dropped before sending.
 */
export async function addPersonTags(personId: number, tags: Array<string | undefined | null>): Promise<boolean> {
  const auth = getAuth()
  if (!auth) return false
  if (!Number.isFinite(personId) || personId <= 0) return false
  const cleaned = Array.from(
    new Set(
      tags
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t): t is string => t.length > 0 && t.length <= 80),
    ),
  )
  if (cleaned.length === 0) return false
  try {
    const res = await fetch(`${FUB_BASE}/people/${personId}?mergeTags=true`, {
      method: 'PUT',
      headers: fubHeaders(auth),
      body: JSON.stringify({ tags: cleaned }),
      next: { revalidate: 0 },
    })
    return res.ok
  } catch (err) {
    console.error('[addPersonTags] Network error:', err)
    return false
  }
}

/**
 * Add a note to an existing FUB person. Notes appear in the person's timeline
 * AND in Matt's FUB inbox/notifications when configured. Use for high-signal
 * activity that warrants a push to the FUB app (listing views, seller intent
 * page hits, buyer intent page hits, area guide views).
 *
 * FUB notes API: POST /v1/notes with { personId, body, isHtml? }
 *
 * Note: this is best-effort. If notes can't be created (FUB rate limit, bad
 * person id, etc.) the failure is logged and swallowed — the parent event
 * was already posted.
 */
export async function addPersonNote(personId: number, body: string): Promise<boolean> {
  const auth = getAuth()
  if (!auth) return false
  if (!Number.isFinite(personId) || personId <= 0) return false
  const trimmed = body.trim().slice(0, 2000)
  if (!trimmed) return false
  try {
    const res = await fetch(`${FUB_BASE}/notes`, {
      method: 'POST',
      headers: fubHeaders(auth),
      body: JSON.stringify({ personId, body: trimmed, isHtml: false }),
      next: { revalidate: 0 },
    })
    return res.ok
  } catch (err) {
    console.error('[addPersonNote] Network error:', err)
    return false
  }
}

/**
 * Assign a FUB person to a specific user (broker). This is what powers the
 * round-robin between Matt and Rebecca for new seller leads. The userId is
 * the FUB-side numeric id (Matt=1, Rebecca=2, Paul=3 as of 2026-05-17).
 *
 * Sets `assignedUserId` on the person record. FUB downstream rules can also
 * read this for action-plan enrollment, smart-list filtering, and round-robin
 * distribution checks.
 *
 * Returns true on success. Logs and swallows network/422 errors so the caller
 * (typically a lead-capture path) can continue with the rest of the workflow.
 */
export async function assignPersonToUser(personId: number, userId: number): Promise<boolean> {
  const auth = getAuth()
  if (!auth) return false
  if (!Number.isFinite(personId) || personId <= 0) return false
  if (!Number.isFinite(userId) || userId <= 0) return false
  try {
    const res = await fetch(`${FUB_BASE}/people/${personId}`, {
      method: 'PUT',
      headers: fubHeaders(auth),
      body: JSON.stringify({ assignedUserId: userId }),
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      console.warn(`[assignPersonToUser] PUT failed: personId=${personId} userId=${userId} status=${res.status}`)
    }
    return res.ok
  } catch (err) {
    console.error('[assignPersonToUser] Network error:', err)
    return false
  }
}

/**
 * Write one or more custom field values on an existing FUB person.
 *
 * Field names are the FUB api-side `name` (e.g. `customMoveTimeline`,
 * `customLeadTier`, `customCMADeliveredAt`). Field schema must already exist
 * in the FUB account (set up via `.tmp_env/fub-setup/01-create-custom-fields.mjs`).
 *
 * The seller LP form uses this to write the timeline classification, tier,
 * and property address that the FUB action plan + smart lists then key off.
 *
 * FUB PUT /people/{id} accepts custom fields as top-level properties on the
 * body, NOT nested under a `customFields` key (verified against the live API
 * 2026-05-17).
 */
export async function setPersonCustomFields(
  personId: number,
  fields: Record<string, string | number | null | undefined>,
): Promise<boolean> {
  const auth = getAuth()
  if (!auth) return false
  if (!Number.isFinite(personId) || personId <= 0) return false

  // Drop undefined values (allow null + empty string through so FUB clears them).
  const body: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue
    if (!k.startsWith('custom')) {
      console.warn(`[setPersonCustomFields] Skipping non-custom field: ${k}`)
      continue
    }
    body[k] = v
  }
  if (Object.keys(body).length === 0) return false

  try {
    const res = await fetch(`${FUB_BASE}/people/${personId}`, {
      method: 'PUT',
      headers: fubHeaders(auth),
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      console.warn(`[setPersonCustomFields] PUT failed: personId=${personId} status=${res.status}`)
    }
    return res.ok
  } catch (err) {
    console.error('[setPersonCustomFields] Network error:', err)
    return false
  }
}

/**
 * Update person stage and/or merge tags on an existing FUB person.
 * This is used to trigger FUB automation workflows in a controlled way.
 */
export async function updatePersonAutomationState(params: {
  personId: number
  stage?: string
  tags?: Array<string | undefined | null>
}): Promise<boolean> {
  const auth = getAuth()
  if (!auth) return false
  if (!Number.isFinite(params.personId) || params.personId <= 0) return false

  const cleanedTags = Array.from(
    new Set(
      (params.tags ?? [])
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter((tag): tag is string => tag.length > 0 && tag.length <= 80),
    ),
  )

  const body: Record<string, unknown> = {}
  if (params.stage?.trim()) body.stage = params.stage.trim()
  if (cleanedTags.length > 0) body.tags = cleanedTags
  if (Object.keys(body).length === 0) return false

  try {
    const response = await fetch(`${FUB_BASE}/people/${params.personId}?mergeTags=true`, {
      method: 'PUT',
      headers: fubHeaders(auth),
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    })
    return response.ok
  } catch (error) {
    console.error('[updatePersonAutomationState] Network error:', error)
    return false
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
  /** UTM/referrer attribution for the visitor's first identification. */
  campaign?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string }
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
    campaign: params.campaign,
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
  /** UTM/referrer attribution carried from the visitor's first session. */
  campaign?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string }
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
    campaign: params.campaign,
  })

  // Optional real-time push signal: add a concise note so Matt gets an app
  // notification when a known contact views a listing.
  if (!isRealtimeActivityAlertsEnabled()) return
  const personId = await resolvePersonId(person)
  if (!personId) return
  const addressLine = [params.property.street, params.property.city, params.property.state].filter(Boolean).join(', ')
  const details: string[] = []
  if (params.property.mlsNumber) details.push(`MLS ${params.property.mlsNumber}`)
  if (params.property.price != null) details.push(`$${params.property.price.toLocaleString()}`)
  const detailsLine = details.length > 0 ? ` (${details.join(' • ')})` : ''
  const who = email ?? `FUB Contact ${personId}`
  const note = `Matt alert: ${who} is viewing listing ${addressLine || params.listingUrl}${detailsLine}.`
  await addPersonNote(personId, note)
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
  /** UTM/referrer attribution carried from the visitor's first session. */
  campaign?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string }
  /** Optional context tag emitted into the event message for FUB filtering
   *  (e.g. "category=seller_intent" so Matt can group page-views by intent). */
  message?: string
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
    campaign: params.campaign,
    message: params.message,
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

  // Optional real-time push signal: add a note so Matt is notified in FUB app.
  if (!isRealtimeActivityAlertsEnabled()) return
  const personId = await resolvePersonId(person)
  if (!personId) return
  const who = email || `FUB Contact ${personId}`
  const titlePart = params.pageTitle?.trim() ? ` (${params.pageTitle.trim()})` : ''
  const note = `Matt alert: ${who} is back on the website and viewing ${params.pageUrl}${titlePart}.`
  await addPersonNote(personId, note)
  await createRealtimeTask({
    personId,
    taskType: 'Call',
    dueInMinutes: 10,
    taskName: 'Lead returned to website. Follow up now.',
  })
}

/**
 * Snapshot row shape consumed by the marketing dashboard and the FUB outreach
 * execution cron. Mirrors the legacy `fub_contacts_cache` row shape so callers
 * can swap data sources (Supabase cache → live FUB API) without changes.
 */
export type FubMyLeadSnapshotRow = {
  fub_id: string
  broker_id: string | null
  stage: string | null
  tags: unknown
  name: string | null
  email: string | null
  source: string | null
}

type FubLivePerson = {
  id?: number
  name?: string
  firstName?: string
  lastName?: string
  emails?: Array<{ value?: string | null }>
  stage?: string | null
  tags?: string[] | null
  source?: string | null
  assignedUserId?: number | null
}

/**
 * Pull "My Leads" for a broker directly from the live FUB People API. Used as
 * the source of truth when the legacy Supabase contact cache table is absent.
 *
 * Resolution order for the FUB user id:
 *   1. `FOLLOWUPBOSS_BROKER_USER_MAP` env (slug → userId pairs).
 *   2. Lookup by broker email via `findUserByEmail`.
 *
 * Returns rows shaped like the old `fub_contacts_cache` snapshot so dashboards
 * and outreach execution can consume them with no schema branching.
 */
export async function fetchMyLeadsFromFubLive(params: {
  brokerSlug?: string | null
  brokerEmail?: string | null
  brokerId?: string | null
  /** Hard cap on rows returned (defaults to 1500). FUB pages are 100/req. */
  limit?: number
}): Promise<{ rows: FubMyLeadSnapshotRow[]; assignedUserId: number | null; warning: string | null }> {
  const auth = getAuth()
  if (!auth) {
    return { rows: [], assignedUserId: null, warning: 'FOLLOWUPBOSS_API_KEY not configured' }
  }

  const slug = params.brokerSlug?.trim().toLowerCase() || ''
  const email = params.brokerEmail?.trim() || null

  let assignedUserId: number | null = null
  if (slug) {
    const mapped = getMappedUserIdForSlug(slug)
    if (mapped) assignedUserId = mapped
  }
  if (!assignedUserId && email) {
    const user = await findUserByEmail(email)
    if (user?.id) assignedUserId = user.id
  }
  if (!assignedUserId) {
    return {
      rows: [],
      assignedUserId: null,
      warning: 'Could not resolve FUB assigned user id (set FOLLOWUPBOSS_BROKER_USER_MAP or broker email).',
    }
  }

  const cap = Math.max(1, Math.min(5000, params.limit ?? 1500))
  const pageSize = 100
  const rows: FubMyLeadSnapshotRow[] = []

  for (let offset = 0; offset < cap; offset += pageSize) {
    const remaining = cap - offset
    const limit = Math.min(pageSize, remaining)
    const query = new URLSearchParams({
      assignedUserId: String(assignedUserId),
      limit: String(limit),
      offset: String(offset),
      fields: 'id,name,firstName,lastName,emails,stage,tags,source,assignedUserId',
    })
    let res: Response
    try {
      res = await fetch(`${FUB_BASE}/people?${query.toString()}`, {
        headers: fubHeaders(auth),
        next: { revalidate: 0 },
      })
    } catch (err) {
      return {
        rows,
        assignedUserId,
        warning: `FUB people fetch network error at offset ${offset}: ${(err as Error).message}`,
      }
    }
    if (!res.ok) {
      return {
        rows,
        assignedUserId,
        warning: `FUB people fetch HTTP ${res.status} at offset ${offset}`,
      }
    }
    const payload = (await res.json().catch(() => null)) as { people?: FubLivePerson[] } | null
    const people = Array.isArray(payload?.people) ? payload!.people : []
    if (people.length === 0) break

    for (const person of people) {
      const fubId = Number(person.id)
      if (!Number.isFinite(fubId) || fubId <= 0) continue
      const fullName =
        (person.name?.trim()) ||
        [person.firstName?.trim(), person.lastName?.trim()].filter(Boolean).join(' ').trim() ||
        null
      const primaryEmail = Array.isArray(person.emails)
        ? (person.emails.find((e) => typeof e?.value === 'string' && (e.value as string).trim().length > 0)?.value ?? null)
        : null
      rows.push({
        fub_id: String(fubId),
        broker_id: params.brokerId ?? null,
        stage: typeof person.stage === 'string' ? person.stage : null,
        tags: Array.isArray(person.tags) ? person.tags : [],
        name: fullName,
        email: primaryEmail ? String(primaryEmail).trim() : null,
        source: typeof person.source === 'string' ? person.source : null,
      })
    }

    if (people.length < limit) break
  }

  return { rows, assignedUserId, warning: null }
}
