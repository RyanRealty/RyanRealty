/**
 * Fleet intake core — bot findings become loop work through the ADD verb.
 * reachability: entry-point scripts/loop-brief.ts + scripts/fleet-intake.ts
 * Client-passed like signals.ts (no server-only) so the loop-brief boot and
 * the standalone script both run it: every session ingests the fleet's
 * output BEFORE picking work. That is the co-evolution wire — bots feed the
 * loop, the loop reshapes what bots test, automatically, every cycle.
 *
 * Verbs mapping (COMPANY_IMPROVEMENT §How Matt steers):
 *   ADD    — minor/major/p0 finding → OPEN work node (reproduce-or-reject).
 *   CHANGE — a regression finding on shipped work (caseId regress-G<n>)
 *            carries the register-correction instruction in its contract.
 *   info   — recorded as confirmed baseline, no node (never noise the queue).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isCompanyImprovementDomain } from './domains'

export type FleetIntakeResult = {
  processed: number
  created: Array<{ nodeId: string; title: string }>
  duplicates: number
  baselines: number
  errors: string[]
}

export async function runFleetIntake(sb: SupabaseClient): Promise<FleetIntakeResult> {
  const result: FleetIntakeResult = { processed: 0, created: [], duplicates: 0, baselines: 0, errors: [] }

  const { data: findings, error } = await sb
    .from('fleet_findings')
    .select('id,bot,case_id,url,viewport,expected,observed,severity,evidence,domain,fingerprint')
    .eq('status', 'new')
    .order('created_at', { ascending: true })
  if (error) {
    result.errors.push(`findings unreadable: ${error.message}`)
    return result
  }
  if (!findings?.length) return result

  const { data: openNodes } = await sb
    .from('loop_work_nodes')
    .select('id,objective,state')
    .in('state', ['open', 'in_progress', 'blocked'])
  const openObjectives = (openNodes ?? []).map((n) => String(n.objective))

  for (const f of findings) {
    result.processed += 1
    const tag = `fleet:${f.fingerprint}`

    if (openObjectives.some((o) => o.includes(tag))) {
      await sb
        .from('fleet_findings')
        .update({ status: 'duplicate', triaged_at: new Date().toISOString() })
        .eq('id', f.id)
      result.duplicates += 1
      continue
    }

    if (f.severity === 'info') {
      await sb
        .from('fleet_findings')
        .update({ status: 'confirmed', triaged_at: new Date().toISOString() })
        .eq('id', f.id)
      result.baselines += 1
      continue
    }

    // CHANGE mapping: a regression on shipped work names its original gap and
    // carries the register-correction duty into the fix node's contract.
    const regressGap = String(f.case_id ?? '').match(/^regress-(G\d+)$/)?.[1] ?? null
    let domain = f.domain && isCompanyImprovementDomain(String(f.domain)) ? String(f.domain) : 'public-ux'
    let regressionPrefix = ''
    if (regressGap) {
      const { data: original } = await sb
        .from('loop_work_nodes')
        .select('domain,title')
        .eq('version_gap', regressGap)
        .maybeSingle()
      if (original?.domain && isCompanyImprovementDomain(String(original.domain))) {
        domain = String(original.domain)
      }
      regressionPrefix = `REGRESSION of ${regressGap} ("${original?.title ?? 'shipped work'}" — was DONE and accepted). `
    }

    const node = {
      domain,
      title: `Fleet finding [${f.severity}]: ${String(f.observed).slice(0, 90)}`,
      objective: `${tag} — ${regressionPrefix}bot ${f.bot} (case ${f.case_id ?? 'ad-hoc'}) at ${f.url}${f.viewport ? ` [${f.viewport}]` : ''}: expected "${f.expected}" but observed "${f.observed}". FIRST STEP: reproduce it yourself; if it does not reproduce, reject the finding and release this node with the evidence.${regressGap ? ` ON FIX (CHANGE verb): restore the original accept, then update the REQUIREMENTS rows covering ${regressGap} with the new evidence.` : ''}`,
      output: regressGap
        ? 'Regression fixed as a class; original accept restored; covering register rows corrected with evidence.'
        : 'Defect fixed as a CLASS everywhere it occurs, or the finding rejected with reproduction evidence.',
      accept: `The original expected state holds at ${f.url} (and everywhere the class occurs), verified at 390+1280 with evidence.`,
    }

    const { data: created, error: nodeErr } = await sb.from('loop_work_nodes').insert(node).select('id').single()
    if (nodeErr || !created?.id) {
      result.errors.push(`node create failed for ${f.id}: ${nodeErr?.message}`)
      continue
    }
    await sb
      .from('fleet_findings')
      .update({ status: 'node_created', node_id: created.id, triaged_at: new Date().toISOString() })
      .eq('id', f.id)
    openObjectives.push(node.objective)
    result.created.push({ nodeId: String(created.id), title: node.title })
  }

  return result
}
