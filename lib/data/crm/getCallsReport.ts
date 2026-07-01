import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { resolveDateRange } from './getAgentActivityReport'

// ── Re-export the date preset type from the shared module ──────────────────────
export type { DatePreset } from './getAgentActivityReport'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CallsParams = {
  /** null = all brokers (superuser/Everyone view) */
  brokerSlug: string | null
  datePreset: string
  dateStart?: string | null
  dateEnd?: string | null
}

/**
 * Per-broker row for the Calls report breakdown table.
 *
 * Metric → crm_* source mapping:
 *
 * | Metric              | Source                                                                |
 * |---------------------|-----------------------------------------------------------------------|
 * | received            | crm_timeline kind='call', broker=slug, ts in [start,end]              |
 * | receivedPeople      | count(DISTINCT person_id) from the above                              |
 * | missed              | crm_timeline kind='voicemail', broker=slug, ts in [start,end]        |
 * | missedPeople        | count(DISTINCT person_id) from the above                              |
 * | connected           | received - missed (unanswered calls generate both call+voicemail rows)|
 * | connectedPeople     | 0 (V1 — not computable without set-difference join)                   |
 * | conversations       | kind='call' WHERE payload->>'recordingDurationSec' > 0               |
 * | conversationsPeople | count(DISTINCT person_id) from conversations subset                   |
 * | talkTimeSec         | SUM(payload->>'recordingDurationSec') for kind='call' rows            |
 * | callsMade           | 0 — outbound click-to-call not yet implemented                        |
 * | callsMadePeople     | 0                                                                     |
 * | answerTimeSec       | null — not tracked (Twilio webhook fires before answer)               |
 *
 * CONNECTED logic: the Twilio voice webhook logs kind='call' for EVERY inbound call
 * (including those that go unanswered). If the broker doesn't answer within 25 s,
 * voice-complete fires and logs kind='voicemail'. So: answered = received - missed.
 */
export type CallsRow = {
  brokerSlug: string
  brokerName: string
  avatarUrl: string | null
  /** Outbound calls made by this broker — not yet tracked (0). */
  callsMade: number
  callsMadePeople: number
  /** Answered inbound calls = received - missed. */
  connected: number
  connectedPeople: number
  /** Inbound calls with recordingDurationSec > 0 in payload. */
  conversations: number
  conversationsPeople: number
  /** All inbound calls (kind='call') — includes answered + unanswered. */
  received: number
  receivedPeople: number
  /** Unanswered inbound calls (kind='voicemail'). */
  missed: number
  missedPeople: number
  /** Total recorded talk time in seconds (sum of payload.recordingDurationSec). */
  talkTimeSec: number
  /** Average answer time in seconds — not tracked (null). */
  answerTimeSec: number | null
}

export type CallsTotals = Omit<CallsRow, 'brokerSlug' | 'brokerName' | 'avatarUrl'>

export type CallsResult = {
  rows: CallsRow[]
  totals: CallsTotals
  dateStart: string
  dateEnd: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

const EMPTY_TOTALS: CallsTotals = {
  callsMade: 0, callsMadePeople: 0,
  connected: 0, connectedPeople: 0,
  conversations: 0, conversationsPeople: 0,
  received: 0, receivedPeople: 0,
  missed: 0, missedPeople: 0,
  talkTimeSec: 0, answerTimeSec: null,
}

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readCallsReport(params: CallsParams): Promise<CallsResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(params.datePreset, params.dateStart, params.dateEnd)

  // 1. Broker roster — crm-active brokers with a crm_slug
  const { data: brokerRows, error: brokerError } = await sb
    .from('brokers')
    .select('crm_slug,display_name,photo_url')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)
    .order('sort_order', { ascending: true })

  if (brokerError) console.error('[getCallsReport] brokers error', brokerError.message)

  const allBrokers = (brokerRows ?? []).filter((b) => b.crm_slug) as Array<{
    crm_slug: string
    display_name: string | null
    photo_url: string | null
  }>

  const scopedBrokers = params.brokerSlug
    ? allBrokers.filter((b) => b.crm_slug === params.brokerSlug)
    : allBrokers

  const brokerSlugs = scopedBrokers.map((b) => b.crm_slug)

  if (brokerSlugs.length === 0) {
    return { rows: [], totals: { ...EMPTY_TOTALS }, dateStart: start, dateEnd: end }
  }

  // 2. Per-broker parallel queries.
  //
  //    For each broker, two raw-row queries (call volumes are low — ~10s–100s/month,
  //    well within the Supabase default row cap). Raw rows are needed for:
  //      a) talk-time SUM (payload.recordingDurationSec)
  //      b) conversations count (payload.recordingDurationSec > 0)
  //      c) distinct person_id sets
  //
  //    Group A: kind='call' rows with person_id + payload (inbound calls, all)
  //    Group B: kind='voicemail' rows with person_id (missed calls)
  //
  const perBrokerGroup = await Promise.all(
    scopedBrokers.map((b) => {
      const slug = b.crm_slug
      return Promise.all([
        // a: inbound calls — person_id + payload for people count, talk time, conversations
        sb.from('crm_timeline')
          .select('person_id, payload')
          .eq('broker', slug)
          .eq('kind', 'call')
          .gte('ts', start)
          .lte('ts', end),
        // b: voicemails (missed calls) — person_id for people count
        sb.from('crm_timeline')
          .select('person_id')
          .eq('broker', slug)
          .eq('kind', 'voicemail')
          .gte('ts', start)
          .lte('ts', end),
      ] as const)
    }),
  )

  // 3. Build per-broker rows
  const rows: CallsRow[] = scopedBrokers.map((b, i) => {
    const [callsRes, voicemailsRes] = perBrokerGroup[i]
    const callRows = (callsRes.data ?? []) as Array<{ person_id: number; payload: Record<string, unknown> | null }>
    const vmRows = (voicemailsRes.data ?? []) as Array<{ person_id: number }>

    // Received (all inbound calls)
    const received = callRows.length
    const receivedPeople = new Set(callRows.map((r) => r.person_id)).size

    // Missed (went to voicemail — broker didn't answer in 25 s)
    const missed = vmRows.length
    const missedPeople = new Set(vmRows.map((r) => r.person_id)).size

    // Connected (answered) = received - missed
    // Each unanswered call generates BOTH a 'call' row AND a 'voicemail' row,
    // so the difference gives the count of answered calls.
    const connected = Math.max(0, received - missed)

    // Conversations = answered calls with a recorded conversation (recordingDurationSec > 0)
    const conversationRows = callRows.filter((r) => {
      const dur = (r.payload as Record<string, unknown> | null)?.recordingDurationSec
      return typeof dur === 'number' && dur > 0
    })
    const conversations = conversationRows.length
    const conversationsPeople = new Set(conversationRows.map((r) => r.person_id)).size

    // Talk time = sum of recordingDurationSec across all answered (recorded) calls
    const talkTimeSec = callRows.reduce((sum, r) => {
      const dur = (r.payload as Record<string, unknown> | null)?.recordingDurationSec
      return sum + (typeof dur === 'number' ? dur : 0)
    }, 0)

    return {
      brokerSlug: b.crm_slug,
      brokerName: b.display_name ?? b.crm_slug,
      avatarUrl: BROKER_HEADSHOT[b.crm_slug] ?? b.photo_url ?? null,
      // Outbound not yet tracked
      callsMade: 0,
      callsMadePeople: 0,
      connected,
      connectedPeople: 0,  // V1: set-difference requires additional query
      conversations,
      conversationsPeople,
      received,
      receivedPeople,
      missed,
      missedPeople,
      talkTimeSec,
      answerTimeSec: null,
    }
  })

  // 4. Totals — sum across all scoped broker rows.
  //    Note: people counts may slightly double-count the same person calling
  //    multiple brokers in the same period; acceptable at this scale.
  const totals: CallsTotals = rows.reduce(
    (acc, r) => ({
      callsMade: acc.callsMade + r.callsMade,
      callsMadePeople: acc.callsMadePeople + r.callsMadePeople,
      connected: acc.connected + r.connected,
      connectedPeople: acc.connectedPeople + r.connectedPeople,
      conversations: acc.conversations + r.conversations,
      conversationsPeople: acc.conversationsPeople + r.conversationsPeople,
      received: acc.received + r.received,
      receivedPeople: acc.receivedPeople + r.receivedPeople,
      missed: acc.missed + r.missed,
      missedPeople: acc.missedPeople + r.missedPeople,
      talkTimeSec: acc.talkTimeSec + r.talkTimeSec,
      answerTimeSec: null,
    }),
    { ...EMPTY_TOTALS },
  )

  return { rows, totals, dateStart: start, dateEnd: end }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Calls report data — per-broker inbound call counts, talk time, and
 * conversation metrics over a date range.
 *
 * Cached 10 minutes (matching FUB's documented reporting cache TTL).
 * Cache is keyed on filter params so different combos get separate entries.
 *
 * Source tables:
 *   - crm_timeline kind='call'     → inbound calls (RECEIVED, CONNECTED, TALK TIME)
 *   - crm_timeline kind='voicemail' → missed calls (CALLS MISSED)
 *
 * V1 approximations (documented):
 *   - callsMade = 0 (no outbound click-to-call tracking yet)
 *   - connectedPeople = 0 (requires set-difference between call/voicemail person sets)
 *   - answerTimeSec = null (Twilio webhook fires before the call is answered;
 *     actual answer time would need a separate DialCallDuration event)
 *   - connected = received - missed (relies on the invariant that every unanswered
 *     call generates exactly one voicemail entry; true for the current voice webhook)
 */
export async function getCallsReport(params: CallsParams): Promise<CallsResult> {
  const cached = unstable_cache(
    () => readCallsReport(params),
    [
      'crm-calls-report-v1',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-calls', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
