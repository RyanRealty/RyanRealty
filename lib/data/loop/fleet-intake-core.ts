/**
 * Fleet intake core — bot findings become loop work through the ADD verb.
 * reachability: entry-point scripts/loop-brief.ts + scripts/fleet-intake.ts
 * Client-passed like signals.ts (no server-only) so the loop-brief boot and
 * the standalone script both run it: every session ingests the fleet's
 * output BEFORE picking work. That is the co-evolution wire — bots feed the
 * loop, the loop reshapes what bots test, automatically, every cycle.
 *
 * Verbs mapping (COMPANY_IMPROVEMENT §How Matt steers):
 *   ADD    — minor/major/p0 finding → one durable punch-list node (appends).
 *            Unclaimed OPEN/BLOCKED `Fleet finding [` singles fold into it.
 *   CHANGE — a regression finding on shipped work (caseId regress-G<n>)
 *            still gets its own node; do not fold those into the punch list.
 *   info   — recorded as confirmed baseline, no node (never noise the queue).
 *
 * Punch-list identity (deterministic find-or-create):
 *   version_gap = FLEET-PUNCH. That string is not a G-gap (`G\d+`), so it
 *   does not collide with planned-gap numbering, the regress-G* CHANGE
 *   path, or gap-order in the brief. The unique index on version_gap makes
 *   the active row a singleton. Title stays queue-visible to
 *   fleetNodePriority: `Fleet finding [p0]: review punch list` when any
 *   punch line is p0, otherwise `Fleet finding [major]: review punch list`.
 *   If a prior punch list is already done/killed and still holds the gap
 *   key, the successor is found by that title + open/in_progress/blocked.
 *
 * Why not parent_id / ship-class: parent_id is a tree of children (Matt
 * does not want that). Intake still writes one building node. At serve
 * time `selectShipClass` slices punch *lines* into a virtual family class
 * (cap SHIP_CLASS_MAX) without minting children.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isCompanyImprovementDomain } from './domains'

export const FLEET_PUNCH_GAP = 'FLEET-PUNCH'
export const FLEET_PUNCH_TITLE_BODY = 'review punch list'
export const FLEET_PUNCH_OUTPUT =
  'Class-fix (or reject) the served punch-line slice at 390+1280. Leftover lines stay on this inbox.'
export const FLEET_PUNCH_ACCEPT =
  'Each served line is fixed as a class or rejected with reproduce evidence at 390+1280. Completing this node is only valid when no open punch lines remain.'
export const FLEET_PUNCH_CONTRACT =
  'FLEET-PUNCH — one durable fleet-review punch list. Class-fix every line (or reject with reproduce evidence). FIRST STEP on each line: reproduce it yourself; if it does not reproduce, reject that line with the evidence.'

const PUNCH_TITLE_RE = /^Fleet finding \[(p0|major)\]: review punch list$/
const FLEET_SINGLE_TITLE_RE = /^Fleet finding \[(p0|major|minor)\]:/
const PUNCH_LINE_SEV_RE = /^-\s*\[(p0|major|minor)\]\s+/
const PUNCH_LINE_RE =
  /^-\s*\[(p0|major|minor)\]\s+(\S+)(?:\s+\[([^\]]+)\])?\s+—\s+(.+?)\s+(fleet:([a-f0-9]{8,}))\s*$/i
const PUNCH_EXPECTED_RE = /^expected "([^"]*)" observed "([^"]*)"(?:\s+(\S+))?$/i
const PUNCH_DISPOSITION_RE = /^-\s*\[(fixed|rejected)\]\s+fleet:([a-f0-9]{8,})\b/i
const FINGERPRINT_TAG_RE = /fleet:([a-f0-9]{8,})/i
const REGRESS_GAP_RE = /^regress-(G\d+)$/
const REGRESSION_MARK_RE = /REGRESSION of G\d+/

export type PunchLineSeverity = 'p0' | 'major' | 'minor'
export type PunchLineDisposition = 'fixed' | 'rejected'

export type PunchLine = {
  severity: PunchLineSeverity
  url: string
  observed: string
  expected: string | null
  viewport: string | null
  bot: string | null
  fingerprint: string
  raw: string
}

export type PunchDisposition = {
  fingerprint: string
  status: PunchLineDisposition
  note: string
}

export type FleetIntakeResult = {
  processed: number
  created: Array<{ nodeId: string; title: string }>
  appended: number
  folded: number
  duplicates: number
  baselines: number
  errors: string[]
}

export type FleetIntakeFinding = {
  id: string
  bot: string
  case_id: string | null
  url: string
  viewport: string | null
  expected: string
  observed: string
  severity: string
  fingerprint: string
  domain?: string | null
}

export type FleetIntakeActiveNode = {
  id: string
  title: string
  objective: string
  state: string
  owner_session: string | null
  version_gap: string | null
  domain: string
}

export type FleetPunchDraft = {
  id: string | null
  title: string
  objective: string
  output: string
  accept: string
  versionGap: string | null
  created: boolean
  appended: number
}

export type FleetRegressionDraft = {
  findingId: string
  gap: string
  domain: string
  title: string
  objective: string
  output: string
  accept: string
}

export type FleetIntakePlan = {
  punch: FleetPunchDraft | null
  punchFindingIds: string[]
  regressions: FleetRegressionDraft[]
  fold: Array<{ id: string; line: string }>
  duplicates: string[]
  baselines: string[]
}

export function fleetFingerprintTag(fingerprint: string): string {
  return `fleet:${fingerprint}`
}

export function objectiveHasFingerprint(objective: string, fingerprint: string): boolean {
  return objective.includes(fleetFingerprintTag(fingerprint))
}

export function isFleetPunchListTitle(title: string): boolean {
  return PUNCH_TITLE_RE.test(title.trim())
}

export function isFleetPunchListNode(node: {
  title: string
  version_gap?: string | null
  versionGap?: string | null
  objective?: string
}): boolean {
  if (node.version_gap === FLEET_PUNCH_GAP || node.versionGap === FLEET_PUNCH_GAP) return true
  if (isFleetPunchListTitle(node.title)) return true
  return Boolean(node.objective?.includes('FLEET-PUNCH — one durable'))
}

export function findFleetPunchListNode<T extends FleetIntakeActiveNode>(nodes: T[]): T | null {
  return nodes.find((n) => isFleetPunchListNode(n)) ?? null
}

export function fleetPunchListTitle(severity: 'p0' | 'major'): string {
  return `Fleet finding [${severity}]: ${FLEET_PUNCH_TITLE_BODY}`
}

export function punchTitleSeverity(objective: string, incoming?: string): 'p0' | 'major' {
  if (incoming === 'p0') return 'p0'
  for (const line of objective.split('\n')) {
    if (PUNCH_LINE_SEV_RE.exec(line)?.[1] === 'p0') return 'p0'
  }
  return 'major'
}

export function formatFleetPunchLine(input: {
  severity: string
  url: string
  observed: string
  fingerprint: string
  expected?: string | null
  viewport?: string | null
  bot?: string | null
}): string {
  const severity = ['p0', 'major', 'minor'].includes(input.severity) ? input.severity : 'minor'
  const observed = String(input.observed).replace(/\s+/g, ' ').trim().slice(0, 120)
  const expected = input.expected ? String(input.expected).replace(/\s+/g, ' ').trim().slice(0, 120) : ''
  const viewport = input.viewport ? String(input.viewport).replace(/\s+/g, ' ').trim() : ''
  const bot = input.bot ? String(input.bot).replace(/\s+/g, ' ').trim() : ''
  const vp = viewport ? ` [${viewport}]` : ''
  if (expected) {
    const botBit = bot ? ` ${bot}` : ''
    return `- [${severity}] ${input.url}${vp} — expected "${expected}" observed "${observed}"${botBit} ${fleetFingerprintTag(input.fingerprint)}`
  }
  return `- [${severity}] ${input.url}${vp} — ${observed} ${fleetFingerprintTag(input.fingerprint)}`
}

export function appendPunchLine(objective: string, line: string): string {
  const tag = line.match(FINGERPRINT_TAG_RE)?.[0]
  if (tag && objective.includes(tag)) return objective
  const base = objective.trimEnd()
  return base ? `${base}\n${line}` : line
}

export function parsePunchLines(objective: string): PunchLine[] {
  const lines: PunchLine[] = []
  for (const raw of objective.split('\n')) {
    const m = PUNCH_LINE_RE.exec(raw.trim())
    if (!m) continue
    const severity = m[1].toLowerCase() as PunchLineSeverity
    const body = m[4].replace(/\s+/g, ' ').trim()
    const expectedMatch = PUNCH_EXPECTED_RE.exec(body)
    lines.push({
      severity,
      url: m[2],
      viewport: m[3] ? m[3].trim() : null,
      expected: expectedMatch?.[1] ?? null,
      observed: expectedMatch?.[2] ?? body,
      bot: expectedMatch?.[3] ?? null,
      fingerprint: m[6].toLowerCase(),
      raw: raw.trim(),
    })
  }
  return lines
}

export function punchDispositionFingerprints(objective: string): Set<string> {
  const found = new Set<string>()
  for (const raw of objective.split('\n')) {
    const m = PUNCH_DISPOSITION_RE.exec(raw.trim())
    if (m) found.add(m[2].toLowerCase())
  }
  return found
}

export function openPunchLines(objective: string): PunchLine[] {
  const resolved = punchDispositionFingerprints(objective)
  return parsePunchLines(objective).filter((line) => !resolved.has(line.fingerprint))
}

export function canCompletePunchList(objective: string): boolean {
  return openPunchLines(objective).length === 0
}

export function formatPunchDisposition(input: PunchDisposition): string {
  const status = input.status === 'rejected' ? 'rejected' : 'fixed'
  const note = String(input.note).replace(/\s+/g, ' ').trim().slice(0, 240)
  return `- [${status}] ${fleetFingerprintTag(input.fingerprint)}${note ? ` — ${note}` : ''}`
}

/** Append-only dispositions. Original punch lines stay intact. */
export function appendPunchDispositions(objective: string, resolutions: PunchDisposition[]): string {
  const already = punchDispositionFingerprints(objective)
  const extras: string[] = []
  for (const resolution of resolutions) {
    const fp = resolution.fingerprint.toLowerCase()
    if (already.has(fp)) continue
    extras.push(formatPunchDisposition({ ...resolution, fingerprint: fp }))
    already.add(fp)
  }
  if (!extras.length) return objective
  const base = objective.trimEnd()
  return base ? `${base}\n${extras.join('\n')}` : extras.join('\n')
}

export function regressGapOf(caseId: string | null | undefined): string | null {
  return String(caseId ?? '').match(REGRESS_GAP_RE)?.[1] ?? null
}

export function isFoldableFleetSingle(node: FleetIntakeActiveNode): boolean {
  if (node.state !== 'open' && node.state !== 'blocked') return false
  if (node.owner_session) return false
  if (isFleetPunchListNode(node)) return false
  if (!FLEET_SINGLE_TITLE_RE.test(node.title)) return false
  if (REGRESSION_MARK_RE.test(node.objective)) return false
  return true
}

export function punchLineFromSingleNode(node: { title: string; objective: string }): string | null {
  const severity = node.title.match(FLEET_SINGLE_TITLE_RE)?.[1] ?? 'minor'
  const fingerprint = node.objective.match(FINGERPRINT_TAG_RE)?.[1]
  if (!fingerprint) return null
  const abs = node.objective.match(/at (https?:\/\/[^\s\]]+)/i)?.[1]
  const rel = node.objective.match(/at (\/[^\s\]]+)/)?.[1]
  const url = abs ?? rel ?? ''
  const quoted = node.objective.match(/observed "([^"]*)"/i)?.[1]
  const fromTitle = node.title.replace(FLEET_SINGLE_TITLE_RE, '').trim()
  const observed = quoted || fromTitle
  const expected = node.objective.match(/expected "([^"]*)"/i)?.[1] ?? null
  const viewport = node.objective.match(/\[(\d{3,4})\]/)?.[1] ?? null
  const bot = node.objective.match(/\bbot\s+(\S+)/i)?.[1] ?? null
  return formatFleetPunchLine({ severity, url, observed, fingerprint, expected, viewport, bot })
}

export function initialPunchObjective(): string {
  return FLEET_PUNCH_CONTRACT
}

function emptyPlan(): FleetIntakePlan {
  return {
    punch: null,
    punchFindingIds: [],
    regressions: [],
    fold: [],
    duplicates: [],
    baselines: [],
  }
}

function punchDraftFrom(
  existing: FleetIntakeActiveNode | null,
  objective: string,
  appended: number,
): FleetPunchDraft {
  return {
    id: existing?.id ?? null,
    title: fleetPunchListTitle(punchTitleSeverity(objective)),
    objective,
    output: FLEET_PUNCH_OUTPUT,
    accept: FLEET_PUNCH_ACCEPT,
    versionGap: existing?.version_gap === FLEET_PUNCH_GAP ? FLEET_PUNCH_GAP : existing ? existing.version_gap : FLEET_PUNCH_GAP,
    created: existing == null,
    appended,
  }
}

/**
 * Pure merge: decide punch-list appends, regression singles, duplicates,
 * baselines, and which unclaimed Fleet finding [ OPEN nodes to fold.
 * runFleetIntake applies this plan to Supabase.
 */
export function mergeFleetIntake(
  findings: FleetIntakeFinding[],
  nodes: FleetIntakeActiveNode[],
  originals: Record<string, { domain?: string | null; title?: string | null }> = {},
): FleetIntakePlan {
  const plan = emptyPlan()
  const existingPunch = findFleetPunchListNode(nodes)
  let punchObjective = existingPunch?.objective ?? initialPunchObjective()
  let punchTouched = false
  let appended = 0
  const seenObjectives = nodes.map((n) => n.objective)

  const alreadyOpen = (fingerprint: string) =>
    seenObjectives.some((o) => objectiveHasFingerprint(o, fingerprint)) ||
    objectiveHasFingerprint(punchObjective, fingerprint)

  for (const f of findings) {
    if (alreadyOpen(f.fingerprint)) {
      plan.duplicates.push(f.id)
      continue
    }
    if (f.severity === 'info') {
      plan.baselines.push(f.id)
      continue
    }

    const gap = regressGapOf(f.case_id)
    if (gap) {
      const original = originals[gap]
      const domain =
        original?.domain && isCompanyImprovementDomain(String(original.domain))
          ? String(original.domain)
          : f.domain && isCompanyImprovementDomain(String(f.domain))
            ? String(f.domain)
            : 'public-ux'
      const regressionPrefix = `REGRESSION of ${gap} ("${original?.title ?? 'shipped work'}" — was DONE and accepted). `
      const tag = fleetFingerprintTag(f.fingerprint)
      const node = {
        findingId: f.id,
        gap,
        domain,
        title: `Fleet finding [${f.severity}]: ${String(f.observed).slice(0, 90)}`,
        objective: `${tag} — ${regressionPrefix}bot ${f.bot} (case ${f.case_id ?? 'ad-hoc'}) at ${f.url}${f.viewport ? ` [${f.viewport}]` : ''}: expected "${f.expected}" but observed "${f.observed}". FIRST STEP: reproduce it yourself; if it does not reproduce, reject the finding and release this node with the evidence. ON FIX (CHANGE verb): restore the original accept, then update the REQUIREMENTS rows covering ${gap} with the new evidence.`,
        output:
          'Regression fixed as a class; original accept restored; covering register rows corrected with evidence.',
        accept: `The original expected state holds at ${f.url} (and everywhere the class occurs), verified at 390+1280 with evidence.`,
      }
      plan.regressions.push(node)
      seenObjectives.push(node.objective)
      continue
    }

    const line = formatFleetPunchLine(f)
    punchObjective = appendPunchLine(punchObjective, line)
    seenObjectives.push(line)
    plan.punchFindingIds.push(f.id)
    appended += 1
    punchTouched = true
  }

  for (const n of nodes) {
    if (!isFoldableFleetSingle(n)) continue
    const line = punchLineFromSingleNode(n)
    if (!line) continue
    const fp = line.match(FINGERPRINT_TAG_RE)?.[1]
    if (fp && objectiveHasFingerprint(punchObjective, fp)) continue
    punchObjective = appendPunchLine(punchObjective, line)
    plan.fold.push({ id: n.id, line })
    punchTouched = true
  }

  if (punchTouched) {
    plan.punch = punchDraftFrom(existingPunch ?? null, punchObjective, appended)
  }
  return plan
}

export async function runFleetIntake(sb: SupabaseClient): Promise<FleetIntakeResult> {
  const result: FleetIntakeResult = {
    processed: 0,
    created: [],
    appended: 0,
    folded: 0,
    duplicates: 0,
    baselines: 0,
    errors: [],
  }

  const { data: findings, error } = await sb
    .from('fleet_findings')
    .select('id,bot,case_id,url,viewport,expected,observed,severity,evidence,domain,fingerprint')
    .eq('status', 'new')
    .order('created_at', { ascending: true })
  if (error) {
    result.errors.push(`findings unreadable: ${error.message}`)
    return result
  }

  const { data: openNodes } = await sb
    .from('loop_work_nodes')
    .select('id,title,objective,state,owner_session,version_gap,domain')
    .in('state', ['open', 'in_progress', 'blocked'])

  const nodes = (openNodes ?? []) as FleetIntakeActiveNode[]
  const incoming = (findings ?? []) as FleetIntakeFinding[]
  result.processed = incoming.length

  const originals: Record<string, { domain?: string | null; title?: string | null }> = {}
  const regressGaps = [
    ...new Set(incoming.map((f) => regressGapOf(f.case_id)).filter((g): g is string => Boolean(g))),
  ]
  if (regressGaps.length) {
    const { data: originalRows } = await sb
      .from('loop_work_nodes')
      .select('version_gap,domain,title')
      .in('version_gap', regressGaps)
    for (const row of originalRows ?? []) {
      const gap = String(row.version_gap ?? '')
      if (gap) originals[gap] = { domain: row.domain, title: row.title }
    }
  }

  const plan = mergeFleetIntake(incoming, nodes, originals)
  if (!incoming.length && !plan.punch) return result

  const now = new Date().toISOString()

  for (const id of plan.duplicates) {
    await sb.from('fleet_findings').update({ status: 'duplicate', triaged_at: now }).eq('id', id)
    result.duplicates += 1
  }
  for (const id of plan.baselines) {
    await sb.from('fleet_findings').update({ status: 'confirmed', triaged_at: now }).eq('id', id)
    result.baselines += 1
  }

  for (const r of plan.regressions) {
    const { data: created, error: nodeErr } = await sb
      .from('loop_work_nodes')
      .insert({
        domain: r.domain,
        title: r.title,
        objective: r.objective,
        output: r.output,
        accept: r.accept,
      })
      .select('id')
      .single()
    if (nodeErr || !created?.id) {
      result.errors.push(`node create failed for ${r.findingId}: ${nodeErr?.message}`)
      continue
    }
    await sb
      .from('fleet_findings')
      .update({ status: 'node_created', node_id: created.id, triaged_at: now })
      .eq('id', r.findingId)
    result.created.push({ nodeId: String(created.id), title: r.title })
  }

  if (plan.punch) {
    const punchId = await persistPunchList(sb, plan.punch, result)
    if (punchId) {
      for (const id of plan.punchFindingIds) {
        await sb
          .from('fleet_findings')
          .update({ status: 'node_created', node_id: punchId, triaged_at: now })
          .eq('id', id)
      }
      result.appended = plan.punch.appended
      for (const folded of plan.fold) {
        const { data: killed, error: killErr } = await sb
          .from('loop_work_nodes')
          .update({
            state: 'killed',
            blocked_reason: `Folded into FLEET-PUNCH punch list (node ${punchId}).`,
            updated_at: now,
          })
          .eq('id', folded.id)
          .in('state', ['open', 'blocked'])
          .is('owner_session', null)
          .select('id')
          .maybeSingle()
        if (killErr || !killed?.id) {
          result.errors.push(`fold kill failed for ${folded.id}: ${killErr?.message ?? 'no matching unclaimed open/blocked row'}`)
          continue
        }
        await sb.from('fleet_findings').update({ node_id: punchId }).eq('node_id', folded.id)
        result.folded += 1
      }
    }
  }

  return result
}

async function persistPunchList(
  sb: SupabaseClient,
  punch: FleetPunchDraft,
  result: FleetIntakeResult,
): Promise<string | null> {
  const now = new Date().toISOString()
  if (punch.id) {
    const { error } = await sb
      .from('loop_work_nodes')
      .update({
        title: punch.title,
        objective: punch.objective,
        output: punch.output,
        accept: punch.accept,
        updated_at: now,
      })
      .eq('id', punch.id)
    if (error) {
      result.errors.push(`punch list update failed: ${error.message}`)
      return null
    }
    return punch.id
  }

  const insert = {
    domain: 'public-ux',
    title: punch.title,
    objective: punch.objective,
    output: punch.output,
    accept: punch.accept,
    version_gap: FLEET_PUNCH_GAP,
  }
  const { data: created, error: nodeErr } = await sb.from('loop_work_nodes').insert(insert).select('id').single()
  if (!nodeErr && created?.id) {
    result.created.push({ nodeId: String(created.id), title: punch.title })
    return String(created.id)
  }
  // Unique version_gap: a done/killed row still holds FLEET-PUNCH. Successor
  // uses the documented title identity and a null gap.
  if (nodeErr?.code === '23505') {
    const { data: retry, error: retryErr } = await sb
      .from('loop_work_nodes')
      .insert({ ...insert, version_gap: null })
      .select('id')
      .single()
    if (retryErr || !retry?.id) {
      result.errors.push(`punch list create failed after gap collision: ${retryErr?.message}`)
      return null
    }
    result.created.push({ nodeId: String(retry.id), title: punch.title })
    return String(retry.id)
  }
  result.errors.push(`punch list create failed: ${nodeErr?.message}`)
  return null
}
