/**
 * getSuppressionSignals — the structured suppression-footprint reader the
 * one-click membership toggles use to make a consent decision BEFORE
 * re-subscribing a contact into a channel (CONTACT360 Phase 3.3, read side).
 *
 * The suppression chokepoint (lib/crm/suppressions) owns the WRITES
 * (addSuppression / removeSuppression) and the boolean send-time gate
 * (isSuppressed). For a UI re-subscribe we need the STRUCTURED footprint — every
 * suppression row across all channels PLUS the tag-derived suppressions — so the
 * pure decision (lib/crm/membership-consent.canSubscribe) can tell a soft system
 * default ('no-sms-consent') apart from a real opt-out. That read lives here in
 * the DAL; the tag->channel projection reuses the chokepoint's exported
 * TAG_CHANNEL mapping so it is the SAME authoritative footprint isSuppressed
 * enforces (one mapping, never a drifting copy).
 *
 * Fails CLOSED: if the compliance table is unreadable, returns a synthetic
 * channel:'all' hard-stop so any consent decision built on it refuses.
 *
 * DAL boundary (G1): the raw .from() reads of crm_suppressions/crm_people live
 * here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { TAG_CHANNEL } from '@/lib/crm/suppressions'

/**
 * A normalized suppression signal: the channel it applies to ('all' blocks
 * every channel) + the raw reason. Tag-derived suppressions are projected onto
 * the channel(s) the tag blocks (a do-not-call tag yields both 'call' and 'sms').
 */
export type SuppressionSignal = { channel: 'all' | 'email' | 'sms' | 'call'; reason: string }

export async function getSuppressionSignals(personId: number): Promise<SuppressionSignal[]> {
  if (!Number.isFinite(personId) || personId <= 0) {
    // fail CLOSED on a bad id — never report "clean" for a non-person.
    return [{ channel: 'all', reason: 'invalid-person' }]
  }
  const sb = createServiceClient()
  const [rows, person] = await Promise.all([
    sb.from('crm_suppressions').select('channel,reason').eq('person_id', personId),
    sb.from('crm_people').select('tags').eq('id', personId).maybeSingle(),
  ])
  if (rows.error) {
    // fail CLOSED: an unreadable compliance table must block every re-subscribe.
    return [{ channel: 'all', reason: 'suppression-check-failed' }]
  }
  const signals: SuppressionSignal[] = (rows.data ?? []).map((r) => ({
    channel: r.channel as SuppressionSignal['channel'],
    reason: String(r.reason ?? ''),
  }))
  const tags = (person.data?.tags as string[] | undefined) ?? []
  const tagsLower = new Set(tags.map((t) => t.toLowerCase()))
  for (const m of TAG_CHANNEL) {
    if (!tagsLower.has(m.tag.toLowerCase())) continue
    for (const ch of m.channels) signals.push({ channel: ch, reason: `tag:${m.tag}` })
  }
  return signals
}
