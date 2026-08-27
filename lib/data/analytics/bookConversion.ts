import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Book conversion — how the KNOWN book moves toward a signed client.
 *
 * WHY THIS IS THE MAIN REPORT, not the web-acquisition one. The business does
 * not run on anonymous traffic: 23,079 people are already known, 20,408 of them
 * sitting in Nurture. Measured 2026-08-26 there were 12 Active Clients. Growing
 * that number is the job, and until now nothing measured it.
 *
 * WHAT MAKES IT MEASURABLE. `crm_timeline` carries `stage_change` rows, so stage
 * movement has a history rather than only a current value — you cannot refine a
 * process you can only see a snapshot of. There were 13 such rows against
 * 100,500 timeline events when this shipped: the mechanism works, the funnel
 * barely moves. That gap IS the finding, and this report is built to show it
 * rather than hide it behind a healthy-looking pie chart.
 *
 * TOUCHES ARE COUNTED BESIDE MOVEMENT on purpose. "We sent 39,945 emails and
 * moved 13 people" is the sentence that changes what you do next. Either number
 * alone is comfortable and useless.
 */

/** The live ladder, from crm_stages where is_active. Order is the funnel order. */
export const ACTIVE_STAGE_ORDER = [
  'Lead',
  'Nurture',
  'Engaged',
  'Active Client',
  'Pending',
  'Closed',
  'Past Client',
  'Sphere',
] as const

export type BookStage = (typeof ACTIVE_STAGE_ORDER)[number] | string

export type StageStanding = { stage: BookStage; people: number }

export type StageMove = {
  from: string | null
  to: string | null
  count: number
}

export type TouchMix = {
  emailOut: number
  smsOut: number
  calls: number
  emailIn: number
  smsIn: number
  /** Replies over sends — the only engagement number that cannot be faked. */
  replyRate: number
  /**
   * DISTINCT people who answered in this window — the headline number
   * (Matt 2026-08-26). Not the count of inbound messages: ten texts from one
   * person is one conversation, and counting messages would let a single chatty
   * contact look like a good month.
   */
  conversationsStarted: number
}

export type BookConversionReport = {
  rangeStart: string
  rangeEnd: string
  /** Current standing across the whole book, not just the window. */
  standing: StageStanding[]
  totalPeople: number
  /** Stage movements recorded INSIDE the window. */
  moves: StageMove[]
  movesTotal: number
  /** Outbound and inbound activity inside the window. */
  touches: TouchMix
  /** Deals opened / closed inside the window, split by side. */
  deals: { sellerOpen: number; buyerOpen: number; closed: number; closedCommission: number }
  warnings: string[]
}

const PAGE = 1000

/**
 * Pull the stage transition out of a `stage_change` row.
 *
 * The writers record it in the TITLE — "Stage: Lead → Nurture" — and leave the
 * payload as `{}`. Structured keys are read first so that once the writers carry
 * `payload.from` / `payload.to` this keeps working without a second migration of
 * the reader, and the title parse stays as the path for every row written before
 * that. Exported so the parsing rule is testable against the real strings.
 */
export function parseStageChange(
  title: string | null | undefined,
  payload: Record<string, unknown> | null | undefined,
): { from: string | null; to: string | null } {
  const p = payload ?? {}
  const pf = typeof p.from === 'string' ? p.from : null
  const pt = typeof p.to === 'string' ? p.to : null
  if (pf || pt) return { from: pf, to: pt }

  const t = title ?? ''
  // "Stage: Lead → Nurture" (and the "(bulk)" suffix the bulk handler adds).
  // The arrow is a real → in the writers; accept -> too.
  const arrow = /^\s*stage:\s*(.+?)\s*(?:→|->)\s*(.+?)\s*(?:\(bulk\))?\s*$/i.exec(t)
  if (arrow) return { from: arrow[1] || null, to: arrow[2] || null }

  // The sequence engine writes a different sentence with no arrow and no origin:
  //   Stage updated by workflow "Seller nurture": Nurture
  // A destination with an unknown origin is still a real move and must not be
  // dropped just because the writer phrased it differently.
  const workflow = /stage updated by workflow\s+"[^"]*"\s*:\s*(.+?)\s*$/i.exec(t)
  if (workflow) return { from: null, to: workflow[1] || null }

  return { from: null, to: null }
}

export async function getBookConversion(startIso: string, endIso: string): Promise<BookConversionReport> {
  const sb = createServiceClient()

  // 1. Current standing across the whole book.
  //    PostgREST caps a select at 1000 rows and the book is 23,079, so this
  //    paginates. `.order()` is not optional: an unordered range() reshuffles
  //    between requests and silently drops rows.
  const people: Array<{ stage: string | null }> = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('crm_people')
      .select('id,stage')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`crm_people read failed: ${error.message}`)
    const page = (data ?? []) as Array<{ stage: string | null }>
    people.push(...page)
    if (page.length < PAGE) break
  }

  const standingMap = new Map<string, number>()
  for (const p of people) {
    const s = (p.stage ?? '(none)').trim()
    // 'lead' and 'Lead' are the same rung typed twice.
    const key = ACTIVE_STAGE_ORDER.find((x) => x.toLowerCase() === s.toLowerCase()) ?? s
    standingMap.set(key, (standingMap.get(key) ?? 0) + 1)
  }
  const standing: StageStanding[] = [...standingMap.entries()]
    .map(([stage, n]) => ({ stage, people: n }))
    .sort((a, b) => {
      const ia = ACTIVE_STAGE_ORDER.indexOf(a.stage as never)
      const ib = ACTIVE_STAGE_ORDER.indexOf(b.stage as never)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return b.people - a.people
    })

  // 2. Movement and touches inside the window, from one timeline pass.
  const events: Array<{ kind: string; title: string | null; payload: Record<string, unknown> | null; person_id: number | null }> = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('crm_timeline')
      .select('id,kind,title,payload,person_id')
      .gte('ts', startIso)
      .lte('ts', endIso)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`crm_timeline read failed: ${error.message}`)
    const page = (data ?? []) as typeof events
    events.push(...page)
    if (page.length < PAGE) break
  }

  const moveMap = new Map<string, StageMove>()
  const touches: TouchMix = { emailOut: 0, smsOut: 0, calls: 0, emailIn: 0, smsIn: 0, replyRate: 0, conversationsStarted: 0 }
  const repliedPeople = new Set<number>()
  for (const e of events) {
    switch (e.kind) {
      case 'email_out': touches.emailOut += 1; break
      case 'sms_out': touches.smsOut += 1; break
      case 'call': touches.calls += 1; break
      case 'email_in':
        touches.emailIn += 1
        if (e.person_id) repliedPeople.add(e.person_id)
        break
      case 'sms_in':
        touches.smsIn += 1
        if (e.person_id) repliedPeople.add(e.person_id)
        break
      case 'stage_change': {
        const { from, to } = parseStageChange(e.title, e.payload)
        const key = `${from ?? '?'}→${to ?? '?'}`
        const row = moveMap.get(key) ?? { from, to, count: 0 }
        row.count += 1
        moveMap.set(key, row)
        break
      }
    }
  }
  const sends = touches.emailOut + touches.smsOut
  touches.replyRate = sends > 0 ? (touches.emailIn + touches.smsIn) / sends : 0
  touches.conversationsStarted = repliedPeople.size
  const moves = [...moveMap.values()].sort((a, b) => b.count - a.count)
  const movesTotal = moves.reduce((n, m) => n + m.count, 0)

  // 3. Deals in the window.
  const { data: dealRows, error: dealErr } = await sb
    .from('crm_deals')
    .select('stage,pipeline,commission_dollars,entered_stage_at,actual_close_date')
    .gte('entered_stage_at', startIso)
    .lte('entered_stage_at', endIso)
    .limit(1000)
  if (dealErr) throw new Error(`crm_deals read failed: ${dealErr.message}`)
  const deals = { sellerOpen: 0, buyerOpen: 0, closed: 0, closedCommission: 0 }
  for (const d of (dealRows ?? []) as Array<Record<string, unknown>>) {
    const stage = String(d.stage ?? '')
    const isClosed = /^closed$/i.test(stage)
    if (isClosed) {
      deals.closed += 1
      const c = Number(d.commission_dollars)
      if (Number.isFinite(c) && c > 0) deals.closedCommission += c
      continue
    }
    if (/^lost/i.test(stage)) continue
    // Seller pipeline stages vs buyer pipeline stages.
    if (/pre-listing|listed/i.test(stage)) deals.sellerOpen += 1
    else if (/buyer/i.test(stage)) deals.buyerOpen += 1
  }

  const warnings: string[] = []
  if (sends > 500 && movesTotal === 0) {
    warnings.push(
      `${sends.toLocaleString()} outbound messages went out in this window and NOT ONE person changed stage. ` +
        `Either the outreach is not landing, or stage changes are being made without being recorded. Both are worth knowing.`,
    )
  }
  if (movesTotal > 0 && sends / movesTotal > 500) {
    warnings.push(
      `${Math.round(sends / movesTotal).toLocaleString()} outbound messages per stage change. ` +
        `That ratio is the number to drive down.`,
    )
  }

  return {
    rangeStart: startIso,
    rangeEnd: endIso,
    standing,
    totalPeople: people.length,
    moves,
    movesTotal,
    touches,
    deals,
    warnings,
  }
}
