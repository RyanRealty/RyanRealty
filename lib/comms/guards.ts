/**
 * Guard sequence for the governed send chokepoint (lib/comms, §A4).
 *
 * Composes the EXISTING canonical guard functions — it re-implements nothing:
 *   - hard-stop + channel suppression: lib/crm/suppressions isSuppressed
 *     (ONE authoritative read; TAG_CHANNEL maps compliance:hard-stop → all
 *     channels, so the same fail-closed read yields both stages — partitioned
 *     here so a hard-stop reports as its own stage, checked first)
 *   - quiet hours (SMS): Pacific and the recipient number's own zone
 *     (lib/crm/recipient-timezones smsQuietZoneFor, Matt 2026-10-04)
 *
 * Returns null when every guard passes. A non-null failure means the send
 * must NOT proceed — callers return it verbatim. Order is load-bearing: a
 * suppressed person never reaches the quiet-hours check, the idempotency
 * ledger, or a provider.
 */

import 'server-only'
import { isSuppressed, type SendChannel } from '@/lib/crm/suppressions'
import { DEFAULT_SMS_TIMEZONE, smsPauseStartLabel } from '@/lib/crm/quiet-hours'
import { smsQuietZoneFor } from '@/lib/crm/recipient-timezones'
import { recordSendBlockEvent } from '@/lib/data/crm/recordSendBlockEvent'
import type { GovernedFailure } from './types'

/**
 * The quiet-hours refusal shown to brokers (kept byte-identical to the
 * composer's). The pause time comes from the rule, so the copy moves with it.
 * It suggests no phone call: ORS 646.563 holds sales calls to the same 8am to
 * 8pm window.
 */
export const QUIET_HOURS_ERROR = `Quiet hours: texts pause ${smsPauseStartLabel()} to 8am Pacific, ahead of Oregon's 8pm cutoff (ORS 646.563). Check "send anyway" to override.`

/** "9:43pm EDT": the clock in `timeZone` at `date`, for a recipient-zone refusal. */
function zoneClock(timeZone: string, date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('hour')}:${part('minute')}${part('dayPeriod').toLowerCase()} ${part('timeZoneName')}`.trim()
}

/** The Pacific refusal where nobody can override (an automated or intro send). */
const QUIET_HOURS_NO_OVERRIDE = `Quiet hours: texts pause ${smsPauseStartLabel()} to 8am Pacific, ahead of Oregon's 8pm cutoff (ORS 646.563). Try again after 8am.`

/**
 * The refusal for a text held by the recipient's own zone (Pacific is open,
 * their area code is not). Names their clock so the broker sees why.
 */
function recipientQuietHoursError(timeZone: string, date: Date, canOverride = true): string {
  const next = canOverride ? 'Check "send anyway" to override.' : 'Try again once it is 8am there.'
  return `Quiet hours for this number: it is ${zoneClock(timeZone, date)} in its area code. Texts pause ${smsPauseStartLabel()} to 8am there as well as in Pacific. ${next}`
}

/**
 * Why a text to `phone` may not send at `date`, or null when it may: the one
 * place the quiet-hours copy is built. Pacific quiet hours keep
 * QUIET_HOURS_ERROR word for word; a hold by the number's own zone names that
 * zone's clock. No phone: Pacific alone. `canOverride: false` is for a send
 * with no "send anyway" (an intro, a template test): the copy says when to try
 * again instead.
 */
export function quietHoursRefusal(
  phone?: string | null,
  date: Date = new Date(),
  opts?: { canOverride?: boolean },
): string | null {
  const zone = smsQuietZoneFor(phone, date)
  if (zone === null) return null
  const canOverride = opts?.canOverride ?? true
  if (zone === DEFAULT_SMS_TIMEZONE) return canOverride ? QUIET_HOURS_ERROR : QUIET_HOURS_NO_OVERRIDE
  return recipientQuietHoursError(zone, date, canOverride)
}

const HARD_STOP_REASON = 'tag:compliance:hard-stop'

export async function checkSendGuards(
  personId: number,
  channel: SendChannel,
  opts?: {
    overrideQuietHours?: boolean
    source?: string
    skipSuppression?: boolean
    /** The number the text goes to. Its area-code zone holds the send too. */
    recipientPhone?: string | null
  },
): Promise<GovernedFailure | null> {
  // 1 + 2. Hard-stop tags, then channel suppression. One isSuppressed call is
  // the authoritative source for both (fail-closed on any read error).
  // Broker manual compose (CRM Text Send / group start) sets skipSuppression:
  // consent / TCPA soft opt-in / STOP-list rows are BULK-ONLY — direct 1:1 and
  // group-thread start must still deliver. Quiet hours below still apply.
  if (!opts?.skipSuppression) {
    const gate = await isSuppressed(personId, channel)
    if (gate.suppressed) {
      const error = `Blocked by suppression (${gate.reasons.join(', ')})`
      const hardStop = gate.reasons.some((r) => r.toLowerCase() === HARD_STOP_REASON)
      const stage = hardStop ? 'hard-stop' : 'suppression'
      // Best-effort ledger — never blocks the refusal path.
      void recordSendBlockEvent({
        personId,
        channel,
        stage,
        reasons: gate.reasons,
        source: opts?.source,
      })
      return { ok: false, error, stage }
    }
  }

  // 3. Quiet hours — SMS only, in Pacific and the recipient's own zone. A6:
  // only a manual, human-typed send passes overrideQuietHours; automated and
  // system callers never set it.
  const quiet = channel === 'sms' && !opts?.overrideQuietHours ? quietHoursRefusal(opts?.recipientPhone) : null
  if (quiet) {
    void recordSendBlockEvent({
      personId,
      channel,
      stage: 'quiet-hours',
      reasons: ['quiet-hours'],
      source: opts?.source,
    })
    return { ok: false, error: quiet, stage: 'quiet-hours' }
  }

  return null
}
