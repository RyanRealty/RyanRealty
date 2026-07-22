/**
 * Guard sequence for the governed send chokepoint (lib/comms, §A4).
 *
 * Composes the EXISTING canonical guard functions — it re-implements nothing:
 *   - hard-stop + channel suppression: lib/crm/suppressions isSuppressed
 *     (ONE authoritative read; TAG_CHANNEL maps compliance:hard-stop → all
 *     channels, so the same fail-closed read yields both stages — partitioned
 *     here so a hard-stop reports as its own stage, checked first)
 *   - quiet hours (SMS): lib/crm/quiet-hours inSmsQuietHours
 *
 * Returns null when every guard passes. A non-null failure means the send
 * must NOT proceed — callers return it verbatim. Order is load-bearing: a
 * suppressed person never reaches the quiet-hours check, the idempotency
 * ledger, or a provider.
 */

import 'server-only'
import { isSuppressed, type SendChannel } from '@/lib/crm/suppressions'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import type { GovernedFailure } from './types'

/** The quiet-hours refusal shown to brokers (kept byte-identical to the composer's). */
export const QUIET_HOURS_ERROR =
  'Quiet hours (TCPA): texts pause 9pm to 8am Pacific. Call instead, or check "send anyway" to override.'

const HARD_STOP_REASON = 'tag:compliance:hard-stop'

export async function checkSendGuards(
  personId: number,
  channel: SendChannel,
  opts?: { overrideQuietHours?: boolean },
): Promise<GovernedFailure | null> {
  // 1 + 2. Hard-stop tags, then channel suppression. One isSuppressed call is
  // the authoritative source for both (fail-closed on any read error).
  const gate = await isSuppressed(personId, channel)
  if (gate.suppressed) {
    const error = `Blocked by suppression (${gate.reasons.join(', ')})`
    const hardStop = gate.reasons.some((r) => r.toLowerCase() === HARD_STOP_REASON)
    return { ok: false, error, stage: hardStop ? 'hard-stop' : 'suppression' }
  }

  // 3. Quiet hours — SMS only. A6: only a manual, human-typed 1:1 reply passes
  // overrideQuietHours; automated/system callers never set it.
  if (channel === 'sms' && !opts?.overrideQuietHours && inSmsQuietHours()) {
    return { ok: false, error: QUIET_HOURS_ERROR, stage: 'quiet-hours' }
  }

  return null
}
