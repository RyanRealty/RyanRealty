/**
 * Client-side resolution loop for the one-tap CMA kick-off (pure, unit-tested).
 *
 * Two failure classes from the 2026-07-17 adversarial review are handled here:
 *  - An ABORTED action POST (cell-network blip): retry once with the SAME
 *    idempotency key — the server replays the stored result if the first
 *    request actually landed, so a retry can never double-enqueue.
 *  - An IN-FLIGHT sibling (`inFlight: true`): the server could NOT confirm the
 *    outcome yet. Rendering a terminal success here would be a lie (the
 *    sibling may still fail), so we poll again after a short delay; if the
 *    sibling failed and released the key, the poll claims it and runs for
 *    real. After the poll budget we give up HONESTLY (tryAgain), never with a
 *    fabricated "kicked off."
 */

import type { CmaKickoffResult } from '@/lib/crm/cma-kickoff'

export type KickoffOutcome =
  | { kind: 'done'; result: Extract<CmaKickoffResult, { ok: true }> }
  | { kind: 'error'; message: string }
  | { kind: 'tryAgain'; message: string }

const IN_FLIGHT_POLLS = 2
const POLL_DELAY_MS = 1500

export async function resolveKickoff(
  attempt: () => Promise<CmaKickoffResult>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<KickoffOutcome> {
  let res: CmaKickoffResult
  try {
    res = await attempt()
  } catch {
    try {
      res = await attempt()
    } catch {
      return {
        kind: 'tryAgain',
        message: 'Network hiccup — tap Build again. A duplicate tap is safe.',
      }
    }
  }

  for (let poll = 0; res.ok && res.inFlight && poll < IN_FLIGHT_POLLS; poll++) {
    await sleep(POLL_DELAY_MS)
    try {
      res = await attempt()
    } catch {
      return {
        kind: 'tryAgain',
        message: 'Network hiccup — tap Build again. A duplicate tap is safe.',
      }
    }
  }

  if (!res.ok) return { kind: 'error', message: res.error }
  if (res.inFlight) {
    return {
      kind: 'tryAgain',
      message: 'Still confirming — give it a few seconds, then tap Build again. A duplicate tap is safe.',
    }
  }
  return { kind: 'done', result: res }
}
