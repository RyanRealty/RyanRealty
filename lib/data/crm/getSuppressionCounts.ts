/**
 * getSuppressionCounts — the opt-out footprint for the /admin/crm/health board
 * (CONTACT360 Phase 9.5, observability read side).
 *
 * Reads crm_suppressions and rolls it up two ways the broker needs at a glance:
 *   - byChannel: how many suppression rows block each channel (all/email/sms/call)
 *   - byReason : the top reasons (tcpa-hard-stop, do-not-call, bounced, ...)
 *   - mailable : the suppression-NET counts the audience + send paths honor —
 *     how many distinct people are blocked on email vs sms (a 'all' row blocks
 *     every channel, so it counts toward both).
 *
 * This is a TABLE-LEVEL aggregate (every person), distinct from
 * getSuppressionSignals which reads ONE person's structured footprint for a
 * consent decision. The board needs the population view; the toggle needs the
 * person view. Both read the same crm_suppressions table through the DAL.
 *
 * DAL boundary (G1): the raw .from() reads of crm_suppressions / crm_people live
 * here, inside lib/data/. Fails SOFT (returns zeros) on an unreadable table so
 * the health board renders a red/zero tile rather than crashing the whole page.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type SuppressionChannel = 'all' | 'email' | 'sms' | 'call'

export type SuppressionCounts = {
  total: number
  byChannel: Record<SuppressionChannel, number>
  byReason: Array<{ reason: string; count: number }>
  /** People blocked on a real outbound channel (an 'all' row blocks both). */
  blockedEmail: number
  blockedSms: number
  /** True when the suppressions table could not be read (board shows a red tile). */
  unreadable: boolean
}

const EMPTY_BY_CHANNEL: Record<SuppressionChannel, number> = { all: 0, email: 0, sms: 0, call: 0 }

function normalizeChannel(raw: string): SuppressionChannel {
  const c = raw.trim().toLowerCase()
  if (c === 'all' || c === 'email' || c === 'sms' || c === 'call') return c
  // Unknown channel value — bucket as 'all' so it is never silently dropped from
  // the population view (a row we can't classify still blocks something).
  return 'all'
}

export async function getSuppressionCounts(): Promise<SuppressionCounts> {
  const sb = createServiceClient()
  // person_id is nullable (value-keyed suppressions exist), so a per-person net
  // count uses a Set keyed by the non-null person_id only; null-person rows still
  // count toward the channel/reason totals.
  // PAGED, and ordered. A bare .select() is capped by PostgREST at 1,000 rows
  // per response, which silently truncated EVERY figure this function returns:
  // measured 2026-08-07, the board printed 1,000 suppression rows / 999 blocked
  // people / 4.4% of contacts, against a real 5,169 / 3,228 / 14.3%, and showed
  // 0 for email, sms and call because the first 1,000 rows in default order are
  // all channel='all'. The colour was right only by luck — a board reading 4.4%
  // stays green well past a real 25% crossing, which is the opposite of what a
  // compliance health signal is for. The .order('id') is required, not
  // decorative: range pagination without a stable sort can repeat or skip rows.
  const { rows: data, error } = await fetchPagedRows<{
    person_id: number | null
    channel: string | null
    reason: string | null
  }>((from, to) =>
    sb
      .from('crm_suppressions')
      .select('person_id,channel,reason')
      .order('id', { ascending: true })
      .range(from, to),
  )

  if (error || !data) {
    return {
      total: 0,
      byChannel: { ...EMPTY_BY_CHANNEL },
      byReason: [],
      blockedEmail: 0,
      blockedSms: 0,
      unreadable: true,
    }
  }

  const byChannel: Record<SuppressionChannel, number> = { ...EMPTY_BY_CHANNEL }
  const reasonCounts = new Map<string, number>()
  const emailPeople = new Set<number>()
  const smsPeople = new Set<number>()

  for (const row of data) {
    const channel = normalizeChannel(String(row.channel ?? ''))
    byChannel[channel] += 1

    const reason = String(row.reason ?? '').trim() || 'unspecified'
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)

    const personId = row.person_id
    if (typeof personId === 'number' && Number.isFinite(personId)) {
      if (channel === 'all' || channel === 'email') emailPeople.add(personId)
      if (channel === 'all' || channel === 'sms') smsPeople.add(personId)
    }
  }

  const byReason = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  return {
    total: data.length,
    byChannel,
    byReason,
    blockedEmail: emailPeople.size,
    blockedSms: smsPeople.size,
    unreadable: false,
  }
}
