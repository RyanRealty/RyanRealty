/**
 * fleet-intake — pull new fleet findings into the loop (THE LOOP v1.6.0).
 *
 *   npx tsx scripts/fleet-intake.ts [--dry-run]
 *
 * A bot report is a LEAD, not a verdict (adversarial rule: nobody's claim is
 * trusted raw — not even our own auditors'). Intake:
 *   1. Lists status='new' rows from fleet_findings.
 *   2. Dedupes against open work nodes (same fingerprint already noded).
 *   3. severity info  -> marks 'confirmed' (baseline fact, no node).
 *      severity minor/major/p0 -> creates an OPEN work node carrying the
 *      finding as its objective, the case's expected as its accept, and the
 *      evidence URL — tagged fleet: so the claiming session knows its first
 *      job is to REPRODUCE the finding before fixing (reject if it cannot).
 *   4. Marks the finding node_created with the node id.
 *
 * The loop then serves these nodes through the normal brief. That closes the
 * self-feeding cycle: ship -> bots walk it -> findings -> nodes -> ship.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isCompanyImprovementDomain } from '../lib/data/loop/domains'

config({ path: '.env.local' })

const DRY = process.argv.includes('--dry-run')

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const { data: findings, error } = await sb
    .from('fleet_findings')
    .select('id,bot,case_id,url,viewport,expected,observed,severity,evidence,domain,fingerprint')
    .eq('status', 'new')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  if (!findings?.length) {
    console.log('no new findings')
    return
  }

  const { data: openNodes } = await sb
    .from('loop_work_nodes')
    .select('id,objective,state')
    .in('state', ['open', 'in_progress', 'blocked'])
  const openObjectives = (openNodes ?? []).map((n) => String(n.objective))

  for (const f of findings) {
    const tag = `fleet:${f.fingerprint}`
    const already = openObjectives.find((o) => o.includes(tag))
    if (already) {
      if (!DRY) await sb.from('fleet_findings').update({ status: 'duplicate', triaged_at: new Date().toISOString() }).eq('id', f.id)
      console.log(`- ${f.id.slice(0, 8)} duplicate of an open node (${tag})`)
      continue
    }

    if (f.severity === 'info') {
      if (!DRY) await sb.from('fleet_findings').update({ status: 'confirmed', triaged_at: new Date().toISOString() }).eq('id', f.id)
      console.log(`- ${f.id.slice(0, 8)} info baseline recorded (no node): ${String(f.observed).slice(0, 80)}`)
      continue
    }

    const domain = f.domain && isCompanyImprovementDomain(String(f.domain)) ? String(f.domain) : 'public-ux'
    const node = {
      domain,
      title: `Fleet finding [${f.severity}]: ${String(f.observed).slice(0, 90)}`,
      objective: `${tag} — bot ${f.bot} (case ${f.case_id ?? 'ad-hoc'}) at ${f.url}${f.viewport ? ` [${f.viewport}]` : ''}: expected "${f.expected}" but observed "${f.observed}". FIRST STEP: reproduce it yourself; if it does not reproduce, reject the finding (mark rejected) and release this node with the evidence.`,
      output: 'Defect fixed as a CLASS everywhere it occurs, or the finding rejected with reproduction evidence.',
      accept: `The original expected state holds at ${f.url} (and everywhere the class occurs), verified at 390+1280 with evidence.`,
    }

    if (DRY) {
      console.log(`- ${f.id.slice(0, 8)} would create node: ${node.title}`)
      continue
    }
    const { data: created, error: nodeErr } = await sb.from('loop_work_nodes').insert(node).select('id').single()
    if (nodeErr || !created?.id) {
      console.error(`  FAILED to create node for ${f.id}: ${nodeErr?.message}`)
      process.exitCode = 1
      continue
    }
    await sb
      .from('fleet_findings')
      .update({ status: 'node_created', node_id: created.id, triaged_at: new Date().toISOString() })
      .eq('id', f.id)
    openObjectives.push(node.objective)
    console.log(`- ${f.id.slice(0, 8)} -> node ${String(created.id).slice(0, 8)} [${domain}] ${node.title}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
