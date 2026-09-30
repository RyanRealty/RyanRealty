/**
 * THE RELIST GUARD for the CRM sequence engine (app/api/cron/crm-sequence-engine).
 *
 * The expired and FSBO recovery workflows text and email an owner about their
 * home. The one-click enroll checks the MLS once, at enroll time; the engine
 * then sent every step on a timer with only suppression and the CMA hold in
 * the way. On 2026-09-21 it texted the owner of 20873 Greenmont, Bend (person
 * 56921, enrollment 31, enrolled 2026-07-05), a home that had been Active with
 * Works Real Estate since 2026-07-06 under a new listing key, which our own
 * listings table showed too. Soliciting the owner of a home listed with
 * another broker, or one that has sold, is a license problem.
 *
 * So before EVERY text or email of a recovery enrollment, the engine asks this
 * module, which runs the same live check every outreach send path runs
 * (verifyNotRelisted: the MLS by key and by address, plus our listings table)
 * for every expired or FSBO record linked to the person:
 *
 *   - any record relisted, pending or sold since: STOP the enrollment, with a
 *     timeline note naming the MLS status and date. Nothing is sent.
 *   - no linked record at all: PAUSE with a note. Nothing is sent blind.
 *   - the MLS or our table could not answer ('global'): hold the step 30
 *     minutes, uncounted (an outage must not end anyone's workflow).
 *   - only this address cannot be answered ('row'): hold an hour, counted in
 *     timeline notes; the third time, PAUSE and text Matt.
 *   - everything clear: send.
 *
 * Which enrollments are recovery enrollments: the two recovery masters (CRM
 * plan 71 expired, 72 FSBO), any sequence the intent-tag automation rules
 * enroll into, and any enrollment of a person carrying an intent:expired-listing
 * or intent:fsbo tag, whatever the workflow. An owner we found through their
 * listing is that owner in every workflow.
 */
import 'server-only'
import { verifyNotRelisted, type RelistVerdict } from '@/lib/data/prospecting/batch'
import {
  countTimelineNotesWithKeyPrefix,
  getRecoveryProspectsForPerson,
  type RecoveryProspect,
} from '@/lib/data/crm/recoveryProspects'
import type { ProspectKind } from '@/lib/data/prospecting/types'

/** CRM legacy plan id of the two recovery master sequences (lib/crm/enroll.ts RULES). */
export const RECOVERY_PLAN_KIND: Readonly<Record<number, ProspectKind>> = Object.freeze({ 71: 'expired', 72: 'fsbo' })

/** The intent tags the expired / FSBO pipelines put on an owner (lib/data/prospecting/drip.ts dripIntentTagFor). */
export const RECOVERY_INTENT_TAG: Readonly<Record<ProspectKind, string>> = Object.freeze({
  expired: 'intent:expired-listing',
  fsbo: 'intent:fsbo',
})

/** Checks that may fail for one address before the workflow pauses for a person (same bound as the email drip). */
export const SEQ_RELIST_MAX_ROW_FAILURES = 3
/** How long a step waits after the check could not answer for its address. */
export const SEQ_RELIST_ROW_RETRY_MS = 60 * 60_000
/** How long a step waits when the MLS or our table could not answer at all (the engine's own retry interval). */
export const SEQ_RELIST_GLOBAL_RETRY_MS = 30 * 60_000

export type RecoverySequenceMap = ReadonlyMap<number, ProspectKind>

/**
 * The sequences the intent-tag automation rules enroll into, by kind. The
 * rules reader fails soft (an empty list), which only narrows this map; the
 * plan ids and the person's tags still mark a recovery enrollment.
 */
export async function loadRecoverySequenceMap(): Promise<RecoverySequenceMap> {
  const map = new Map<number, ProspectKind>()
  try {
    const { getActiveRulesForTrigger } = await import('@/lib/data/crm/getCrmAutomationRules')
    for (const kind of ['expired', 'fsbo'] as const) {
      for (const r of await getActiveRulesForTrigger('tag_added', RECOVERY_INTENT_TAG[kind])) {
        const id = Number(r.actionValue)
        if (r.actionType === 'enroll_sequence' && Number.isInteger(id) && id > 0 && !map.has(id)) map.set(id, kind)
      }
    }
  } catch (e) {
    console.error('[sequence-relist-guard] automation rules read failed; plan ids and tags still apply:', e)
  }
  return map
}

/** The recovery kind of this enrollment, or null when it is not one. Pure. */
export function recoveryKindFor(
  seq: { id: number; fub_legacy_plan_id?: number | null },
  person: { tags?: unknown },
  map: RecoverySequenceMap,
): ProspectKind | null {
  const byPlan = seq.fub_legacy_plan_id != null ? RECOVERY_PLAN_KIND[seq.fub_legacy_plan_id] : undefined
  if (byPlan) return byPlan
  const byRule = map.get(seq.id)
  if (byRule) return byRule
  const tags = Array.isArray(person.tags) ? (person.tags as unknown[]).map(String) : []
  if (tags.includes(RECOVERY_INTENT_TAG.expired)) return 'expired'
  if (tags.includes(RECOVERY_INTENT_TAG.fsbo)) return 'fsbo'
  return null
}

export type RecoveryTouchDecision =
  | { action: 'send'; checked: number }
  | { action: 'stop'; title: string; body: string }
  | { action: 'hold'; retryAt: Date; title: string; body: string; dedupeKey: string }
  | { action: 'pause'; title: string; body: string; alert: { key: string; body: string } | null }

function where(p: RecoveryProspect): string {
  return [p.streetAddress, p.city].filter(Boolean).join(', ') || p.id
}

function shown(status: string | null): string {
  if (!status) return 'on the market or sold'
  return /closed/i.test(status) ? 'sold' : status
}

function oneLine(s: string | null | undefined, max = 160): string {
  return String(s ?? 'no reason given').replace(/\s+/g, ' ').trim().slice(0, max)
}

/**
 * Decide whether a recovery enrollment's text or email may go. Never throws:
 * a failure of any read here is a 'global' hold.
 */
export async function decideRecoveryTouch(input: {
  enrollmentId: number
  stepIndex: number
  sequenceName: string
  person: { id: number; fub_legacy_id?: number | null; name?: string | null }
  now?: Date
}): Promise<RecoveryTouchDecision> {
  const now = input.now ?? new Date()
  const seq = `Workflow "${input.sequenceName}"`
  const holdGlobal = (why: string): RecoveryTouchDecision => ({
    action: 'hold',
    retryAt: new Date(now.getTime() + SEQ_RELIST_GLOBAL_RETRY_MS),
    title: `${seq} step ${input.stepIndex} held: the MLS relist check could not answer`,
    body: `Nothing was sent. ${oneLine(why)}. The step tries again in 30 minutes.`,
    dedupeKey: `seq-relist-hold:e${input.enrollmentId}:s${input.stepIndex}`,
  })

  let props: RecoveryProspect[]
  try {
    props = await getRecoveryProspectsForPerson({ personId: input.person.id, fubLegacyId: input.person.fub_legacy_id ?? null })
  } catch (e) {
    return holdGlobal(`Could not read the linked listing records: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (props.length === 0) {
    return {
      action: 'pause',
      title: `${seq} paused: no expired or FSBO record is linked to this contact, so the MLS relist check cannot run`,
      body:
        'Nothing was sent. Every text and email of this workflow waits on a live MLS check of the owner\'s home, and no home is linked. ' +
        'Link the listing record to this contact from its prospect page, then resume the workflow.',
      alert: null,
    }
  }

  const checked: Array<{ prop: RecoveryProspect; verdict: RelistVerdict }> = []
  for (const prop of props) {
    let verdict: RelistVerdict
    try {
      verdict = await verifyNotRelisted(prop.kind, {
        street_address: prop.streetAddress,
        city: prop.city,
        postal_code: prop.postalCode,
        expiryComparator: prop.offMarketAt,
        listing_key: prop.kind === 'expired' ? prop.id : null,
        fsbo_url: prop.kind === 'fsbo' ? prop.id : null,
      })
    } catch (e) {
      return holdGlobal(`The relist check threw: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (verdict.relisted) {
      const date = verdict.blockedDate ? ` since ${verdict.blockedDate}` : ''
      const status = shown(verdict.blockedStatus)
      return {
        action: 'stop',
        title: `${seq} stopped: ${where(prop)} is ${status} on the MLS${date}`,
        body:
          `Nothing was sent. ${oneLine(verdict.reason, 240)}.` +
          `${verdict.blockedKey ? ` Listing ${verdict.blockedKey}.` : ''}` +
          ' A listed or sold home is not ours to solicit, so this workflow ends here.',
      }
    }
    checked.push({ prop, verdict })
  }

  const failed = checked.filter((c) => c.verdict.verifyFailed)
  if (failed.length === 0) return { action: 'send', checked: checked.length }
  const global = failed.find((c) => c.verdict.failureScope !== 'row')
  if (global) return holdGlobal(global.verdict.reason ?? 'the check did not say why')

  // Only these addresses cannot be answered. Count the tries in the notes.
  const first = failed[0]!
  const prefix = `seq-relist-unverified:e${input.enrollmentId}:s${input.stepIndex}:`
  let prior: number
  try {
    prior = await countTimelineNotesWithKeyPrefix(input.person.id, prefix)
  } catch (e) {
    return holdGlobal(`Could not read the step's earlier checks: ${e instanceof Error ? e.message : String(e)}`)
  }
  const attempt = prior + 1
  const why = oneLine(first.verdict.reason)
  if (attempt >= SEQ_RELIST_MAX_ROW_FAILURES) {
    return {
      action: 'pause',
      title: `${seq} paused: the MLS relist check could not answer for ${where(first.prop)} ${attempt} times`,
      body: `Nothing was sent. ${why}. Check the MLS by hand, then resume the workflow.`,
      alert: {
        key: `seq-relist-e${input.enrollmentId}`,
        body:
          `${seq} for ${input.person.name ?? `contact ${input.person.id}`} paused: the MLS relist check could not answer for ` +
          `${where(first.prop)} ${attempt} times (${why}). Nothing was sent. Check the MLS, then resume it from the contact page.`,
      },
    }
  }
  return {
    action: 'hold',
    retryAt: new Date(now.getTime() + SEQ_RELIST_ROW_RETRY_MS),
    title: `${seq} step ${input.stepIndex} held (${attempt} of ${SEQ_RELIST_MAX_ROW_FAILURES}): the MLS relist check could not answer for ${where(first.prop)}`,
    body: `Nothing was sent. ${why}. The step tries again in an hour.`,
    dedupeKey: `${prefix}${attempt}`,
  }
}
