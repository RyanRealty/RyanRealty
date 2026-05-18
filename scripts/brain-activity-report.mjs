#!/usr/bin/env node
/**
 * brain-activity-report.mjs
 *
 * Snapshots the brain's recent activity into a single static HTML file:
 *   - Action rows in the last 30 days, grouped by status
 *   - Per-row: action_type, target, predicted_north_star_impact, strategy_doc_section,
 *     priority_score, generation_reason
 *   - Top producers by emission count
 *   - Top targets by emission count (which listings / topics / campaigns dominate)
 *   - Costs by producer (from marketing_cost_ledger)
 *   - Performance digest (last measurement-loop output from marketing_decisions)
 *   - Failures (unresolved producer_execution_failures)
 *
 * Output: /Users/matthewryan/RyanRealty/out/proof/2026-05-17/brain-activity-report.html
 *
 * Run: `node scripts/brain-activity-report.mjs [--days=30]`
 * Pure Supabase read. No Anthropic calls.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = dirname(dirname(__filename))

// Load .env.local
try {
  const env = readFileSync(join(REPO_ROOT, '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      process.env[m[1]] = v
    }
  }
} catch {}

const args = process.argv.slice(2)
const daysArg = args.find((a) => a.startsWith('--days='))?.split('=')[1]
const DAYS = daysArg ? parseInt(daysArg, 10) : 30
const since = new Date(Date.now() - DAYS * 86400 * 1000).toISOString()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

function esc(s) {
  if (s === null || s === undefined) return ''
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

async function main() {
  // Action rows
  const { data: actions } = await supabase
    .from('marketing_brain_actions')
    .select('id, created_at, executed_at, status, action_type, target, assigned_producer, priority_score, predicted_north_star_impact, strategy_doc_section, generation_reason, generated_by, killed_reason')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  // Cost ledger
  const { data: costs } = await supabase
    .from('marketing_cost_ledger')
    .select('cost_type, amount_usd, recorded_at, metadata')
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false })
    .limit(500)

  // Recent performance digest
  const { data: perfDigest } = await supabase
    .from('marketing_decisions')
    .select('created_at, decision_type, decision_summary, data_observed')
    .eq('decision_type', 'performance_loop_completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Failures
  const { data: failures } = await supabase
    .from('producer_execution_failures')
    .select('producer_slug, phase, error_message, occurred_at, retry_count, resolved_at')
    .is('resolved_at', null)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(50)

  // Recent action_types histogram
  const byStatus = {}
  const byActionType = {}
  const byTarget = {}
  const byProducer = {}
  for (const a of actions || []) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1
    byActionType[a.action_type] = (byActionType[a.action_type] || 0) + 1
    byTarget[a.target] = (byTarget[a.target] || 0) + 1
    byProducer[a.assigned_producer] = (byProducer[a.assigned_producer] || 0) + 1
  }
  const totalCost = (costs || []).reduce((s, c) => s + Number(c.amount_usd), 0)
  const costByType = {}
  for (const c of costs || []) {
    costByType[c.cost_type] = (costByType[c.cost_type] || 0) + Number(c.amount_usd)
  }

  function topN(obj, n = 10) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Ryan Realty Brain Activity Report</title>
<style>
  :root { --rr-navy:#102742; --rr-cream:#faf8f4; --rr-warm:#e8e2d4; --rr-green:#1f6e3b; --rr-yellow:#b8860b; --rr-red:#b03030; }
  *{box-sizing:border-box} body{margin:0;font-family:'Geist','Inter',system-ui,sans-serif;background:var(--rr-cream);color:var(--rr-navy);line-height:1.5;font-feature-settings:'tnum';font-size:13px}
  header{background:var(--rr-navy);color:var(--rr-cream);padding:24px 36px}
  header h1{margin:0 0 4px;font-size:22px;font-weight:600}
  header p{margin:0;opacity:0.85;font-size:12px}
  main{max-width:1400px;margin:0 auto;padding:20px 36px 60px}
  h2{margin:32px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--rr-navy);font-weight:600;font-size:17px}
  .grid{display:grid;gap:12px;margin:12px 0}
  .grid.two{grid-template-columns:1fr 1fr}
  .grid.four{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
  .card{background:white;border:1px solid var(--rr-warm);border-radius:8px;padding:12px 14px}
  .stat .n{font-size:22px;font-weight:600}
  .stat .l{font-size:11px;color:rgba(16,39,66,0.65);margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
  th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--rr-warm);vertical-align:top}
  th{background:rgba(16,39,66,0.05);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em}
  td code{background:rgba(16,39,66,0.05);padding:1px 4px;border-radius:3px;font-size:11px;font-family:'Geist Mono',ui-monospace,monospace}
  .pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase}
  .pill.pending{background:rgba(16,39,66,0.08);color:var(--rr-navy)}
  .pill.in_production{background:rgba(184,134,11,0.18);color:var(--rr-yellow)}
  .pill.ready{background:rgba(31,110,59,0.15);color:var(--rr-green)}
  .pill.approved{background:rgba(31,110,59,0.25);color:var(--rr-green)}
  .pill.executed{background:rgba(31,110,59,0.40);color:white}
  .pill.killed{background:rgba(176,48,48,0.15);color:var(--rr-red)}
  .pill.needs_changes{background:rgba(184,134,11,0.25);color:var(--rr-yellow)}
  .pill.measured{background:rgba(50,50,50,0.20);color:#333}
  .muted{color:rgba(16,39,66,0.5)}
  .note{background:#fff5f5;border-left:4px solid var(--rr-red);padding:10px 14px;border-radius:4px;margin:12px 0}
  details summary{cursor:pointer;font-weight:600;padding:6px 0}
  pre{background:white;border:1px solid var(--rr-warm);padding:10px;border-radius:5px;font-size:11px;overflow-x:auto;line-height:1.4}
</style>
</head>
<body>
<header>
  <h1>Brain Activity Report</h1>
  <p>What the brain has been doing in the last ${DAYS} days. Snapshotted ${new Date().toISOString()} from Supabase project dwvlophlbvvygjfxcrhm.</p>
</header>
<main>

<h2>Summary</h2>
<div class="grid four">
  <div class="card stat"><div class="n">${actions?.length || 0}</div><div class="l">action rows emitted</div></div>
  <div class="card stat"><div class="n">${byStatus.ready || 0}</div><div class="l">awaiting Matt review</div></div>
  <div class="card stat"><div class="n">${byStatus.executed || 0}</div><div class="l">executed (published)</div></div>
  <div class="card stat"><div class="n">${byStatus.killed || 0}</div><div class="l">killed</div></div>
  <div class="card stat"><div class="n">${(byStatus.pending || 0) + (byStatus.in_production || 0)}</div><div class="l">in flight (pending + in_production)</div></div>
  <div class="card stat"><div class="n">$${totalCost.toFixed(2)}</div><div class="l">Anthropic + API spend last ${DAYS}d</div></div>
  <div class="card stat"><div class="n">${failures?.length || 0}</div><div class="l">unresolved producer failures</div></div>
</div>

<h2>Action rows by status</h2>
<table>
  <thead><tr><th>Status</th><th>Count</th></tr></thead>
  <tbody>${Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([s, n]) => `<tr><td><span class="pill ${s}">${esc(s)}</span></td><td>${n}</td></tr>`).join('')}</tbody>
</table>

<h2>Top action_types (what the brain has emitted most)</h2>
<table>
  <thead><tr><th>action_type</th><th>Count</th></tr></thead>
  <tbody>${topN(byActionType, 15).map(([t, n]) => `<tr><td><code>${esc(t)}</code></td><td>${n}</td></tr>`).join('')}</tbody>
</table>

<h2>Top targets (which listings / topics / campaigns dominate)</h2>
<table>
  <thead><tr><th>Target</th><th>Count</th></tr></thead>
  <tbody>${topN(byTarget, 15).map(([t, n]) => `<tr><td><code>${esc(t)}</code></td><td>${n}</td></tr>`).join('')}</tbody>
</table>

<h2>Top assigned_producer (which producers do most of the work)</h2>
<table>
  <thead><tr><th>Producer</th><th>Count</th></tr></thead>
  <tbody>${topN(byProducer, 15).map(([p, n]) => `<tr><td><code>${esc(p)}</code></td><td>${n}</td></tr>`).join('')}</tbody>
</table>

<h2>Recent action rows (last 50)</h2>
<table>
  <thead><tr>
    <th>Created</th><th>Status</th><th>Type</th><th>Target</th>
    <th>Priority</th><th>NS impact</th><th>Strategy section</th>
  </tr></thead>
  <tbody>
    ${(actions || []).slice(0, 50).map((a) => `<tr>
      <td>${esc(a.created_at?.slice(0, 16))}</td>
      <td><span class="pill ${a.status}">${esc(a.status)}</span></td>
      <td><code>${esc(a.action_type)}</code></td>
      <td><code>${esc(a.target)}</code></td>
      <td>${a.priority_score != null ? Number(a.priority_score).toFixed(2) : ''}</td>
      <td>${a.predicted_north_star_impact != null ? Number(a.predicted_north_star_impact).toFixed(2) : ''}</td>
      <td class="muted">${esc(a.strategy_doc_section || '')}</td>
    </tr>`).join('')}
  </tbody>
</table>

<h2>Cost by type (last ${DAYS} days)</h2>
${costs?.length ? `<table>
  <thead><tr><th>Cost type</th><th>USD</th></tr></thead>
  <tbody>${Object.entries(costByType).sort((a, b) => b[1] - a[1]).map(([t, c]) => `<tr><td>${esc(t)}</td><td>$${c.toFixed(4)}</td></tr>`).join('')}</tbody>
</table>` : '<p class="muted">No cost ledger entries yet. PRODUCER_RUNTIME_ENABLED is likely false, so the runtime hasn\'t fired against Anthropic yet.</p>'}

<h2>Latest performance digest</h2>
${perfDigest ? `<details open>
  <summary>${esc(perfDigest.decision_summary)} (${esc(perfDigest.created_at?.slice(0, 16))})</summary>
  <pre>${esc(JSON.stringify(perfDigest.data_observed, null, 2))}</pre>
</details>` : '<p class="muted">No performance digest yet. Measurement-loop has not yet run with usable data (no posts published yet).</p>'}

${failures?.length ? `<h2>Unresolved producer failures</h2>
<table>
  <thead><tr><th>Producer</th><th>Phase</th><th>Error</th><th>When</th><th>Retries</th></tr></thead>
  <tbody>${failures.map((f) => `<tr>
    <td><code>${esc(f.producer_slug)}</code></td>
    <td>${esc(f.phase)}</td>
    <td>${esc(String(f.error_message || '').slice(0, 200))}</td>
    <td>${esc(f.occurred_at?.slice(0, 16))}</td>
    <td>${f.retry_count}</td>
  </tr>`).join('')}</tbody>
</table>` : ''}

<h2>What this report tells you</h2>
<ul>
  <li>If <strong>action rows emitted</strong> is 0 and you set up the system more than a week ago, generate-briefs is not firing. Check the marketing-weekly-cycle cron.</li>
  <li>If <strong>awaiting Matt review</strong> > 12, you have backlog. Clear the queue at <code>/admin/approval-queue</code>.</li>
  <li>If <strong>executed</strong> is 0 but <strong>approved</strong> > 0, publisher-sweep is not firing. Check the publisher-sweep cron.</li>
  <li>If <strong>killed</strong> > 50% of total, the brain is generating bad briefs. Revise the strategy doc or file producer change requests.</li>
  <li>If <strong>top targets</strong> shows the same listing 10+ times in 30 days, the brain is over-indexing. Adjust per-listing cadence in the strategy doc.</li>
  <li>If <strong>top action_types</strong> is dominated by one (say, <code>comms:matt_summary</code>), the brain is mostly housekeeping. Diversify by promoting other content pillars in the strategy.</li>
  <li>If <strong>cost</strong> > $50 in 7 days and you don't see proportional executed rows, a producer is over-spending. Drill in with: <code>SELECT cost_type, sum(amount_usd) FROM marketing_cost_ledger WHERE recorded_at >= now() - interval '7 days' GROUP BY cost_type;</code></li>
</ul>

</main>
</body>
</html>`

  const outDir = join(REPO_ROOT, 'out/proof/2026-05-17')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'brain-activity-report.html')
  writeFileSync(outPath, html)
  console.log(`Wrote ${outPath} (${html.length.toLocaleString()} bytes)`)
  console.log(`\nSummary:`)
  console.log(`  Action rows: ${actions?.length || 0}`)
  console.log(`  Status breakdown: ${JSON.stringify(byStatus)}`)
  console.log(`  Cost (last ${DAYS}d): $${totalCost.toFixed(4)}`)
  console.log(`  Failures unresolved: ${failures?.length || 0}`)
}

main().catch((e) => {
  console.error('brain-activity-report failed:', e.message)
  process.exit(1)
})
