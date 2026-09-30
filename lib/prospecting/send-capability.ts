/**
 * Trust that only server code can hand to the prospecting send actions.
 *
 * sendProspectingEmailIntro (app/actions/prospecting.ts) is a server action:
 * the send dialog imports it, so its id ships to the browser and anyone can
 * POST arguments to it. Until 2026-09-30 it skipped admin auth whenever
 * `args.actor === 'drip-cron'`, a string any caller could send, and a relist
 * verdict passed the same way could have skipped the MLS check. Both now ride
 * objects minted in this module. A server action's arguments are decoded from
 * the request and can never be one of these objects, so identity is the
 * check: a forged actor gets the admin gate, a forged verdict gets a fresh MLS
 * check.
 */
import 'server-only'
import type { ProspectKind } from '@/lib/data/prospecting/types'
import type { RelistVerdict } from '@/lib/data/prospecting/batch'

/** The first-touch drip drain (its cron route is gated by requireCronAuth). */
export const DRIP_CRON_ACTOR: Readonly<{ actor: 'drip-cron' }> = Object.freeze({ actor: 'drip-cron' as const })

export type DripCronActor = typeof DRIP_CRON_ACTOR

export function isDripCronActor(x: unknown): x is DripCronActor {
  return x === DRIP_CRON_ACTOR
}

/**
 * A relist verdict the send already paid for, reused down the same send (the
 * drip's check, then the intro, then the CMA rail) instead of asking Spark
 * three times. Accepted only fresh, only for the same prospect, only clear.
 */
export type RelistProof = Readonly<{
  kind: ProspectKind
  id: string
  verdict: RelistVerdict
  checkedAt: number
}>

/** Longer than a send takes to reach its checks (seconds), far shorter than a relist takes to happen. */
export const RELIST_PROOF_MAX_AGE_MS = 2 * 60_000

const minted = new WeakSet<object>()

export function mintRelistProof(kind: ProspectKind, id: string, verdict: RelistVerdict, now: number = Date.now()): RelistProof {
  const proof: RelistProof = Object.freeze({ kind, id, verdict: Object.freeze({ ...verdict }), checkedAt: now })
  minted.add(proof)
  return proof
}

/** The proof, when it was minted here for this prospect, is fresh, and says clear. Otherwise null: check again. */
export function acceptRelistProof(
  x: unknown,
  expected: { kind: ProspectKind; id: string },
  now: number = Date.now(),
): RelistProof | null {
  if (typeof x !== 'object' || x === null || !minted.has(x)) return null
  const proof = x as RelistProof
  if (proof.kind !== expected.kind || proof.id !== expected.id) return null
  if (now - proof.checkedAt > RELIST_PROOF_MAX_AGE_MS || proof.checkedAt > now) return null
  if (proof.verdict.relisted || proof.verdict.verifyFailed) return null
  return proof
}
