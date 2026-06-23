import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeEmail, normalizePhone } from './resolvePersonIdentity'
import { buildNativePersonRow } from './nativeCreate'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

/**
 * Native-capture fallback on a FUB push failure (CONTACT360 Phase 0.2 — stop a
 * FUB outage from silently dropping leads). Every lead-capture path that pushes
 * to Follow Up Boss (seller LP, FSBO LP, buyer/general LP) relies on FUB to
 * be the system of record. When the FUB push FAILS — outage, rate-limit, bad
 * key — and we can't even resolve the person back out of FUB, the lead used to
 * vanish: no FUB person, no crm_* row, nothing. This is the shared native
 * find-or-create those failure branches call so a failed FUB push still yields
 * a tracked native lead in crm_people + crm_contact_points.
 *
 * Lookup is email-FIRST then phone, on the same FUB-INDEPENDENT join keys the
 * rest of the CRM uses: a normalized (lowercased) email or a last-10-digit
 * phone, matched against crm_contact_points (the same shape the FUB mirror
 * writes — see lib/crm/mirror.ts upsertCrmMirrorPerson). On a MISS we insert a
 * crm_people row + its contact points keyed to those same normalized values, so
 * once FUB recovers and the delta sync mirrors the same person, the contact
 * point lookup already resolves to a native row instead of orphaning a
 * duplicate.
 *
 * This NEVER touches suppressions or subscribes a contact into any channel — it
 * only records that the lead exists (a person row + contact points). All
 * consent / channel-enrollment decisions stay in the suppression chokepoint
 * (lib/crm/suppressions.ts) and the canonical tagger downstream.
 *
 * DAL boundary (G1): the raw .from() reads/writes live here, inside lib/data/.
 */

/** Default-broker rule for an unstaffed native fallback lead (routes to Matt). */
const DEFAULT_BROKER: CrmBrokerSlug = 'matt'

export type EnsureNativeLeadInput = {
  name?: string | null
  email?: string | null
  phone?: string | null
  /** Origin label stamped on crm_people.source (e.g. 'seller-lp', 'fsbo-lp'). */
  source: string
  /** Extra tags to stamp on the created person (audience:*, source:*, etc.). */
  tags?: string[]
  /**
   * Broker to assign the native lead to. Defaults to Matt. Callers pass the
   * agent-attributed broker (?agent= cookie) so a FUB-outage fallback still
   * routes a Rebecca/Paul ad lead to the right broker instead of Matt.
   */
  assignedBroker?: CrmBrokerSlug
}

export type EnsureNativeLeadResult = { personId: number; created: boolean }

/**
 * The find-or-create DECISION, pure + unit-tested (no Supabase). Given the
 * lookups already run (email-first match, then phone match) plus the normalized
 * keys, decide whether to reuse an existing person or create a new one, and
 * which contact points the create must write.
 *
 * Rules:
 *   - email match wins (email-first) — reuse, never create.
 *   - else phone match — reuse, never create.
 *   - else create, but ONLY when we have at least one usable normalized key to
 *     anchor a contact point on (no key => nothing to dedupe/resolve on later,
 *     so we skip rather than orphan an unfindable lead).
 *
 * `contactPoints` lists exactly what to insert on a create (deduped, normalized,
 * email-before-phone, email primary when present).
 */
export type NativeLeadDecision =
  | { action: 'reuse'; personId: number }
  | { action: 'create'; contactPoints: Array<{ kind: 'email' | 'phone'; value: string; is_primary: boolean }> }
  | { action: 'skip' }

export function decideNativeLeadAction(params: {
  emailMatchPersonId: number | null
  phoneMatchPersonId: number | null
  normalizedEmail: string | null
  normalizedPhone: string | null
}): NativeLeadDecision {
  // Email-first: a resolved email match always wins.
  if (params.emailMatchPersonId !== null) {
    return { action: 'reuse', personId: params.emailMatchPersonId }
  }
  // Phone fallback.
  if (params.phoneMatchPersonId !== null) {
    return { action: 'reuse', personId: params.phoneMatchPersonId }
  }
  // Create-on-miss, but only with a usable key to anchor the new contact point.
  const contactPoints: Array<{ kind: 'email' | 'phone'; value: string; is_primary: boolean }> = []
  if (params.normalizedEmail) {
    contactPoints.push({ kind: 'email', value: params.normalizedEmail, is_primary: true })
  }
  if (params.normalizedPhone) {
    // Phone is primary only when there is no email (email leads the identity).
    contactPoints.push({ kind: 'phone', value: params.normalizedPhone, is_primary: params.normalizedEmail === null })
  }
  if (contactPoints.length === 0) return { action: 'skip' }
  return { action: 'create', contactPoints }
}

/** Build the crm_people.name from an explicit name, else a key-derived placeholder. */
export function nativeLeadName(
  name: string | null | undefined,
  normalizedEmail: string | null,
  normalizedPhone: string | null,
): string {
  const trimmed = String(name ?? '').trim()
  if (trimmed) return trimmed
  if (normalizedEmail) return `Lead ${normalizedEmail}`
  if (normalizedPhone) return `Lead ${normalizedPhone}`
  return 'Website lead'
}

/** Split a full name into first/last for crm_people (mirrors the LP convention). */
function splitName(name: string | null | undefined): { first: string | null; last: string | null } {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: null, last: null }
  return { first: parts[0], last: parts.slice(1).join(' ') || null }
}

/** Look up the crm_people id behind one normalized contact-point value. */
async function lookupPersonIdByContactPoint(
  sb: ReturnType<typeof createServiceClient>,
  kind: 'email' | 'phone',
  value: string,
): Promise<number | null> {
  const { data, error } = await sb
    .from('crm_contact_points')
    .select('person_id')
    .eq('kind', kind)
    .eq('value', value)
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const id = data.person_id as number | null
  return typeof id === 'number' ? id : null
}

/**
 * Find-or-create a native crm_people lead by normalized email (first) then
 * phone. Returns the resolved person id + whether this call created it. Safe to
 * call from any FUB-push failure branch — it never throws on a DB hiccup (it
 * logs and returns the best result it has), so the lead-capture handler can
 * still return success to the visitor.
 */
export async function ensureNativeLead(input: EnsureNativeLeadInput): Promise<EnsureNativeLeadResult> {
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedPhone = normalizePhone(input.phone)

  const sb = createServiceClient()

  // Email-first lookup, then phone — the FUB-independent join keys.
  const emailMatchPersonId = normalizedEmail
    ? await lookupPersonIdByContactPoint(sb, 'email', normalizedEmail)
    : null
  const phoneMatchPersonId =
    emailMatchPersonId === null && normalizedPhone
      ? await lookupPersonIdByContactPoint(sb, 'phone', normalizedPhone)
      : null

  const decision = decideNativeLeadAction({
    emailMatchPersonId,
    phoneMatchPersonId,
    normalizedEmail,
    normalizedPhone,
  })

  if (decision.action === 'reuse') {
    return { personId: decision.personId, created: false }
  }
  if (decision.action === 'skip') {
    return { personId: 0, created: false }
  }

  // Create — person row first, then its contact points keyed on the same
  // normalized values the lookup uses (so the next resolve hits this row). The
  // crm_people payload comes from the shared canonical builder so the native
  // create shape (source + stage + assigned_broker + source-tag) is identical to
  // the inbound-phone path and can never drift.
  const { first, last } = splitName(input.name)
  const emailObjs = normalizedEmail ? [{ value: normalizedEmail, type: 'Primary', isPrimary: 1 }] : []
  const phoneObjs = normalizedPhone ? [{ value: normalizedPhone, type: 'Mobile', isPrimary: normalizedEmail ? 0 : 1 }] : []
  const personRow = buildNativePersonRow({
    name: nativeLeadName(input.name, normalizedEmail, normalizedPhone),
    first_name: first,
    last_name: last,
    source: input.source,
    assignedBroker: input.assignedBroker ?? DEFAULT_BROKER,
    emails: emailObjs,
    phones: phoneObjs,
    tags: input.tags,
  })

  const { data: created, error: createError } = await sb
    .from('crm_people')
    .insert(personRow)
    .select('id')
    .single()

  if (createError || !created) {
    console.warn('[ensureNativeLead] crm_people insert failed:', createError?.message)
    return { personId: 0, created: false }
  }

  const personId = created.id as number
  const { error: pointsError } = await sb.from('crm_contact_points').insert(
    decision.contactPoints.map((p) => ({
      person_id: personId,
      kind: p.kind,
      value: p.value,
      is_primary: p.is_primary,
    })),
  )
  if (pointsError) {
    console.warn('[ensureNativeLead] crm_contact_points insert failed:', pointsError.message)
  }

  return { personId, created: true }
}
