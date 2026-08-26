/**
 * Ship reconciliation — the loop noticing what shipped without it.
 *
 * WHY THIS EXISTS. The work graph's only intake is fleet-intake-core: bot
 * findings become nodes. Nothing ever read the other direction, so work done
 * outside the graph was invisible to it BY CONSTRUCTION. On 2026-08-25 that gap
 * measured eight days wide: loop_work_nodes held no node for D26, D27, the
 * rescued analytics tab or the sandbox-race fix, and site_improvement_ledger —
 * which carries a commit_sha column precisely to link ships to outcomes — had
 * taken zero rows since 2026-08-17, across every session, not one.
 *
 * A graph that cannot see that is not a system of record; it is a queue that
 * looks like one, which is worse, because the next session trusts it.
 *
 * This is deliberately a REPORT, not a gate. Failing a commit because it has no
 * node would push people to write ceremonial nodes to get past the gate, and a
 * ledger full of ceremony is exactly the §0 failure the ledger exists to stop.
 * Surfacing it at session boot puts the fact in front of the one person who can
 * decide whether it matters.
 *
 * Pure: takes commits and known SHAs, returns what is unrepresented. The I/O
 * lives in the caller so this is testable without git or a database.
 */

export type ShippedCommit = {
  sha: string
  subject: string
  /** ISO date, for the age note. */
  date: string
}

export type ReconcileInput = {
  commits: ShippedCommit[]
  /** commit_sha values from site_improvement_ledger. */
  ledgerShas: string[]
  /** Free text of every work node's evidence — a node cites the SHA it shipped. */
  nodeEvidence: string[]
  /** Subjects that are housekeeping, not shippable work worth a node. */
  ignoreSubjectPattern?: RegExp
}

export type UnrepresentedCommit = ShippedCommit & { reason: 'no node, no ledger row' }

export type ReconcileReport = {
  scanned: number
  represented: number
  unrepresented: UnrepresentedCommit[]
  /** True when the loop has no record of ANY commit in the window. */
  totallyBlind: boolean
}

/**
 * Docs, handoff notes and merge commits are records of work, not the work. A
 * node for "docs(handoff): ..." would be a node about writing a node.
 */
export const DEFAULT_IGNORE = /^(docs|chore|merge|revert)[(:]/i

/** A SHA is cited if any evidence or ledger row contains its short form. */
function isCited(sha: string, haystacks: string[]): boolean {
  const short = sha.slice(0, 7)
  if (short.length < 7) return false
  return haystacks.some((h) => h.includes(short))
}

export function reconcileShips(input: ReconcileInput): ReconcileReport {
  const ignore = input.ignoreSubjectPattern ?? DEFAULT_IGNORE
  const haystacks = [...input.ledgerShas, ...input.nodeEvidence].filter(Boolean)
  const candidates = input.commits.filter((c) => !ignore.test(c.subject))
  const unrepresented = candidates
    .filter((c) => !isCited(c.sha, haystacks))
    .map((c) => ({ ...c, reason: 'no node, no ledger row' as const }))
  return {
    scanned: candidates.length,
    represented: candidates.length - unrepresented.length,
    unrepresented,
    totallyBlind: candidates.length > 0 && unrepresented.length === candidates.length,
  }
}

/** The brief's section. Silent-ish when the loop is keeping up. */
export function formatReconcileReport(r: ReconcileReport, windowDays: number): string[] {
  if (r.scanned === 0) return [`no shippable commits in the last ${windowDays} days`]
  if (r.unrepresented.length === 0) {
    return [`${r.represented}/${r.scanned} shipped commits are represented in the loop`]
  }
  const out = [
    `${r.unrepresented.length} of ${r.scanned} shipped commits in the last ${windowDays} days have NO node and NO ledger row.`,
  ]
  if (r.totallyBlind) {
    out.push(
      'EVERY shippable commit in this window is invisible to the loop. The graph is not tracking the shop —',
      'treat commit messages and the plan docs as the record until this is closed, and do not read an empty',
      'work graph as an empty backlog.',
    )
  }
  for (const c of r.unrepresented.slice(0, 12)) out.push(`  ${c.sha.slice(0, 8)} ${c.date}  ${c.subject.slice(0, 88)}`)
  if (r.unrepresented.length > 12) out.push(`  … and ${r.unrepresented.length - 12} more`)
  return out
}
