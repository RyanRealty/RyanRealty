#!/usr/bin/env node
/**
 * check-content-rules.mjs - ci:content-rules (G84). The content process's one rules
 * file stays honest (docs/plans/CONTENT_PROCESS.md, "Rules live in one file").
 *
 * lib/content/process/rules.ts holds every rule with a stable ID, the step that
 * first enforces it, the code that refuses, and a fixture that breaks it; lib/content/process/rules.test.ts
 * proves every enforced rule refuses at its step on its own fixture. This gate holds the file itself:
 *
 *  R1  every rule has an ID of the form R-001, no ID twice, and every ID in the committed
 *      baseline (rules.baseline.json) is still there. IDs are never removed or reused: a
 *      retired rule stays, with status "retired".
 *  R2  an enforced rule names an enforcer (a module that exists and a value it exports, read
 *      off the TypeScript AST), a fixture file under lib/content/process/fixtures/ that exists
 *      and names this rule and its step, and a fixtureMatch that is a regex. A planned rule
 *      names the build-order step that will enforce it. No fixture is shared, none is stray.
 *  R3  the ratchet. rules.baseline.json holds, per number a rule holds, the last value Matt
 *      approved. A reading LOOSER than the baseline fails; a tighter one passes and is printed
 *      as "tightened" (the daily digest reads this later). A video type that sets its own value
 *      is held to it, and a new type is held to the default. A number that disappears, or a rule
 *      that now holds another number, is a loosening. Updating the baseline to a looser value
 *      needs `Approved-by: matt` and `Rule-loosened: R-xxx` in the commit message
 *      (scripts/check-rule-loosening.mjs, commit-msg).
 *  R4  every number the factory holds (QA_THRESHOLDS, the job caps, video_types.json) belongs to
 *      some rule's threshold, or is listed in rules.ts UNRATCHETED with the reason. A number no
 *      rule owns could loosen without the ratchet seeing it.
 *
 * Usage: node scripts/check-content-rules.mjs [--report] [--json] [--write-baseline]
 *   --report          print the findings, always exit 0
 *   --json            machine-readable
 *   --write-baseline  record today's numbers (IDs only ever grow); a looser number written here
 *                     still needs the commit trailers
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const BASELINE = 'lib/content/process/rules.baseline.json'
export const FIXTURE_DIR = 'lib/content/process/fixtures'
export const ID_FORM = /^R-\d{3}$/
export const STATUSES = ['enforced', 'planned', 'retired']
export const STEPS = ['brief', 'voice', 'stills', 'board', 'animatic', 'motion', 'master', 'certify', 'approve']
export const DELIVERABLES = ['video', 'still', 'carousel', 'post_copy', 'paid_ad']
export const PLANNED_IN = ['process core', 'certifier', 'doors', 'judge', 'library']

/** The values a TypeScript or JavaScript module exports, read off its AST. A type, an interface and `export *` are not values. */
export function exportedNames(file) {
  const text = readFileSync(file, 'utf8')
  const kind = /\.(m?js|cjs)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
  const names = new Set()
  const bindingNames = (name) => {
    if (ts.isIdentifier(name)) names.add(name.text)
    else for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindingNames(el.name)
  }
  for (const st of sf.statements) {
    const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) ?? [] : []
    if (mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) names.add('default')
      if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) bindingNames(d.name)
      else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) && st.name) names.add(st.name.text)
    }
    if (ts.isExportDeclaration(st) && !st.isTypeOnly && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const el of st.exportClause.elements) if (!el.isTypeOnly) names.add(el.name.text)
    }
    if (ts.isExportAssignment(st)) names.add('default')
  }
  return names
}

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const fmt = (v) => (Array.isArray(v) ? `[${v.join(', ')}]` : String(v))

/**
 * Judge the rules. Pure: everything it reads comes in through `input`.
 *  rules       the RULES array
 *  baseline    the parsed rules.baseline.json, or null when there is none
 *  resolved    { 'R-004': { spec, resolved } } for every threshold, or { error } for one that does not resolve
 *  currentTypes the video types video_types.json lists
 *  unowned     numbers no rule owns (threshold-path unownedNumbers)
 *  files       { exists(rel), exportsOf(rel), json(rel), strayFixtures: string[] }
 *  compareResolved   from lib/content/process/threshold-path.ts
 */
export function evaluate(input) {
  const { rules, baseline, resolved, currentTypes, unowned, files, compareResolved } = input
  const problems = []
  const tightened = []
  const fail = (m) => problems.push(m)

  // R1: IDs.
  const seen = new Set()
  rules.forEach((r, i) => {
    const label = typeof r?.id === 'string' ? r.id : `rule #${i + 1}`
    if (typeof r?.id !== 'string' || !ID_FORM.test(r.id)) return fail(`${label} has no ID of the form R-001`)
    if (seen.has(r.id)) fail(`${r.id} appears twice (an ID is never reused)`)
    seen.add(r.id)
  })
  for (const id of baseline?.ids ?? []) if (!seen.has(id)) fail(`${id} is in the committed baseline and has disappeared from rules.ts (IDs are never removed: retire a rule with status "retired")`)

  for (const r of rules) {
    if (typeof r?.id !== 'string' || !ID_FORM.test(r.id)) continue
    const at = (m) => fail(`${r.id}: ${m}`)
    if (!STATUSES.includes(r.status)) at(`status is ${JSON.stringify(r.status)}, not one of ${STATUSES.join(', ')}`)
    if (typeof r.title !== 'string' || r.title.trim() === '') at('has no title')
    if (typeof r.source !== 'string' || r.source.trim() === '') at('has no source')
    if (!STEPS.includes(r.step)) at(`step is ${JSON.stringify(r.step)}, not one of ${STEPS.join(', ')}`)
    if (!Array.isArray(r.appliesTo) || r.appliesTo.length === 0 || r.appliesTo.some((d) => !DELIVERABLES.includes(d))) at(`appliesTo must name deliverables from ${DELIVERABLES.join(', ')}`)

    // R2: enforced and planned.
    if (r.status === 'enforced') {
      const e = r.enforcer
      if (!isObj(e) || typeof e.module !== 'string' || typeof e.export !== 'string' || !e.module || !e.export) at('is enforced but names no enforcer { module, export }')
      else if (isAbsolute(e.module) || e.module.split(/[\\/]/).includes('..')) at(`enforcer module ${e.module} must be a path inside the repository`)
      else if (!files.exists(e.module)) at(`enforcer module ${e.module} does not exist`)
      else if (!files.exportsOf(e.module)?.has(e.export)) at(`enforcer ${e.module} does not export ${e.export}`)
      if (typeof r.fixture !== 'string' || !r.fixture) at('is enforced but names no fixture')
      else if (!r.fixture.startsWith(`${FIXTURE_DIR}/`) || !r.fixture.endsWith('.json') || r.fixture.slice(FIXTURE_DIR.length + 1).includes('/')) at(`fixture ${r.fixture} must be a .json file directly under ${FIXTURE_DIR}/`)
      else if (!files.exists(r.fixture)) at(`fixture ${r.fixture} does not exist`)
      else {
        let fx = null
        try {
          fx = files.json(r.fixture)
        } catch (err) {
          at(`fixture ${r.fixture} is not JSON (${err.message})`)
        }
        if (fx && fx.rule !== r.id) at(`fixture ${r.fixture} names rule ${JSON.stringify(fx.rule)}, not ${r.id}`)
        if (fx && fx.step !== r.step) at(`fixture ${r.fixture} names step ${JSON.stringify(fx.step)}, not ${r.step}`)
      }
      if (typeof r.fixtureMatch !== 'string' || !r.fixtureMatch) at('is enforced but has no fixtureMatch (the regex its refusal must match)')
      else {
        try {
          new RegExp(r.fixtureMatch, 'i')
        } catch (err) {
          at(`fixtureMatch is not a regex (${err.message})`)
        }
      }
    }
    if (r.status === 'planned' && !PLANNED_IN.includes(r.plannedIn)) at(`is planned but plannedIn is ${JSON.stringify(r.plannedIn)}; name the build-order step: ${PLANNED_IN.join(', ')}`)
  }

  const byFixture = new Map()
  for (const r of rules) if (r?.status === 'enforced' && typeof r.fixture === 'string') byFixture.set(r.fixture, [...(byFixture.get(r.fixture) ?? []), r.id])
  for (const [file, ids] of byFixture) if (ids.length > 1) fail(`${file} is the fixture of ${ids.join(' and ')}: each enforced rule needs a fixture of its own`)
  for (const stray of files.strayFixtures) if (!byFixture.has(`${FIXTURE_DIR}/${stray}`)) fail(`${FIXTURE_DIR}/${stray} belongs to no enforced rule`)

  // R3: the ratchet.
  for (const [key, entry] of Object.entries(resolved)) if (entry.error) fail(`${key}: ${entry.error}`)
  const base = baseline?.thresholds ?? {}
  for (const [key, b] of Object.entries(base)) {
    const cur = resolved[key]
    const id = key.split('#')[0]
    if (!cur || cur.error) {
      if (!cur) fail(`${key} (${b.source}:${b.path}) is no longer held by ${id}: a number that disappears is loosened, and needs Matt (Approved-by: matt, Rule-loosened: ${id})`)
      continue
    }
    if (cur.spec.source !== b.source || cur.spec.path !== b.path || cur.spec.tighterIs !== b.tighterIs) {
      fail(`${key} holds ${cur.spec.source}:${cur.spec.path} (${cur.spec.tighterIs} is tighter) but the baseline has ${b.source}:${b.path} (${b.tighterIs} is tighter): another number is a loosening, and needs Matt (Rule-loosened: ${id})`)
      continue
    }
    const types = b.path.startsWith('defaults.') ? currentTypes : []
    for (const f of compareResolved({ value: b.value, ...(b.perType ? { perType: b.perType } : {}) }, cur.resolved, cur.spec.tighterIs, types)) {
      const line = `${key} ${b.source}:${b.path}${f.where === 'value' ? '' : ` for ${f.where}`}: ${fmt(f.baseline)} -> ${f.current === undefined ? 'gone' : fmt(f.current)}`
      if (f.comparison === 'looser') fail(`${line} is LOOSER than the number Matt approved (${cur.spec.tighterIs} is tighter); a looser number needs Approved-by: matt and Rule-loosened: ${id} in the commit that changes the baseline`)
      else tightened.push(`${line} (tightened)`)
    }
  }
  for (const key of Object.keys(resolved)) if (!resolved[key].error && !base[key]) fail(`${key} holds a number with no baseline value: record it with node scripts/check-content-rules.mjs --write-baseline`)

  // R4: every number has an owner.
  for (const n of unowned) fail(`${n} is a number the factory holds that no rule's threshold names (a number like that could loosen unseen): give a rule that threshold, or list it in UNRATCHETED with the reason`)

  return { problems, tightened }
}

/** The baseline for today's numbers. IDs only ever grow. */
export function nextBaseline(rules, resolved, previous) {
  const ids = [...new Set([...(previous?.ids ?? []), ...rules.map((r) => r.id)])].sort()
  const thresholds = {}
  for (const [key, e] of Object.entries(resolved)) {
    if (e.error) continue
    thresholds[key] = { source: e.spec.source, path: e.spec.path, tighterIs: e.spec.tighterIs, value: e.resolved.value, ...(e.resolved.perType ? { perType: e.resolved.perType } : {}) }
  }
  return {
    version: 1,
    _doc: 'The last value Matt approved for every number a rule holds, and every rule ID ever issued. A looser number needs `Approved-by: matt` and `Rule-loosened: R-xxx` in the commit message (scripts/check-rule-loosening.mjs). IDs are never removed. Re-record with: node scripts/check-content-rules.mjs --write-baseline',
    ids,
    thresholds,
  }
}

async function loadReal(root) {
  // The files are TypeScript. Plain Node reads them only from 22.18 (type stripping); CI's
  // gates job runs Node 20, which throws ERR_UNKNOWN_FILE_EXTENSION. So every Node reads them
  // the same way, through the repo's tsx (tsImport), and Node 22 proves what Node 20 runs.
  const { tsImport } = await import('tsx/esm/api')
  const load = (rel) => tsImport(pathToFileURL(join(root, rel)).href, import.meta.url)
  const [{ RULES, CAPS, UNRATCHETED }, tp, th] = await Promise.all([
    load('lib/content/process/rules.ts'),
    load('lib/content/process/threshold-path.ts'),
    load('lib/studio/qa/thresholds.ts'),
  ])
  const vt = th.loadVideoTypes()
  const data = tp.buildThresholdData({ qa: th.QA_THRESHOLDS, extraBannedPhrases: th.EXTRA_BANNED_PHRASES, requiredTechniqueCategories: th.REQUIRED_TECHNIQUE_CATEGORIES, caps: CAPS, videoTypes: vt })
  const resolved = {}
  for (const rule of RULES) {
    tp.thresholdsOf(rule).forEach((spec, i) => {
      const key = tp.thresholdKey(rule.id, i)
      try {
        resolved[key] = { spec, resolved: tp.resolveThreshold(spec, data) }
      } catch (e) {
        resolved[key] = { spec, error: e.message }
      }
    })
  }
  const exportsCache = new Map()
  const fixtureDir = join(root, FIXTURE_DIR)
  const files = {
    exists: (rel) => existsSync(join(root, rel)),
    exportsOf: (rel) => {
      if (!exportsCache.has(rel)) exportsCache.set(rel, exportedNames(join(root, rel)))
      return exportsCache.get(rel)
    },
    json: (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8')),
    strayFixtures: existsSync(fixtureDir) ? readdirSync(fixtureDir).filter((f) => /^R-\d{3}\.json$/.test(f)) : [],
  }
  const baselinePath = join(root, BASELINE)
  return {
    rules: RULES,
    baseline: existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : null,
    resolved,
    currentTypes: Object.keys(vt.types),
    unowned: tp.unownedNumbers(data, RULES, UNRATCHETED),
    files,
    compareResolved: tp.compareResolved,
    thresholdsOf: tp.thresholdsOf,
    thresholdKey: tp.thresholdKey,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const input = await loadReal(ROOT)
  if (args.includes('--write-baseline')) {
    const next = nextBaseline(input.rules, input.resolved, input.baseline)
    writeFileSync(join(ROOT, BASELINE), `${JSON.stringify(next, null, 2)}\n`)
    const { problems } = evaluate({ ...input, baseline: next })
    const loosened = evaluate(input).problems.filter((p) => /LOOSER/.test(p))
    console.log(`Recorded ${Object.keys(next.thresholds).length} numbers and ${next.ids.length} rule IDs in ${BASELINE}.`)
    if (loosened.length) {
      console.log('These are LOOSER than the committed baseline: the commit needs `Approved-by: matt` and a `Rule-loosened: R-xxx` line for each rule:')
      for (const l of loosened) console.log(`  ${l.split(' is LOOSER')[0]}`)
    }
    if (problems.length) {
      for (const p of problems) console.log(`  ${p}`)
      process.exit(1)
    }
    return
  }
  const { problems, tightened } = evaluate(input)
  const enforced = input.rules.filter((r) => r.status === 'enforced').length
  const planned = input.rules.filter((r) => r.status === 'planned').length
  if (args.includes('--json')) {
    console.log(JSON.stringify({ pass: problems.length === 0, rules: input.rules.length, enforced, planned, problems, tightened }, null, 2))
  } else {
    for (const t of tightened) console.log(`tightened: ${t}`)
    if (problems.length === 0) {
      console.log(`ci:content-rules OK: ${input.rules.length} rules (${enforced} enforced, ${planned} planned), ${Object.keys(input.resolved).length} numbers held to the baseline${tightened.length ? `, ${tightened.length} tightened (record with --write-baseline)` : ''}.`)
    } else {
      console.error(`ci:content-rules FAILED: ${problems.length} problem(s)`)
      for (const p of problems) console.error(`  - ${p}`)
      console.error('\nlib/content/process/rules.ts is the one rules file (docs/plans/CONTENT_PROCESS.md). See docs/MECHANICAL_GATES.md G84.')
    }
  }
  if (problems.length && !args.includes('--report')) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main()
