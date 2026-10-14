#!/usr/bin/env node
/**
 * check-rule-loosening.mjs - commit-msg gate: only Matt loosens a content rule.
 *
 * Matt 2026-10-14 (docs/plans/CONTENT_PROCESS.md, "Rules can tighten freely;
 * loosening waits for Matt"). lib/content/process/rules.baseline.json holds the
 * last value Matt approved for every number a rule holds (ci:content-rules reads
 * it). A commit that changes that file is checked against HEAD:
 *
 *  - an ID that was in HEAD's baseline and is not in the staged one is refused,
 *    with no override: IDs are never removed (a retired rule stays, with status
 *    "retired");
 *  - a number the staged baseline holds LOOSER than HEAD's (or no longer holds at
 *    all, or holds a different path or direction) needs, in the commit message,
 *      Approved-by: matt
 *      Rule-loosened: R-xxx          (one line per rule, or R-xxx, R-yyy)
 *    and every loosened rule must be named. A tighter number needs nothing.
 *  - a merge whose loosened entry arrived unchanged from the merged branch needs
 *    nothing (that branch's commit carried the trailers).
 *
 * There is no override environment variable: the point is that an agent cannot
 * loosen its own rules. Invoked by .husky/commit-msg with the message file as argv[2],
 * the same way as scripts/check-technique-approval.mjs.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const BASELINE = 'lib/content/process/rules.baseline.json'
export const APPROVED = /^approved-by:\s*matt\s*$/im
export const ID_FORM = /^R-\d{3}$/

/** JSON with sorted keys, so a re-ordered entry is not a "change". */
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
  return JSON.stringify(v)
}

const ruleOf = (key) => key.split('#')[0]

/**
 * What the staged baseline does that Matt must approve: IDs it drops, and the
 * numbers it holds looser than `head`. `others` are the other parents of a merge.
 * `compareResolved` is lib/content/process/threshold-path.ts's.
 */
export function looseningProblems(head, staged, compareResolved, others = []) {
  const removedIds = []
  const loosened = new Map()
  const note = (id, line) => loosened.set(id, [...(loosened.get(id) ?? []), line])
  for (const parent of [head, ...others]) {
    for (const id of parent?.ids ?? []) if (!(staged.ids ?? []).includes(id) && !removedIds.includes(id)) removedIds.push(id)
  }
  const sameAsOther = (key, entry) => others.some((o) => o?.thresholds?.[key] && canonical(o.thresholds[key]) === canonical(entry))
  for (const [key, b] of Object.entries(head?.thresholds ?? {})) {
    const s = staged.thresholds?.[key]
    const id = ruleOf(key)
    if (!s) {
      note(id, `${key} (${b.source}:${b.path}) is no longer held`)
      continue
    }
    if (sameAsOther(key, s)) continue
    if (s.source !== b.source || s.path !== b.path || s.tighterIs !== b.tighterIs) {
      note(id, `${key} now holds ${s.source}:${s.path} (${s.tighterIs} is tighter), was ${b.source}:${b.path} (${b.tighterIs} is tighter)`)
      continue
    }
    const types = [...new Set([...Object.keys(b.perType ?? {}), ...Object.keys(s.perType ?? {})])]
    for (const f of compareResolved({ value: b.value, ...(b.perType ? { perType: b.perType } : {}) }, { value: s.value, ...(s.perType ? { perType: s.perType } : {}) }, b.tighterIs, types)) {
      if (f.comparison === 'looser') note(id, `${key} ${b.path}${f.where === 'value' ? '' : ` for ${f.where}`}: ${JSON.stringify(f.baseline)} -> ${f.current === undefined ? 'gone' : JSON.stringify(f.current)}`)
    }
  }
  return { removedIds, loosened }
}

/** What the commit message still lacks for these loosened rules: the Approved-by line, and each rule named on a Rule-loosened line. */
export function messageProblems(message, ruleIds) {
  if (!ruleIds.length) return []
  const body = String(message ?? '').split('\n').filter((l) => !l.startsWith('#')).join('\n')
  const named = new Set()
  for (const m of body.matchAll(/^rule-loosened:\s*(.+)$/gim)) for (const t of m[1].split(/[\s,]+/)) if (ID_FORM.test(t)) named.add(t)
  const out = []
  if (!APPROVED.test(body)) out.push('no `Approved-by: matt` line')
  for (const id of ruleIds) if (!named.has(id)) out.push(`no \`Rule-loosened: ${id}\` line`)
  return out
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 })
  } catch {
    return null
  }
}

/** The baseline at a revision (":" is the index), null when the file is not there. Throws on bad JSON. */
function baselineAt(rev) {
  const text = git(['show', `${rev}:${BASELINE}`])
  return text === null ? null : JSON.parse(text)
}

async function main() {
  const staged = (git(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']) ?? '').split('\n').map((s) => s.trim())
  if (!staged.includes(BASELINE)) process.exit(0)
  const msgFile = process.argv[2] || '.git/COMMIT_EDITMSG'
  const message = existsSync(msgFile) ? readFileSync(msgFile, 'utf8') : ''
  const stop = (lines) => {
    console.error('')
    console.error('========================================================')
    console.error('Rule loosening gate FAILED')
    console.error('========================================================')
    console.error('')
    for (const l of lines) console.error(l)
    console.error('')
    process.exit(1)
  }
  let after
  try {
    after = baselineAt('')
  } catch (e) {
    stop([`The staged ${BASELINE} is not valid JSON (${e.message}).`])
  }
  if (after === null) stop([`${BASELINE} is staged for deletion: the baseline holds every approved number and every rule ID, and may not be deleted.`])
  const parents = []
  for (const rev of ['HEAD', 'MERGE_HEAD']) {
    if (git(['rev-parse', '-q', '--verify', rev]) === null) continue
    try {
      parents.push(baselineAt(rev))
    } catch {
      parents.push(null)
    }
  }
  process.removeAllListeners('warning')
  const { compareResolved } = await import(pathToFileURL(join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'lib/content/process/threshold-path.ts')).href)
  const { removedIds, loosened } = looseningProblems(parents[0] ?? null, after, compareResolved, parents.slice(1))
  const lines = []
  if (removedIds.length) {
    lines.push(`This commit removes rule ID(s) from ${BASELINE}: ${removedIds.join(', ')}.`)
    lines.push('IDs are never removed or reused. Keep the rule in rules.ts with status "retired" and keep its ID here.')
  }
  const problems = messageProblems(message, [...loosened.keys()])
  if (loosened.size && problems.length) {
    lines.push(`This commit LOOSENS ${loosened.size} content rule number(s) in ${BASELINE}:`)
    for (const [id, what] of loosened) for (const w of what) lines.push(`  ${id}: ${w}`)
    lines.push('')
    lines.push('Only Matt loosens a rule (docs/plans/CONTENT_PROCESS.md, ruling 4). The commit message needs:')
    for (const p of problems) lines.push(`  - ${p}`)
    lines.push('')
    lines.push('An agent does not write these lines for itself. If Matt has not approved it, put the number back (or tighten it).')
  }
  if (lines.length) stop(lines)
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main()
