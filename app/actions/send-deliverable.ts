'use server'

/**
 * sendDeliverable — THE unified deliverable-send server action (admin rebuild
 * spec 03 §6.1). One action, one auth shape, one at-most-once ledger, one error
 * vocabulary, for every document a broker puts in front of a contact:
 *
 *   cma · bpo · market_report · newsletter · listing_matches
 *
 * The policy lives in `lib/crm/send-deliverable.ts` (pure + dependency
 * injected, so the contract is unit-testable). This file is the wiring: it
 * binds the real auth guards, the real A5 idempotency ledger, and the dispatch
 * table to the KEPT send engines.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   Suppression, the Oregon ORS 696.820 disclosure block, quiet hours, A2P and
 *   the wrong-recipient guard all stay INSIDE the engines below, where they are
 *   already enforced fail-closed. A second copy at the chokepoint could drift
 *   from the one that actually runs — the exact failure mode this rebuild
 *   exists to remove. The chokepoint adds uniform auth + at-most-once + a
 *   stable errorKind, and nothing else.
 *
 * DRAFT-FIRST: nothing here is ever reached without an explicit broker tap.
 *
 * Enforced by `scripts/check-deliverable-send-chokepoint.mjs`
 * (`ci:deliverable-send-chokepoint`): the dispatch table must cover every kind,
 * the guards must be the real ones, and no NEW surface may import a
 * deliverable-send action directly instead of calling this.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { requireCrmAccess, requirePersonInScope, type CrmAccess } from '@/app/actions/crm'
import { withSendIdempotency } from '@/lib/crm/idempotency'
import {
  runSendDeliverable,
  type DeliverableDispatchResult,
  type DeliverableKind,
  type SendDeliverableDeps,
  type SendDeliverableInput,
  type SendDeliverableResult,
} from '@/lib/crm/send-deliverable'

import { sendCmaForContactAction } from '@/app/actions/contact-cma'
import { sendBpoForContactAction } from '@/app/actions/contact-bpo'
import { sendMarketReportNowAction } from '@/app/actions/crm-send-now'
import { sendNewsletterToContactAction } from '@/app/actions/contact-newsletter'
import { sendListingMatchesForContactAction } from '@/app/actions/contact-listing-matches'
import { normalizeSavedSearchFrequency } from '@/lib/saved-search-frequency'

function str(override: Record<string, unknown> | undefined, key: string): string | null {
  const v = override?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * The dispatch table. One entry per DeliverableKind — the gate pins this
 * against DELIVERABLE_KINDS so a new kind cannot ship without a real send path.
 */
const dispatch: SendDeliverableDeps<CrmAccess>['dispatch'] = {
  async cma(input): Promise<DeliverableDispatchResult> {
    const slug = (input.ref ?? '').trim()
    if (!slug) return { ok: false, error: 'Pick a finalized CMA to send' }
    return sendCmaForContactAction(slug)
  },

  async bpo(input): Promise<DeliverableDispatchResult> {
    const slug = (input.ref ?? '').trim()
    if (!slug) return { ok: false, error: 'Pick a final price opinion to send' }
    const includeOfferStrategy = input.override?.includeOfferStrategy === true
    return sendBpoForContactAction(input.personId, slug, includeOfferStrategy)
  },

  async market_report(input): Promise<DeliverableDispatchResult> {
    const raw = input.override?.areas
    const areas = Array.isArray(raw) ? raw.map((a) => String(a).trim()).filter(Boolean) : []
    if (areas.length === 0) return { ok: false, error: 'Pick at least one area first' }
    const fd = new FormData()
    for (const a of areas) fd.append('areas', a)
    // Area slugs are re-validated against the registry inside the action; an
    // unknown slug fails there with a named error, never silently sends empty.
    return sendMarketReportNowAction(input.personId, fd)
  },

  async newsletter(input): Promise<DeliverableDispatchResult> {
    // No inner idempotency key: the chokepoint already holds the ledger claim
    // for this send, so passing a second key would open a second ledger row for
    // one broker intent.
    return sendNewsletterToContactAction(input.personId)
  },

  async listing_matches(input): Promise<DeliverableDispatchResult> {
    const filtersJson = str(input.override, 'filtersJson') ?? (input.ref ?? '').trim()
    if (!filtersJson) return { ok: false, error: 'Nothing to send — the saved search has no filters' }
    const name = str(input.override, 'name')
    const frequency = normalizeSavedSearchFrequency(str(input.override, 'frequency') ?? undefined)
    return sendListingMatchesForContactAction(input.personId, filtersJson, { name, frequency })
  },
}

async function personExists(personId: number): Promise<boolean> {
  const sb = createServiceClient()
  const { data, error } = await sb.from('crm_people').select('id').eq('id', personId).maybeSingle()
  // Fail OPEN on a read error: the engines below each resolve the person again
  // and refuse on their own if it is missing. Refusing here on a transient
  // Supabase blip would block a legitimate send with a misleading "not found".
  if (error) return true
  return Boolean(data)
}

const deps: SendDeliverableDeps<CrmAccess> = {
  // The CrmAccess travels through UNCHANGED — see the docblock on
  // SendDeliverableDeps: narrowing it would scope the owner to his own leads.
  requireAccess: requireCrmAccess,
  requireScope: requirePersonInScope,
  personExists,
  withIdempotency: withSendIdempotency,
  dispatch,
}

/** THE unified deliverable send. Every deliverable send goes through here. */
export async function sendDeliverable(input: SendDeliverableInput): Promise<SendDeliverableResult> {
  return runSendDeliverable(input, deps)
}

/**
 * Convenience wrapper for the `(idempotencyKey) => result` shape the person
 * page's SendPanel props use. Kept here (not in the page) so the page never
 * imports a deliverable-send engine directly.
 */
export async function sendDeliverableForPerson(
  personId: number,
  kind: DeliverableKind,
  idempotencyKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await sendDeliverable({ personId, kind, idempotencyKey })
  return r.ok ? { ok: true } : { ok: false, error: r.error }
}
