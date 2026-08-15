/**
 * THE LOOP ledger writes. Not on the public barrel (file-size budget).
 * reachability: entry-point company scoreboard / growth-loop Learn step
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { confidenceFromVerdicts, type CompanyImprovementDomain, type LedgerVerdict } from './domains'
import { assertLedgerDraft, isExpiredUnlearned, type ImprovementLedgerDraft } from './ledger-draft'

export type { ImprovementLedgerDraft }

export type ImprovementLedgerRow = {
  id: string
  domain: CompanyImprovementDomain
  changeClass: string
  surface: string
  description: string
  metric: string
  baselineValue: number | null
  predictedDelta: number | null
  actualDelta: number | null
  windowDays: number
  shippedAt: string
  measuredAt: string | null
  verdict: LedgerVerdict | null
  commitSha: string | null
}

function isVerdict(value: string | null): value is LedgerVerdict {
  return value === 'win' || value === 'loss' || value === 'flat' || value === 'inconclusive'
}

export async function insertImprovementLedgerRow(
  draft: ImprovementLedgerDraft,
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    assertLedgerDraft(draft)
    const sb = createServiceClient()
    // WIP guard (THE LOOP v1.3.0): a domain with stranded windows may not open
    // a new class. Close the old hypothesis (closeImprovementLedgerRow) first —
    // 'inconclusive' is a legal verdict when the metric became unmeasurable.
    const stranded = await listExpiredUnlearnedWindows({ domain: draft.domain })
    if (stranded.length > 0) {
      const ids = stranded.map((r) => r.id).join(', ')
      return {
        data: null,
        error: `domain "${draft.domain}" has ${stranded.length} expired unlearned window(s) — write actual_delta + verdict via closeImprovementLedgerRow before opening a new class. Stranded ids: ${ids}`,
      }
    }
    const { data, error } = await sb
      .from('site_improvement_ledger')
      .insert({
        domain: draft.domain,
        change_class: draft.changeClass,
        surface: draft.surface,
        description: draft.description,
        metric: draft.metric,
        baseline_value: draft.baselineValue ?? null,
        predicted_delta: draft.predictedDelta,
        window_days: draft.windowDays ?? 14,
        commit_sha: draft.commitSha ?? null,
        notes: draft.notes ?? null,
      })
      .select('id')
      .single()
    if (error || !data?.id) {
      console.error('[insertImprovementLedgerRow]', error?.message)
      return { data: null, error: error?.message ?? 'insert returned no id' }
    }
    return { data: { id: data.id as string }, error: null }
  } catch (err) {
    console.error('[insertImprovementLedgerRow]', err)
    return { data: null, error: err instanceof Error ? err.message : 'insert failed' }
  }
}

export async function listOpenImprovementWindows(): Promise<ImprovementLedgerRow[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('site_improvement_ledger')
    .select(
      'id,domain,change_class,surface,description,metric,baseline_value,predicted_delta,actual_delta,window_days,shipped_at,measured_at,verdict,commit_sha',
    )
    .is('actual_delta', null)
    .order('shipped_at', { ascending: false })
  if (error) {
    console.error('[listOpenImprovementWindows]', error.message)
    return []
  }
  return (data ?? []).map(mapRow)
}

/** Open rows whose measurement window has lapsed — the stranded work the weekly packet closes first. */
export async function listExpiredUnlearnedWindows(input?: {
  domain?: CompanyImprovementDomain
  now?: Date
}): Promise<ImprovementLedgerRow[]> {
  const now = input?.now ?? new Date()
  const open = await listOpenImprovementWindows()
  return open.filter(
    (r) =>
      (!input?.domain || r.domain === input.domain) &&
      isExpiredUnlearned(
        { shippedAt: r.shippedAt, windowDays: r.windowDays, actualDelta: r.actualDelta },
        now,
      ),
  )
}

/**
 * The Learn step, mechanical. Writes the measured outcome and verdict so the
 * class is closed and the domain may open its next class.
 */
export async function closeImprovementLedgerRow(input: {
  id: string
  actualDelta: number
  verdict: LedgerVerdict
  notes?: string | null
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    if (!input.id.trim()) return { data: null, error: 'id is required' }
    if (!Number.isFinite(input.actualDelta)) return { data: null, error: 'actualDelta must be a finite number' }
    if (!isVerdict(input.verdict)) return { data: null, error: `unknown verdict "${input.verdict}"` }
    const sb = createServiceClient()
    const patch: Record<string, unknown> = {
      actual_delta: input.actualDelta,
      verdict: input.verdict,
      measured_at: new Date().toISOString(),
    }
    if (input.notes != null) patch.notes = input.notes
    const { data, error } = await sb
      .from('site_improvement_ledger')
      .update(patch)
      .eq('id', input.id)
      .select('id')
      .single()
    if (error || !data?.id) {
      console.error('[closeImprovementLedgerRow]', error?.message)
      return { data: null, error: error?.message ?? 'update matched no row' }
    }
    return { data: { id: data.id as string }, error: null }
  } catch (err) {
    console.error('[closeImprovementLedgerRow]', err)
    return { data: null, error: err instanceof Error ? err.message : 'close failed' }
  }
}

export async function getChangeClassConfidence(input: {
  changeClass: string
  domain?: CompanyImprovementDomain
}): Promise<number> {
  const sb = createServiceClient()
  let q = sb.from('site_improvement_ledger').select('verdict').eq('change_class', input.changeClass)
  if (input.domain) q = q.eq('domain', input.domain)
  const { data, error } = await q
  if (error) {
    console.error('[getChangeClassConfidence]', error.message)
    return 0.5
  }
  const verdicts = (data ?? [])
    .map((r) => r.verdict as string | null)
    .filter(isVerdict)
  return confidenceFromVerdicts(verdicts)
}

function mapRow(r: Record<string, unknown>): ImprovementLedgerRow {
  return {
    id: String(r.id),
    domain: r.domain as CompanyImprovementDomain,
    changeClass: String(r.change_class),
    surface: String(r.surface),
    description: String(r.description),
    metric: String(r.metric),
    baselineValue: r.baseline_value == null ? null : Number(r.baseline_value),
    predictedDelta: r.predicted_delta == null ? null : Number(r.predicted_delta),
    actualDelta: r.actual_delta == null ? null : Number(r.actual_delta),
    windowDays: Number(r.window_days ?? 14),
    shippedAt: String(r.shipped_at),
    measuredAt: r.measured_at == null ? null : String(r.measured_at),
    verdict: isVerdict(r.verdict as string | null) ? (r.verdict as LedgerVerdict) : null,
    commitSha: r.commit_sha == null ? null : String(r.commit_sha),
  }
}
