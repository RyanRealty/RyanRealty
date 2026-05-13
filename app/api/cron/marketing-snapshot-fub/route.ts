/**
 * FUB (Follow Up Boss) daily snapshot ingestor.
 *
 * Fetches CRM metrics from the FUB v1 REST API and decomposes them into
 * marketing_channel_daily rows. Iterates day-by-day in series to keep
 * per-day attribution accurate and to respect FUB's rate limits.
 *
 * Default behavior: pulls yesterday only (for the daily Vercel cron).
 * Backfill: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD pulls one row per
 * day in that range.
 *
 * Auth: requires Authorization: Bearer $CRON_SECRET.
 *
 * Qualified-seller-lead tags (canonical, from docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md §2):
 *   hot-seller   — timeline "ASAP — 0 to 3 months"
 *   warm-seller  — timeline "3 to 12 months"
 *   nurture-only — timeline "Just exploring" (excluded from qualified count)
 *
 * FUB /v1/people also carries tags from the broader seller pipeline
 * (seller, seller-lead) which are included in the qualified-seller-lead
 * count so organic leads from outside the FB funnel are captured too.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  IngestorResult,
  MetricRow,
  isAuthorizedCron,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'
import { getFubHeaders } from '@/lib/fub-snapshot'

export const maxDuration = 300

const SOURCE = 'fub_api_v1'
const FUB_BASE = 'https://api.followupboss.com/v1'

// Canonical seller-lead tags. Match against the actual tag values observed in
// FUB, normalised to lowercase. Source:
//   - docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md §2 (kebab-case playbook tags)
//   - direct FUB inspection 2026-05-12 (Title Case tags applied by webhook +
//     landing-page form submissions + the auto:seller-seq:new automation)
// Comparison is case-insensitive (see isSellerLead helper).
// nurture-only is explicitly excluded — those are not yet qualified.
const SELLER_LEAD_TAGS = new Set<string>([
  // Playbook kebab-case (canonical doc)
  'hot-seller',
  'warm-seller',
  'seller',
  'seller-lead',
  // Webhook Title Case (actual production tags)
  'seller lead',
  'seller intent',
  'hot seller',
  'warm seller',
  // Landing-page seller-intent tags
  'lp-home-value',
  // Automation tag (fires when website lead is classified seller-intent)
  'auto:seller-seq:new',
])

function isSellerLead(tags: string[] | null | undefined): boolean {
  if (!Array.isArray(tags)) return false
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    if (SELLER_LEAD_TAGS.has(raw.toLowerCase().trim())) return true
  }
  return false
}

// ─── date helpers ───────────────────────────────────────────────────────────

function* dateIter(startDate: string, endDate: string): Generator<string> {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

/** Inclusive [dayStart, dayEnd) window for a YYYY-MM-DD date string. */
function dayWindow(date: string): { after: string; before: string } {
  const after = `${date}T00:00:00Z`
  // "before" is the first moment of the next day — FUB's createdBefore is exclusive
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return { after, before: next.toISOString() }
}

// ─── FUB paged-fetch helper ──────────────────────────────────────────────────

type FubPage<T> = {
  items: T[]
  nextOffset: number | null
}

async function fetchAllPages<T>(
  endpoint: string,
  params: Record<string, string>,
  headers: HeadersInit,
  pageSize = 100,
): Promise<T[]> {
  const all: T[] = []
  let offset = 0
  while (true) {
    const q = new URLSearchParams({ ...params, limit: String(pageSize), offset: String(offset) })
    const res = await fetch(`${FUB_BASE}/${endpoint}?${q}`, { headers })
    if (!res.ok) {
      throw new Error(`FUB /${endpoint} HTTP ${res.status}`)
    }
    const data = (await res.json()) as Record<string, unknown>
    // FUB returns the resource array under its plural name, e.g. { people: [...] }
    const key = Object.keys(data).find(
      (k) => Array.isArray(data[k]) && k !== 'metadata',
    )
    const items: T[] = key ? (data[key] as T[]) : []
    all.push(...items)
    if (items.length < pageSize) break
    offset += pageSize
  }
  return all
}

/**
 * Fetch items in a creation-date window using sort=-created and client-side
 * filtering. FUB v1 /people does NOT accept createdAfter/createdBefore as
 * query params (it returns 400). The documented filter pattern is to sort
 * by -created and paginate until we hit dates before the window.
 *
 * Stops paginating as soon as the newest item on a page is older than
 * startDateISO, so for typical 30-day windows this is far cheaper than
 * scanning the whole DB.
 */
async function fetchInDateWindow<T extends { created?: string | null; createdAt?: string | null }>(
  endpoint: string,
  startDateISO: string,
  endDateISO: string,
  headers: HeadersInit,
  pageSize = 100,
  hardCapPages = 200,
): Promise<T[]> {
  const all: T[] = []
  let offset = 0
  let pages = 0
  while (pages < hardCapPages) {
    const q = new URLSearchParams({
      sort: '-created',
      limit: String(pageSize),
      offset: String(offset),
    })
    const res = await fetch(`${FUB_BASE}/${endpoint}?${q}`, { headers })
    if (!res.ok) {
      throw new Error(`FUB /${endpoint} HTTP ${res.status}`)
    }
    const data = (await res.json()) as Record<string, unknown>
    const key = Object.keys(data).find(
      (k) => Array.isArray(data[k]) && k !== 'metadata',
    )
    const items: T[] = key ? (data[key] as T[]) : []
    if (items.length === 0) break

    for (const item of items) {
      const created: string = item.created ?? item.createdAt ?? ''
      if (!created) continue
      if (created >= endDateISO) continue
      if (created < startDateISO) continue
      all.push(item)
    }

    // If the newest item on this page is older than our window start,
    // every remaining page is also older — stop.
    const newest: string = items[0]?.created ?? items[0]?.createdAt ?? ''
    if (newest && newest < startDateISO) break

    if (items.length < pageSize) break
    offset += pageSize
    pages += 1
  }
  return all
}

// ─── FUB type stubs (only the fields we consume) ────────────────────────────

type FubPerson = {
  id: number
  created?: string
  source?: string | null
  tags?: string[] | null
  /** Milliseconds from lead creation to first agent response, if FUB computes it. */
  firstAgentResponseTime?: number | null
  // FUB may expose this under a different field name — we check both
  respondedAt?: string | null
  createdAt?: string | null
}

type FubEvent = {
  id: number
  type?: string
  created?: string
  createdAt?: string
  personId?: number
}

type FubDeal = {
  id: number
  created?: string
  createdAt?: string
  price?: number | null
  status?: string | null
  updatedAt?: string | null
  stage?: string | null
  stageUpdatedAt?: string | null
}

// ─── metric builders ─────────────────────────────────────────────────────────

function buildRows(
  date: string,
  people: FubPerson[],
  events: FubEvent[],
  deals: FubDeal[],
  allDeals: FubDeal[], // full pipeline snapshot for stage metrics
): MetricRow[] {
  const base = { date, channel: 'fub' as const, source: SOURCE }
  const rows: MetricRow[] = []

  // ── account scope ──────────────────────────────────────────────────────

  // new_leads: people created on this day
  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'new_leads',
    value: people.length,
  })

  // appointments_booked: events of type Appointment on this day
  const appointments = events.filter(
    (e) => typeof e.type === 'string' && e.type.toLowerCase() === 'appointment',
  )
  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'appointments_booked',
    value: appointments.length,
  })

  // deals_created: deals created on this day (already filtered by createdAfter/Before)
  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'deals_created',
    value: deals.length,
  })

  // deals_closed_won / deals_closed_lost: deals whose status was updated to terminal
  // on this day. FUB doesn't expose a stageUpdatedAt filter via query params, so we
  // use the deals returned (filtered by createdAt). For transition metrics we check
  // updatedAt falls within the day window (best available proxy without webhooks).
  // This is a known approximation; cite as such in metadata.
  const { after, before } = dayWindow(date)
  const afterMs = Date.parse(after)
  const beforeMs = Date.parse(before)

  const closedWon = allDeals.filter((d) => {
    if (typeof d.status !== 'string') return false
    if (d.status.toLowerCase() !== 'closed won') return false
    const upd = d.stageUpdatedAt ?? d.updatedAt
    if (!upd) return false
    const ms = Date.parse(upd)
    return Number.isFinite(ms) && ms >= afterMs && ms < beforeMs
  })
  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'deals_closed_won',
    value: closedWon.length,
    metadata: { approximation: 'stageUpdatedAt|updatedAt within day window' },
  })

  const closedLost = allDeals.filter((d) => {
    if (typeof d.status !== 'string') return false
    if (d.status.toLowerCase() !== 'closed lost') return false
    const upd = d.stageUpdatedAt ?? d.updatedAt
    if (!upd) return false
    const ms = Date.parse(upd)
    return Number.isFinite(ms) && ms >= afterMs && ms < beforeMs
  })
  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'deals_lost',
    value: closedLost.length,
    metadata: { approximation: 'stageUpdatedAt|updatedAt within day window' },
  })

  // avg_response_time_minutes: mean of (respondedAt - createdAt) for new leads.
  // FUB does not reliably expose a machine-readable firstAgentRespondedAt on the
  // /v1/people endpoint in all account configs. We use firstAgentResponseTime
  // (pre-computed, milliseconds) when present. Skip rows where the value is NULL
  // rather than emitting 0.
  const responseTimes: number[] = people.flatMap((p) => {
    if (
      typeof p.firstAgentResponseTime === 'number' &&
      Number.isFinite(p.firstAgentResponseTime) &&
      p.firstAgentResponseTime > 0
    ) {
      return [p.firstAgentResponseTime / 60_000]
    }
    // fallback: compute from respondedAt and createdAt if both are present
    const created = p.createdAt ?? p.created
    const responded = p.respondedAt
    if (created && responded) {
      const delta = (Date.parse(responded) - Date.parse(created)) / 60_000
      if (Number.isFinite(delta) && delta >= 0) return [delta]
    }
    return []
  })
  if (responseTimes.length > 0) {
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    rows.push({
      ...base,
      scope: 'account',
      scope_id: '',
      metric: 'avg_response_time_minutes',
      value: Math.round(avg * 100) / 100,
      metadata: { sample_size: responseTimes.length },
    })
    // (If responseTimes is empty we skip this metric entirely — no row emitted.)
  }

  // qualified_seller_leads (north-star): new leads with any canonical seller tag
  const qualifiedSellers = people.filter((p) => isSellerLead(p.tags))
  if (qualifiedSellers.length > 0) {
    rows.push({
      ...base,
      scope: 'account',
      scope_id: '',
      metric: 'qualified_seller_leads',
      value: qualifiedSellers.length,
      metadata: { tags_matched: [...SELLER_LEAD_TAGS] },
    })
  }

  // ── source scope ───────────────────────────────────────────────────────

  // new_leads by lead source
  const bySource = new Map<string, number>()
  for (const p of people) {
    const src = (typeof p.source === 'string' && p.source.trim()) ? p.source.trim() : 'unknown'
    bySource.set(src, (bySource.get(src) ?? 0) + 1)
  }
  for (const [src, count] of bySource) {
    rows.push({
      ...base,
      scope: 'source',
      scope_id: src,
      metric: 'new_leads',
      value: count,
      metadata: { source: src },
    })
  }

  // ── campaign scope (pipeline snapshot by stage) ────────────────────────

  // Pipeline snapshot: group allDeals by stage (end-of-day state approximation —
  // FUB doesn't expose a point-in-time deals snapshot, so we use the current
  // stage of all active deals as a daily watermark).
  type StageAgg = { count: number; value: number }
  const byStage = new Map<string, StageAgg>()
  for (const d of allDeals) {
    const stage = (typeof d.stage === 'string' && d.stage.trim()) ? d.stage.trim() : 'unknown'
    const existing = byStage.get(stage) ?? { count: 0, value: 0 }
    existing.count += 1
    existing.value += typeof d.price === 'number' && Number.isFinite(d.price) ? d.price : 0
    byStage.set(stage, existing)
  }
  for (const [stage, agg] of byStage) {
    const scopeId = `stage:${stage}`
    rows.push({
      ...base,
      scope: 'campaign',
      scope_id: scopeId,
      metric: 'pipeline_count',
      value: agg.count,
      metadata: { stage },
    })
    if (agg.value > 0) {
      rows.push({
        ...base,
        scope: 'campaign',
        scope_id: scopeId,
        metric: 'pipeline_value',
        value: agg.value,
        metadata: { stage },
      })
    }
  }

  return rows
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let startDate: string
  let endDate: string
  try {
    ;({ startDate, endDate } = parseDateRange(request))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'invalid date range' },
      { status: 400 },
    )
  }

  const headers = getFubHeaders()
  if (!headers) {
    return NextResponse.json({ error: 'FOLLOWUPBOSS_API_KEY is not configured' }, { status: 500 })
  }

  const errors: string[] = []
  const metricsCovered = new Set<string>()
  let totalRows = 0

  // Fetch full deal pipeline once (for stage snapshot). We re-use this for
  // every day in the range; stage data is current-state so it's the same
  // snapshot regardless of which day we're writing metrics for.
  let allDeals: FubDeal[] = []
  try {
    allDeals = await fetchAllPages<FubDeal>('deals', {}, headers)
  } catch (e) {
    errors.push(`deals pipeline fetch: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Compute the full window once and fetch all people/events/deals created in
  // the range in a single paginated stream per endpoint. Then we group by day
  // in JavaScript. This avoids 90+ API calls per endpoint AND works around
  // FUB /v1/people not supporting createdAfter/createdBefore query params.
  const fullStartISO = `${startDate}T00:00:00Z`
  const fullEndISO = dayWindow(endDate).before

  let allPeople: FubPerson[] = []
  let allEvents: FubEvent[] = []
  let allDealsCreated: FubDeal[] = []

  try {
    allPeople = await fetchInDateWindow<FubPerson>('people', fullStartISO, fullEndISO, headers)
  } catch (e) {
    errors.push(`people window fetch: ${e instanceof Error ? e.message : String(e)}`)
  }
  try {
    allEvents = await fetchInDateWindow<FubEvent>('events', fullStartISO, fullEndISO, headers)
  } catch (e) {
    errors.push(`events window fetch: ${e instanceof Error ? e.message : String(e)}`)
  }
  try {
    allDealsCreated = await fetchInDateWindow<FubDeal>('deals', fullStartISO, fullEndISO, headers)
  } catch (e) {
    errors.push(`deals window fetch: ${e instanceof Error ? e.message : String(e)}`)
  }

  const inDay = (created: string | null | undefined, day: string): boolean => {
    if (!created) return false
    return created.slice(0, 10) === day
  }

  for (const day of dateIter(startDate, endDate)) {
    try {
      const people = allPeople.filter((p) => inDay(p.created ?? p.createdAt, day))
      const events = allEvents.filter((e) => inDay(e.created ?? e.createdAt, day))
      const dealsCreated = allDealsCreated.filter((d) => inDay(d.created ?? d.createdAt, day))

      const rows = buildRows(day, people, events, dealsCreated, allDeals)
      const upserted = await upsertMetricRows(rows)
      totalRows += upserted
      rows.forEach((r) => metricsCovered.add(r.metric))
    } catch (e) {
      errors.push(`${day}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const result: IngestorResult = {
    channel: 'fub',
    startDate,
    endDate,
    rowsUpserted: totalRows,
    metricsCovered: [...metricsCovered],
    errors,
    fetchedAt: new Date().toISOString(),
  }

  return NextResponse.json(result)
}
