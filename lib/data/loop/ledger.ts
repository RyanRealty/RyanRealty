import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { confidenceFromVerdicts, type CompanyImprovementDomain, type LedgerVerdict } from './domains'
import { assertLedgerDraft, type ImprovementLedgerDraft } from './ledger-draft'

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
