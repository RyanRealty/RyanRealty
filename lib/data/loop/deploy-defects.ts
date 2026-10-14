/**
 * Deploy-found defects become claimable work nodes (Matt 2026-10-14).
 * reachability: entry-point scripts/deploy-defects.ts + scripts/lib/deploy-defect-report.mjs + scripts/loop-brief.ts
 *
 * WHY. On 2026-10-14 two sessions ran `npm run deploy:verify`, both saw the same
 * noindex sitemap URLs, and both built a fix (#580 and a duplicate thrown away).
 * Nothing told the second session the first had it. Matt: "When the post-deploy
 * check finds a problem, it would automatically file one claimable work item. The
 * first session to claim it owns the fix, and every other session sees it's taken."
 *
 * The rules, in one place, pure (no database, no server-only): the node id, the
 * fingerprint, the filing plan, the completion plan and every line deploy:verify
 * and the boot brief print. The database side is `deploy-defects-dal.ts`, which
 * binds this to the existing work-graph DAL; the process side is
 * `scripts/lib/deploy-defect-report.mjs`. Tests hand `reconcileDeployDefects` an
 * in-memory `DeployDefectOps`.
 *
 * NODE ID. `version_gap`, which already is the work graph's id scheme (G8, SITE-12,
 * FLEET-PUNCH) and carries a unique index, so the database itself refuses a second
 * node for the same fingerprint however many sessions run deploy:verify at once:
 *
 *   DEPLOY-<check family>-<first 10 hex of sha256(family + sorted failure keys)>
 *   DEPLOY-<check family>-<fp>-r2, -r3 ...   a recurrence after the node was done
 *
 * Domain `factory` (the loop's own machinery, docs/DEVELOPMENT_PROCESS.md): the
 * defect is found by the loop's verification step, and a site domain would put it
 * in the site queue's serve order and fleet cap, which it is not part of.
 *
 * RECURRENCE. `done` and `killed` are terminal in the work graph (assertTransition
 * and the loop_work_nodes_guard trigger), so a done node cannot reopen. A failure
 * whose fingerprint belongs to a done node files a LINKED FOLLOW-UP (`-rN`, parent
 * = the done node), so the history reads as one chain: the fix held, then it
 * regressed. A killed node is a decision (not a defect, won't fix): its failure is
 * reported, not refiled.
 *
 * ONE DEFECT, ONE OWNER. A failing set the active nodes of the same check already
 * list (all of it, or the part of it still failing) is that defect: it prints the
 * node's claim state and files nothing. Only failing keys no active node lists get
 * a node, so a partial fix (the set shrinks) and a second session's re-run never
 * mint a second node for the first session's job.
 */
import { createHash } from 'node:crypto'
import type { WorkNodeDraft, WorkNodeState } from './work-node'

export const DEPLOY_GAP_PREFIX = 'DEPLOY-'
export const DEPLOY_DOMAIN = 'factory' as const
export const DEPLOY_TITLE_PREFIX = 'Deploy check failed'
export const DEPLOY_CLAIM_SCRIPT = 'scripts/deploy-defects.ts'
/** The owner a passing deploy:verify stamps while it closes a node nobody held. */
export const DEPLOY_AUTO_OWNER_PREFIX = 'deploy-verify-'
/** A node lists at most this many failing keys; the fingerprint always covers all of them. */
export const DEPLOY_MAX_LISTED_KEYS = 300

/** Every check `npm run deploy:verify` runs against the READY production deploy. */
export const DEPLOY_CHECK_FAMILIES = {
  homepage: { label: 'production host answers', reproduce: 'npm run deploy:verify -- --no-file' },
  'inline-scripts': { label: 'inline scripts and GTM loader', reproduce: 'npm run deploy:verify -- --no-file' },
  'legacy-image': { label: 'legacy /_next/image redirect', reproduce: 'npm run deploy:verify -- --no-file' },
  'sitemap-smoke': { label: 'sitemap smoke', reproduce: 'npm run deploy:verify -- --no-file' },
  'live-seo': { label: 'live SEO baseline', reproduce: 'npm run seo:live' },
  'sitemap-url-health': { label: 'sitemap URL health', reproduce: 'npm run seo:sitemap-urls' },
  'build-telemetry': { label: 'build telemetry', reproduce: 'npm run deploy:verify -- --no-file' },
} as const

export type DeployCheckFamily = keyof typeof DEPLOY_CHECK_FAMILIES

export function isDeployCheckFamily(value: string): value is DeployCheckFamily {
  return Object.prototype.hasOwnProperty.call(DEPLOY_CHECK_FAMILIES, value)
}

/**
 * Sampled checks (live SEO, sitemap URL health) fetch a subset of the sitemap, so
 * a pass proves nothing about a URL it did not fetch. `checkedPaths` are the
 * pathnames this run fetched and found healthy; `listedPaths` every pathname the
 * sitemap listed. A recorded failing path is verified when it was checked, or when
 * the sitemap no longer lists it (the defect was a bad URL IN the sitemap).
 */
export type DeployCheckScope = { checkedPaths: string[]; listedPaths: string[] }

export type DeployCheckResult = {
  family: DeployCheckFamily
  status: 'fail' | 'pass' | 'skipped'
  /** fail: the identity of each failure, stable run to run. Defaults to `lines`. */
  keys?: string[]
  /** fail: what a human reads (may carry timings and counts). Defaults to `keys`. */
  lines?: string[]
  /** pass: the evidence the closing node carries. */
  evidence?: string
  /** pass on a sampled check: what the run actually covered. Absent = exhaustive. */
  scope?: DeployCheckScope
}

export type DeployVerifyRun = {
  /** The deploy SHA, full or short. */
  sha: string
  /** ISO time of the run. */
  at: string
  /** false = read and print only (`--no-file`). */
  write: boolean
  results: DeployCheckResult[]
}

/** The slice of a work node this module reads. `WorkNode` (work-graph.ts) satisfies it. */
export type DeployNodeView = {
  id: string
  versionGap: string | null
  title: string
  objective: string
  state: WorkNodeState
  ownerSession: string | null
  blockedReason: string | null
  evidence: string | null
  updatedAt: string
}

export type DeployDefectOps = {
  /** Every DEPLOY-* node, any state. Throws when the read fails (an empty list must mean none). */
  list(): Promise<DeployNodeView[]>
  create(draft: WorkNodeDraft): Promise<{ id: string | null; error: string | null }>
  claim(id: string, owner: string): Promise<{ ok: boolean; error: string | null }>
  complete(id: string, evidence: string): Promise<{ ok: boolean; error: string | null }>
  release(id: string): Promise<{ ok: boolean; error: string | null }>
}

const ACTIVE_STATES: readonly WorkNodeState[] = ['open', 'in_progress', 'blocked']
const isActive = (n: DeployNodeView) => ACTIVE_STATES.includes(n.state)

// ── identity ────────────────────────────────────────────────────────────────

export function isDeployFoundGap(gap: string | null | undefined): boolean {
  return typeof gap === 'string' && gap.startsWith(DEPLOY_GAP_PREFIX)
}

/** A transport error is the network's answer, not the site's: never a node. */
export function isTransientLine(line: string): boolean {
  return /: fetch failed \(/.test(line)
}

/**
 * A failure's identity. A page line (`/path: reason`) is kept as printed. An
 * aggregate line carries counts that move run to run ("12 of 80 sampled titles
 * run past 60 chars ... ceiling: <the titles>"), so its digits collapse and its
 * trailing list drops; otherwise every re-run would mint a new fingerprint.
 */
export function failureKey(line: string): string {
  const t = line.replace(/\s+/g, ' ').trim()
  if (t.startsWith('/') || t.startsWith('https://')) return t
  return t.replace(/(ceiling): .*$/, '$1').replace(/\d+(?:\.\d+)?/g, '#')
}

export function failureKeys(lines: readonly string[]): string[] {
  return [...new Set(lines.filter((l) => !isTransientLine(l)).map(failureKey).filter(Boolean))].sort()
}

export function deployFingerprint(family: DeployCheckFamily, keys: readonly string[]): string {
  const sorted = [...new Set(keys)].sort()
  return createHash('sha256').update(`${family}\n${sorted.join('\n')}`).digest('hex').slice(0, 10)
}

export function deployGap(family: DeployCheckFamily, fingerprint: string, recurrence = 1): string {
  return `${DEPLOY_GAP_PREFIX}${family}-${fingerprint}${recurrence > 1 ? `-r${recurrence}` : ''}`
}

export type ParsedDeployGap = { family: DeployCheckFamily; fingerprint: string; recurrence: number }

export function parseDeployGap(gap: string | null | undefined): ParsedDeployGap | null {
  const m = /^DEPLOY-(.+)-([0-9a-f]{10})(?:-r(\d+))?$/.exec(gap ?? '')
  const family = m?.[1] ?? ''
  if (!m || !isDeployCheckFamily(family)) return null
  return { family, fingerprint: m[2], recurrence: m[3] ? Number(m[3]) : 1 }
}

/** The command a session runs to take a node. The owner is the session's own tool-model-date. */
export function deployClaimCommand(gap: string, today: Date = new Date()): string {
  return `npx tsx --conditions=react-server ${DEPLOY_CLAIM_SCRIPT} --claim ${gap} --owner <tool>-<model>-${today.toISOString().slice(0, 10)}`
}

function stamp(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : `${d.toISOString().slice(0, 16).replace('T', ' ')}Z`
}

const short = (sha: string) => sha.slice(0, 7)

// ── the node ────────────────────────────────────────────────────────────────

export function buildDeployDraft(input: {
  family: DeployCheckFamily
  keys: readonly string[]
  /** Printed lines at filing time, when they differ from the keys (counts, timings). */
  detail?: readonly string[]
  sha: string
  at: string
  fingerprint: string
  recurrence: number
  previous?: { gap: string; evidence: string | null } | null
  parentId?: string | null
}): WorkNodeDraft {
  const { label, reproduce } = DEPLOY_CHECK_FAMILIES[input.family]
  const listed = input.keys.slice(0, DEPLOY_MAX_LISTED_KEYS)
  const objective = [
    `Fix the production defect that npm run deploy:verify found: ${label}.`,
    `Found at deploy ${short(input.sha)} on ${input.at}. Reproduce it first: ${reproduce}. If it does not reproduce, complete this node with that run as the evidence.`,
    `Claim this node before you start. If another session holds it, leave it.`,
    ``,
    `Failing (${input.keys.length}):`,
    ...listed.map((k) => `- ${k}`),
    ...(input.keys.length > listed.length ? [`(+${input.keys.length - listed.length} more failing lines not listed)`] : []),
    ...(input.detail?.length ? [``, `Observed at filing:`, ...input.detail.slice(0, 40).map((d) => `- ${d.replace(/\s+/g, ' ').trim()}`)] : []),
    ...(input.previous
      ? [``, `Recurrence ${input.recurrence}: ${input.previous.gap} was done and this failure came back.${input.previous.evidence ? ` Its evidence: ${input.previous.evidence.replace(/\s+/g, ' ').trim().slice(0, 300)}` : ''}`]
      : []),
    ``,
    `Fingerprint ${input.fingerprint} (check ${input.family}).`,
  ].join('\n')
  return {
    domain: DEPLOY_DOMAIN,
    title: `${DEPLOY_TITLE_PREFIX}: ${label} (${input.keys.length} ${input.keys.length === 1 ? 'failure' : 'failures'})`,
    objective,
    output: `A fix merged to main with npm run ship, after which npm run deploy:verify passes the ${label} check on production.`,
    accept: `A later deploy:verify passes "${label}" with none of the failing lines above. deploy:verify completes this node itself when it does; otherwise complete it with the passing run as the evidence.`,
    versionGap: deployGap(input.family, input.fingerprint, input.recurrence),
    parentId: input.parentId ?? null,
  }
}

/** The failing keys a node lists, read back from its objective. */
export function parseFailingKeys(objective: string): string[] {
  const lines = objective.split('\n')
  const at = lines.findIndex((l) => /^Failing \(\d+\):$/.test(l))
  if (at < 0) return []
  const keys: string[] = []
  for (const l of lines.slice(at + 1)) {
    if (!l.startsWith('- ')) break
    keys.push(l.slice(2))
  }
  return keys
}

/** The pathname a key names (`/path: reason`, `/path [decision]: reason`), or null for an aggregate. */
export function keyPath(key: string): string | null {
  const m = /^(\/\S*?)(?::|\s|$)/.exec(key)
  return m ? m[1] : null
}

/**
 * Whether a passing run actually re-checked what a node recorded. An exhaustive
 * check (no scope) verified everything; a sampled one verifies a path it fetched
 * or one the sitemap no longer lists.
 */
export function unverifiedPaths(keys: readonly string[], scope: DeployCheckScope | undefined): string[] {
  if (!scope) return []
  const checked = new Set(scope.checkedPaths)
  const listed = new Set(scope.listedPaths)
  const out: string[] = []
  for (const key of keys) {
    const p = keyPath(key)
    if (p && !checked.has(p) && listed.has(p)) out.push(p)
  }
  return out
}

// ── the plan ────────────────────────────────────────────────────────────────

export type FailurePlan = {
  keys: string[]
  /** Active nodes of this check that already list part or all of the failing set. */
  covering: DeployNodeView[]
  /** The failing keys no active node lists. */
  uncovered: string[]
  /** Set when the uncovered keys' own fingerprint belongs to a killed node. */
  killed: DeployNodeView | null
  /** Set when the uncovered keys need a node. */
  file: { fingerprint: string; recurrence: number; previous: DeployNodeView | null } | null
}

export function planFailure(result: DeployCheckResult, nodes: readonly DeployNodeView[]): FailurePlan {
  const family = result.family
  const keys = failureKeys(result.keys ?? result.lines ?? [])
  const plan: FailurePlan = { keys, covering: [], uncovered: [], killed: null, file: null }
  if (keys.length === 0) return plan
  const ofFamily = nodes.filter((n) => parseDeployGap(n.versionGap)?.family === family)
  const covered = new Set<string>()
  for (const n of ofFamily.filter(isActive)) {
    const listed = new Set(parseFailingKeys(n.objective))
    const hit = keys.filter((k) => listed.has(k))
    if (hit.length === 0) continue
    plan.covering.push(n)
    for (const k of hit) covered.add(k)
  }
  plan.uncovered = keys.filter((k) => !covered.has(k))
  if (plan.uncovered.length === 0) return plan
  const fingerprint = deployFingerprint(family, plan.uncovered)
  const chain = ofFamily
    .filter((n) => parseDeployGap(n.versionGap)?.fingerprint === fingerprint)
    .sort((a, b) => (parseDeployGap(b.versionGap)?.recurrence ?? 1) - (parseDeployGap(a.versionGap)?.recurrence ?? 1))
  const latest = chain[0] ?? null
  if (latest && isActive(latest)) {
    plan.covering.push(latest)
    plan.uncovered = []
    return plan
  }
  if (latest?.state === 'killed') {
    plan.killed = latest
    return plan
  }
  plan.file = {
    fingerprint,
    recurrence: latest ? (parseDeployGap(latest.versionGap)?.recurrence ?? 1) + 1 : 1,
    previous: latest,
  }
  return plan
}

// ── the lines ───────────────────────────────────────────────────────────────

/** What deploy:verify prints for a node that already exists. */
export function existingNodeLine(node: DeployNodeView, now: Date = new Date()): string {
  const gap = node.versionGap ?? node.id
  if (node.state === 'done' || node.state === 'killed') return `${gap} is ${node.state}`
  if (node.state === 'in_progress') {
    return `${gap} is claimed by ${node.ownerSession ?? '?'} since ${stamp(node.updatedAt)}: do not start a second fix`
  }
  if (node.state === 'blocked') {
    return `${gap} is blocked (${(node.blockedReason ?? 'no reason recorded').replace(/\s+/g, ' ').trim()}): do not start a second fix`
  }
  return `${gap} is already filed (unclaimed): claim it with ${deployClaimCommand(gap, now)}`
}

export type DeployOutcome =
  | { kind: 'filed'; family: DeployCheckFamily; gap: string; id: string; recurrenceOf: string | null }
  | { kind: 'would-file'; family: DeployCheckFamily; gap: string }
  | { kind: 'existing'; family: DeployCheckFamily; gap: string; state: WorkNodeState; owner: string | null }
  | { kind: 'killed'; family: DeployCheckFamily; gap: string }
  | { kind: 'transient'; family: DeployCheckFamily }
  | { kind: 'not-filed'; family: DeployCheckFamily; error: string }
  | { kind: 'completed'; family: DeployCheckFamily; gap: string; heldBy: string | null }
  | { kind: 'would-complete'; family: DeployCheckFamily; gap: string }
  | { kind: 'left-open'; family: DeployCheckFamily; gap: string; reason: string }

export type DeployReconcileReport = { lines: string[]; outcomes: DeployOutcome[] }

const isDuplicateKey = (error: string | null) => /duplicate key|loop_work_nodes_version_gap_uq|23505/i.test(error ?? '')
const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, ' ').slice(0, 200)

function asView(id: string, draft: WorkNodeDraft): DeployNodeView {
  return {
    id,
    versionGap: draft.versionGap ?? null,
    title: draft.title,
    objective: draft.objective,
    state: 'open',
    ownerSession: null,
    blockedReason: null,
    evidence: null,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * File what failed, close what passed. Never throws: a database that cannot be
 * reached is reported in `lines` and the caller's verdict stands. `run.write`
 * false reads and prints, and calls no write op.
 */
export async function reconcileDeployDefects(run: DeployVerifyRun, ops: DeployDefectOps): Promise<DeployReconcileReport> {
  const report: DeployReconcileReport = { lines: [], outcomes: [] }
  const failing = run.results.filter((r) => r.status === 'fail')
  const passing = run.results.filter((r) => r.status === 'pass')
  if (failing.length === 0 && passing.length === 0) return report
  const now = new Date(run.at)
  const today = Number.isNaN(now.getTime()) ? new Date() : now
  try {
    let nodes: DeployNodeView[]
    try {
      nodes = await ops.list()
    } catch (e) {
      for (const f of failing) {
        const { label } = DEPLOY_CHECK_FAMILIES[f.family]
        report.outcomes.push({ kind: 'not-filed', family: f.family, error: message(e) })
        report.lines.push(
          `${label}: the work graph could not be read (${message(e)}), so this failure was NOT filed. Look for an existing DEPLOY- node (npx tsx scripts/loop-brief.ts) before you start a fix.`,
        )
      }
      return report
    }
    for (const result of failing) await fileFailure(run, result, nodes, ops, report, today)
    for (const result of passing) await closePass(run, result, nodes, ops, report)
  } catch (e) {
    report.lines.push(`deploy defect filing stopped: ${message(e)}. The failures above stand.`)
  }
  return report
}

async function fileFailure(
  run: DeployVerifyRun,
  result: DeployCheckResult,
  nodes: DeployNodeView[],
  ops: DeployDefectOps,
  report: DeployReconcileReport,
  today: Date,
): Promise<void> {
  const { label } = DEPLOY_CHECK_FAMILIES[result.family]
  const plan = planFailure(result, nodes)
  if (plan.keys.length === 0) {
    report.outcomes.push({ kind: 'transient', family: result.family })
    report.lines.push(`${label}: only transport errors, not a defect to file. Re-run deploy:verify.`)
    return
  }
  report.lines.push(`${label}: ${plan.keys.length} failing`)
  for (const n of plan.covering) {
    report.outcomes.push({ kind: 'existing', family: result.family, gap: n.versionGap ?? n.id, state: n.state, owner: n.ownerSession })
    report.lines.push(existingNodeLine(n, today))
  }
  if (plan.killed) {
    const gap = plan.killed.versionGap ?? plan.killed.id
    report.outcomes.push({ kind: 'killed', family: result.family, gap })
    report.lines.push(
      `${gap} was killed (${(plan.killed.blockedReason ?? 'no reason recorded').replace(/\s+/g, ' ').trim()}) and this failure is back: not refiled. Ask Matt before you fix it.`,
    )
  }
  if (!plan.file) return
  const draft = buildDeployDraft({
    family: result.family,
    keys: plan.uncovered,
    // Only lines that carry more than the key does (counts, timings): a line
    // equal to its key is already in the Failing block.
    detail: (result.lines ?? []).filter((l) => !isTransientLine(l) && !plan.uncovered.includes(l)),
    sha: run.sha,
    at: run.at,
    fingerprint: plan.file.fingerprint,
    recurrence: plan.file.recurrence,
    previous: plan.file.previous
      ? { gap: plan.file.previous.versionGap ?? plan.file.previous.id, evidence: plan.file.previous.evidence }
      : null,
    parentId: plan.file.previous?.id ?? null,
  })
  const gap = draft.versionGap as string
  if (!run.write) {
    report.outcomes.push({ kind: 'would-file', family: result.family, gap })
    report.lines.push(`Not filed (--no-file, nothing written): would file ${gap} (unclaimed)`)
    return
  }
  const made = await ops.create(draft)
  if (made.id) {
    nodes.push(asView(made.id, draft))
    report.outcomes.push({ kind: 'filed', family: result.family, gap, id: made.id, recurrenceOf: plan.file.previous?.versionGap ?? null })
    report.lines.push(`Filed ${gap} (unclaimed): claim it with ${deployClaimCommand(gap, today)}`)
    if (plan.file.previous) {
      report.lines.push(`  recurrence of ${plan.file.previous.versionGap ?? plan.file.previous.id}, done ${stamp(plan.file.previous.updatedAt)}; linked as its follow-up`)
    }
    return
  }
  if (isDuplicateKey(made.error)) {
    // Another run filed it between our read and our write: the unique index on
    // version_gap is what makes filing idempotent. Say who holds it.
    try {
      const again = (await ops.list()).find((n) => n.versionGap === gap)
      if (again) {
        report.outcomes.push({ kind: 'existing', family: result.family, gap, state: again.state, owner: again.ownerSession })
        report.lines.push(existingNodeLine(again, today))
        return
      }
    } catch {
      /* fall through to the plain line */
    }
    report.outcomes.push({ kind: 'existing', family: result.family, gap, state: 'open', owner: null })
    report.lines.push(`${gap} was filed by another run a moment ago: claim it with ${deployClaimCommand(gap, today)}`)
    return
  }
  report.outcomes.push({ kind: 'not-filed', family: result.family, error: made.error ?? 'create failed' })
  report.lines.push(
    `${label}: could not file ${gap} (${(made.error ?? 'create failed').replace(/\s+/g, ' ').slice(0, 160)}). The failure above stands; check for an existing DEPLOY- node before you start a fix.`,
  )
}

async function closePass(
  run: DeployVerifyRun,
  result: DeployCheckResult,
  nodes: DeployNodeView[],
  ops: DeployDefectOps,
  report: DeployReconcileReport,
): Promise<void> {
  const { label } = DEPLOY_CHECK_FAMILIES[result.family]
  const open = nodes.filter((n) => parseDeployGap(n.versionGap)?.family === result.family && isActive(n))
  for (const node of open) {
    const gap = node.versionGap ?? node.id
    const recorded = parseFailingKeys(node.objective)
    const missed = unverifiedPaths(recorded, result.scope)
    if (missed.length > 0) {
      const reason = `${label} passed on a sample that did not fetch ${missed.length} of the ${recorded.length} URL(s) this node recorded (first: ${missed[0]}); left open`
      report.outcomes.push({ kind: 'left-open', family: result.family, gap, reason })
      report.lines.push(`${gap}: ${reason}`)
      continue
    }
    if (!run.write) {
      report.outcomes.push({ kind: 'would-complete', family: result.family, gap })
      report.lines.push(`Not closed (--no-file, nothing written): ${gap} would be completed, ${label} passes`)
      continue
    }
    const evidence = [
      `deploy:verify passed "${label}" at deploy ${short(run.sha)} on ${run.at}${result.evidence ? `: ${result.evidence}` : ''}.`,
      `The ${recorded.length} failing line(s) this node recorded no longer fail${result.scope ? ' (each recorded URL was fetched this run or is gone from the sitemap)' : ''}.`,
      `Closed by deploy:verify, not by a session.`,
    ].join(' ')
    const heldBy = node.state === 'in_progress' ? node.ownerSession : null
    let claimedHere = false
    if (node.state !== 'in_progress') {
      const took = await ops.claim(node.id, `${DEPLOY_AUTO_OWNER_PREFIX}${short(run.sha)}`)
      if (!took.ok) {
        report.outcomes.push({ kind: 'left-open', family: result.family, gap, reason: `could not take it to close it (${took.error ?? 'claim failed'})` })
        report.lines.push(`${gap}: ${label} passes but the node could not be closed (${(took.error ?? 'claim failed').slice(0, 120)}); left open`)
        continue
      }
      claimedHere = true
    }
    const done = await ops.complete(node.id, evidence)
    if (!done.ok) {
      if (claimedHere) await ops.release(node.id)
      report.outcomes.push({ kind: 'left-open', family: result.family, gap, reason: done.error ?? 'complete failed' })
      report.lines.push(`${gap}: ${label} passes but the node could not be closed (${(done.error ?? 'complete failed').slice(0, 120)}); left open`)
      continue
    }
    node.state = 'done'
    report.outcomes.push({ kind: 'completed', family: result.family, gap, heldBy })
    report.lines.push(`${gap} completed: ${label} passes at ${short(run.sha)}${heldBy ? ` (it was claimed by ${heldBy}; the fix is live)` : ''}`)
  }
}

// ── the boot brief ──────────────────────────────────────────────────────────

/** The open deploy-found nodes and who holds them, for the top of scripts/loop-brief.ts. */
export function formatDeployDefectBrief(
  nodes: readonly Pick<DeployNodeView, 'versionGap' | 'title' | 'objective' | 'state' | 'ownerSession' | 'blockedReason' | 'updatedAt' | 'id'>[],
  now: Date = new Date(),
): string[] {
  const active = nodes.filter((n) => isDeployFoundGap(n.versionGap) && ACTIVE_STATES.includes(n.state))
  const lines = ['--- DEPLOY-FOUND DEFECTS (deploy:verify files one node per failure; claim it before you fix it) ---']
  if (active.length === 0) {
    lines.push('none open. A failing deploy:verify files one; a passing run closes it.')
    return lines
  }
  const rank = (n: { state: WorkNodeState }) => (n.state === 'open' ? 0 : n.state === 'in_progress' ? 1 : 2)
  for (const n of [...active].sort((a, b) => rank(a) - rank(b) || a.updatedAt.localeCompare(b.updatedAt))) {
    const gap = n.versionGap as string
    // The date ends at the sentence's period, not the first one: a lazy match stopped
    // at the '.000Z' fraction and dropped the Z, so the time read as local (off by
    // the zone's offset on any machine not on UTC).
    const found = /Found at deploy (\S+) on (\S+?)\.(?:\s|$)/.exec(n.objective)
    lines.push(`  ${gap} [${n.state}] ${n.title}${found ? ` (found at ${found[1]}, ${stamp(found[2])})` : ''}`)
    const view = { ...n, evidence: null } as DeployNodeView
    if (n.state === 'open') lines.push(`    UNCLAIMED. Claim it: ${deployClaimCommand(gap, now)}`)
    else lines.push(`    ${existingNodeLine(view, now).replace(`${gap} is `, '')}`)
  }
  return lines
}
