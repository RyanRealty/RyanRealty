import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeEmail, normalizePhone } from './resolvePersonIdentity'
import { buildNativePersonRow } from './nativeCreate'
import { CRM_BROKERS, type CrmBrokerSlug } from '@/lib/crm/constants'
import { pickRoutedBroker } from '@/lib/crm/lead-routing'

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

/** Coerce a routed slug to a known CRM broker, failing safe to the default (Matt). */
function coerceBroker(slug: string): CrmBrokerSlug {
  return (CRM_BROKERS as readonly string[]).includes(slug) ? (slug as CrmBrokerSlug) : DEFAULT_BROKER
}

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
    // REUSE: merge the caller's tags into the existing person + refresh source /
    // assigned_broker when provided. Without this the second touch from an LP
    // (the same email/phone re-submitting a different form) would silently drop
    // the new audience:/source:/intent: tags and the routed broker — the lead
    // would keep its first-touch attribution forever. Merge, never overwrite the
    // tag set. Non-fatal on a DB hiccup (the lead already exists).
    await mergeReuseEnrichment(sb, decision.personId, {
      tags: input.tags,
      source: input.source,
      assignedBroker: input.assignedBroker,
    })
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
  // Broker: an explicit assignedBroker (e.g. an ?agent= attributed Rebecca/Paul
  // ad lead) always wins. Otherwise route through the lead-routing engine, whose
  // live behavior is all-to-Matt (seeded strategy) until an owner flips it.
  const routedBroker = input.assignedBroker ?? coerceBroker(await pickRoutedBroker({ source: input.source }))
  const personRow = buildNativePersonRow({
    name: nativeLeadName(input.name, normalizedEmail, normalizedPhone),
    first_name: first,
    last_name: last,
    source: input.source,
    assignedBroker: routedBroker,
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

/** Dedupe + trim a tag list, dropping empties and over-long tags (FUB parity: <=80). */
export function cleanTags(tags: Array<string | null | undefined> | undefined): string[] {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t): t is string => t.length > 0 && t.length <= 80),
    ),
  )
}

/**
 * REUSE-path enrichment: union the new tags onto the existing crm_people.tags
 * array, and update source / assigned_broker when the caller supplied them. Reads
 * the current tags first (Postgres text[] has no in-place merge via supabase-js),
 * then writes the union. Best-effort — logs and swallows on error so a re-submit
 * never breaks the LP response.
 */
async function mergeReuseEnrichment(
  sb: ReturnType<typeof createServiceClient>,
  personId: number,
  input: { tags?: string[]; source?: string; assignedBroker?: CrmBrokerSlug },
): Promise<void> {
  const incoming = cleanTags(input.tags)
  const hasSource = Boolean(input.source?.trim())
  const hasBroker = Boolean(input.assignedBroker)
  if (incoming.length === 0 && !hasSource && !hasBroker) return

  try {
    const { data: existing, error: readError } = await sb
      .from('crm_people')
      .select('tags')
      .eq('id', personId)
      .maybeSingle()
    if (readError) {
      console.warn('[ensureNativeLead] reuse tag read failed:', readError.message)
      return
    }
    const current = Array.isArray(existing?.tags) ? (existing!.tags as string[]) : []
    const update: Record<string, unknown> = {}
    if (incoming.length > 0) {
      const merged = Array.from(new Set([...current, ...incoming]))
      if (merged.length !== current.length) update.tags = merged
    }
    if (hasSource) update.source = input.source!.trim()
    if (hasBroker) update.assigned_broker = input.assignedBroker
    if (Object.keys(update).length === 0) return
    const { error: updateError } = await sb.from('crm_people').update(update).eq('id', personId)
    if (updateError) {
      console.warn('[ensureNativeLead] reuse enrichment update failed:', updateError.message)
    }
  } catch (err) {
    console.warn('[ensureNativeLead] reuse enrichment threw:', err instanceof Error ? err.message : String(err))
  }
}

export type NativeEnrichmentInput = {
  personId: number
  /** Canonical tags to UNION onto crm_people.tags (audience:*, seller:*, etc.). */
  tags?: string[]
  /** Custom fields merged into crm_people.custom jsonb (timeline, tier, address). */
  custom?: Record<string, string | number | boolean | null | undefined>
  /** Broker to (re)assign the person to (the round-robin / attributed broker). */
  assignedBroker?: CrmBrokerSlug
  /** Optional origin note written to crm_timeline as a 'note' row. */
  originNote?: { title?: string; body: string }
}

/**
 * Native lead enrichment — the in-house replacement for the dead FUB enrichment
 * chain (addPersonTags + assignPersonToUser + setPersonCustomFields +
 * postLeadOriginNote). Runs on a resolved native person id from the LP paths:
 *
 *   1. UNION canonical tags onto crm_people.tags (read-modify-write).
 *   2. MERGE custom fields into crm_people.custom jsonb (preserve existing keys).
 *   3. SET assigned_broker (the routed broker — never all-to-Matt by accident).
 *   4. WRITE an origin note to crm_timeline (the "why this lead came in" entry).
 *
 * Best-effort + never throws — a failure here must never fail lead capture. The
 * crm_people row already exists by the time this runs.
 *
 * DAL boundary (G1): the raw .from() writes live here, inside lib/data/.
 */
export async function enrichNativeLead(input: NativeEnrichmentInput): Promise<void> {
  if (!Number.isFinite(input.personId) || input.personId <= 0) return
  const sb = createServiceClient()

  try {
    // 1–3: tags union + custom merge + broker assignment in one read-modify-write.
    const incomingTags = cleanTags(input.tags)
    const customEntries = Object.entries(input.custom ?? {}).filter(([, v]) => v !== undefined)
    const hasBroker = Boolean(input.assignedBroker)
    if (incomingTags.length > 0 || customEntries.length > 0 || hasBroker) {
      const { data: existing, error: readError } = await sb
        .from('crm_people')
        .select('tags, custom')
        .eq('id', input.personId)
        .maybeSingle()
      if (readError) {
        console.warn('[enrichNativeLead] person read failed:', readError.message)
      } else {
        const currentTags = Array.isArray(existing?.tags) ? (existing!.tags as string[]) : []
        const currentCustom =
          existing?.custom && typeof existing.custom === 'object' && !Array.isArray(existing.custom)
            ? (existing.custom as Record<string, unknown>)
            : {}
        const update: Record<string, unknown> = {}
        if (incomingTags.length > 0) {
          update.tags = Array.from(new Set([...currentTags, ...incomingTags]))
        }
        if (customEntries.length > 0) {
          update.custom = { ...currentCustom, ...Object.fromEntries(customEntries) }
        }
        if (hasBroker) update.assigned_broker = input.assignedBroker
        if (Object.keys(update).length > 0) {
          const { error: updateError } = await sb
            .from('crm_people')
            .update(update)
            .eq('id', input.personId)
          if (updateError) console.warn('[enrichNativeLead] person update failed:', updateError.message)
        }
      }
    }

    // 4: origin note → crm_timeline.
    if (input.originNote?.body?.trim()) {
      const { error: noteError } = await sb.from('crm_timeline').insert({
        person_id: input.personId,
        kind: 'note',
        title: input.originNote.title?.trim() || 'Lead origin',
        body: input.originNote.body.trim().slice(0, 4000),
        broker: input.assignedBroker ?? null,
        source: 'lp-form',
      })
      if (noteError) console.warn('[enrichNativeLead] origin note insert failed:', noteError.message)
    }
  } catch (err) {
    console.warn('[enrichNativeLead] threw:', err instanceof Error ? err.message : String(err))
  }
}

export type CreateNativeTaskInput = {
  personId: number
  name: string
  type?: string
  /** Minutes from now the task is due (e.g. 5 for the hot-lead call task). */
  dueInMinutes?: number
  assignedBroker?: CrmBrokerSlug
}

/**
 * Create a native crm_tasks row — the in-house replacement for the dead FUB
 * createRealtimeTask. Used for the 5-minute hot-lead call task on the seller /
 * FSBO / expired LP paths. Best-effort + never throws.
 *
 * DAL boundary (G1): the raw .from() write lives here, inside lib/data/.
 */
export async function createNativeTask(input: CreateNativeTaskInput): Promise<void> {
  if (!Number.isFinite(input.personId) || input.personId <= 0) return
  const name = input.name?.trim()
  if (!name) return
  const dueInMinutes = Number.isFinite(input.dueInMinutes) ? Math.max(1, Number(input.dueInMinutes)) : 5
  const dueAt = new Date(Date.now() + dueInMinutes * 60 * 1000).toISOString()
  try {
    const sb = createServiceClient()
    const { error } = await sb.from('crm_tasks').insert({
      person_id: input.personId,
      name: name.slice(0, 190),
      type: input.type?.trim() || 'Call',
      due_at: dueAt,
      assigned_broker: input.assignedBroker ?? null,
      origin: 'lp-form',
    })
    if (error) console.warn('[createNativeTask] insert failed:', error.message)
  } catch (err) {
    console.warn('[createNativeTask] threw:', err instanceof Error ? err.message : String(err))
  }
}
