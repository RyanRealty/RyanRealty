import { assertCompanyDomain, type CompanyImprovementDomain } from './domains'

/**
 * Pure work-node rules for the durable work graph (THE LOOP v1.4.0).
 * The graph, not the chat session, is the source of record for in-flight
 * work. Server DAL: ./work-graph.ts
 */

export const WORK_NODE_STATES = ['open', 'in_progress', 'blocked', 'done', 'killed'] as const
export type WorkNodeState = (typeof WORK_NODE_STATES)[number]

export type WorkNodeDraft = {
  domain: CompanyImprovementDomain
  title: string
  /** Contract: what this node changes in the world. */
  objective: string
  /** Contract: the artifact or evidence "done" produces. */
  output: string
  /** Contract: the accept test, matched to the goal type. */
  accept: string
  versionGap?: string | null
  parentId?: string | null
  dependsOn?: string[]
}

export function assertWorkNodeDraft(input: {
  domain: string
  title: string
  objective: string
  output: string
  accept: string
}): asserts input is WorkNodeDraft {
  assertCompanyDomain(input.domain)
  if (!input.title.trim()) throw new Error('title is required')
  if (!input.objective.trim()) throw new Error('objective is required — a node without an objective is not a bounded job')
  if (!input.output.trim()) throw new Error('output is required — name the artifact done produces')
  if (!input.accept.trim()) throw new Error('accept is required — a node without an accept test cannot be audited')
}

const TRANSITIONS: Record<WorkNodeState, WorkNodeState[]> = {
  open: ['in_progress', 'killed'],
  in_progress: ['done', 'blocked', 'open', 'killed'],
  blocked: ['open', 'in_progress', 'killed'],
  done: [],
  killed: [],
}

export function isLegalTransition(from: WorkNodeState, to: WorkNodeState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: WorkNodeState, to: WorkNodeState): void {
  if (!isLegalTransition(from, to)) {
    throw new Error(`illegal work-node transition ${from} -> ${to} (done and killed are terminal)`)
  }
}

/**
 * Queue priority for the brief's next-node pick. Fleet-reported live defects
 * outrank planned gap work: a p0 (money path broken / wrong public number)
 * beats everything, a major beats gap order. Lower = served first.
 */
export function fleetNodePriority(title: string): number {
  if (title.startsWith('Fleet finding [p0]') || title.startsWith('Matt ADD [p0]') || title.startsWith('Matt CHANGE [p0]')) {
    return 0
  }
  if (
    title.startsWith('Fleet finding [major]') ||
    title.startsWith('Matt ADD') ||
    title.startsWith('Matt CHANGE')
  ) {
    return 1
  }
  return 2
}

/** A node in_progress with no update for this many days is stranded work. */
export const STALE_IN_PROGRESS_DAYS = 3

/**
 * Site queue claims (domain public-ux, version_gap SITE-*) go stale in HOURS,
 * not days. Sessions are disposable and several run at once (Matt 2026-09-07);
 * a cloud session killed mid-round by a rate limit leaves its claim
 * in_progress, and the sentinel's orphan release only knows Cursor agents.
 * Observed 2026-09-08: four grinder claims and two local claims sat frozen for
 * five hours while every hourly fire stopped at the guard. The window matches
 * the grinder's own concurrency guard (3 hours), so a live lane must heartbeat
 * the node it holds (the site-queue skill's rule) or lose it.
 */
export const SITE_CLAIM_IDLE_HOURS = 3

/** A site queue claim: the public-ux domain AND a SITE-* version gap. */
export function isSiteClaim(node: { domain?: string | null; versionGap?: string | null }): boolean {
  return node.domain === 'public-ux' && String(node.versionGap ?? '').startsWith('SITE-')
}

export function isStaleInProgress(
  node: { state: WorkNodeState; updatedAt: string; domain?: string | null; versionGap?: string | null },
  now: Date = new Date(),
): boolean {
  if (node.state !== 'in_progress') return false
  const ageMs = now.getTime() - Date.parse(node.updatedAt)
  const limitMs = isSiteClaim(node)
    ? SITE_CLAIM_IDLE_HOURS * 60 * 60 * 1000
    : STALE_IN_PROGRESS_DAYS * 24 * 60 * 60 * 1000
  return ageMs > limitMs
}

// ── Orphan auto-release (pre-arm item 3, ARMING-RUNBOOK Step 1) ──────────────
// A cloud agent that dies mid-node (crash, token exhaustion, cancellation)
// leaves its claim in_progress. When the owner's newest run is TERMINAL, the
// claim is an orphan — the sentinel releases it back to open instead of
// waiting out the 3-hour standdown.

/** Cloud-agent owner sessions are the Cursor agent id the sentinel stamped. */
export function isCloudAgentSession(owner: string | null): boolean {
  if (typeof owner !== 'string') return false
  const s = owner.trim()
  // Cursor cloud agent ids are `bc-<uuid>`. Cloud-bot sessions stamp
  // `cursor-cloud-bc-<hex>-…` which the old /^bc-/ prefix missed, leaving
  // FLEET-PUNCH claims stranded (deep-audit 2026-09-04).
  return /^(bc-|cursor-cloud-bc-)/i.test(s)
}

/**
 * Release only when ALL hold: the node is in_progress, its owner is a cloud
 * agent (human sessions have no API status — they age out via staleness),
 * the owner's newest run is terminal, and a short grace period has passed
 * since the last node update (never race a completion that is mid-write).
 */
export const ORPHAN_GRACE_MIN = 10

export function shouldAutoRelease(
  node: { state: WorkNodeState; ownerSession: string | null; updatedAt: string },
  ownerRunTerminal: boolean,
  now: Date = new Date(),
): boolean {
  if (node.state !== 'in_progress') return false
  if (!isCloudAgentSession(node.ownerSession)) return false
  if (!ownerRunTerminal) return false
  const ageMs = now.getTime() - Date.parse(node.updatedAt)
  return ageMs > ORPHAN_GRACE_MIN * 60 * 1000
}
