#!/usr/bin/env node
/**
 * ci:studio-techniques — the technique menu is real code (Matt 2026-10-13).
 *
 * Matt: "I want all these skills not only in place but forced to be used."
 * The ryan-studio technique library was 15 recipes, most of them prose, two of
 * them written for Remotion (deleted), and a bot could name any of them in a
 * brief while rendering none. One factory (docs/plans/STUDIO_ONE_FACTORY.md)
 * makes a technique selectable only when it exists:
 *
 *   - every technique has a known category, a kind (code | prompt | process),
 *     a status (ready | planned), a tier (signature | base: Matt 2026-10-14,
 *     every film runs at least one ready signature technique) and a recipe file;
 *   - a READY or APPROVED code technique names its lib/studio module and the
 *     test that holds it, and both files exist;
 *   - an APPROVED technique carries approved_by "matt", approved_on (an ISO
 *     date) and reel (the showcase render Matt saw). Nothing is approved by
 *     an agent: Matt approves after watching the reel (Matt 2026-10-14);
 *   - a PLANNED technique names its home, so the idea has a place to land
 *     (video_gate refuses planned techniques in a brief);
 *   - every category is one video:check knows (lib/studio/qa/thresholds.ts);
 *   - no recipe file sits outside the registry, and no recipe tells a bot to
 *     use Remotion.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TECH_DIR = '.claude/skills/ryan-studio/techniques'
const KINDS = ['code', 'prompt', 'process']
/** planned (an idea with a home) -> ready (code + test, built) -> approved (Matt saw its showcase reel and said yes). */
const STATUSES = ['planned', 'ready', 'approved']
/** signature: the visible craft from the research; base: spine and polish. */
export const TIERS = ['signature', 'base']

/** The categories video:check accepts, read from its own source so the two cannot drift. */
export function checkCategories(thresholdsSource) {
  const m = thresholdsSource.match(/TECHNIQUE_CATEGORIES\s*=\s*\[([^\]]*)\]/)
  if (!m) return null
  return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1])
}

/**
 * Pure: problems with a registry. `exists(path)` answers for repo-relative
 * paths; `recipeFiles` are the .md names in the techniques folder;
 * `readRecipe(name)` returns a recipe's text.
 */
export function registryProblems({ registry, knownCategories, exists, recipeFiles, readRecipe }) {
  const problems = []
  const techniques = registry && typeof registry === 'object' ? registry.techniques : null
  if (!techniques || typeof techniques !== 'object') return ['registry.json has no "techniques" object']
  const declared = registry.categories && typeof registry.categories === 'object' ? Object.keys(registry.categories) : []
  if (!knownCategories) problems.push('could not read TECHNIQUE_CATEGORIES from lib/studio/qa/thresholds.ts')
  for (const c of declared) {
    if (knownCategories && !knownCategories.includes(c)) problems.push(`category "${c}" is not one video:check knows (lib/studio/qa/thresholds.ts)`)
  }
  const files = new Set()
  for (const [name, t] of Object.entries(techniques)) {
    const where = `technique "${name}"`
    if (!t || typeof t !== 'object') {
      problems.push(`${where} is not an object`)
      continue
    }
    if (!declared.includes(t.category)) problems.push(`${where}: category "${t.category}" is not in registry.categories`)
    if (!KINDS.includes(t.kind)) problems.push(`${where}: kind "${t.kind}" must be one of ${KINDS.join(', ')}`)
    if (!STATUSES.includes(t.status)) problems.push(`${where}: status "${t.status}" must be one of ${STATUSES.join(', ')}`)
    if (t.tier === undefined) problems.push(`${where}: no tier (one of ${TIERS.join(', ')})`)
    else if (!TIERS.includes(t.tier)) problems.push(`${where}: tier "${t.tier}" must be one of ${TIERS.join(', ')}`)
    if (typeof t.file !== 'string' || !t.file) problems.push(`${where}: no recipe file`)
    else {
      files.add(t.file)
      if (!recipeFiles.includes(t.file)) problems.push(`${where}: recipe ${t.file} does not exist`)
    }
    if (t.status === 'approved') {
      if (t.approved_by !== 'matt') problems.push(`${where} is approved but approved_by is ${JSON.stringify(t.approved_by ?? null)}, not "matt"`)
      if (!(typeof t.approved_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.approved_on) && !Number.isNaN(Date.parse(t.approved_on)))) problems.push(`${where} is approved with no approved_on ISO date (YYYY-MM-DD)`)
      if (!(typeof t.reel === 'string' && t.reel.trim())) problems.push(`${where} is approved with no reel (the path or URL of the showcase render Matt saw)`)
    } else if (t.approved_by !== undefined || t.approved_on !== undefined) {
      problems.push(`${where} carries approval fields but its status is "${t.status}"`)
    }
    if ((t.status === 'ready' || t.status === 'approved') && t.kind === 'code') {
      if (!t.module || !exists(t.module)) problems.push(`${where} is ready but its module ${t.module ?? '(none)'} does not exist`)
      if (!t.test || !exists(t.test)) problems.push(`${where} is ready but its test ${t.test ?? '(none)'} does not exist`)
    }
    if (t.status === 'planned' && !(typeof t.home === 'string' && t.home.trim())) {
      problems.push(`${where} is planned with no "home" naming where its code will live`)
    }
  }
  for (const f of recipeFiles) {
    if (!files.has(f)) problems.push(`recipe ${f} has no registry entry`)
    const text = readRecipe(f)
    for (const line of text.split('\n')) {
      if (/remotion/i.test(line) && !/(gone|retired|deleted)/i.test(line)) {
        problems.push(`recipe ${f} tells a bot to use Remotion, which is deleted: "${line.trim().slice(0, 80)}"`)
      }
    }
  }
  return problems
}

function main() {
  const dir = join(ROOT, TECH_DIR)
  const registry = JSON.parse(readFileSync(join(dir, 'registry.json'), 'utf8'))
  const knownCategories = checkCategories(readFileSync(join(ROOT, 'lib/studio/qa/thresholds.ts'), 'utf8'))
  const recipeFiles = readdirSync(dir).filter((f) => f.endsWith('.md'))
  const problems = registryProblems({
    registry,
    knownCategories,
    exists: (p) => existsSync(join(ROOT, p)),
    recipeFiles,
    readRecipe: (f) => readFileSync(join(dir, f), 'utf8'),
  })
  const entries = Object.values(registry.techniques)
  const ready = entries.filter((t) => t.status === 'ready' || t.status === 'approved').length
  const approved = entries.filter((t) => t.status === 'approved').length
  const signatures = entries.filter((t) => t.tier === 'signature' && t.status === 'approved').length
  if (problems.length) {
    console.error('ci:studio-techniques FAILED\n')
    for (const p of problems) console.error(`  - ${p}`)
    console.error(`\nFix the registry (${TECH_DIR}/registry.json) or build the code. A technique is on the menu only when it is real.`)
    process.exit(1)
  }
  console.log(`✓ ci:studio-techniques: ${entries.length} techniques, ${ready} built (${approved} approved, ${signatures} of them signature), ${entries.length - ready} planned; every built code technique has its module and test, every technique a tier.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
