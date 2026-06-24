import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { lookupPersonByPhone, normalizeTo10 } from '@/lib/crm/twilio'
import { buildNativePersonRow } from './nativeCreate'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

/**
 * Native lead-create on an inbound contact (CONTACT360 Phase 0.1 — close the
 * inbound-voice lead leak). An inbound text OR call from an unknown number is a
 * hot signal; the old voice handler only logged a timeline if the caller was
 * already known, so unknown callers created NO lead. This is the single shared
 * find-or-create both the inbound-SMS and inbound-voice webhooks call, so the
 * create shape (person + contact point + tags + assignment) stays identical
 * across both channels and never drifts.
 *
 * Lookup reuses lib/crm/twilio.lookupPersonByPhone (crm_contact_points by
 * normalized last-10). On a MISS we insert a crm_people row + a crm_contact_points
 * phone row keyed to the same normalized last-10 the lookup uses, so the very
 * next inbound from that number resolves to this person (no duplicate-on-known).
 *
 * Returns the resolved match plus `created` so the caller knows whether to fire
 * a new-lead broker alert (only on a real create) and which timeline kind to log.
 */

export type FindOrCreateResult = {
  match: { personId: number; name: string | null; broker: CrmBrokerSlug | null } | null
  created: boolean
}

export type InboundLeadSource = 'inbound-call' | 'inbound-sms'

/** Default-broker rule for an unstaffed inbound lead (every inbound routes to Matt). */
const DEFAULT_BROKER: CrmBrokerSlug = 'matt'

/**
 * Pure decision: given an existing lookup result + a normalized phone, decide
 * whether to create. Unit-testable without supabase — this is the create-vs-reuse
 * branch the route relies on. Create only when there is NO existing match AND we
 * have a usable normalized number to key the new contact point on.
 */
export function shouldCreatePerson(
  existing: { personId: number } | null,
  normalizedTen: string | null,
): boolean {
  if (existing) return false
  return Boolean(normalizedTen)
}

/** The display name a freshly-created inbound lead gets (phone-derived placeholder). */
export function inboundLeadName(source: InboundLeadSource, raw: string, normalizedTen: string | null): string {
  const shown = normalizedTen ?? raw
  return source === 'inbound-call' ? `Call lead ${shown}` : `Text lead ${shown}`
}

/**
 * Find the person behind an inbound phone number, creating a tracked lead on a
 * miss. Mirrors the inbound-SMS create shape exactly (only the source / name /
 * tag differ by channel). Safe to call before forwarding/voicemail or before
 * replying to a text — the create never blocks the send path.
 */
export async function findOrCreatePersonByPhone(params: {
  phone: string
  source: InboundLeadSource
  /** Assign a NEW lead to this broker (the owner of the dialed Twilio line).
   *  Defaults to Matt (the default desk). Ignored for an existing contact. */
  assignBroker?: CrmBrokerSlug | null
}): Promise<FindOrCreateResult> {
  const existing = await lookupPersonByPhone(params.phone)
  const ten = normalizeTo10(params.phone)

  if (!shouldCreatePerson(existing, ten)) {
    return { match: existing, created: false }
  }
  // ten is non-null here (shouldCreatePerson guards it), but narrow for TS.
  if (!ten) return { match: existing, created: false }
  const assignedBroker: CrmBrokerSlug = params.assignBroker ?? DEFAULT_BROKER

  // The crm_people payload comes from the shared canonical builder so the native
  // create shape (source + stage + assigned_broker + source-tag) is identical to
  // the FUB-fallback path (ensureNativeLead) and can never drift. Audience is
  // genuinely unknown on a first inbound contact (the caller could be a buyer or
  // a seller), so no audience tag is stamped here — it is assigned later when the
  // contact takes a buyer/seller action, the same convention the lead-integrity
  // gate allows for top-of-funnel registrations.
  const personRow = buildNativePersonRow({
    name: inboundLeadName(params.source, params.phone, ten),
    first_name: null,
    last_name: null,
    source: params.source,
    assignedBroker,
    phones: [{ value: params.phone, type: 'Mobile', isPrimary: 1 }],
  })

  const sb = createServiceClient()
  const { data: created } = await sb
    .from('crm_people')
    .insert(personRow)
    .select('id,name,assigned_broker')
    .single()

  if (!created) {
    // insert failed — fall back to whatever the lookup found (likely null)
    return { match: existing, created: false }
  }

  await sb
    .from('crm_contact_points')
    .insert({ person_id: created.id, kind: 'phone', value: ten, is_primary: true })

  return {
    match: {
      personId: created.id,
      name: created.name,
      broker: (created.assigned_broker as CrmBrokerSlug | null) ?? assignedBroker,
    },
    created: true,
  }
}
