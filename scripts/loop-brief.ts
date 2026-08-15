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
 * exactly ONE node, completes it with evidence, updates the handoff, ships.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { collectCompanyScoreboardSignals } from '../lib/data/loop/signals'
import { isStaleInProgress, type WorkNodeState } from '../lib/data/loop/work-node'

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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const now = new Date()

  const [signals, nodesRes] = await Promise.all([
    collectCompanyScoreboardSignals(sb, now),
    sb
      .from('loop_work_nodes')
      .select(
        'id,depends_on,domain,version_gap,title,objective,output,accept,state,blocked_reason,owner_session,updated_at',
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
    .sort((a, b) => gapOrder(a.version_gap) - gapOrder(b.version_gap))

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
  push('--- NEXT NODE (work exactly this one) ---')
  if (!next) {
    push('No eligible open node. Close blocked/in_progress work or open the next version gap.')
  } else {
    push(`${next.version_gap ?? '(ad-hoc)'} [${next.domain}] ${next.title}`)
    push(`objective: ${next.objective}`)
    push(`output:    ${next.output}`)
    push(`accept:    ${next.accept}`)
    push(`claim it:  state open -> in_progress (lib/data/loop/work-graph.ts claimWorkNode)`)
  }
  push('')
  push('--- RULES (v1.4.0) ---')
  push('1. One node per cycle. Claim before working; evidence before done.')
  push('2. Only environment-verified facts enter durable state (probe rows, screenshots, deploy READY).')
  push('3. Update CROSS_AGENT_HANDOFF Current before stopping. The chat is disposable; the graph is not.')
  push('4. Matt gates: outbound to real people, public posts, ad spend, OAuth grants. Nothing else waits.')
  push('============================================')

  console.log(lines.join('\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
