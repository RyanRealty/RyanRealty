/**
 * loop-brief — one-command session rehydration for THE LOOP (v1.4.0).
 *
 * The chat session is disposable working memory; this brief is how a fresh
 * session (or a fresh context after summarization) rebuilds the smallest
 * high-signal state: handoff Current, scoreboard headline, stranded ledger
 * windows, the work graph, and the next node's full contract.
 *
 *   npx tsx scripts/loop-brief.ts
 *
 * Matt's prompt is one line: "Run the loop." The session runs this, works
 * ONE SHIP CLASS (same-category fleet findings share one rebuild; planned
 * G-rows stay a class of one), completes each node with evidence, updates
 * the handoff, ships once.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { DOMAIN_REQUIRED_READS, type CompanyImprovementDomain } from '../lib/data/loop/domains'
import { runFleetIntake } from '../lib/data/loop/fleet-intake-core'
import { collectCompanyScoreboardSignals } from '../lib/data/loop/signals'
import { formatPunchSliceBrief, selectShipClass } from '../lib/data/loop/ship-class'
import { fleetNodePriority, isStaleInProgress, type WorkNodeState } from '../lib/data/loop/work-node'
import { execFileSync } from 'node:child_process'
import { reconcileShips, formatReconcileReport } from '../lib/data/loop/ship-reconcile'
import { classifyFeed, formatSilentZeroReport } from '../lib/data/loop/silent-zero'

config({ path: '.env.local' })

type NodeRow = {
  id: string
  depends_on: string[]
  domain: string
  version_gap: string | null
  title: string
  objective: string
  output: string
  accept: string
  state: WorkNodeState
  blocked_reason: string | null
  owner_session: string | null
  evidence?: string | null
  updated_at: string
}

function gapOrder(gap: string | null): number {
  const n = gap?.match(/^G(\d+)$/)?.[1]
  return n ? Number(n) : 9999
}

function handoffCurrent(): string {
  try {
    const src = readFileSync('docs/plans/CROSS_AGENT_HANDOFF.md', 'utf8')
    const start = src.indexOf('# Current')
    const end = src.indexOf('# Prior', start)
    const block = src.slice(start, end > start ? end : start + 2000).trim()
    return block.split('\n').slice(0, 18).join('\n')
  } catch {
    return 'UNREADABLE: docs/plans/CROSS_AGENT_HANDOFF.md'
  }
}

function manifestStatus(): string {
  try {
    const src = readFileSync('docs/plans/ENTERPRISE_MAP/VERSION-1.md', 'utf8')
    return src.split('\n').find((l) => l.startsWith('**Status:')) ?? 'UNREADABLE: no Status line'
  } catch {
    return 'UNREADABLE: docs/plans/ENTERPRISE_MAP/VERSION-1.md'
  }
}

function requirementsSummary(): string {
  try {
    const src = readFileSync('docs/plans/ENTERPRISE_MAP/REQUIREMENTS.md', 'utf8')
    const counts: Record<string, number> = {}
    for (const m of src.matchAll(/^\|\s*R-\d{3}\s*\|[^|]*\|[^|]*\|([^|]*)\|/gm)) {
      const d = m[1].trim().replace(/\*/g, '')
      counts[d] = (counts[d] ?? 0) + 1
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    if (total === 0) return 'UNREADABLE: no R-rows'
    const order = ['VERIFIED', 'LOCKED', 'PARTIAL', 'MISSING', 'GATED', 'PARKED', 'SUPERSEDED']
    return `${total} requirements: ${order.filter((k) => counts[k]).map((k) => `${counts[k]} ${k}`).join(' · ')} (register: ENTERPRISE_MAP/REQUIREMENTS.md)`
  } catch {
    return 'UNREADABLE: docs/plans/ENTERPRISE_MAP/REQUIREMENTS.md'
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const now = new Date()

  // Fleet intake runs at every boot: bot findings become work nodes (ADD verb)
  // BEFORE the session picks its node — the fleet's output is never waiting.
  const intake = await runFleetIntake(sb)

  const [signals, nodesRes] = await Promise.all([
    collectCompanyScoreboardSignals(sb, now),
    sb
      .from('loop_work_nodes')
      .select(
        'id,depends_on,domain,version_gap,title,objective,output,accept,state,evidence,blocked_reason,owner_session,updated_at',
      )
      .order('created_at', { ascending: true }),
  ])
  const nodes = (nodesRes.data ?? []) as NodeRow[]
  if (nodesRes.error) console.error('work graph UNREADABLE:', nodesRes.error.message)

  const doneIds = new Set(nodes.filter((n) => n.state === 'done').map((n) => n.id))
  const inProgress = nodes.filter((n) => n.state === 'in_progress')
  const blocked = nodes.filter((n) => n.state === 'blocked')
  const eligible = nodes
    .filter((n) => n.state === 'open' && n.depends_on.every((d) => doneIds.has(d)))
    .sort(
      (a, b) =>
        fleetNodePriority(a.title) - fleetNodePriority(b.title) ||
        gapOrder(a.version_gap) - gapOrder(b.version_gap),
    )

  const strandedDomains = Object.keys(signals.ledger.expiredByDomain)
  // Learn-first: a domain with expired unlearned windows must close them
  // before any other class in that domain (the insert guard enforces it).
  const learnFirst = eligible.find((n) => strandedDomains.includes(n.domain))
  const next = learnFirst ?? eligible[0] ?? null

  const needsReauth = signals.social.tokens.filter((t) => t.status === 'needs-reauth')
  const deltaAgeMin = signals.sync.lastDeltaSyncAt
    ? Math.round((now.getTime() - Date.parse(signals.sync.lastDeltaSyncAt)) / 60000)
    : null

  const lines: string[] = []
  const push = (s = '') => lines.push(s)

  push('================ LOOP BRIEF ================')
  push(`fetched: ${signals.fetchedAt}`)
  push(`version: ${manifestStatus()}`)
  push(`demand:  ${requirementsSummary()}`)
  push('')
  push('--- HANDOFF (Current) ---')
  push(handoffCurrent())
  push('')
  push('--- SCOREBOARD HEADLINE ---')
  push(
    `people ${signals.crm.people} (Lead ${signals.crm.byStage['Lead'] ?? 0}, +${signals.crm.createdLast7d} in 7d) · GCI verified $${(signals.commissions.gciByStatus['settlement_verified'] ?? 0).toLocaleString()} · brain measured ${signals.brain.measured}/ready ${signals.brain.byStatus['ready'] ?? 0}`,
  )
  push(
    `delta ${deltaAgeMin == null ? 'UNKNOWN' : `${deltaAgeMin} min ago`} · pulse ${signals.pulse.rows} rows ${Object.keys(signals.pulse.byMethodology).join(',')} · alerts ${signals.search.listingAlertsActive} active · identity ${signals.identity.identityMappedToCrm}/${signals.identity.identityMap} stitched`,
  )
  push(
    `stranded ledger windows: ${signals.ledger.expiredUnlearned}${strandedDomains.length ? ` (${strandedDomains.map((d) => `${d}:${signals.ledger.expiredByDomain[d]}`).join(', ')}) — these domains are FROZEN until Learn closes them` : ''}`,
  )
  push(
    `tokens needing re-auth: ${needsReauth.length ? needsReauth.map((t) => `${t.table} (PARKED unless Matt wants it)`).join(', ') : 'none — the rest auto-refresh via the daily heartbeat'}`,
  )
  push('')
  push('--- FLEET INTAKE (ran at this boot) ---')
  push(
    intake.processed === 0 && intake.created.length === 0 && intake.folded === 0
      ? 'no new bot findings'
      : `processed ${intake.processed}: ${intake.created.length} new node(s) · ${intake.appended} punch-list append(s) · ${intake.folded} folded · ${intake.duplicates} duplicate(s) · ${intake.baselines} baseline(s)${intake.errors.length ? ` · ERRORS: ${intake.errors.join('; ')}` : ''}`,
  )
  for (const c of intake.created) push(`  + ${c.title}`)
  push('')
  push('--- WORK GRAPH ---')
  push(`nodes: ${nodes.length} · open ${nodes.filter((n) => n.state === 'open').length} · in_progress ${inProgress.length} · blocked ${blocked.length} · done ${nodes.filter((n) => n.state === 'done').length}`)
  for (const n of inProgress) {
    const stale = isStaleInProgress({ state: n.state, updatedAt: n.updated_at }, now)
    push(`  IN_PROGRESS ${n.version_gap ?? '-'} [${n.domain}] ${n.title} — owner ${n.owner_session ?? '?'}${stale ? ' *** STALE — continue or release this node first' : ''}`)
  }
  for (const n of blocked) {
    push(`  BLOCKED ${n.version_gap ?? '-'} [${n.domain}] ${n.title} — ${n.blocked_reason ?? 'no reason recorded'}`)
  }
  push('')
  push('--- SILENT ZEROS (feeds reporting healthy while producing nothing) ---')
  try {
    const WINDOW = 30
    const since = new Date(Date.now() - WINDOW * 86400_000).toISOString().slice(0, 10)
    const { data: feedRows } = await sb
      .from('marketing_channel_daily')
      .select('channel,metric,value,date')
      .gte('date', since)
    type Agg = { rows: number; total: number; nonZeroRows: number; latest: string | null }
    const byKey = new Map<string, Agg>()
    for (const r of (feedRows ?? []) as Array<{ channel: string; metric: string; value: number; date: string }>) {
      const key = `${r.channel}\u0000${r.metric}`
      const a = byKey.get(key) ?? { rows: 0, total: 0, nonZeroRows: 0, latest: null }
      a.rows += 1
      const v = Number(r.value) || 0
      a.total += v
      if (v !== 0) a.nonZeroRows += 1
      if (!a.latest || r.date > a.latest) a.latest = r.date
      byKey.set(key, a)
    }
    const verdicts = [...byKey.entries()].map(([key, a]) => {
      const [channel, metric] = key.split('\u0000')
      return classifyFeed({ channel: channel ?? '', metric: metric ?? '', ...a })
    })
    for (const line of formatSilentZeroReport(verdicts)) push(line)
  } catch (err) {
    // Never block the boot on a diagnostic.
    push(`silent-zero check unavailable: ${(err as Error).message.slice(0, 120)}`)
  }
  push('')
  push('--- SHIP RECONCILIATION (what shipped without the loop) ---')
  try {
    const WINDOW_DAYS = 14
    const raw = execFileSync(
      'git',
      ['log', `--since=${WINDOW_DAYS}.days`, '--first-parent', '--pretty=format:%H%x1f%ad%x1f%s', '--date=short', 'origin/main'],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
    )
    const commits = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, date, subject] = line.split('\x1f')
        return { sha: sha ?? '', date: date ?? '', subject: subject ?? '' }
      })
    const ledgerRes = await sb.from('site_improvement_ledger').select('commit_sha')
    const ledgerShas = (ledgerRes.data ?? [])
      .map((r) => (r as { commit_sha: string | null }).commit_sha)
      .filter((v): v is string => Boolean(v))
    const nodeEvidence = nodes.map((n) => n.evidence ?? '').filter(Boolean)
    for (const line of formatReconcileReport(reconcileShips({ commits, ledgerShas, nodeEvidence }), WINDOW_DAYS)) {
      push(line)
    }
  } catch (err) {
    // Never let reconciliation stop the boot — a brief that refuses to print is
    // worse than one that admits it could not check.
    push(`reconciliation unavailable: ${(err as Error).message.slice(0, 120)}`)
  }
  push('')
  push('--- SHIP CLASS (one rebuild for this whole set) ---')
  push('R-221: do not poll GitHub Actions. One ci:gates per ship.')
  if (!next) {
    push('No eligible open node. Close blocked/in_progress work or open the next version gap.')
  } else {
    const ship = selectShipClass(
      eligible.map((n) => ({
        id: n.id,
        domain: n.domain,
        title: n.title,
        objective: n.objective,
        versionGap: n.version_gap,
      })),
      {
        id: next.id,
        domain: next.domain,
        title: next.title,
        objective: next.objective,
        versionGap: next.version_gap,
      },
    )
    const shipNodes = ship.nodes
      .map((s) => eligible.find((n) => n.id === s.id))
      .filter((n): n is NodeRow => n != null)
    const reads = DOMAIN_REQUIRED_READS[next.domain as CompanyImprovementDomain] ?? []
    if (ship.punch) {
      for (const line of formatPunchSliceBrief({
        punch: ship.punch,
        nodeId: next.id,
        title: next.title,
        domain: next.domain,
        reads,
      })) {
        push(line)
      }
    } else {
      push(`class: ${ship.key} · ${shipNodes.length} node(s)${ship.remaining ? ` · ${ship.remaining} leftover sibling(s) stay open for the next ship of this class` : ''}`)
      push('DO NOT run npm run push or deploy:verify until every node below is locally accepted or blocked.')
      push('Then ONE push, ONE deploy:verify, complete all shipped nodes with that READY SHA.')
      push(`claim them: claimShipClass([${shipNodes.map((n) => n.id).join(', ')}], owner)  (lib/data/loop/work-graph.ts)`)
      push('load first (this animal\'s discipline — read before working):')
      for (const r of reads) push(`  - ${r}`)
      push('  - REQUIREMENTS.md rows covering this class (grep the gap ref) + the canon preflight for whatever the change touches')
      push('')
      for (const [i, n] of shipNodes.entries()) {
        push(`--- NODE ${i + 1}/${shipNodes.length} ---`)
        push(`${n.version_gap ?? '(ad-hoc)'} [${n.domain}] ${n.title}`)
        push(`id:        ${n.id}`)
        push(`objective: ${n.objective}`)
        push(`output:    ${n.output}`)
        push(`accept:    ${n.accept}`)
      }
    }
  }
  push('')
  push('--- RULES (v1.6.0) ---')
  push('1. One ship class per cycle. Claim the whole class before working; evidence before done.')
  push('2. Same-category fleet findings share ONE npm run push and ONE deploy:verify. Do not rebuild after each finding.')
  push('3. Only environment-verified facts enter durable state (probe rows, screenshots, deploy READY).')
  push('4. Update CROSS_AGENT_HANDOFF Current before stopping. The chat is disposable; the graph is not.')
  push('5. Matt gates: outbound to real people, public posts, ad spend, OAuth grants. Nothing else waits.')
  push('============================================')

  console.log(lines.join('\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
