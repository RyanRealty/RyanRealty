/**
 * A sale the MLS shows closed is closed in the Vault — the I/O half.
 * reachability: /api/cron/tc-mls-close (daily), the SkySlope intake
 * (lib/data/tc/skyslope-intake.ts runs it on the deals it touched), and
 * scripts/tc-mls-close.ts (plan | apply).
 *
 * The decisions are pure in lib/tc/mls-close.ts; this file reads the Vault
 * and the MLS rows (public.listings by "ListNumber"), and writes:
 *
 *   1. tc_cycle_repair_log, BEFORE anything changes: the whole tc_cycles row
 *      as read right before the write, the deal's stage, the change, the MLS
 *      facts it rests on (outcome 'pending'). A deal whose log write fails is
 *      not touched.
 *   2. the deal stage, when the Vault's cycles (closes applied) say closed.
 *      Written before the cycle, so a run cut off between the two leaves the
 *      cycle still open and the next run redoes the whole decision.
 *   3. the cycle: status 'Closed', actual_closing_date = the MLS CloseDate,
 *      term_provenance status / actual_closing_date stamped by 'mls'. Guarded
 *      on updated_at: a row changed since it was read is left for the next run.
 *   4. one tc_events row per write (actor 'mls-close'), and the log row's
 *      outcome ('repaired' | 'failed').
 *
 * Reads and writes nothing in SkySlope, sends nothing.
 */
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { stampCloseProvenance } from '@/lib/tc/terms/provenance'
import {
  MLS_CLOSE_ACTOR,
  MLS_CLOSE_VERSION,
  applyMlsCloses,
  decideMlsCloses,
  decideStageAfterMlsClose,
  normalizeMlsNumber,
  type MlsCloseCycle,
  type MlsCloseDecision,
  type MlsListingFacts,
  type MlsStageDecision,
} from '@/lib/tc/mls-close'

type Obj = Record<string, unknown>
type SB = SupabaseClient
type CloseDecision = Extract<MlsCloseDecision, { kind: 'close' }>

const LEASE_NAME = 'tc-mls-close'
const CYCLE_COLUMNS =
  'id, deal_id, kind, status, mls_number, contract_acceptance_date, escrow_closing_date, actual_closing_date, dead_date, source_created_on, created_at'
const LISTING_COLUMNS = 'ListNumber, StandardStatus, CloseDate, ClosePrice, purchase_contract_date, ListOfficeName, buyer_office_name, ModificationTimestamp'

export type MlsCloseSweepOptions = {
  /** false = plan only: read and decide, write nothing. */
  apply: boolean
  /** Only these deals; omitted = every deal holding a sale cycle with an MLS number and no close date. */
  dealIds?: readonly string[] | null
  log?: (line: string) => void
  sb?: SB
}

export type MlsCloseApplied = {
  cycleId: string
  repairLogId: number | null
  from: { status: string | null; actual_closing_date: string | null }
  to: { status: string | null; actual_closing_date: string }
  outcome: 'planned' | 'repaired' | 'failed'
  note: string | null
}

export type MlsCloseDealReport = {
  dealId: string
  address: string | null
  closes: Array<CloseDecision & { applied?: MlsCloseApplied }>
  /** Sale cycles with an MLS number the rule looked at and left alone, with why. */
  skips: Array<Extract<MlsCloseDecision, { kind: 'skip' }>>
  stage: MlsStageDecision | null
  stageWritten: boolean
  errors: string[]
}

export type MlsCloseSweepResult = {
  ok: boolean
  mode: 'plan' | 'apply'
  error: string | null
  dealsChecked: number
  totals: { closes: number; closed: number; failed: number; stagesUpdated: number; logged: number; events: number }
  deals: MlsCloseDealReport[]
  ms: number
}

// ── reads ──────────────────────────────────────────────────────────────────

async function pageAll(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<Obj[]> {
  const out: Obj[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as Obj[]))
    if (!data || data.length < 1000) break
  }
  return out
}

const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v))
const date10 = (v: unknown): string | null => (v == null || v === '' ? null : String(v).slice(0, 10))

function toCycle(r: Obj): MlsCloseCycle {
  return {
    id: String(r.id),
    dealId: String(r.deal_id),
    kind: String(r.kind ?? ''),
    status: str(r.status),
    mlsNumber: str(r.mls_number),
    contractAcceptanceDate: date10(r.contract_acceptance_date),
    escrowClosingDate: date10(r.escrow_closing_date),
    actualClosingDate: date10(r.actual_closing_date),
    deadDate: date10(r.dead_date),
    createdOn: str(r.source_created_on) ?? str(r.created_at),
  }
}

/** Deals holding a sale cycle the rule could close: an MLS number and no close date yet. */
async function candidateDealIds(sb: SB): Promise<string[]> {
  const rows = await pageAll((a, b) =>
    sb.from('tc_cycles').select('id, deal_id, mls_number').eq('kind', 'sale').is('actual_closing_date', null).order('id').range(a, b),
  )
  return [...new Set(rows.filter((r) => normalizeMlsNumber(str(r.mls_number))).map((r) => String(r.deal_id)))]
}

/** The MLS rows on these numbers, one per number (the newest by ModificationTimestamp if the table holds two). */
export async function getMlsCloseFacts(numbers: readonly string[], sb: SB = createServiceClient()): Promise<Map<string, MlsListingFacts>> {
  const out = new Map<string, MlsListingFacts & { modified: string }>()
  const unique = [...new Set(numbers.map((n) => normalizeMlsNumber(n)).filter((n): n is string => !!n))]
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await sb.from('listings').select(LISTING_COLUMNS).in('ListNumber', unique.slice(i, i + 200))
    if (error) throw new Error(`listings: ${error.message}`)
    for (const r of (data ?? []) as Obj[]) {
      const n = normalizeMlsNumber(str(r.ListNumber))
      if (!n) continue
      const modified = str(r.ModificationTimestamp) ?? ''
      const prior = out.get(n)
      if (prior && prior.modified >= modified) continue
      out.set(n, {
        listNumber: n,
        status: str(r.StandardStatus),
        // CloseDate is stored as midnight UTC on the closing day.
        closeDate: date10(r.CloseDate),
        closePrice: r.ClosePrice == null ? null : Number(r.ClosePrice),
        purchaseContractDate: date10(r.purchase_contract_date),
        listOfficeName: str(r.ListOfficeName),
        buyerOfficeName: str(r.buyer_office_name),
        modified,
      })
    }
  }
  return new Map([...out].map(([k, { modified: _m, ...facts }]) => [k, facts]))
}

type DealRow = { id: string; address: string | null; stage: string | null; stage_detail: string | null }

async function loadInputs(sb: SB, dealIds: readonly string[]) {
  const deals: DealRow[] = []
  const cycles: MlsCloseCycle[] = []
  for (let i = 0; i < dealIds.length; i += 100) {
    const chunk = dealIds.slice(i, i + 100)
    const { data: d, error: de } = await sb.from('tc_deals').select('id, address, stage, stage_detail').in('id', chunk)
    if (de) throw new Error(`tc_deals: ${de.message}`)
    for (const r of (d ?? []) as Obj[]) deals.push({ id: String(r.id), address: str(r.address), stage: str(r.stage), stage_detail: str(r.stage_detail) })
    const { data: c, error: ce } = await sb.from('tc_cycles').select(CYCLE_COLUMNS).in('deal_id', chunk)
    if (ce) throw new Error(`tc_cycles: ${ce.message}`)
    for (const r of (c ?? []) as Obj[]) cycles.push(toCycle(r))
  }
  const listings = await getMlsCloseFacts(cycles.map((c) => c.mlsNumber ?? '').filter(Boolean), sb)
  return { deals, cycles, listings }
}

// ── the sweep ──────────────────────────────────────────────────────────────

/**
 * Decide, and with `apply`, write every MLS close on the given deals (or on
 * every deal that could have one). Never throws: a failure lands in `error`
 * or in the deal's `errors`.
 */
export async function runMlsCloseSweep(opts: MlsCloseSweepOptions): Promise<MlsCloseSweepResult> {
  const t0 = Date.now()
  const log = opts.log ?? (() => {})
  const result: MlsCloseSweepResult = {
    ok: false,
    mode: opts.apply ? 'apply' : 'plan',
    error: null,
    dealsChecked: 0,
    totals: { closes: 0, closed: 0, failed: 0, stagesUpdated: 0, logged: 0, events: 0 },
    deals: [],
    ms: 0,
  }
  let sb: SB
  let inputs: Awaited<ReturnType<typeof loadInputs>>
  try {
    sb = opts.sb ?? createServiceClient()
    const ids = opts.dealIds ? [...new Set(opts.dealIds.filter(Boolean))] : await candidateDealIds(sb)
    inputs = await loadInputs(sb, ids)
  } catch (err) {
    return { ...result, error: err instanceof Error ? err.message : String(err), ms: Date.now() - t0 }
  }

  const closedListNumbers = new Set([...inputs.listings.values()].filter((l) => l.status === 'Closed').map((l) => l.listNumber))
  for (const deal of inputs.deals) {
    const onDeal = inputs.cycles.filter((c) => c.dealId === deal.id)
    if (!onDeal.length) continue
    result.dealsChecked++
    const decisions = decideMlsCloses(onDeal, inputs.listings)
    const closes = decisions.filter((d): d is CloseDecision => d.kind === 'close')
    const report: MlsCloseDealReport = {
      dealId: deal.id,
      address: deal.address,
      closes,
      skips: decisions.filter(
        (d): d is Extract<MlsCloseDecision, { kind: 'skip' }> =>
          d.kind === 'skip' && !['not_a_sale', 'already_closed', 'no_mls_number'].includes(d.reason),
      ),
      stage: null,
      stageWritten: false,
      errors: [],
    }
    if (closes.length) {
      report.stage = decideStageAfterMlsClose({
        vaultStage: deal.stage,
        vaultStageDetail: deal.stage_detail,
        cyclesAfter: applyMlsCloses(onDeal, decisions),
        closedListNumbers,
      })
      result.totals.closes += closes.length
      for (const c of closes) {
        log(`  ${deal.address ?? deal.id}: close cycle ${c.cycleId.slice(0, 8)} ${JSON.stringify(c.set)} (MLS ${c.evidence.list_number} closed ${c.evidence.mls_close_date}, ${c.evidence.days_from_escrow_date >= 0 ? '+' : ''}${c.evidence.days_from_escrow_date}d from escrow date)`)
      }
      if (report.stage.kind === 'update') log(`  ${deal.address ?? deal.id}: stage ${report.stage.from.stage}/${report.stage.from.stageDetail} → ${report.stage.to.stage}/${report.stage.to.stageDetail}`)
      if (opts.apply) await applyDeal(sb, deal, report, result)
    }
    if (closes.length || report.skips.length) result.deals.push(report)
  }
  return { ...result, ok: true, ms: Date.now() - t0 }
}

async function recordEvent(sb: SB, result: MlsCloseSweepResult, report: MlsCloseDealReport, e: { cycle_id?: string | null; action: string; detail: Obj }) {
  const { error } = await sb.from('tc_events').insert({
    deal_id: report.dealId,
    cycle_id: e.cycle_id ?? null,
    actor: MLS_CLOSE_ACTOR,
    action: e.action,
    detail: { ...e.detail, rule_version: MLS_CLOSE_VERSION },
  })
  if (error) report.errors.push(`tc_events ${e.action}: ${error.message}`)
  else result.totals.events++
}

async function setOutcome(sb: SB, report: MlsCloseDealReport, id: number | null, outcome: 'repaired' | 'failed', note: string) {
  if (id == null) return
  const { error } = await sb.from('tc_cycle_repair_log').update({ outcome, note }).eq('id', id)
  if (error) report.errors.push(`repair log ${id} outcome: ${error.message}`)
}

async function applyDeal(sb: SB, deal: DealRow, report: MlsCloseDealReport, result: MlsCloseSweepResult): Promise<void> {
  const closes = report.closes
  const stage = report.stage
  const stageChange = stage?.kind === 'update' ? stage : null

  // 1. the before-image, read right before the write, logged before anything changes
  const { data: rows, error: readErr } = await sb.from('tc_cycles').select('*').in('id', closes.map((c) => c.cycleId))
  if (readErr) {
    report.errors.push(`read before write: ${readErr.message}`)
    return
  }
  const beforeById = new Map(((rows ?? []) as Obj[]).map((r) => [String(r.id), r]))
  const { data: dealNow, error: dealErr } = await sb.from('tc_deals').select('id, stage, stage_detail').eq('id', deal.id).single()
  if (dealErr || !dealNow) {
    report.errors.push(`deal read before write: ${dealErr?.message ?? 'no row'}`)
    return
  }
  const dealBefore = { stage: str((dealNow as Obj).stage), stage_detail: str((dealNow as Obj).stage_detail) }
  const logRows = closes.map((c) => ({
    source: MLS_CLOSE_ACTOR,
    rule_version: MLS_CLOSE_VERSION,
    cycle_id: c.cycleId,
    deal_id: deal.id,
    reasons: ['mls_closed'],
    before_row: beforeById.get(c.cycleId) ?? null,
    deal_before: dealBefore,
    changes: { cycle: c.set, deal: stageChange ? { stage: stageChange.to.stage, stage_detail: stageChange.to.stageDetail } : null },
    evidence: c.evidence,
    outcome: 'pending',
  }))
  if (logRows.some((r) => !r.before_row)) {
    report.errors.push('a cycle to close is gone: nothing written')
    return
  }
  const { data: logged, error: logErr } = await sb.from('tc_cycle_repair_log').insert(logRows).select('id, cycle_id')
  if (logErr || !logged?.length) {
    report.errors.push(`repair log: ${logErr?.message ?? 'no rows'}: nothing written`)
    return
  }
  result.totals.logged += logged.length
  const logIdByCycle = new Map((logged as Obj[]).map((r) => [String(r.cycle_id), r.id as number]))

  // 2. the deal stage, guarded on the stage we decided from
  let stageNote = ''
  if (stageChange) {
    let q = sb
      .from('tc_deals')
      .update({ stage: stageChange.to.stage, stage_detail: stageChange.to.stageDetail, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
    q = stageChange.from.stage == null ? q.is('stage', null) : q.eq('stage', stageChange.from.stage)
    q = stageChange.from.stageDetail == null ? q.is('stage_detail', null) : q.eq('stage_detail', stageChange.from.stageDetail)
    const { data: updated, error } = await q.select('id')
    if (error) {
      report.errors.push(`stage update: ${error.message}`)
      stageNote = `; stage not written (${error.message})`
    } else if (!updated?.length) {
      report.errors.push('stage update skipped: the deal changed while the sweep ran')
      stageNote = '; stage not written (the deal changed while the sweep ran)'
    } else {
      report.stageWritten = true
      result.totals.stagesUpdated++
      stageNote = `; deal stage ${stageChange.from.stage} → ${stageChange.to.stage}`
      await recordEvent(sb, result, report, {
        action: 'mls_stage_updated',
        detail: {
          from: stageChange.from,
          to: stageChange.to,
          cycles: closes.map((c) => c.cycleId),
          repair_log_ids: [...logIdByCycle.values()],
          note: 'The MLS shows the sale closed; the deal stage follows the Vault cycles.',
        },
      })
    }
  }

  // 3. each cycle, guarded on the row we logged
  for (const c of closes) {
    const before = beforeById.get(c.cycleId)!
    const logId = logIdByCycle.get(c.cycleId) ?? null
    const at = new Date().toISOString()
    const patch: Obj = {
      ...c.set,
      term_provenance: stampCloseProvenance(before.term_provenance ?? {}, c.set, {
        at,
        actor: MLS_CLOSE_ACTOR,
        mls: { listNumber: c.evidence.list_number, closeDate: c.evidence.mls_close_date, closePrice: c.evidence.mls_close_price },
      }),
      updated_at: at,
    }
    let q = sb.from('tc_cycles').update(patch).eq('id', c.cycleId).is('actual_closing_date', null)
    q = before.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', before.updated_at as string)
    const { data: updated, error } = await q.select('id')
    const from = { status: str(before.status), actual_closing_date: date10(before.actual_closing_date) }
    const to = { status: c.set.status ?? from.status, actual_closing_date: c.set.actual_closing_date }
    if (error || !updated?.length) {
      const note = error ? `cycle not written: ${error.message}` : 'cycle not written: it changed while the sweep ran (next run decides again)'
      report.errors.push(`${c.cycleId.slice(0, 8)} ${note}`)
      result.totals.failed++
      c.applied = { cycleId: c.cycleId, repairLogId: logId, from, to, outcome: 'failed', note }
      await setOutcome(sb, report, logId, 'failed', note + stageNote)
      continue
    }
    result.totals.closed++
    const note = `closed from MLS ${c.evidence.list_number} (${c.evidence.mls_close_date})${stageNote}`
    c.applied = { cycleId: c.cycleId, repairLogId: logId, from, to, outcome: 'repaired', note }
    await recordEvent(sb, result, report, {
      cycle_id: c.cycleId,
      action: 'mls_cycle_closed',
      detail: {
        from,
        to,
        mls: c.evidence,
        repair_log_id: logId,
        note: 'The MLS shows this sale closed; recorded closed whatever the SkySlope status says.',
      },
    })
    await setOutcome(sb, report, logId, 'repaired', note)
  }
}

// ── lease + run log (cron) ─────────────────────────────────────────────────

export async function tryTakeMlsCloseLease(seconds = 120): Promise<boolean> {
  const { data } = await createServiceClient().rpc('crm_try_cron_lease', { p_name: LEASE_NAME, p_lease_seconds: seconds })
  return data !== false
}

export async function releaseMlsCloseLease(): Promise<void> {
  await createServiceClient().rpc('crm_release_cron_lease', { p_name: LEASE_NAME })
}

export async function writeMlsCloseRunLog(input: { ok: boolean; durationMs: number; records: number; error: string | null; cycleId: string }): Promise<void> {
  try {
    await createServiceClient().from('sync_logs').insert({
      endpoint: 'tc_mls_close',
      method: 'GET',
      response_status: input.ok ? 200 : 500,
      records_returned: input.records,
      duration_ms: input.durationMs,
      sync_cycle_id: input.cycleId,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      error_message: input.error,
      alert_sent: false,
    })
  } catch (err) {
    console.warn('[tc-mls-close] sync_logs skip', err)
  }
}
