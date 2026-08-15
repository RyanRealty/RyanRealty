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

/** A node in_progress with no update for this many days is stranded work. */
export const STALE_IN_PROGRESS_DAYS = 3

export function isStaleInProgress(
  node: { state: WorkNodeState; updatedAt: string },
  now: Date = new Date(),
): boolean {
  if (node.state !== 'in_progress') return false
  const ageMs = now.getTime() - Date.parse(node.updatedAt)
  return ageMs > STALE_IN_PROGRESS_DAYS * 24 * 60 * 60 * 1000
}
