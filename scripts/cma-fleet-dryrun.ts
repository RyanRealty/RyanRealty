/**
 * CMA FLEET DRY RUN: every open Bend expired CMA through the engine, scored,
 * diffed against the last baseline. WRITES NOTHING TO THE DATABASE.
 *
 * Matt 2026-10-07: turn "we fix what we hit" into a measurable number. After
 * every CMA engine change, one command dry-runs the fleet, scores each home
 * (build or fail and where, comps, recommended, rule 3 hold, flagged), diffs
 * against the last run and against the stored rows, and prints one headline,
 * so a fix that helps one home and breaks another shows up before it ships.
 *
 *   npm run cma:fleet -- --dry                          selection only, nothing runs
 *   npm run cma:fleet -- --dry-list                     the selected slugs, one per line
 *   npm run cma:fleet                                   the fleet, diffed against out/cma-fleet/latest.json
 *   npm run cma:fleet -- --slugs a,b --baseline none    two homes, no diff
 *   npm run cma:fleet -- --from-json out/cma-fleet/raw/<runId>   score captured dry-run files, no DB
 *
 * How it runs:
 *  - Runs from any CWD: every path resolves against the repo root and each
 *    child gets cwd = repo root (the dry run loads .env.local relative to CWD).
 *  - Reads live Supabase through the DAL only (listCmaQueue, getBoundaryGeoJSON,
 *    getListingRawRowByKey, resolveCmaSubject). No raw .from(), no SQL.
 *  - One home = one child process: `tsx scripts/cma-build-dryrun.ts --json <slug>`.
 *    That script is the deterministic half of the engine (the LLM judge and
 *    the adversarial audit are skipped), so a "build" here is a CEILING on a
 *    real build, not a promise and never a send. Nothing in that script changes.
 *  - Concurrency is clamped to 5 because the dry run hits production PostgREST.
 *  - Writes only under --out-dir (default out/cma-fleet, gitignored): the run
 *    file, a partial file while running, raw per-home JSON, and latest.json.
 *  - Do not put this on a cron without Matt's yes.
 *
 * City filter: point-in-polygon against the boundaries row geo_type='city',
 * geo_slug=<--city> (TIGER 2024 Incorporated Places) via getBoundaryGeoJSON.
 * A home with no coordinates falls back to a city-name match and is labeled
 * 'name-fallback' in every output. If the polygon row is missing the run
 * refuses (exit 2) rather than silently matching the whole fleet by name;
 * --city any skips the filter on purpose.
 *
 * Every decision (flags, selection, scoring, diff, headline, exit code, the
 * report) is in lib/cma/fleet-score.ts, which is pure and unit-tested. This
 * file only wires.
 *
 * Exit codes: 0 ok · 1 regression (a home newly fails or newly holds; the run
 * file and latest.json are still written) · 2 unusable (nothing ran, nothing
 * written) · 3 harness error (run complete, latest.json left alone) · 130
 * interrupted (partial file flushed, resume command printed).
 */
import { config as loadEnv } from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import type {
  Coordinates,
  FleetConfig,
  FleetRun,
  HomeRunResult,
  HomeScore,
  SelectedHome,
  SelectionCounts,
  StoredDiff,
} from '@/lib/cma/fleet-score'
import type { Ring } from '@/lib/geo/project-svg'

const repoRoot = path.resolve(__dirname, '..')
// quiet: dotenv 17 otherwise prints an "injecting env" tip to stdout, which
// would sit in front of the --json document.
loadEnv({ path: path.join(repoRoot, '.env.local'), quiet: true })
loadEnv({ path: path.join(repoRoot, '.env'), quiet: true })

// `server-only` / `next/cache` throw in a bare tsx process and every DAL module
// carries them. The shim installs BEFORE any lib/** import, which is why every
// lib import below is dynamic. The next/cache stub it installs makes
// unstable_cache a passthrough, which getBoundaryGeoJSON needs.
const { installServerOnlyShim } = require('./lib/server-only-shim.cjs') as {
  installServerOnlyShim: (repoRoot?: string) => void
}
installServerOnlyShim(repoRoot)

const DRY_RUN_SCRIPT = 'scripts/cma-build-dryrun.ts'
const TSX_BIN = path.join(repoRoot, 'node_modules', '.bin', 'tsx')
const CHILD_ARGV = [DRY_RUN_SCRIPT, '--json', '<slug>']
const STDIO_CAP = 64 * 1024 * 1024
const KILL_GRACE_MS = 5000
const COORD_CONCURRENCY = 5

type Pure = typeof import('@/lib/cma/fleet-score')

const log = (line: string) => process.stderr.write(`${line}\n`)

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return 'unknown'
  }
}

function gitDirty(): boolean | 'unknown' {
  const out = git(['status', '--porcelain'])
  return out === 'unknown' ? 'unknown' : out.length > 0
}

function sha1OfFile(file: string): string {
  try {
    return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')
  } catch {
    return 'unknown'
  }
}

function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, text)
  fs.renameSync(tmp, file)
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/**
 * main() ends in process.exit, and a pipe can still hold a large --json
 * document when that fires; resolving on the write callback drains it first.
 */
function writeStdout(text: string): Promise<void> {
  return new Promise((resolve) => {
    process.stdout.write(text, () => resolve())
  })
}

/** Repo-relative for anything under the repo; absolute otherwise (a scratch --out-dir). */
function rel(file: string): string {
  const r = path.relative(repoRoot, file)
  return r.startsWith('..') || path.isAbsolute(r) ? file : r
}

function dirSizeMb(dir: string): number | null {
  if (!fs.existsSync(dir)) return null
  let bytes = 0
  const walk = (d: string) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) walk(p)
      else bytes += fs.statSync(p).size
    }
  }
  walk(dir)
  return bytes / (1024 * 1024)
}

function isFleetRun(v: unknown): v is FleetRun {
  return (
    typeof v === 'object' &&
    v != null &&
    (v as { schemaVersion?: unknown }).schemaVersion === 1 &&
    typeof (v as { runId?: unknown }).runId === 'string' &&
    Array.isArray((v as { homes?: unknown }).homes)
  )
}

// ---------------------------------------------------------------------------
// One child process per home
// ---------------------------------------------------------------------------

type ChildOutcome = {
  stdout: string
  stderr: string
  exitCode: number | null
  signal: string | null
  timedOut: boolean
  overflow: boolean
  spawnError: string | null
  durationMs: number
}

const inFlight = new Set<ChildProcess>()

function runChild(slug: string, timeoutSec: number): Promise<ChildOutcome> {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(TSX_BIN, [DRY_RUN_SCRIPT, '--json', slug], {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    inFlight.add(child)
    const out: Buffer[] = []
    const err: Buffer[] = []
    let overflow = false
    let timedOut = false
    let exited = false
    let settled = false
    let spawnError: string | null = null

    // A child that already exited is never re-signaled.
    const kill = (sig: NodeJS.Signals) => {
      if (exited) return
      try {
        child.kill(sig)
      } catch {
        /* already gone */
      }
    }
    const timer = setTimeout(() => {
      timedOut = true
      kill('SIGTERM')
      setTimeout(() => kill('SIGKILL'), KILL_GRACE_MS).unref()
    }, timeoutSec * 1000)

    // Each stream is capped at STDIO_CAP; past it the child is a harness error.
    const collect = (bufs: Buffer[], len: { n: number }, chunk: Buffer) => {
      len.n += chunk.length
      if (len.n > STDIO_CAP) {
        if (!overflow) {
          overflow = true
          kill('SIGKILL')
        }
        return
      }
      bufs.push(chunk)
    }
    const outLen = { n: 0 }
    const errLen = { n: 0 }
    child.stdout?.on('data', (chunk: Buffer) => collect(out, outLen, chunk))
    child.stderr?.on('data', (chunk: Buffer) => collect(err, errLen, chunk))

    const finish = (exitCode: number | null, signal: string | null) => {
      if (settled) return
      settled = true
      exited = true
      clearTimeout(timer)
      inFlight.delete(child)
      resolve({
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        exitCode,
        signal,
        timedOut,
        overflow,
        spawnError,
        durationMs: Date.now() - started,
      })
    }
    child.on('error', (e) => {
      spawnError = e.message
      finish(null, null)
    })
    child.on('close', (code, signal) => finish(code, signal))
  })
}

/** Runs the child up to 1 + retries times; engine results are never retried. */
async function runHome(
  pure: Pure,
  home: SelectedHome,
  config: FleetConfig,
  rawDir: string | null,
  runId: string,
): Promise<HomeScore> {
  let attempts = 0
  let last: { result: HomeRunResult; stderr: string } | null = null
  while (attempts <= config.retries && !stopping) {
    attempts += 1
    const child = await runChild(home.slug, config.timeoutSec)
    const harnessBase = {
      attempts,
      exitCode: child.exitCode,
      signal: child.signal,
      timedOut: child.timedOut,
      durationMs: child.durationMs,
      stderr: child.stderr,
    }
    let harnessReason: string | null = null
    if (child.spawnError) harnessReason = `spawn-error ${child.spawnError}`
    else if (child.overflow) harnessReason = 'stdout-overflow'
    else if (child.timedOut) harnessReason = 'timeout'
    else if (child.signal) harnessReason = 'signal'
    else if (child.exitCode !== 0) harnessReason = 'nonzero-exit'
    const parsed = harnessReason ? null : pure.parseDryRunStdout(child.stdout, home.slug)
    if (parsed && 'dry' in parsed) {
      let rawPath: string | null = null
      if (rawDir) {
        rawPath = path.posix.join('raw', runId, `${home.slug}.json`)
        writeAtomic(path.join(rawDir, `${home.slug}.json`), JSON.stringify(parsed.dry, null, 2))
        if (parsed.dry.ok !== true) fs.writeFileSync(path.join(rawDir, `${home.slug}.stderr.log`), child.stderr)
      }
      return pure.scoreHome(home, { dry: parsed.dry, notes: parsed.notes, rawPath, ...harnessBase }, {
        minComps: minComps ?? pure.FLEET_MIN_COMPS_DEFAULT,
        priceThresholdPct: config.priceThresholdPct,
      })
    }
    last = { result: { harnessReason: harnessReason ?? (parsed as { harnessReason: string }).harnessReason, ...harnessBase }, stderr: child.stderr }
    if (!stopping && attempts <= config.retries) log(`  retry ${attempts}/${config.retries} ${home.slug}: ${last.result.harnessReason}`)
  }
  const result = last?.result ?? { harnessReason: 'interrupted', attempts, exitCode: null, signal: null, timedOut: false, durationMs: 0 }
  if (rawDir && last) fs.writeFileSync(path.join(rawDir, `${home.slug}.stderr.log`), last.stderr)
  return pure.scoreHome(home, result, { minComps: minComps ?? pure.FLEET_MIN_COMPS_DEFAULT, priceThresholdPct: config.priceThresholdPct })
}

// Rule 8's floor: lib/cma/comps MIN_COMPS on a live run (set in main); the
// pure default when --from-json keeps the DAL graph out of the process.
let minComps: number | null = null
let stopping = false

// ---------------------------------------------------------------------------
// Selection against the live queue
// ---------------------------------------------------------------------------

async function selectFromQueue(
  pure: Pure,
  config: FleetConfig,
): Promise<{ homes: SelectedHome[]; counts: SelectionCounts } | { unusable: string }> {
  const { listCmaQueue, CMA_QUEUE_READ_LIMIT, getBoundaryGeoJSON, getListingRawRowByKey } = await import('@/lib/data')
  const { resolveCmaSubject } = await import('@/lib/cma/subject')
  const { outerRings } = await import('@/lib/geo/project-svg')

  const { rows, truncated } = await listCmaQueue({ limit: CMA_QUEUE_READ_LIMIT, includeArchived: config.includeArchived })
  if (rows.length === 0) return { unusable: 'UNREADABLE: the queue came back empty' }
  log(`queue rows: ${rows.length} (truncated: ${truncated})`)

  let rings: Ring[] = []
  if (config.city !== 'any') {
    let geometry: GeoJSON.Geometry | null = null
    try {
      geometry = await getBoundaryGeoJSON({ geoType: 'city', geoSlug: config.city })
    } catch (e) {
      log(`boundary read threw: ${e instanceof Error ? e.message : String(e)}`)
    }
    rings = outerRings(geometry)
    if (rings.length === 0) {
      return {
        unusable:
          `no boundaries polygon for city '${config.city}' (geo_type='city', geo_slug='${config.city}'); ` +
          'refusing to match by name for the whole fleet; use --city any to skip the filter',
      }
    }
    log(`boundary: city/${config.city}, ${rings.length} outer ring(s)`)
  }

  // Coordinates for the survivors only (or the listed slugs), a few at a time.
  const candidates = config.slugs
    ? rows.filter((r) => config.slugs!.includes(r.slug))
    : pure.prefilterQueueRows(rows, config).rows
  const coordsBySlug = new Map<string, Coordinates>()
  const queue = [...candidates]
  const coordWorker = async () => {
    for (;;) {
      const row = queue.shift()
      if (!row) return
      try {
        let lat: number | null = null
        let lng: number | null = null
        if (row.subjectListingKey) {
          const raw = await getListingRawRowByKey(row.subjectListingKey)
          const la = Number(raw?.['Latitude'])
          const ln = Number(raw?.['Longitude'])
          if (Number.isFinite(la) && Number.isFinite(ln)) {
            lat = la
            lng = ln
          }
        }
        if (lat == null || lng == null) {
          const resolved = await resolveCmaSubject({
            mlsNumber: row.subjectListingKey ?? null,
            rawAddress: row.address,
            city: row.city,
            postalCode: null,
          })
          const la = resolved.subject?.latitude ?? null
          const ln = resolved.subject?.longitude ?? null
          if (la != null && ln != null && Number.isFinite(la) && Number.isFinite(ln)) {
            lat = la
            lng = ln
          }
        }
        if (lat != null && lng != null) coordsBySlug.set(row.slug, { lat, lng })
      } catch (e) {
        log(`  coordinates read threw for ${row.slug}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: COORD_CONCURRENCY }, () => coordWorker()))
  log(`coordinates: ${coordsBySlug.size} of ${candidates.length} candidates`)

  return pure.selectHomes(rows, { config, rings, coordsBySlug, queueTruncated: truncated })
}

/** --from-json: captured dry-run files stand in for the engine; no queue, no DB. */
function selectFromJson(config: FleetConfig): { homes: SelectedHome[]; counts: SelectionCounts; dries: Map<string, HomeRunResult> } | { unusable: string } {
  const dir = path.resolve(repoRoot, config.fromJson!)
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return { unusable: `--from-json: ${dir} is not a directory` }
  const homes: SelectedHome[] = []
  const dries = new Map<string, HomeRunResult>()
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue
    let parsed: unknown
    try {
      parsed = readJson(path.join(dir, name))
    } catch (e) {
      log(`  skipping ${name}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    const element = (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, unknown> | null
    if (!element || typeof element.slug !== 'string' || typeof element.ok !== 'boolean') {
      log(`  skipping ${name}: not a dry-run element (needs slug and ok)`)
      continue
    }
    const slug = element.slug
    if (config.slugs && !config.slugs.includes(slug)) continue
    homes.push({
      slug,
      address: typeof element.address === 'string' ? element.address : null,
      city: typeof element.city === 'string' ? element.city : null,
      stateAtSelection: null,
      prospectKind: null,
      docType: null,
      offMarketAt: null,
      createdAt: null,
      storedRecommended: null,
      storedCompsCount: null,
      storedBuildError: null,
      storedNeedsReview: null,
      theirPrice: null,
      lat: null,
      lng: null,
      inside: null,
      cityMatch: 'skipped',
    })
    dries.set(slug, {
      dry: element as unknown as HomeRunResult['dry'],
      notes: [],
      attempts: 0,
      exitCode: null,
      signal: null,
      timedOut: false,
      durationMs: 0,
      rawPath: null,
    })
  }
  homes.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
  const limited = config.limit != null ? homes.slice(0, config.limit) : homes
  const n = homes.length
  return {
    homes: limited,
    dries,
    counts: {
      queueRows: 0,
      queueTruncated: false,
      afterDocKind: n,
      afterKind: n,
      afterStates: n,
      afterSince: n,
      withCoordinates: 0,
      insidePolygon: 0,
      outsidePolygon: 0,
      nameFallback: 0,
      afterLimit: limited.length,
      boundarySource: null,
    },
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const pure: Pure = await import('@/lib/cma/fleet-score')
  const parsed = pure.parseFleetArgs(process.argv.slice(2))
  if ('usageError' in parsed) {
    log(`usage error: ${parsed.usageError}`)
    log(pure.FLEET_USAGE)
    return pure.fleetExitCode({ usageError: parsed.usageError })
  }
  const { config, warnings } = parsed
  for (const w of warnings) log(`warning: ${w}`)

  const outDir = path.resolve(repoRoot, config.outDir)
  const fromJson = config.fromJson != null

  // Baseline before anything runs, so a bad file is exit 2 with nothing written.
  let baselineRun: FleetRun | null = null
  let baselineFile: string | null = null
  if (config.baseline === 'none') {
    baselineFile = null
  } else if (config.baseline === 'auto') {
    const latest = path.join(outDir, 'latest.json')
    baselineFile = fs.existsSync(latest) ? latest : null
  } else {
    baselineFile = path.resolve(repoRoot, config.baseline)
    if (!fs.existsSync(baselineFile)) {
      log(`--baseline ${baselineFile} does not exist`)
      return pure.fleetExitCode({ unusable: true })
    }
  }
  if (baselineFile) {
    try {
      const b = readJson(baselineFile)
      if (!isFleetRun(b)) throw new Error('not a FleetRun file (schemaVersion 1 with runId and homes)')
      baselineRun = b
    } catch (e) {
      log(`--baseline ${baselineFile} is unusable: ${e instanceof Error ? e.message : String(e)}`)
      return pure.fleetExitCode({ unusable: true })
    }
  }

  // Resume: the partial file is read before selection so a bad one is exit 2.
  let resumeRun: FleetRun | null = null
  if (config.resume) {
    const file = path.resolve(repoRoot, config.resume)
    try {
      const r = readJson(file)
      if (!isFleetRun(r) || r.complete) throw new Error('not a partial FleetRun file')
      resumeRun = r
    } catch (e) {
      log(`--resume ${file} is unusable: ${e instanceof Error ? e.message : String(e)}`)
      return pure.fleetExitCode({ unusable: true })
    }
  }

  if (!fromJson) {
    const { MIN_COMPS } = await import('@/lib/cma/comps')
    minComps = MIN_COMPS
    if (!fs.existsSync(TSX_BIN)) {
      log(`tsx binary missing at ${TSX_BIN}; run npm install`)
      return pure.fleetExitCode({ unusable: true })
    }
  }

  const selected = fromJson ? selectFromJson(config) : await selectFromQueue(pure, config)
  if ('unusable' in selected) {
    log(selected.unusable)
    return pure.fleetExitCode({ unusable: true })
  }
  const { homes, counts } = selected
  const fromJsonDries: Map<string, HomeRunResult> | null =
    'dries' in selected ? (selected as { dries: Map<string, HomeRunResult> }).dries : null
  log(`selection: ${pure.selectionLine(counts)}`)
  if (config.since) log('since: offMarketAt, createdAt when null')
  if (config.slugs) {
    const missing = homes.filter((h) => h.stateAtSelection == null && !fromJson).length
    log(`slugs: ${config.slugs.length} listed, ${missing} without a queue row`)
  }
  if (homes.length === 0) {
    log('no homes selected')
    return pure.fleetExitCode({ unusable: true })
  }

  if (config.dryList) {
    await writeStdout(homes.map((h) => `${h.slug}\n`).join(''))
    return pure.fleetExitCode({ dry: true })
  }
  if (config.dry) {
    const table = [
      `${'slug'.padEnd(26)} ${'state'.padEnd(13)} ${'cityMatch'.padEnd(14)} ${'inside'.padEnd(7)} ${'storedRec'.padEnd(12)} address`,
      ...homes.map(
        (h) =>
          `${h.slug.padEnd(26)} ${(h.stateAtSelection ?? 'none').padEnd(13)} ${h.cityMatch.padEnd(14)} ${String(h.inside ?? 'n/a').padEnd(7)} ${pure
            .money(h.storedRecommended)
            .padEnd(12)} ${h.address ?? ''}`,
      ),
      `selected ${homes.length} · ${pure.selectionLine(counts)}`,
    ]
    await writeStdout(`${table.join('\n')}\n`)
    return pure.fleetExitCode({ dry: true })
  }

  // Resume must be a subset of this selection; already-scored homes are skipped.
  const scored = new Map<string, HomeScore>()
  if (resumeRun) {
    const selectedSlugs = new Set(homes.map((h) => h.slug))
    const stray = resumeRun.homes.filter((h) => !selectedSlugs.has(h.slug)).map((h) => h.slug)
    if (stray.length) {
      log(`--resume: ${stray.length} scored slug(s) are not in the current selection (${stray.slice(0, 5).join(', ')}); refusing`)
      return pure.fleetExitCode({ unusable: true })
    }
    for (const h of resumeRun.homes) scored.set(h.slug, h)
    log(`resuming ${resumeRun.runId}: ${scored.size} of ${homes.length} already scored`)
  }

  const runId = resumeRun?.runId ?? new Date().toISOString().replace(/:/g, '-')
  const startedAt = resumeRun?.startedAt ?? new Date().toISOString()
  const wallStart = Date.now()
  const rawDir = config.raw && !fromJson ? path.join(outDir, 'raw', runId) : null
  if (rawDir) fs.mkdirSync(rawDir, { recursive: true })
  fs.mkdirSync(outDir, { recursive: true })
  const partialFile = path.join(outDir, `${runId}.partial.json`)
  const runFile = path.join(outDir, `${runId}.json`)
  const reportFile = path.join(outDir, `${runId}.md`)
  const latestFile = path.join(outDir, 'latest.json')

  const meta = {
    schemaVersion: 1 as const,
    runId,
    startedAt,
    gitSha: git(['rev-parse', 'HEAD']),
    gitBranch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    gitDirty: gitDirty(),
    dryRunScriptSha1: sha1OfFile(path.join(repoRoot, DRY_RUN_SCRIPT)),
    nodeVersion: process.version,
    childArgv: CHILD_ARGV,
    engine: 'deterministic-half' as const,
    source: fromJson ? ('from-json' as const) : ('queue' as const),
    config,
    selection: counts,
  }
  const baselineRef = baselineRun
    ? {
        file: rel(baselineFile!),
        runId: baselineRun.runId,
        gitSha: baselineRun.gitSha,
        dryRunScriptSha1: baselineRun.dryRunScriptSha1,
        startedAt: baselineRun.startedAt,
      }
    : null

  const assemble = (complete: boolean): FleetRun => {
    const list = pure.sortHomes([...scored.values()])
    const vsStored: StoredDiff = pure.diffAgainstStored({ homes: list }, { priceThresholdPct: config.priceThresholdPct })
    const partial: FleetRun = {
      ...meta,
      finishedAt: complete ? new Date().toISOString() : null,
      wallSec: complete ? Math.round((Date.now() - wallStart) / 1000) : null,
      complete,
      totals: pure.computeTotals(list),
      homes: list,
      vsStored,
      baseline: baselineRef,
      diff: null,
      headline: '',
    }
    if (!complete) return partial
    partial.diff = baselineRun ? pure.diffFleet(baselineRun, partial, { priceThresholdPct: config.priceThresholdPct }) : null
    partial.headline = pure.headline(partial.diff, partial)
    return partial
  }
  const flushPartial = () => writeAtomic(partialFile, JSON.stringify(assemble(false), null, 2))

  const onSignal = (sig: NodeJS.Signals) => {
    if (stopping) return
    stopping = true
    log(`\n${sig}: stopping launches, terminating ${inFlight.size} in-flight child(ren), flushing the partial file`)
    for (const c of inFlight) {
      try {
        c.kill('SIGTERM')
      } catch {
        /* gone */
      }
    }
    flushPartial()
    log(`resume with: npm run cma:fleet -- --resume ${rel(partialFile)}`)
    process.exit(130)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  // The pool: N workers pull from one shared list.
  const pending = homes.filter((h) => !scored.has(h.slug))
  const total = homes.length
  let completed = scored.size
  const durations: number[] = []
  const worker = async () => {
    for (;;) {
      if (stopping) return
      const home = pending.shift()
      if (!home) return
      const score = fromJson
        ? pure.scoreHome(home, fromJsonDries!.get(home.slug)!, {
            minComps: minComps ?? pure.FLEET_MIN_COMPS_DEFAULT,
            priceThresholdPct: config.priceThresholdPct,
          })
        : await runHome(pure, home, config, rawDir, runId)
      if (stopping) return
      scored.set(home.slug, score)
      completed += 1
      durations.push(score.durationMs)
      log(pure.formatHomeLine(score, { index: completed, total }))
      flushPartial()
      if (!fromJson && completed % 5 === 0 && durations.length >= 3) {
        const med = pure.median(durations) ?? 0
        const remaining = total - completed
        const etaMin = Math.round((med * remaining) / config.concurrency / 60000)
        log(`ETA ~${etaMin}m from ${completed} completed homes (median ${Math.round(med / 1000)}s each)`)
      }
    }
  }
  await Promise.all(Array.from({ length: fromJson ? 1 : config.concurrency }, () => worker()))
  if (stopping) return 130

  // Completion.
  const run = assemble(true)
  const files: string[] = []
  writeAtomic(runFile, JSON.stringify(run, null, 2))
  files.push(rel(runFile))
  if (fs.existsSync(partialFile)) fs.unlinkSync(partialFile)
  const rawDirMb = rawDir ? dirSizeMb(rawDir) : null
  const report = () => pure.renderReport(run, { files, rawDirMb })
  if (run.totals.harnessErrors === 0 && config.latest) {
    fs.copyFileSync(runFile, latestFile)
    files.push(rel(latestFile))
  } else {
    log(
      run.totals.harnessErrors > 0
        ? `latest.json left alone: ${run.totals.harnessErrors} harness error(s) mean this run is not a baseline`
        : 'latest.json left alone (--no-latest)',
    )
  }
  if (config.saveAs) {
    const dest = path.resolve(repoRoot, config.saveAs)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(runFile, dest)
    files.push(rel(dest))
  }
  fs.writeFileSync(reportFile, `# CMA fleet dry run ${runId}\n\n\`\`\`\n${report()}\n\`\`\`\n`)
  files.push(rel(reportFile))

  await writeStdout(config.json ? `${JSON.stringify(run, null, 2)}\n` : `${report()}\n`)
  if (rawDirMb != null) log(`raw directory ${rel(rawDir!)}: ${rawDirMb.toFixed(1)} MB`)

  return pure.fleetExitCode({
    harnessErrors: run.totals.harnessErrors,
    diff: run.diff,
    allowRegressions: config.allowRegressions,
  })
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    log(`cma-fleet-dryrun threw: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
    process.exit(2)
  })
