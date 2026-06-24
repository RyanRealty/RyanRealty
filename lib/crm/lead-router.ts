import 'server-only'
import { ensureNativeLead, type EnsureNativeLeadInput } from '@/lib/data/crm/ensureNativeLead'
import { sendEvent, type SendEventParams } from '@/lib/followupboss'

/**
 * Cutover chokepoint (Twilio/FUB cutover 2026-06-24). The single place that
 * decides whether a captured lead is written to Follow Up Boss, to the in-house
 * CRM (crm_people via ensureNativeLead), or both.
 *
 * `CRM_LEAD_BACKEND` controls it:
 *   - 'fub'    — FUB only (pre-cutover legacy behavior)
 *   - 'dual'   — FUB + native (default; the proving window, zero behavior change
 *                from before since native writes already ran via the mirror)
 *   - 'native' — in-house CRM only; FUB writes stop entirely
 *
 * The flip from 'dual' to 'native' IS the cutover. The native write path does
 * NOT depend on FUB, so crm_people keeps filling the instant FUB is cancelled.
 *
 * Adoption: each lead entry point passes BOTH its native fields and the FUB
 * event it already builds; captureLead runs whichever the flag selects. A native
 * failure never blocks the FUB write and vice-versa (independent try/catch), so
 * one backend being down never drops a lead during the dual-run window.
 */

export type CrmLeadBackend = 'fub' | 'dual' | 'native'

export function crmLeadBackend(): CrmLeadBackend {
  // Default flipped to 'native' at the FUB cutover (2026-06-24) — the in-house
  // CRM is the live lead backend. FUB writes are dead end-to-end (the FUB client
  // is neutralized via getFubApiKey()), so 'fub'/'dual' are legacy no-ops.
  const v = (process.env.CRM_LEAD_BACKEND ?? 'native').trim().toLowerCase()
  return v === 'fub' || v === 'native' ? v : 'native'
}

/** Pure routing decision — unit-tested without DB/FUB. */
export function leadBackendPlan(backend: CrmLeadBackend): { native: boolean; fub: boolean } {
  return { native: backend !== 'fub', fub: backend !== 'native' }
}

export type CaptureLeadInput = EnsureNativeLeadInput & {
  /** The FUB event this entry point already builds. Sent only when the flag
   *  includes FUB. Omit on a pure-native source. */
  fub?: SendEventParams
}

export type CaptureLeadResult = {
  personId: number | null
  created: boolean
  native: 'written' | 'skipped' | 'failed'
  fub: 'sent' | 'skipped' | 'failed'
  backend: CrmLeadBackend
}

export async function captureLead(input: CaptureLeadInput): Promise<CaptureLeadResult> {
  const backend = crmLeadBackend()
  const plan = leadBackendPlan(backend)
  const out: CaptureLeadResult = { personId: null, created: false, native: 'skipped', fub: 'skipped', backend }

  if (plan.native) {
    try {
      const r = await ensureNativeLead({
        name: input.name,
        email: input.email,
        phone: input.phone,
        source: input.source,
        tags: input.tags,
        assignedBroker: input.assignedBroker,
      })
      out.personId = r.personId
      out.created = r.created
      out.native = 'written'
    } catch (e) {
      out.native = 'failed'
      console.error('[captureLead] native write failed:', e)
    }
  }

  if (plan.fub && input.fub) {
    try {
      const r = await sendEvent(input.fub)
      out.fub = r.ok ? 'sent' : 'failed'
      if (!r.ok) console.error('[captureLead] FUB write failed:', r.error ?? r.status)
    } catch (e) {
      out.fub = 'failed'
      console.error('[captureLead] FUB write threw:', e)
    }
  }

  return out
}
