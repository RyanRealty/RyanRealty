/**
 * Legacy Follow Up Boss module — now the NATIVE lead-capture shim.
 *
 * FUB was decommissioned 2026-06-24 (lib/crm/fub-env.ts getFubApiKey() is
 * hardcoded undefined, so no FUB HTTP could ever authenticate). Every FUB HTTP
 * function that used to live here silently no-oped after the cutover and was
 * deleted once its call sites migrated to the in-house equivalents
 * (final sweep 2026-07-15):
 *
 *   - findPersonByEmail / findPersonByPhone  → the personId returned by
 *     sendEvent (ensureNativeLead dedupes email-first, then phone)
 *   - addPersonTags / replacePersonTags / setPersonCustomFields /
 *     assignPersonToUser / updatePersonAutomationState / addPersonNote /
 *     postLeadOriginNote → lib/data/crm/ensureNativeLead.ts enrichNativeLead
 *     (usually via lib/canonical-lead-tagger.ts canonicallyTagLead)
 *   - createRealtimeTask / completeFubTask → createNativeTask + crm_tasks
 *   - trackListingView / trackPageView / trackPropertySearch /
 *     trackSavedPropertySearch / trackListingTileClick / trackSavedProperty /
 *     trackContactAgentInquiry / trackReturnVisit / trackPageViewIfPossible
 *     → deleted; first-party visitor_sessions / visitor_events carries
 *     per-person browsing, and lead-bearing call sites now call sendEvent
 *     directly
 *   - fetchMyLeadsFromFubLive → deleted (zero callers; dashboards read
 *     crm_people via lib/data)
 *
 * What remains, and why:
 *   - sendEvent — the ONE live capture entry point. Keeps the legacy FUB event
 *     signature so its ~25 call sites didn't need a rewrite, but writes to
 *     crm_people via ensureNativeLead and returns the native personId.
 *   - trackSignedInUser — sign-in/sign-up capture; routes through
 *     ensureNativeLead directly.
 *   - isPlaceholderLeadEmail — placeholder-address recognizer (never was
 *     FUB-specific; kept here for its existing importers).
 */

const PLACEHOLDER_EMAIL_RE = /@placeholder\.ryan-realty\.com$/i

/**
 * True when the email is one of our own synthetic placeholder addresses
 * (@placeholder.ryan-realty.com), used as a stand-in for leads with no real
 * email. Recognizing these keeps them out of dedup keys and deliverable
 * address lists. Not FUB-specific despite the historical file location.
 */
export function isPlaceholderLeadEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false
  return PLACEHOLDER_EMAIL_RE.test(email.trim())
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

/**
 * Capture a site event as a native CRM lead (creates or reuses the person and
 * triggers downstream enrollment via the callers' canonical tagging).
 * Use type "Registration" for sign-ups; matching is by email to avoid duplicates.
 */
export async function sendEvent(params: SendEventParams): Promise<{ ok: true; status: number; personId: number | null } | { ok: false; status?: number; error?: string }> {
  // FUB DECOMMISSIONED (cutover 2026-06-24): capture natively instead of POSTing
  // to Follow Up Boss. A lead-bearing event creates/reuses a crm_people lead with
  // inferred audience + source tags; an anonymous tracking event (no email/phone)
  // resolves to nothing (ensureNativeLead skips it). Every former sendEvent caller
  // now writes to the in-house CRM with zero FUB traffic — no per-caller change.
  // First-party visitor_sessions covers page-view tracking the old events carried.
  //
  // Returns the native crm_people personId so LP enrichment can run against it.
  // ensureNativeLead returns personId=0 when it skips (anonymous tracking event
  // with no email/phone), which we surface as null. Callers gate enrichment on a
  // positive id, mirroring the old "resolve the FUB person id" pattern.
  try {
    const email = params.person?.emails?.[0]?.value ?? null
    const phone = params.person?.phones?.[0]?.value ?? null
    const name = [params.person?.firstName, params.person?.lastName].filter(Boolean).join(' ').trim() || null
    const t = params.type
    const audience: 'seller' | 'buyer' | null =
      t === 'Seller Inquiry'
        ? 'seller'
        : t === 'Property Inquiry' || t === 'Viewed Property' || t === 'Saved Property' || t === 'Property Search' || t === 'Saved Property Search'
          ? 'buyer'
          : null
    const tags = [audience ? `audience:${audience}` : null, params.source ? `source:${params.source}` : null].filter(
      (x): x is string => Boolean(x),
    )
    const slug = params.brokerAttribution?.brokerSlug
    const assignedBroker = slug === 'matt' || slug === 'rebecca' || slug === 'paul' ? slug : undefined
    const { ensureNativeLead } = await import('@/lib/data/crm/ensureNativeLead')
    const native = await ensureNativeLead({ name, email, phone, source: params.source, tags, assignedBroker })
    return { ok: true, status: 200, personId: native.personId > 0 ? native.personId : null }
  } catch (err) {
    console.error('[sendEvent → native] capture failed:', err)
    return { ok: false, error: 'native capture failed' }
  }
}

/**
 * After a user signs in or signs up (email, Google, magic link), capture them
 * as a native CRM lead so every authenticated visitor yields a crm_people row.
 *
 * The legacy FUB tail (find-by-email + Registration event) was a dead no-op
 * after the 2026-06-24 decommission and was deleted; the sourceUrl / message /
 * campaign params are retained in the signature for the existing callers but
 * are no longer forwarded anywhere.
 */
export async function trackSignedInUser(params: {
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  sourceUrl?: string
  /** e.g. "Signed in (Google)", "Signed in (email)" — historical FUB message; unused post-cutover. */
  message?: string
  /** UTM/referrer attribution for the visitor's first identification. */
  campaign?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string }
}): Promise<void> {
  const email = params.email?.trim()
  if (!email) return

  let firstName = params.firstName?.trim()
  let lastName = params.lastName?.trim()
  if ((!firstName || !lastName) && params.fullName?.trim()) {
    const parts = String(params.fullName).trim().split(/\s+/)
    firstName = firstName ?? parts[0]
    lastName = lastName ?? (parts.length > 1 ? parts.slice(1).join(' ') : '')
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || params.fullName?.trim() || null
  try {
    const { ensureNativeLead } = await import('@/lib/data/crm/ensureNativeLead')
    await ensureNativeLead({ name: fullName, email, source: 'website-signup', tags: ['source:website-signup'] })
  } catch (err) {
    console.warn('[trackSignedInUser] native capture failed:', err)
  }
}
