#!/usr/bin/env node
/**
 * taste-table.mjs — the taste table as a standing instrument (SITE-51).
 *
 * Matt, 2026-09-09: "how do we actually get a better looking site through this
 * process." The 2026-09-08 table (`design_system/public/taste-table.json`)
 * was a one-off: 24 captures through `take-route-shots.mjs` into a scratch
 * directory, three ad-hoc evaluator workflows, and a hand-assembled table.
 * This is that made into a tool that runs on demand and on a cadence.
 *
 * For every public `ui_kits/<class>/parity.json` class named in
 * `design_system/public/taste-classes.json` (the ONLY source of a class's
 * URL — this tool never guesses one for a dynamic route):
 *
 *   1. Capture the first viewport at 1440 and 375 via `take-route-shots.mjs`
 *      into a SCRATCH run directory (`.taste-table/<ISO timestamp>/` by
 *      default) — never `design_system/ryan-realty/ui_kits/`, so no route's
 *      committed receipt is ever disturbed by this tool.
 *   2. Run ONE separate evaluator per class, on the instrument the route
 *      receipts use (`claude-sonnet-5`, rubric `v1-2026-09-08`,
 *      `design_system/public/taste-evaluator.v1-2026-09-08.md`), three
 *      independent scorings, the median.
 *   3. Write `design_system/public/taste-table.json` (sorted median
 *      ascending) and regenerate the "Taste table" markdown block in
 *      `docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md` from it.
 *
 * Usage:
 *   node scripts/taste-table.mjs <baseUrl> [--classes a,b] [--shots-only]
 *       [--evaluate-only <runDir>] [--repeat] [--dry-run]
 *       [--diff[=previous.json]]
 *   node scripts/taste-table.mjs --diff                # standalone: working file vs HEAD's
 *   node scripts/taste-table.mjs --seed-draft[=table.json]
 *       # SITE-62: DRAFT seeds for every class under 70. Not a write to
 *       # Supabase. A person edits scripts/seed-site-queue.ts then runs
 *       # `npx tsx scripts/seed-site-queue.ts`.
 *
 * Transport: the Anthropic SDK directly (`@anthropic-ai/sdk` — the repo's own
 * `createAnthropic()` in lib/ai/anthropic.ts is TypeScript and cannot be
 * imported from a plain .mjs script) when `ANTHROPIC_API_KEY` is set;
 * otherwise the `claude` CLI on PATH, told to Read the two screenshots.
 * Both use model `claude-sonnet-5` — a different model from whatever built
 * the page classes (recorded per-row as `builderModel`, read off each route
 * file's last commit's `Co-Authored-By:` trailer).
 *
 * Exit codes: 0 clean; 1 usage/registry/IO error; 2 at least one row could
 * not be validated (recorded with `row.invalid`, per-class, run continues).
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import Anthropic from '@anthropic-ai/sdk'
import {
  FINISH_LINE,
  RUBRIC_VERSION,
  buildRow,
  buildSeedDrafts,
  builderModelFromCommitBody,
  collectUsedVersionGaps,
  computeDiff,
  droppedClasses,
  filterClasses,
  formatSeedDrafts,
  isNonEmptyString,
  isPlainObject,
  loadClassRegistry,
  regenerateMarkdownSection,
  renderMarkdownTable,
  sameModelWarning,
} from './lib/taste-table-core.mjs'

const REPO_ROOT = process.cwd()
const CLASS_REGISTRY_PATH = 'design_system/public/taste-classes.json'
const TABLE_PATH = 'design_system/public/taste-table.json'
const E2E_DOC_PATH = 'docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md'
const PROMPT_PATH = 'design_system/public/taste-evaluator.v1-2026-09-08.md'
const TAKE_ROUTE_SHOTS = 'scripts/take-route-shots.mjs'
// THE ONE INSTRUMENT (Matt 2026-09-09: "default to always having Grok 4.6 do the
// evaluation preferably always using the subscription tokens"). The judge belongs to
// the repo, not to whoever built the page: scripts/taste-evaluate.ts uses this same
// model and transport, so a table mark and a route receipt come off one ruler. The
// grok CLI spends Matt's Grok subscription; the SDK path bills per token. A Grok lane
// BUILDS with grok-4.5 so ci:taste-canon's evaluatorModel != builderModel still holds.
// Switching from claude-sonnet-5 rebaselines every class once.
const EVALUATOR_MODEL = 'grok-4.6'
const GROK_CLI = process.env.GROK_CLI ?? `${process.env.HOME}/.grok/bin/grok`
const SCORINGS_PER_CLASS = 3

// ---------------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------------

export function parseArgv(argv) {
  const opts = {
    baseUrl: null,
    classesCsv: null,
    shotsOnly: false,
    evaluateOnlyDir: null,
    repeat: false,
    dryRun: false,
    diff: false,
    diffPath: null,
    api: false,
    claude: false,
    seedDraft: false,
    seedDraftPath: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--api') opts.api = true
    else if (a === '--claude') opts.claude = true
    else if (a === '--classes') opts.classesCsv = argv[++i] ?? null
    else if (a.startsWith('--classes=')) opts.classesCsv = a.slice('--classes='.length)
    else if (a === '--shots-only') opts.shotsOnly = true
    else if (a === '--evaluate-only') opts.evaluateOnlyDir = argv[++i] ?? null
    else if (a.startsWith('--evaluate-only=')) opts.evaluateOnlyDir = a.slice('--evaluate-only='.length)
    else if (a === '--repeat') opts.repeat = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--diff') {
      opts.diff = true
      // `--diff <path.json>` is accepted; a bare `--diff` before the baseUrl
      // or at the end of argv stays valueless (SITE-51: "`--diff` alone
      // compares the working file to HEAD's").
      const next = argv[i + 1]
      if (isNonEmptyString(next) && next.endsWith('.json')) {
        opts.diffPath = next
        i += 1
      }
    } else if (a.startsWith('--diff=')) {
      opts.diff = true
      opts.diffPath = a.slice('--diff='.length) || null
    } else if (a === '--seed-draft') {
      opts.seedDraft = true
      const next = argv[i + 1]
      if (isNonEmptyString(next) && next.endsWith('.json')) {
        opts.seedDraftPath = next
        i += 1
      }
    } else if (a.startsWith('--seed-draft=')) {
      opts.seedDraft = true
      opts.seedDraftPath = a.slice('--seed-draft='.length) || null
    } else if (a.startsWith('--')) {
      throw new Error(`unknown option ${a}`)
    } else if (opts.baseUrl === null) {
      opts.baseUrl = a
    } else {
      throw new Error(`unexpected extra argument "${a}"`)
    }
  }
  return opts
}

// ---------------------------------------------------------------------------
// small IO helpers
// ---------------------------------------------------------------------------

function readJson(path) {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'))
}

function loadRegistry() {
  const raw = readJson(CLASS_REGISTRY_PATH)
  const list = Array.isArray(raw) ? raw : raw?.classes
  const { classes, problems } = loadClassRegistry(list)
  return { classes, problems }
}

function loadCurrentTable() {
  const path = join(REPO_ROOT, TABLE_PATH)
  if (!existsSync(path)) return { evaluatedAt: null, baseUrl: null, instrument: null, rows: [] }
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  return {
    evaluatedAt: parsed.evaluatedAt ?? null,
    baseUrl: parsed.baseUrl ?? null,
    instrument: parsed.instrument ?? null,
    rows: Array.isArray(parsed.rows) ? parsed.rows : [],
  }
}

/** Default: `git show HEAD:design_system/public/taste-table.json`. */
function loadPreviousTable(explicitPath) {
  if (explicitPath) {
    return JSON.parse(readFileSync(resolve(REPO_ROOT, explicitPath), 'utf8'))
  }
  const res = spawnSync('git', ['show', `HEAD:${TABLE_PATH}`], { cwd: REPO_ROOT, encoding: 'utf8' })
  if (res.status !== 0) {
    throw new Error(`could not read HEAD:${TABLE_PATH} — ${(res.stderr || '').trim() || 'git show failed'}`)
  }
  return JSON.parse(res.stdout)
}

function isoTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// capture — take-route-shots.mjs, into the scratch run dir ONLY
// ---------------------------------------------------------------------------

function captureClass(cls, baseUrl, runDir) {
  const outDir = join(runDir, cls.key)
  mkdirSync(outDir, { recursive: true })
  const url = new URL(cls.url, baseUrl).toString()
  const res = spawnSync(process.execPath, [TAKE_ROUTE_SHOTS, cls.key, url, '--out', outDir], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  })
  return { ok: res.status === 0, outDir, url }
}

function shotPathsFor(runDir, key) {
  const outDir = join(runDir, key)
  return {
    desktopPath: join(REPO_ROOT, outDir, 'desktop.png'),
    mobilePath: join(REPO_ROOT, outDir, 'mobile375.png'),
    desktopRel: `${key}/desktop.png`,
    mobileRel: `${key}/mobile375.png`,
  }
}

// ---------------------------------------------------------------------------
// evaluator — two transports behind one function
// ---------------------------------------------------------------------------

/** Strip a fenced code block if present, then take the first {...} span. Tolerates a stray sentence around the JSON. */
export function parseEvaluatorJson(text) {
  const raw = String(text ?? '')
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1] : raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}

function normalizeScoring(parsed) {
  if (!isPlainObject(parsed) || !Number.isInteger(parsed.score)) return { score: null }
  return {
    score: parsed.score,
    criteria: parsed.criteria,
    tells: Array.isArray(parsed.tells) ? parsed.tells : [],
    defects: Array.isArray(parsed.defects) ? parsed.defects : [],
    dullest: typeof parsed.dullest === 'string' ? parsed.dullest : '',
    beats: typeof parsed.beats === 'string' ? parsed.beats : '',
    verdict: typeof parsed.verdict === 'string' ? parsed.verdict : '',
  }
}

function buildPrompt({ key, route, url }, instrumentText) {
  return (
    `${instrumentText}\n\n---\n\n` +
    `Class: ${key}\nRoute file: ${route}\nURL captured: ${url}\n\n` +
    'The model that built this page is NOT you. You are a separate evaluator ' +
    'judging only the two screenshots — no code, no live browsing, no DOM.'
  )
}

async function scoreWithSdk(prompt, shots, apiKey) {
  const client = new Anthropic({ apiKey })
  const desktop = readFileSync(shots.desktopPath).toString('base64')
  const mobile = readFileSync(shots.mobilePath).toString('base64')
  const resp = await client.messages.create({
    model: EVALUATOR_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'text', text: 'Desktop screenshot (1440x900), first viewport:' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: desktop } },
          { type: 'text', text: 'Mobile screenshot (375x812), first viewport:' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: mobile } },
          { type: 'text', text: 'Reply with the JSON object only, per the contract above.' },
        ],
      },
    ],
  })
  return (resp.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

function scoreWithCli(prompt, shots) {
  const fullPrompt =
    `${prompt}\n\nRead these two files before scoring — do not guess from their names:\n` +
    `Desktop (1440x900): ${shots.desktopPath}\nMobile (375x812): ${shots.mobilePath}\n\n` +
    'Reply with the JSON object only, per the contract above.'
  const res = spawnSync(
    'claude',
    ['-p', fullPrompt, '--model', EVALUATOR_MODEL, '--output-format', 'json', '--allowedTools', 'Read'],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024, timeout: 240000 },
  )
  if (res.error) throw res.error
  if (res.status !== 0) {
    throw new Error(`claude CLI exited ${res.status}: ${(res.stderr || '').slice(0, 500)}`)
  }
  let wrapper
  try {
    wrapper = JSON.parse(res.stdout)
  } catch {
    throw new Error(`claude CLI did not return its --output-format json wrapper: ${res.stdout.slice(0, 300)}`)
  }
  if (wrapper.is_error) throw new Error(`claude CLI reported an error: ${JSON.stringify(wrapper).slice(0, 500)}`)
  return String(wrapper.result ?? '')
}

function scoreWithGrok(prompt, shots) {
  const fullPrompt =
    `${prompt}\n\nRead these two image files with your file tool and judge what is IN them — do not guess from their names:\n` +
    `Desktop (1440x900): ${shots.desktopPath}\nMobile (375x812): ${shots.mobilePath}\n\n` +
    'Reply with the JSON object only, no preamble and no code fence.'
  const res = spawnSync(
    GROK_CLI,
    ['-p', fullPrompt, '-m', EVALUATOR_MODEL, '--permission-mode', 'bypassPermissions', '--output-format', 'plain'],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900000 },
  )
  if (res.error) throw res.error
  if (res.status !== 0) throw new Error(`grok CLI exited ${res.status}: ${(res.stderr || '').slice(0, 500)}`)
  return String(res.stdout ?? '')
}

async function evaluateClass(cls, shots, { transport, apiKey, instrumentText }) {
  const scorings = []
  for (let i = 0; i < SCORINGS_PER_CLASS; i += 1) {
    const prompt = buildPrompt(cls, instrumentText)
    let text = ''
    try {
      text =
        transport === 'sdk'
          ? await scoreWithSdk(prompt, shots, apiKey)
          : transport === 'claude'
            ? scoreWithCli(prompt, shots)
            : scoreWithGrok(prompt, shots)
    } catch (err) {
      console.error(`  ${cls.key}: scoring ${i + 1}/${SCORINGS_PER_CLASS} failed — ${err.message}`)
    }
    scorings.push(normalizeScoring(parseEvaluatorJson(text)))
  }
  return scorings
}

// ---------------------------------------------------------------------------
// builder model — the route file's last commit
// ---------------------------------------------------------------------------

function builderModelForRoute(route) {
  const res = spawnSync('git', ['log', '-1', '--format=%B', '--', route], { cwd: REPO_ROOT, encoding: 'utf8' })
  return builderModelFromCommitBody(res.status === 0 ? res.stdout : '')
}

// ---------------------------------------------------------------------------
// printing
// ---------------------------------------------------------------------------

function printDiff(diffRows, dropped) {
  console.log(`\n--diff (median change vs previous table, ${FINISH_LINE} is the finish line)`)
  for (const d of diffRows) {
    const prev = d.prevMedian === null ? '—' : String(d.prevMedian)
    const change = d.change === null ? 'new' : d.change > 0 ? `+${d.change}` : `${d.change}`
    const marker = d.marker ? ` ${d.marker}` : ''
    console.log(`  ${d.key.padEnd(24)} ${prev.padStart(4)} -> ${String(d.median).padStart(4)}  (${change})${marker}`)
  }
  if (dropped.length) console.log(`  no longer on this table: ${dropped.join(', ')}`)
}

function printCandidates(rows) {
  const under = rows
    .filter((r) => Number.isInteger(r.median) && r.median < FINISH_LINE)
    .slice()
    .sort((a, b) => a.median - b.median)
  const scoredRows = rows.filter((r) => Number.isInteger(r.median))
  console.log(`\nCandidates under ${FINISH_LINE} for the next round (bottom first):`)
  if (scoredRows.length === 0) {
    console.log('  UNKNOWN — no class scored in this run, so this says nothing about the site.')
  } else if (under.length === 0) {
    const unscored = rows.length - scoredRows.length
    console.log(`  none — all ${scoredRows.length} scored classes are at or above the finish line${unscored ? `, but ${unscored} did not score and are unknown` : ''}.`)
  }
  for (const r of under) console.log(`  ${r.key} — ${r.median}`)
}

// ---------------------------------------------------------------------------
// --seed-draft — SITE-62: table → DRAFT seeds. Never a Supabase write.
// ---------------------------------------------------------------------------

const SEED_FILE = 'scripts/seed-site-queue.ts'

/**
 * Optional read of loop_work_nodes.version_gap so a node that exists in the
 * graph but not yet in SEEDS (this round's SITE-62) is not reissued. Native
 * fetch only — this file must not import supabase-js. Missing env → [].
 * Failures are warnings; the seed-file gaps still number the drafts.
 */
async function loadUsedGapsFromLoopWorkNodes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!isNonEmptyString(url) || !isNonEmptyString(key)) return []
  const endpoint = `${String(url).replace(/\/$/, '')}/rest/v1/loop_work_nodes?select=version_gap`
  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      console.error(`taste-table --seed-draft: loop_work_nodes read failed (${res.status}) — using seed-file gaps only`)
      return []
    }
    const rows = await res.json()
    return (Array.isArray(rows) ? rows : [])
      .map((r) => (isPlainObject(r) ? r.version_gap : null))
      .filter((g) => isNonEmptyString(g))
  } catch {
    console.error('taste-table --seed-draft: loop_work_nodes read failed — using seed-file gaps only')
    return []
  }
}

async function runSeedDraft(opts) {
  const tableRel = isNonEmptyString(opts.seedDraftPath) ? opts.seedDraftPath : TABLE_PATH
  const tableAbs = resolve(REPO_ROOT, tableRel)
  if (!existsSync(tableAbs)) {
    console.error(`taste-table --seed-draft: table not found at ${tableRel}`)
    process.exit(1)
  }
  let table
  try {
    table = JSON.parse(readFileSync(tableAbs, 'utf8'))
  } catch (err) {
    console.error(`taste-table --seed-draft: could not parse ${tableRel}: ${err.message}`)
    process.exit(1)
  }

  const seedAbs = join(REPO_ROOT, SEED_FILE)
  const usedFromFile = existsSync(seedAbs) ? collectUsedVersionGaps(readFileSync(seedAbs, 'utf8')) : []
  const usedFromDb = await loadUsedGapsFromLoopWorkNodes()
  const usedGaps = [...new Set([...usedFromFile, ...usedFromDb])]

  const { drafts, warnings } = buildSeedDrafts({ table, usedGaps, root: REPO_ROOT })
  for (const w of warnings) console.error(`taste-table --seed-draft: ${w}`)

  const text = formatSeedDrafts(drafts)
  process.stdout.write(text)

  // Scratchpad is optional and gitignored. Only the default table run writes
  // it, so a test pointing --seed-draft at a temp file does not touch it.
  if (!isNonEmptyString(opts.seedDraftPath)) {
    try {
      mkdirSync(join(REPO_ROOT, 'scratchpad'), { recursive: true })
      writeFileSync(join(REPO_ROOT, 'scratchpad/taste-table-seed-draft.ts'), text)
      console.error('wrote scratchpad/taste-table-seed-draft.ts (gitignored; DRAFT — not seeded)')
    } catch (err) {
      console.error(`taste-table --seed-draft: could not write scratchpad (${err.message})`)
    }
  }

  if (drafts.length === 0) {
    console.error(`taste-table --seed-draft: no class under ${FINISH_LINE} with a surviving defect.`)
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  let opts
  try {
    opts = parseArgv(process.argv.slice(2))
  } catch (err) {
    console.error(`taste-table: ${err.message}`)
    process.exit(1)
  }

  // ---- standalone --seed-draft: no capture, no evaluation, no Supabase write ----
  if (opts.seedDraft) {
    await runSeedDraft(opts)
    process.exit(0)
  }

  // ---- standalone --diff: no capture, no evaluation, just a report ----
  if (opts.diff && !opts.baseUrl && !opts.evaluateOnlyDir && !opts.dryRun) {
    const current = loadCurrentTable()
    let previous
    try {
      previous = loadPreviousTable(opts.diffPath)
    } catch (err) {
      console.error(`taste-table: ${err.message}`)
      process.exit(1)
    }
    const diffRows = computeDiff(previous.rows ?? [], current.rows ?? [])
    const dropped = droppedClasses(previous.rows ?? [], current.rows ?? [])
    printDiff(diffRows, dropped)
    process.exit(0)
  }

  const { classes: registry, problems: registryProblems } = loadRegistry()
  if (registryProblems.length) {
    console.error('taste-table: class registry problems:')
    for (const p of registryProblems) console.error(`  - ${p}`)
    if (registry.length === 0) process.exit(1)
  }

  const { subset: selected, missing } = filterClasses(registry, opts.classesCsv)
  if (missing.length) {
    console.error(`taste-table: unknown class(es) in --classes: ${missing.join(', ')}`)
    process.exit(1)
  }
  if (selected.length === 0) {
    console.error('taste-table: no classes selected.')
    process.exit(1)
  }

  // Default is the grok CLI on Matt's subscription. An ambient ANTHROPIC_API_KEY must
  // never silently flip billing or the ruler, so both alternatives are explicit flags.
  const transport = opts.api && process.env.ANTHROPIC_API_KEY ? 'sdk' : opts.claude ? 'claude' : 'grok'
  const runDir = opts.evaluateOnlyDir ?? join('.taste-table', isoTimestamp())

  if (opts.dryRun) {
    console.log('taste-table --dry-run (nothing was called)')
    console.log(`  classes (${selected.length}): ${selected.map((c) => c.key).join(', ')}`)
    console.log(`  runDir: ${runDir}${opts.evaluateOnlyDir ? ' (existing — --evaluate-only)' : ' (would be created)'}`)
    if (!opts.evaluateOnlyDir) console.log(`  baseUrl: ${opts.baseUrl ?? '(missing — required unless --evaluate-only)'}`)
    console.log(`  transport: ${transport} (${transport === 'sdk' ? 'ANTHROPIC_API_KEY is set' : 'ANTHROPIC_API_KEY is unset — falls back to the claude CLI'})`)
    console.log(`  shotsOnly: ${opts.shotsOnly}`)
    console.log(`  repeat: ${opts.repeat}`)
    console.log(`  diff: ${opts.diff}${opts.diffPath ? ` (against ${opts.diffPath})` : opts.diff ? ' (against HEAD)' : ''}`)
    process.exit(0)
  }

  if (!opts.evaluateOnlyDir) {
    if (!isNonEmptyString(opts.baseUrl)) {
      console.error('taste-table: a baseUrl is required unless --evaluate-only <runDir> is given.')
      process.exit(1)
    }
    mkdirSync(join(REPO_ROOT, runDir), { recursive: true })
    console.log(`taste-table — capturing ${selected.length} class(es) into ${runDir}\n`)
    let captureFailed = false
    for (const cls of selected) {
      const { ok } = captureClass(cls, opts.baseUrl, runDir)
      if (!ok) {
        captureFailed = true
        console.error(`  ${cls.key}: capture failed (see take-route-shots output above)`)
      }
    }
    writeFileSync(
      join(REPO_ROOT, runDir, 'run-meta.json'),
      `${JSON.stringify({ baseUrl: opts.baseUrl, capturedAt: new Date().toISOString(), classes: selected.map((c) => c.key) }, null, 2)}\n`,
    )
    if (opts.shotsOnly) {
      console.log(`\nshots-only run complete — ${runDir}`)
      process.exit(captureFailed ? 1 : 0)
    }
    if (captureFailed) {
      console.error('\ntaste-table: at least one capture failed; continuing to evaluate what did capture.')
    }
  }

  // ---- evaluate ----
  const apiKey = process.env.ANTHROPIC_API_KEY
  const instrumentText = readFileSync(join(REPO_ROOT, PROMPT_PATH), 'utf8')
  let runMeta = { baseUrl: opts.baseUrl, capturedAt: null }
  const metaPath = join(REPO_ROOT, runDir, 'run-meta.json')
  if (existsSync(metaPath)) {
    try {
      runMeta = { ...runMeta, ...JSON.parse(readFileSync(metaPath, 'utf8')) }
    } catch {
      /* best effort */
    }
  }
  const baseUrlForTable = runMeta.baseUrl ?? opts.baseUrl ?? 'unknown'

  console.log(`\ntaste-table — evaluating ${selected.length} class(es) via the ${transport} transport (${EVALUATOR_MODEL})\n`)

  const firstPassMedianByKey = new Map()
  const newRows = []
  let anyInvalid = false
  let anySameModel = false

  for (const cls of selected) {
    const shots = shotPathsFor(runDir, cls.key)
    if (!existsSync(shots.desktopPath) || !existsSync(shots.mobilePath)) {
      console.error(`  ${cls.key}: shots not found under ${runDir}/${cls.key}/ — skipping`)
      newRows.push({ key: cls.key, url: cls.url, route: cls.route, median: null, invalid: 'shots missing — capture (or point --evaluate-only at a run that has them) before scoring' })
      anyInvalid = true
      continue
    }
    console.log(`  ${cls.key} (${cls.url})`)
    const scorings = await evaluateClass(cls, shots, { transport, apiKey, instrumentText })
    const builderModel = builderModelForRoute(cls.route)
    const { row, problems } = buildRow({
      key: cls.key,
      url: cls.url,
      route: cls.route,
      scorings,
      builderModel,
      shots: { desktop: shots.desktopRel, mobile375: shots.mobileRel },
      root: REPO_ROOT,
    })
    if (problems.length) {
      anyInvalid = true
      console.error(`  ${cls.key}: INVALID — ${row.invalid}`)
    } else {
      console.log(`    median ${row.median} (${row.scores.join(' · ')})`)
    }
    const warning = sameModelWarning(row, EVALUATOR_MODEL)
    if (warning) {
      anySameModel = true
      console.error(`  WARNING: ${warning}`)
    }
    if (Number.isInteger(row.median)) firstPassMedianByKey.set(cls.key, row.median)
    newRows.push(row)
  }

  // ---- --repeat: a second evaluation pass on the SAME shots, for variance ----
  let variance = null
  if (opts.repeat) {
    console.log(`\ntaste-table --repeat — scoring the same shots a second time\n`)
    const deltas = []
    for (const cls of selected) {
      const shots = shotPathsFor(runDir, cls.key)
      if (!existsSync(shots.desktopPath) || !existsSync(shots.mobilePath)) continue
      const scorings = await evaluateClass(cls, shots, { transport, apiKey, instrumentText })
      const { median } = (() => {
        const scores = scorings.map((s) => s.score)
        const sorted = scores.every((n) => Number.isInteger(n)) ? [...scores].sort((a, b) => a - b) : null
        return { median: sorted ? sorted[1] : null }
      })()
      const first = firstPassMedianByKey.get(cls.key)
      if (Number.isInteger(median) && Number.isInteger(first)) {
        const delta = Math.abs(median - first)
        deltas.push(delta)
        console.log(`  ${cls.key}: pass1 ${first} vs pass2 ${median} (Δ${delta})`)
      } else {
        console.log(`  ${cls.key}: pass2 did not produce a comparable median (pass1 ${first ?? '—'}, pass2 ${median ?? '—'})`)
      }
    }
    variance = deltas.length ? Math.max(...deltas) : null
    console.log(`\n  instrument.variance = ${variance === null ? 'unmeasured (no comparable pair)' : variance}`)
  }

  // ---- merge into the full table, sort ascending ----
  const current = loadCurrentTable()
  const byKey = new Map(current.rows.map((r) => [r.key, r]))
  for (const row of newRows) byKey.set(row.key, row)
  const allRows = [...byKey.values()].sort((a, b) => {
    const am = Number.isInteger(a.median) ? a.median : Infinity
    const bm = Number.isInteger(b.median) ? b.median : Infinity
    return am - bm
  })

  const instrument = {
    evaluatorModel: EVALUATOR_MODEL,
    rubricVersion: RUBRIC_VERSION,
    scorings: SCORINGS_PER_CLASS,
    aggregate: 'median',
    shotSpec: {
      viewports: [1440, 375],
      capture: 'first viewport, scripts/take-route-shots.mjs default, scale 1, palette-quantized',
      states: ['default'],
    },
    promptFile: PROMPT_PATH,
    transport,
    variance,
  }

  const table = { evaluatedAt: today(), baseUrl: baseUrlForTable, instrument, rows: allRows }
  // 2026-09-09: a dead dev server made every capture fail, and the all-null table that
  // produced overwrote 25 real marks AND reported every class past the finish line. A run
  // that scored nothing does not get to replace one that scored everything, and no class
  // silently loses the mark the rise rule compares against.
  const scored = allRows.filter((r) => Number.isInteger(r.median))
  if (scored.length === 0) {
    console.error(`\ntaste-table: NOT writing ${TABLE_PATH} — no class scored; the previous table is intact.`)
    console.error('  Fix capture first (is the dev server actually serving baseUrl?), then re-run.')
    process.exit(2)
  }
  let lost = []
  try {
    const priorRows = loadPreviousTable(null).rows ?? []
    const priorByKey = new Map(priorRows.map((r) => [r.key, r]))
    lost = allRows
      .filter((r) => !Number.isInteger(r.median) && Number.isInteger(priorByKey.get(r.key)?.median))
      .map((r) => `${r.key} (had ${priorByKey.get(r.key).median})`)
  } catch {
    /* no previous table to protect */
  }
  if (lost.length) {
    console.error(`\ntaste-table: NOT writing ${TABLE_PATH} — these classes had a mark and did not score:`)
    for (const r of lost) console.error(`  ${r}`)
    console.error('  Re-run them with --classes, or --evaluate-only a run that has their shots.')
    process.exit(2)
  }
  writeFileSync(join(REPO_ROOT, TABLE_PATH), `${JSON.stringify(table, null, 1)}\n`)
  console.log(`\nwrote ${TABLE_PATH} (${allRows.length} rows, ${scored.length} scored)`)

  const block = renderMarkdownTable(allRows, { evaluatedAt: table.evaluatedAt, instrument })
  const docPath = join(REPO_ROOT, E2E_DOC_PATH)
  const docText = readFileSync(docPath, 'utf8')
  const nextDocText = regenerateMarkdownSection(docText, block)
  if (nextDocText !== docText) {
    writeFileSync(docPath, nextDocText)
    console.log(`updated ${E2E_DOC_PATH}`)
  } else {
    console.log(`${E2E_DOC_PATH} already matches (no change)`)
  }

  console.log(`\n${block}`)

  if (opts.diff) {
    let previous
    try {
      previous = loadPreviousTable(opts.diffPath)
    } catch (err) {
      console.error(`taste-table: ${err.message}`)
      previous = null
    }
    if (previous) {
      const diffRows = computeDiff(previous.rows ?? [], allRows)
      const dropped = droppedClasses(previous.rows ?? [], allRows)
      printDiff(diffRows, dropped)
    }
  }

  printCandidates(allRows)

  if (anySameModel) {
    console.error('\ntaste-table: evaluatorModel matched builderModel for at least one class (see WARNING lines above).')
  }
  if (anyInvalid) {
    console.error('\ntaste-table: at least one row is invalid — see INVALID lines above.')
    process.exit(2)
  }
  process.exit(0)
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && statSync(process.argv[1]).isFile() && process.argv[1].endsWith('taste-table.mjs')
  } catch {
    return false
  }
})()
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`taste-table: fatal — ${err?.stack || err}`)
    process.exit(1)
  })
}
