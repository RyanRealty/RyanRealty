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
 *      receipts use (the judge chain and rubric in
 *      `scripts/lib/taste-evaluate-result.mjs` — grok-4.6, falling back to
 *      the claude CLI when grok is missing or 402), three independent
 *      scorings, the median. Each row records the model that answered.
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
 * Transport: default is the grok CLI (subscription) with the claude CLI as
 * the fallback link; `--claude` skips straight to the claude CLI; `--api`
 * uses the Anthropic SDK directly (`@anthropic-ai/sdk` — the repo's own
 * `createAnthropic()` in lib/ai/anthropic.ts is TypeScript and cannot be
 * imported from a plain .mjs script) and bills per token. The judge is
 * always a different model from whatever built the page classes (recorded
 * per-row as `builderModel`, read off each route file's last commit's
 * `Co-Authored-By:` trailer); when any selected class was built by sonnet
 * the claude link uses opus.
 *
 * Exit codes: 0 clean; 1 usage/registry/IO error; 2 at least one row could
 * not be validated (recorded with `row.invalid`, per-class, run continues).
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import Anthropic from '@anthropic-ai/sdk'
import {
  classForRoute,
  evaluatorBrief,
  loadTasteCatalog,
} from './lib/taste-catalog.mjs'
import {
  EVALUATOR_MODEL,
  FALLBACK_EVALUATORS,
  RUBRIC_PATH,
  RUBRIC_VERSION,
  claudeCliFailure,
  claudeModelFromWrapper,
  grokCliFailure,
  grokFailureFallsBack,
  pickFallbackAlias,
} from './lib/taste-evaluate-result.mjs'
import {
  FINISH_LINE,
  buildRow,
  buildSeedDrafts,
  builderModelFromCommitBody,
  collectUsedVersionGaps,
  computeDiff,
  criteriaProblems,
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
// ONE RULER: the prompt file and rubric version come from taste-evaluate-result.mjs,
// the same module scripts/taste-evaluate.ts reads, so a table mark and a route
// receipt are the same instrument.
const PROMPT_PATH = RUBRIC_PATH
const TAKE_ROUTE_SHOTS = 'scripts/take-route-shots.mjs'
// THE RULER AND ITS FALLBACK (Matt 2026-09-09: "default to always having Grok 4.6 do
// the evaluation preferably always using the subscription tokens"; Matt 2026-09-12:
// "fix it all"). The judge belongs to the repo, not to whoever built the page. Link 1
// is grok-4.6 through the grok CLI (subscription; XAI_API_KEY stripped). When that
// CLI is missing or answers 402 — as it did for every fire from 2026-09-11 10:17 —
// link 2 is the claude CLI (subscription), sonnet unless the builder was sonnet.
// The table records the model that actually answered in instrument.evaluatorModel
// and per row, so a switch of link rebaselines once through the identity keys. A
// Grok lane BUILDS with grok-4.5 so evaluatorModel != builderModel still holds.
const GROK_CLI = process.env.GROK_CLI ?? `${process.env.HOME}/.grok/bin/grok`
const CLAUDE_CLI = process.env.CLAUDE_CLI ?? 'claude'
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

function catalogNoteFor(key) {
  const raw = JSON.parse(readFileSync(join(REPO_ROOT, 'design_system/public/taste-catalog.json'), 'utf8'))
  const loaded = loadTasteCatalog(raw)
  if (loaded.problems.length) {
    throw new Error(`taste-catalog: ${loaded.problems.join('; ')}`)
  }
  const classKey = classForRoute(loaded, key) ?? key
  return evaluatorBrief(loaded, classKey)
}

function buildPrompt({ key, route, url }, instrumentText) {
  const catalog = catalogNoteFor(key)
  return (
    `${instrumentText}\n\n---\n\n` +
    `Class: ${key}\nRoute file: ${route}\nURL captured: ${url}\n\n` +
    (catalog ? `${catalog}\n\n` : '') +
    'The model that built this page is NOT you. You are a separate evaluator ' +
    'judging only the two screenshots — no code, no live browsing, no DOM. ' +
    'A stacked-section page that ignored the catalog is a defect.'
  )
}

async function scoreWithSdk(prompt, shots, apiKey, model) {
  const client = new Anthropic({ apiKey })
  const desktop = readFileSync(shots.desktopPath).toString('base64')
  const mobile = readFileSync(shots.mobilePath).toString('base64')
  const resp = await client.messages.create({
    model,
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

/**
 * Link 2: the claude CLI. `alias` is sonnet|opus (never the builder). Returns
 * `{ text, model }` — the model the CLI actually answered with, off its wrapper.
 * Throws an Error carrying `.kind` ('missing' | '402' | 'error') on failure.
 */
function scoreWithCli(prompt, shots, alias) {
  const fullPrompt =
    `${prompt}\n\nRead these two files before scoring — do not guess from their names:\n` +
    `Desktop (1440x900): ${shots.desktopPath}\nMobile (375x812): ${shots.mobilePath}\n\n` +
    'Reply with the JSON object only, per the contract above.'
  // The judge spends the subscription: an ambient ANTHROPIC_API_KEY makes the claude
  // CLI bill per token and (2026-09-12) exit 1. Strip it, as the grok link strips XAI_API_KEY.
  const claudeEnv = { ...process.env }
  delete claudeEnv.ANTHROPIC_API_KEY
  delete claudeEnv.ANTHROPIC_AUTH_TOKEN
  const res = spawnSync(
    CLAUDE_CLI,
    ['-p', fullPrompt, '--model', alias, '--output-format', 'json', '--allowedTools', 'Read'],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024, timeout: 600000, env: claudeEnv },
  )
  let wrapper = null
  try {
    wrapper = res.stdout ? JSON.parse(res.stdout) : null
  } catch {
    wrapper = null
  }
  const fail = claudeCliFailure(res.status, res.stderr, wrapper, {
    cliMissing: Boolean(res.error && res.error.code === 'ENOENT'),
  })
  if (fail) {
    const err = new Error(fail.message)
    err.kind = fail.kind
    throw err
  }
  return { text: String(wrapper.result ?? ''), model: claudeModelFromWrapper(wrapper, alias) }
}

/**
 * Link 1: grok-4.6 through the grok CLI. Throws an Error carrying `.kind`
 * ('missing' | '402' | 'error'); the caller falls back on the first two only.
 */
function scoreWithGrok(prompt, shots) {
  const fullPrompt =
    `${prompt}\n\nRead these two image files with your file tool and judge what is IN them — do not guess from their names:\n` +
    `Desktop (1440x900): ${shots.desktopPath}\nMobile (375x812): ${shots.mobilePath}\n\n` +
    'Reply with the JSON object only, no preamble and no code fence.'
  if (!existsSync(GROK_CLI)) {
    const fail = grokCliFailure(127, `no grok CLI at ${GROK_CLI}`, '', { cliMissing: true })
    const err = new Error(fail.message)
    err.kind = fail.kind
    throw err
  }
  const grokEnv = { ...process.env }
  delete grokEnv.XAI_API_KEY
  const res = spawnSync(
    GROK_CLI,
    ['-p', fullPrompt, '-m', EVALUATOR_MODEL, '--permission-mode', 'bypassPermissions', '--output-format', 'plain'],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900000, env: grokEnv },
  )
  const fail = grokCliFailure(res.status, res.stderr, res.stdout, {
    cliMissing: Boolean(res.error && res.error.code === 'ENOENT'),
  })
  if (fail) {
    const err = new Error(fail.message)
    err.kind = fail.kind
    throw err
  }
  return { text: String(res.stdout ?? ''), model: EVALUATOR_MODEL }
}

/**
 * Run the judge chain once. `state.link` remembers which link is answering so
 * a 402 on the first scoring does not get re-tried 77 more times in one run.
 * Returns { text, model, transport }.
 */
async function askJudge(prompt, shots, { transport, apiKey, alias, state }) {
  if (transport === 'sdk') {
    // --api is explicit and bills per token; it is a claude model, never grok.
    const model = FALLBACK_EVALUATORS[alias]
    return { text: await scoreWithSdk(prompt, shots, apiKey, model), model, transport: 'sdk' }
  }
  if (transport === 'grok' && state.link !== 'claude') {
    try {
      const r = scoreWithGrok(prompt, shots)
      state.link = 'grok'
      return { ...r, transport: 'grok' }
    } catch (err) {
      if (!grokFailureFallsBack({ kind: err.kind })) throw err
      console.error(`  link 1 (grok-4.6) unavailable — ${err.kind}. Falling back to the claude CLI (${alias}) for the rest of this run; the table rebaselines once.`)
      state.link = 'claude'
    }
  }
  const r = scoreWithCli(prompt, shots, alias)
  return { ...r, transport: 'claude' }
}

/** A scoring the row builder will accept: integer score, five criteria that sum to it. */
function scoringWellFormed(s) {
  return isPlainObject(s) && Number.isInteger(s.score) && criteriaProblems(s.criteria, s.score).length === 0
}

// One malformed answer out of three used to void the class, and a voided class with a
// prior mark voided the whole table write (2026-09-12: `compare` lost a 27-class run to one
// missing criteria field). A judge that drops a field is retried once on the same shots
// before the scoring is recorded as-is.
const SCORING_RETRIES = 1

async function evaluateClass(cls, shots, { transport, apiKey, instrumentText, alias, state }) {
  const scorings = []
  const models = new Set()
  for (let i = 0; i < SCORINGS_PER_CLASS; i += 1) {
    let scoring = null
    for (let attempt = 0; attempt <= SCORING_RETRIES; attempt += 1) {
      const prompt = buildPrompt(cls, instrumentText)
      let text = ''
      try {
        const r = await askJudge(prompt, shots, { transport, apiKey, alias, state })
        text = r.text
        models.add(r.model)
      } catch (err) {
        console.error(`  ${cls.key}: scoring ${i + 1}/${SCORINGS_PER_CLASS} failed — ${err.message}`)
      }
      scoring = normalizeScoring(parseEvaluatorJson(text))
      if (scoringWellFormed(scoring)) break
      if (attempt < SCORING_RETRIES) {
        const why = isPlainObject(scoring) ? criteriaProblems(scoring.criteria, scoring.score).join(' ') || 'no integer score' : 'unparseable answer'
        console.error(`  ${cls.key}: scoring ${i + 1}/${SCORINGS_PER_CLASS} malformed (${why}) — asking once more`)
      }
    }
    scorings.push(scoring)
  }
  return { scorings, evaluatorModel: models.size === 1 ? [...models][0] : models.size > 1 ? 'mixed' : null }
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

  let catalog = null
  try {
    const loaded = loadTasteCatalog(
      JSON.parse(readFileSync(join(REPO_ROOT, 'design_system/public/taste-catalog.json'), 'utf8')),
    )
    if (loaded.problems.length === 0) catalog = loaded
    else for (const p of loaded.problems) console.error(`taste-table --seed-draft: catalog: ${p}`)
  } catch (err) {
    console.error(`taste-table --seed-draft: catalog unreadable (${err.message}) — drafts will skip classes with no on-disk primitive`)
  }

  const { drafts, warnings } = buildSeedDrafts({ table, usedGaps, root: REPO_ROOT, catalog })
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
    console.log(
      `  transport: ${transport} (${
        transport === 'sdk'
          ? '--api with ANTHROPIC_API_KEY — bills per token'
          : transport === 'claude'
            ? '--claude: the claude CLI only'
            : `grok CLI (${EVALUATOR_MODEL}) first; the claude CLI when grok is missing or 402`
      })`,
    )
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

  // The fallback alias must not be any selected class's builder. Most classes were
  // built by claude-fable / opus lanes; if any was built by sonnet the chain uses opus.
  const builderModels = selected.map((cls) => builderModelForRoute(cls.route))
  const alias = builderModels.some((m) => /sonnet/i.test(String(m))) ? 'opus' : pickFallbackAlias(null)
  const judgeState = { link: transport === 'claude' ? 'claude' : null }
  const judgeLabel =
    transport === 'grok' ? `${EVALUATOR_MODEL}, falling back to claude ${alias}` : transport === 'claude' ? `claude ${alias}` : FALLBACK_EVALUATORS[alias]
  console.log(`\ntaste-table — evaluating ${selected.length} class(es) via the ${transport} transport (${judgeLabel})\n`)

  const firstPassMedianByKey = new Map()
  const newRows = []
  const modelsUsed = new Set()
  let anyInvalid = false
  let anySameModel = false

  for (const [idx, cls] of selected.entries()) {
    const shots = shotPathsFor(runDir, cls.key)
    if (!existsSync(shots.desktopPath) || !existsSync(shots.mobilePath)) {
      console.error(`  ${cls.key}: shots not found under ${runDir}/${cls.key}/ — skipping`)
      newRows.push({ key: cls.key, url: cls.url, route: cls.route, median: null, invalid: 'shots missing — capture (or point --evaluate-only at a run that has them) before scoring' })
      anyInvalid = true
      continue
    }
    console.log(`  ${cls.key} (${cls.url})`)
    const { scorings, evaluatorModel } = await evaluateClass(cls, shots, {
      transport,
      apiKey,
      instrumentText,
      alias,
      state: judgeState,
    })
    const builderModel = builderModels[idx]
    const { row, problems } = buildRow({
      key: cls.key,
      url: cls.url,
      route: cls.route,
      scorings,
      builderModel,
      shots: { desktop: shots.desktopRel, mobile375: shots.mobileRel },
      root: REPO_ROOT,
    })
    row.evaluatorModel = evaluatorModel
    row.rubricVersion = RUBRIC_VERSION
    if (evaluatorModel) modelsUsed.add(evaluatorModel)
    if (evaluatorModel === 'mixed') {
      problems.push('the three scorings came from two different judges — one class, one ruler. Re-run this class.')
      row.invalid = [row.invalid, problems[problems.length - 1]].filter(Boolean).join(' ')
    }
    if (problems.length) {
      anyInvalid = true
      console.error(`  ${cls.key}: INVALID — ${row.invalid}`)
    } else {
      console.log(`    median ${row.median} (${row.scores.join(' · ')}) — ${evaluatorModel}`)
    }
    const warning = evaluatorModel ? sameModelWarning(row, evaluatorModel) : null
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
      const { scorings } = await evaluateClass(cls, shots, { transport, apiKey, instrumentText, alias, state: judgeState })
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

  // The model that ACTUALLY answered, not the one we hoped for. When this run scored
  // nothing new, keep the previous instrument's model so the table stays honest.
  const answered = [...modelsUsed].filter((m) => m !== 'mixed')
  const evaluatorModelUsed =
    answered.length === 1 ? answered[0] : answered.length > 1 ? 'mixed' : current.instrument?.evaluatorModel ?? EVALUATOR_MODEL
  if (evaluatorModelUsed === 'mixed') {
    console.error('\ntaste-table: this run mixed two judges across classes. Every class on one ruler — re-run the classes scored by the other link.')
  }
  const instrument = {
    evaluatorModel: evaluatorModelUsed,
    primaryEvaluator: EVALUATOR_MODEL,
    fallbackEvaluator: FALLBACK_EVALUATORS[alias],
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
  // A class that had a mark and did not score this run keeps its PRIOR row (the mark the
  // rise rule compares against, on the rubric it was scored on) instead of voiding the
  // write for every class that did score. The carried row is marked, the run still exits
  // non-zero, and `ci:rubric-freeze` keeps reporting the class until it is re-run.
  const carried = []
  try {
    const priorRows = loadPreviousTable(null).rows ?? []
    const priorByKey = new Map(priorRows.map((r) => [r.key, r]))
    for (let i = 0; i < allRows.length; i += 1) {
      const r = allRows[i]
      const prior = priorByKey.get(r.key)
      if (Number.isInteger(r.median) || !Number.isInteger(prior?.median)) continue
      allRows[i] = { ...prior, carriedForward: { on: today(), because: r.invalid ?? 'did not score' } }
      carried.push(`${r.key} (keeps ${prior.median} on ${prior.rubricVersion ?? 'its prior rubric'})`)
    }
    allRows.sort((a, b) => {
      const am = Number.isInteger(a.median) ? a.median : Infinity
      const bm = Number.isInteger(b.median) ? b.median : Infinity
      return am - bm
    })
  } catch {
    /* no previous table to protect */
  }
  if (carried.length) {
    console.error(`\ntaste-table: these classes had a mark and did not score — prior row carried forward, NOT rescored:`)
    for (const r of carried) console.error(`  ${r}`)
    console.error('  Re-run them with --classes, or --evaluate-only a run that has their shots.')
  }
  writeFileSync(join(REPO_ROOT, TABLE_PATH), `${JSON.stringify(table, null, 1)}\n`)
  console.log(`\nwrote ${TABLE_PATH} (${allRows.length} rows, ${scored.length} scored${carried.length ? `, ${carried.length} carried forward` : ''})`)

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
