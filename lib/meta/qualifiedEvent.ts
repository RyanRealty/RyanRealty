/**
 * lib/meta/qualifiedEvent.ts — the CRM→CAPI "qualified lead" loop
 * (Conversion Leads Optimization). When a crm_people lead reaches a qualifying
 * stage (updateCrmStageAction), fire a Meta CAPI "Qualified" event so Meta can
 * learn which leads convert, not just which submit.
 *
 * Safety: consent-gated (a suppressed subject is sent in LDU mode, never for
 * targeting) and DRY-RUN unless META_CAPI_QUALIFIED_ENABLED === 'true'. Mirrors
 * the audience-push posture — no surprise PII sends to Meta. At Ryan Realty's
 * lead volume this is the right architecture but latent (Meta needs ~50 events/
 * ad-set/week to optimize), so it ships off and lights up when volume scales.
 *
 * DAL boundary: all DB reads go through lib/data/crm readers. No raw .from().
 */
import 'server-only'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'
import { sendServerEvent, type MetaCapiUserData } from '@/lib/meta-capi'
import { isMetaCapiQualifiedEnabled } from '@/lib/meta-env'
import { getPersonContact } from '@/lib/data/crm/getPersonContact'
import { getPersonSuppressions } from '@/lib/data/crm/getPersonSuppressions'
import { shouldExcludeFromSharing } from '@/lib/crm/gpc'

/**
 * CRM stages that represent a qualified opportunity. Grounded in the live stage
 * vocabulary (2026-06-23): Lead / Seller Prospect / Real Estate Agent / cold are
 * NOT qualified; these three are. Matt-confirmable — adjust here.
 */
export const QUALIFYING_STAGES: ReadonlySet<string> = new Set([
  'A - Hot 1-3 Months',
  'Active Client',
  'Past Client',
])

/** Pure + tested: does crossing into this stage count as a qualified lead? */
export function isQualifyingStage(stage: string | null | undefined): boolean {
  return !!stage && QUALIFYING_STAGES.has(stage.trim())
}

const hash = (v: string | null | undefined): string | undefined => {
  const t = v?.trim().toLowerCase()
  return t ? bytesToHex(sha256(t)) : undefined
}

export type FireQualifiedResult = { fired: boolean; dryRun: boolean; reason?: string }

/**
 * Fire a Meta CAPI "Qualified" event for a CRM person who reached a qualifying
 * stage. Never throws (safe to fire-and-forget); returns a result for logging.
 */
export async function fireQualifiedLeadEvent(opts: {
  personId: number
  stage: string
  /** Injectable for tests. */
  readContact?: typeof getPersonContact
  readSuppressions?: typeof getPersonSuppressions
  send?: typeof sendServerEvent
}): Promise<FireQualifiedResult> {
  const readContact = opts.readContact ?? getPersonContact
  const readSuppressions = opts.readSuppressions ?? getPersonSuppressions
  const send = opts.send ?? sendServerEvent
  try {
    const contact = await readContact(opts.personId)
    if (!contact || (!contact.email && !contact.phone)) {
      return { fired: false, dryRun: true, reason: 'no-contact-key' }
    }
    const userData: MetaCapiUserData = {
      em: hash(contact.email),
      ph: hash(contact.phone),
      fn: hash(contact.firstName),
      ln: hash(contact.lastName),
    }
    // Consent: a suppressed subject still gets the measurement event, but in LDU
    // (no targeting/personalization). Best-effort — a lookup failure leaves it off.
    let ldu = false
    try {
      if (shouldExcludeFromSharing(await readSuppressions(opts.personId))) ldu = true
    } catch {
      /* leave ldu as-is */
    }

    const eventId = `qualified:${opts.personId}:${opts.stage}`
    if (!isMetaCapiQualifiedEnabled()) {
      console.log(
        `[qualified-capi] DRY RUN (flag off): person ${opts.personId} stage "${opts.stage}" ldu=${ldu} — no Meta call.`,
      )
      return { fired: false, dryRun: true, reason: 'flag-disabled' }
    }
    const res = await send(
      'Qualified',
      userData,
      { lead_stage: opts.stage, lead_event_source: 'crm' },
      eventId,
      undefined,
      ldu,
    )
    if (!res.ok) {
      console.warn(`[qualified-capi] send failed for person ${opts.personId}: ${res.error}`)
      return { fired: false, dryRun: false, reason: res.error }
    }
    console.log(
      `[qualified-capi] LIVE Qualified event sent for person ${opts.personId} (stage "${opts.stage}", ldu=${ldu}).`,
    )
    return { fired: true, dryRun: false }
  } catch (e) {
    console.warn('[qualified-capi] unexpected error:', e instanceof Error ? e.message : String(e))
    return { fired: false, dryRun: true, reason: 'error' }
  }
}
