import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { resolveDateRange } from './getAgentActivityReport'

// ── INFERRED REPORT ───────────────────────────────────────────────────────────
// This report mirrors the Calls report structure and follows standard FUB Texts
// reporting conventions. No dedicated FUB GIF frame was captured for this tab,
// so the layout and metric set are inferred from the Calls report + FUB's
// documented Texts reporting behavior (per-agent sent/received/conversations/
// response-rate). A code comment is left on each metric clarifying its source.
// ─────────────────────────────────────────────────────────────────────────────

// ── Re-export the date preset type from the shared module ──────────────────────
export type { DatePreset } from './getAgentActivityReport'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TextsParams = {
  /** null = all brokers (superuser/Everyone view) */
  brokerSlug: string | null
  datePreset: string
  dateStart?: string | null
  dateEnd?: string | null
}

/**
 * Per-broker row for the Texts report breakdown table.
 *
 * Metric → crm_* source mapping (INFERRED — mirrors Calls report; no FUB GIF frame captured):
 *
 * | Metric              | Source                                                                |
 * |---------------------|-----------------------------------------------------------------------|
 * | sent                | crm_timeline kind='sms_out', broker=slug, ts in [start,end]           |
 * | sentPeople          | count(DISTINCT person_id) from sms_out rows                           |
 * | received            | crm_timeline kind='sms_in',  broker=slug, ts in [start,end]           |
 * | receivedPeople      | count(DISTINCT person_id) from sms_in rows                            |
 * | conversations       | count(DISTINCT person_id) present in BOTH sms_out AND sms_in sets     |
 * | responseRate        | conversations / sentPeople × 100 (% of texted people who replied)    |
 *
 * V1 approximations (documented):
 *   - responseRate denominator uses sentPeople (unique people texted by broker).
 *     When sentPeople = 0, responseRate = null (not 0%) to avoid division by zero.
 *   - conversations requires set-intersection between sent/received person_id sets;
 *     this is computed client-side from the two sets (no extra round-trip needed).
 */
export type TextsRow = {
  brokerSlug: string
  brokerName: string
  avatarUrl: string | null
  /** Outbound texts sent by this broker (kind='sms_out'). */
  sent: number
  sentPeople: number
  /** Inbound texts received by this broker's number (kind='sms_in'). */
  received: number
  receivedPeople: number
  /**
   * 2-way conversations — distinct people who both received a text from this
   * broker AND replied (i.e. appear in both sms_out and sms_in person_id sets).
   */
  conversations: number
  /**
   * Response rate — conversations / sentPeople × 100.
   * null when sentPeople = 0 (displayed as "—").
   */
  responseRate: number | null
}

export type TextsTotals = Omit<TextsRow, 'brokerSlug' | 'brokerName' | 'avatarUrl'>

export type TextsResult = {
  rows: TextsRow[]
  totals: TextsTotals
  dateStart: string
  dateEnd: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

const EMPTY_TOTALS: TextsTotals = {
  sent: 0,
  sentPeople: 0,
  received: 0,
  receivedPeople: 0,
  conversations: 0,
  responseRate: null,
}

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readTextsReport(params: TextsParams): Promise<TextsResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(params.datePreset, params.dateStart, params.dateEnd)

  // 1. Broker roster — crm-active brokers with a crm_slug
  const { data: brokerRows, error: brokerError } = await sb
    .from('brokers')
    .select('crm_slug,display_name,photo_url')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)
    .order('sort_order', { ascending: true })

  if (brokerError) console.error('[getTextsReport] brokers error', brokerError.message)

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
  //    Two queries per broker — low cardinality expected (texts are broker-personal
  //    1:1 SMS via Twilio; volumes are ~10s–100s/month per broker).
  //
  //    Group A: kind='sms_out' rows — outbound texts sent BY the broker
  //    Group B: kind='sms_in'  rows — inbound texts received on the broker's number
  //
  const perBrokerGroup = await Promise.all(
    scopedBrokers.map((b) => {
      const slug = b.crm_slug
      return Promise.all([
        // a: texts SENT by this broker
        sb.from('crm_timeline')
          .select('person_id')
          .eq('broker', slug)
          .eq('kind', 'sms_out')
          .gte('ts', start)
          .lte('ts', end),
        // b: texts RECEIVED on this broker's number
        sb.from('crm_timeline')
          .select('person_id')
          .eq('broker', slug)
          .eq('kind', 'sms_in')
          .gte('ts', start)
          .lte('ts', end),
      ] as const)
    }),
  )

  // 3. Build per-broker rows
  const rows: TextsRow[] = scopedBrokers.map((b, i) => {
    const [sentRes, receivedRes] = perBrokerGroup[i]
    const sentRows = (sentRes.data ?? []) as Array<{ person_id: number }>
    const receivedRows = (receivedRes.data ?? []) as Array<{ person_id: number }>

    // Texts sent
    const sent = sentRows.length
    const sentPeopleSet = new Set(sentRows.map((r) => r.person_id))
    const sentPeople = sentPeopleSet.size

    // Texts received
    const received = receivedRows.length
    const receivedPeopleSet = new Set(receivedRows.map((r) => r.person_id))
    const receivedPeople = receivedPeopleSet.size

    // 2-way conversations — person_id appears in both sent and received sets
    let conversations = 0
    for (const pid of sentPeopleSet) {
      if (receivedPeopleSet.has(pid)) conversations++
    }

    // Response rate — % of texted people who replied back
    const responseRate = sentPeople > 0
      ? Math.round((conversations / sentPeople) * 100 * 10) / 10
      : null

    return {
      brokerSlug: b.crm_slug,
      brokerName: b.display_name ?? b.crm_slug,
      avatarUrl: BROKER_HEADSHOT[b.crm_slug] ?? b.photo_url ?? null,
      sent,
      sentPeople,
      received,
      receivedPeople,
      conversations,
      responseRate,
    }
  })

  // 4. Totals — sum across all scoped broker rows.
  //    responseRate is re-derived from the aggregate conversations/sentPeople
  //    so it is mathematically correct (not an average of per-broker rates).
  const aggSentPeople = rows.reduce((sum, r) => sum + r.sentPeople, 0)
  const aggConversations = rows.reduce((sum, r) => sum + r.conversations, 0)

  const totals: TextsTotals = {
    sent: rows.reduce((sum, r) => sum + r.sent, 0),
    sentPeople: aggSentPeople,
    received: rows.reduce((sum, r) => sum + r.received, 0),
    receivedPeople: rows.reduce((sum, r) => sum + r.receivedPeople, 0),
    conversations: aggConversations,
    responseRate:
      aggSentPeople > 0
        ? Math.round((aggConversations / aggSentPeople) * 100 * 10) / 10
        : null,
  }

  return { rows, totals, dateStart: start, dateEnd: end }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Texts report data — per-broker outbound/inbound SMS counts, conversation
 * counts, and response rate over a date range.
 *
 * Cached 10 minutes (matching FUB's documented reporting cache TTL).
 * Cache is keyed on filter params so different combos get separate entries.
 *
 * Source tables:
 *   - crm_timeline kind='sms_out' → texts SENT by broker
 *   - crm_timeline kind='sms_in'  → texts RECEIVED on broker's Twilio number
 *
 * INFERRED REPORT: no dedicated FUB GIF frame was captured for the Texts tab.
 * Metrics and layout mirror the Calls report + standard FUB Texts conventions.
 */
export async function getTextsReport(params: TextsParams): Promise<TextsResult> {
  const cached = unstable_cache(
    () => readTextsReport(params),
    [
      'crm-texts-report-v1',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-texts', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
