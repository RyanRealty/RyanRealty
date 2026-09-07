import 'server-only'

/**
 * What happened AFTER we sent it (Matt 2026-09-07: "getting these things
 * looking good and approved and then sent out and TRACKED so that we can get
 * LEADS is the goal").
 *
 * The plumbing was already complete and completely invisible. A sent CMA
 * writes to three tables and the queue read none of them:
 *
 *   email_events   `email_key = 'cma:<slug>'`   sent / delivered / open /
 *                                               click / bounce / unsubscribe
 *   visitor_events `page_category='client-document'`, page_url `/cma/<slug>`
 *   crm_timeline   `email_in` / `sms_in` on the linked person — the reply
 *
 * This reader turns those three into ONE row-level answer per document, and one
 * per-lane funnel. It is the read half; lib/crm/cma-engagement.ts is the write
 * half that routes the same signals to the broker's phone.
 *
 * §0 note on what each field means. `sentAt` is the send stamp on the `cmas`
 * row (delivered_at — the column is named for the CRM's "delivered to the
 * lead", not for an SMTP delivery receipt). `deliveredAt` is the provider's
 * actual delivery event and exists ONLY on the Resend fallback rail; a Gmail
 * DWD send has no delivery webhook, so a null there means "no receipt exists",
 * never "it did not arrive". The UI must not render the two as one stage.
 *
 * COST. Every read is `.in()`-chunked over the caller's id set — no per-row
 * query, no unbounded table scan. getCmaLaneFunnel scopes the expensive
 * engagement join to the SENT rows only, because no unsent document can have
 * been opened; that is what keeps it off getCmaPerformance's ~90s path while
 * still counting every stage on the same denominator.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import {
  getDocEngagementDetail,
  EMPTY_DOC_ENGAGEMENT_DETAIL,
} from '@/lib/data/prospecting/engagement'
import { listCmaQueue } from '@/lib/data/cma/unified-queue'
import { classifyCmaOrigin, CMA_ORIGIN_LABEL, type CmaOrigin } from '@/lib/cma/origin'

/** Inbound kinds that count as "they answered". A form submit is not a reply. */
export const REPLY_TIMELINE_KINDS = ['email_in', 'sms_in'] as const

export type CmaOutcome = {
  cmaId: string
  slug: string
  /** cmas.delivered_at — when the broker's send left the building. */
  sentAt: string | null
  /** Provider delivery receipt. Resend rail only; null on the Gmail rail. */
  deliveredAt: string | null
  firstOpenAt: string | null
  opens: number
  firstClickAt: string | null
  clicks: number
  /** First `/cma/<slug>` page view — they actually opened the document. */
  firstVisitAt: string | null
  visits: number
  lastVisitAt: string | null
  /** First inbound email/SMS from the linked person AFTER the send. */
  repliedAt: string | null
  /** Hard bounce or spam complaint on this send. */
  bounced: boolean
  /** Unsubscribe attributed to this send. */
  unsubscribed: boolean
  /** crm_people.stage for the linked contact — where this lead sits today. */
  leadStage: string | null
}

export type CmaOutcomeMap = Record<string, CmaOutcome>

export function emptyCmaOutcome(cmaId: string, slug: string): CmaOutcome {
  return {
    cmaId,
    slug,
    sentAt: null,
    deliveredAt: null,
    firstOpenAt: null,
    opens: 0,
    firstClickAt: null,
    clicks: 0,
    firstVisitAt: null,
    visits: 0,
    lastVisitAt: null,
    repliedAt: null,
    bounced: false,
    unsubscribed: false,
    leadStage: null,
  }
}

type Row = Record<string, unknown>

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v)
  return s === '' ? null : s
}

/** Chunk an array into fixed-size slices — every read here is `.in()`-bounded. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function computeCmaOutcomes(cmaIds: string[]): Promise<CmaOutcomeMap> {
  const ids = [...new Set(cmaIds.map((s) => String(s ?? '').trim()).filter(Boolean))]
  if (ids.length === 0) return {}
  const sb = createServiceClient()

  // 1. The documents themselves — id, slug, the linked person, the send stamp.
  const docs: Row[] = []
  for (const part of chunk(ids, 100)) {
    const { data, error } = await sb
      .from('cmas')
      .select('id, slug, person_id, client_email, delivered_at')
      .in('id', part)
    if (error) throw new Error(`cma outcomes: cmas read failed: ${error.message}`)
    docs.push(...((data ?? []) as Row[]))
  }
  if (docs.length === 0) return {}

  // 2. Email + document engagement, one bounded pass over the three tables.
  const engagement = await getDocEngagementDetail(
    docs.map((d) => ({
      id: String(d.id),
      slug: str(d.slug),
      personId: d.person_id == null ? null : Number(d.person_id),
    })),
  )

  const personIds = [
    ...new Set(
      docs.map((d) => (d.person_id == null ? null : Number(d.person_id))).filter((v): v is number => v != null),
    ),
  ]

  // 3. Replies. A reply is inbound traffic from the linked person AFTER the
  //    send — scoped by the earliest send in this set so the read never walks
  //    the contact's whole history. Per-CMA the stamp is re-tested against that
  //    document's own sentAt below, so a contact with two CMAs cannot inherit
  //    the older document's reply onto the newer one.
  const sentStamps = docs
    .map((d) => str(d.delivered_at))
    .filter((v): v is string => !!v)
    .sort()
  const earliestSend = sentStamps[0] ?? null
  const inboundByPid = new Map<number, string[]>()
  if (personIds.length > 0 && earliestSend) {
    for (const part of chunk(personIds, 100)) {
      const { data, error } = await sb
        .from('crm_timeline')
        .select('person_id, ts')
        .in('person_id', part)
        .in('kind', REPLY_TIMELINE_KINDS as unknown as string[])
        .gte('ts', earliestSend)
        .order('ts', { ascending: true })
      if (error) throw new Error(`cma outcomes: crm_timeline read failed: ${error.message}`)
      for (const t of (data ?? []) as Row[]) {
        const pid = Number(t.person_id)
        const at = str(t.ts)
        if (!Number.isFinite(pid) || !at) continue
        const list = inboundByPid.get(pid) ?? []
        list.push(at)
        inboundByPid.set(pid, list)
      }
    }
  }

  // 4. Where the lead sits today.
  const stageByPid = new Map<number, string | null>()
  for (const part of chunk(personIds, 200)) {
    const { data, error } = await sb.from('crm_people').select('id, stage').in('id', part)
    if (error) throw new Error(`cma outcomes: crm_people read failed: ${error.message}`)
    for (const p of (data ?? []) as Row[]) stageByPid.set(Number(p.id), str(p.stage))
  }

  const out: CmaOutcomeMap = {}
  for (const d of docs) {
    const cmaId = String(d.id)
    const slug = str(d.slug) ?? cmaId
    const eng = engagement[cmaId] ?? EMPTY_DOC_ENGAGEMENT_DETAIL
    const sentAt = str(d.delivered_at)
    const pid = d.person_id == null ? null : Number(d.person_id)

    // Earliest inbound strictly after this document's own send. No send stamp
    // means no "reply to it" can be claimed — the row shows nothing rather
    // than crediting the document with a conversation it did not start.
    let repliedAt: string | null = null
    if (pid != null && sentAt) {
      const list = inboundByPid.get(pid) ?? []
      for (const at of list) {
        if (at > sentAt) {
          repliedAt = at
          break // the list is ordered ascending
        }
      }
    }

    out[cmaId] = {
      cmaId,
      slug,
      sentAt,
      deliveredAt: eng.emailDeliveredAt,
      firstOpenAt: eng.firstOpenAt,
      opens: eng.emailOpens,
      firstClickAt: eng.firstClickAt,
      clicks: eng.emailClicks,
      firstVisitAt: eng.firstViewAt,
      visits: eng.reportViews,
      lastVisitAt: eng.lastViewAt,
      repliedAt,
      bounced: eng.bouncedAt != null,
      unsubscribed: eng.unsubscribedAt != null,
      leadStage: pid == null ? null : (stageByPid.get(pid) ?? null),
    }
  }
  return out
}

/**
 * Per-document outcome for a bounded set of CMA ids.
 *
 * 60-second TTL on the `cma:engagement` tag: the same tag the open/click/view
 * writers already bust, so a fresh open flushes this early rather than sitting
 * behind a stale window while a broker is watching the row.
 */
export const getCmaOutcomes = makeResilientCached<[string[]], CmaOutcomeMap>(
  computeCmaOutcomes,
  ['cma-outcomes-v1'],
  { revalidate: 60, tags: ['cma:engagement'] },
  {},
)

// ── Per-lane funnel ──────────────────────────────────────────────────────────

export type CmaLaneFunnelRow = {
  origin: CmaOrigin
  label: string
  /** Every non-archived document in the lane. */
  built: number
  /** Built, audited, clean — sendable today. */
  ready: number
  sent: number
  /** Provider delivery receipts (Resend rail only — see the file header). */
  delivered: number
  opened: number
  clicked: number
  /** Opened the document itself, not just the email. */
  visited: number
  replied: number
  bounced: number
  unsubscribed: number
  /** Each stage over `sent`, 0..1. Null when nothing in the lane was sent. */
  openRate: number | null
  clickRate: number | null
  visitRate: number | null
  replyRate: number | null
}

export type CmaLaneFunnel = {
  lanes: CmaLaneFunnelRow[]
  totals: CmaLaneFunnelRow
}

/** Guarded ratio — a rate over zero sends is unknown, never 0%. */
function rate(n: number, denom: number): number | null {
  return denom > 0 ? n / denom : null
}

function emptyLane(origin: CmaOrigin, label: string): CmaLaneFunnelRow {
  return {
    origin,
    label,
    built: 0,
    ready: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    visited: 0,
    replied: 0,
    bounced: 0,
    unsubscribed: 0,
    openRate: null,
    clickRate: null,
    visitRate: null,
    replyRate: null,
  }
}

function withRates(row: CmaLaneFunnelRow): CmaLaneFunnelRow {
  return {
    ...row,
    openRate: rate(row.opened, row.sent),
    clickRate: rate(row.clicked, row.sent),
    visitRate: rate(row.visited, row.sent),
    replyRate: rate(row.replied, row.sent),
  }
}

async function computeCmaLaneFunnel(): Promise<CmaLaneFunnel> {
  // The queue reader is the ONE state vocabulary (built / ready / sent). Reading
  // it rather than re-deriving state here is what keeps the funnel's "ready"
  // from ever disagreeing with the number of rows a broker can see and approve.
  const { rows } = await listCmaQueue({ limit: 1000 })

  const byOrigin = new Map<CmaOrigin, CmaLaneFunnelRow>()
  const lane = (o: CmaOrigin): CmaLaneFunnelRow => {
    const found = byOrigin.get(o)
    if (found) return found
    const made = emptyLane(o, CMA_ORIGIN_LABEL[o])
    byOrigin.set(o, made)
    return made
  }

  const sentRows: Array<{ id: string; origin: CmaOrigin }> = []
  for (const r of rows) {
    const l = lane(r.origin)
    l.built++
    if (r.state === 'ready') l.ready++
    if (r.state === 'sent') {
      l.sent++
      sentRows.push({ id: r.id, origin: r.origin })
    }
  }

  // Downstream stages only exist for a document that actually went out, so the
  // engagement join is scoped to those ids — a handful, not the whole table.
  const outcomes = sentRows.length > 0 ? await getCmaOutcomes(sentRows.map((r) => r.id)) : {}
  for (const r of sentRows) {
    const o = outcomes[r.id]
    if (!o) continue
    const l = lane(r.origin)
    if (o.deliveredAt) l.delivered++
    if (o.opens > 0) l.opened++
    if (o.clicks > 0) l.clicked++
    if (o.visits > 0) l.visited++
    if (o.repliedAt) l.replied++
    if (o.bounced) l.bounced++
    if (o.unsubscribed) l.unsubscribed++
  }

  const totals = emptyLane('unknown', 'All lanes')
  for (const l of byOrigin.values()) {
    totals.built += l.built
    totals.ready += l.ready
    totals.sent += l.sent
    totals.delivered += l.delivered
    totals.opened += l.opened
    totals.clicked += l.clicked
    totals.visited += l.visited
    totals.replied += l.replied
    totals.bounced += l.bounced
    totals.unsubscribed += l.unsubscribed
  }

  const lanes = [...byOrigin.values()]
    .map(withRates)
    .sort((a, b) => b.built - a.built || a.label.localeCompare(b.label))
  return { lanes, totals: withRates(totals) }
}

const EMPTY_FUNNEL: CmaLaneFunnel = { lanes: [], totals: emptyLane('unknown', 'All lanes') }

/**
 * Built → ready → sent → delivered → opened → clicked → visited → replied, per
 * lane. 5-minute TTL: it heads a page a broker refreshes, and the inputs move
 * at the pace of sends, not clicks.
 */
export const getCmaLaneFunnel = makeResilientCached<[], CmaLaneFunnel>(
  computeCmaLaneFunnel,
  ['cma-lane-funnel-v1'],
  { revalidate: 300, tags: ['cma:engagement'] },
  EMPTY_FUNNEL,
)

/** Re-exported so a caller can classify a raw row without a second import. */
export { classifyCmaOrigin }
