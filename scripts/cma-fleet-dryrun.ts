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
 *   npm run cma:fleet -- --resume out/cma-fleet/<runId>.partial.json   finish an interrupted run
 *
 * How it runs:
 *  - Run it as `npm run cma:fleet` (npm runs it from the repo root wherever you
 *    type it) or as `npx tsx scripts/cma-fleet-dryrun.ts` FROM THE REPO ROOT.
 *    tsx resolves the `@/` imports through the tsconfig it finds from the
 *    current directory, so a direct tsx run from outside the repo cannot load
 *    lib/ at all. Once loaded, every path resolves against the repo root and
 *    each child gets cwd = repo root (the dry run loads .env.local relative to
 *    its CWD).
 *  - Reads live Supabase through the DAL only (listCmaQueue, getBoundaryGeoJSON,
 *    getListingRawRowByKey, resolveCmaSubject). No raw .from(), no SQL.
 *  - One home = one child process: `tsx scripts/cma-build-dryrun.ts --json <slug>`,
 *    started as its own process group (lib/cma/fleet-child.ts) so a timeout,
 *    an output overflow, Ctrl-C or a harness exception kills the engine
 *    grandchild too, not just the tsx wrapper. That script is the
 *    deterministic half of the engine (the LLM judge and the adversarial audit
 *    are skipped), so a "build" here is a CEILING on a real build, not a
 *    promise and never a send. Nothing in that script changes.
 *  - Concurrency is clamped to 5 because the dry run hits production PostgREST.
 *  - Writes only under --out-dir (default out/cma-fleet, gitignored): the run
 *    file, a partial file while running, raw per-home JSON, and latest.json,
 *    each through write-temp-then-rename.
 *  - Do not put this on a cron without Matt's yes.
 *
 * Resume: `--resume <partial>` takes EVERY setting from the partial file
 * (selection, out-dir, baseline, raw, latest, concurrency, timeouts, output
 * format), so the printed resume command is complete as printed. A flag on the
 * command line that disagrees with the partial is refused (exit 2). So is a
 * resume on different code: the commit, the working tree (clean, or the same
 * uncommitted changes by fingerprint) and scripts/cma-build-dryrun.ts must
 * match the partial, or one run file would mix two engines. A resume diffs
 * against the baseline the partial recorded, never a newer latest.json.
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
 * Baseline: --baseline auto (the default) reads out-dir/latest.json when it
 * exists. A latest.json that does not parse is a warning with the recovery
 * (delete it, or pass --baseline none), and the run goes on with no baseline;
 * an explicit --baseline file that does not parse refuses (exit 2).
 *
 * Exit codes: 0 ok · 1 regression (a home newly fails or newly holds; the run
 * file and latest.json are still written) · 2 unusable (nothing ran, nothing
 * written) · 3 harness error (run complete with harness errors and latest.json
 * left alone, or an exception mid-run: in-flight child groups killed, partial
 * file flushed, resume command printed) · 130 interrupted (partial file
 * flushed, resume command printed).
 */
import { config as loadEnv } from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import type { GroupChild, GroupChildOutcome } from '@/lib/cma/fleet-child'
import type {
  Coordinates,
  FleetConfig,
  FleetRun,
  HomeRunResult,
  HomeScore,
  RunProvenance,
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
/** How long 'close' may trail a child's exit before its group is killed and the home resolves anyway. */
const EXIT_DRAIN_MS = 3000
const COORD_CONCURRENCY = 5
/** Changed files above this are fingerprinted by size and mtime instead of contents. */
const FINGERPRINT_READ_CAP = 16 * 1024 * 1024

type Pure = typeof import('@/lib/cma/fleet-score')
type ChildModule = typeof import('@/lib/cma/fleet-child')

const log = (line: string) => process.stderr.write(`${line}\n`)

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * The working tree as this run sees it: dirty or not, and a sha1 over every
 * changed or untracked path and its contents (null when clean), so a resume
 * can prove the uncommitted code is the same code. The run's own out-dir is
 * left out when it sits inside the repo, or its partial file would dirty the
 * tree between the start and the resume.
 */
function gitTreeState(outDirAbs: string): Pick<RunProvenance, 'gitDirty' | 'gitDirtySha1'> {
  const args = ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.']
  const outRel = path.relative(repoRoot, outDirAbs)
  if (outRel && !outRel.startsWith('..') && !path.isAbsolute(outRel)) args.push(`:(exclude)${outRel}`)
  let raw: string
  try {
    raw = execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 256 * 1024 * 1024,
    })
  } catch {
    return { gitDirty: 'unknown', gitDirtySha1: null }
  }
  // -z entries are "XY path"; a rename or copy carries its source as the next entry.
  const tokens = raw.split('\0').filter((t) => t.length > 0)
  const paths: string[] = []
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]!
    const xy = t.slice(0, 2)
    paths.push(t.slice(3))
    if ((xy.includes('R') || xy.includes('C')) && i + 1 < tokens.length) {
      paths.push(tokens[i + 1]!)
      i += 1
    }
  }
  if (paths.length === 0) return { gitDirty: false, gitDirtySha1: null }
  const h = crypto.createHash('sha1')
  for (const p of [...new Set(paths)].sort()) {
    h.update(p).update('\0')
    const abs = path.join(repoRoot, p)
    try {
      const st = fs.statSync(abs)
      if (!st.isFile()) h.update(st.isDirectory() ? 'dir' : 'other')
      else if (st.size > FINGERPRINT_READ_CAP) h.update(`size ${st.size} mtime ${st.mtimeMs}`)
      else h.update(crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex'))
    } catch {
      h.update('missing')
    }
    h.update('\n')
  }
  return { gitDirty: true, gitDirtySha1: h.digest('hex') }
}

function sha1OfFile(file: string): string {
  try {
    return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')
  } catch {
    return 'unknown'
  }
}

/**
 * A stored coordinate, or null when it is missing. NULL and '' are missing,
 * never the point 0: Number(null) and Number('') are 0, which read a Bend
 * home with no stored coordinates as (0, 0), outside the polygon, and dropped
 * it from the fleet instead of sending it to the name fallback. No home this
 * tool scores sits on the equator or the prime meridian, so 0 is missing too.
 */
function coordOf(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'string' && v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n !== 0 ? n : null
}

/** Write-temp-then-rename in the same directory; the pid keeps two runs' temp files apart. */
function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, text)
  fs.renameSync(tmp, file)
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

function loadRun(file: string): { run: FleetRun } | { error: string } {
  if (!fs.existsSync(file)) return { error: 'does not exist' }
  try {
    const r = readJson(file)
    if (!isFleetRun(r)) return { error: 'not a FleetRun file (schemaVersion 1 with runId and homes)' }
    return { run: r }
  } catch (e) {
    return { error: errText(e) }
  }
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

// Every child group still running; the signal handler, the mid-run exception
// path and the exit hook signal each one.
const inFlight = new Set<GroupChild>()
let startGroupChild: ChildModule['startGroupChild'] | null = null

async function runChild(slug: string, timeoutSec: number): Promise<GroupChildOutcome> {
  const child = startGroupChild!({
    command: TSX_BIN,
    args: [DRY_RUN_SCRIPT, '--json', slug],
    cwd: repoRoot,
    env: process.env,
    timeoutMs: timeoutSec * 1000,
    killGraceMs: KILL_GRACE_MS,
    stdioCap: STDIO_CAP,
    drainMs: EXIT_DRAIN_MS,
  })
  inFlight.add(child)
  try {
    return await child.done
  } finally {
    inFlight.delete(child)
  }
}

/** Resolves when every in-flight child has settled, or after ms. */
async function waitForChildren(ms: number): Promise<void> {
  const until = Date.now() + ms
  while (inFlight.size > 0 && Date.now() < until) await new Promise((r) => setTimeout(r, 100))
}

/** SIGTERM every in-flight group, a grace period, then SIGKILL whatever is left. */
async function stopChildren(): Promise<void> {
  for (const c of inFlight) c.signal('SIGTERM')
  await waitForChildren(KILL_GRACE_MS)
  for (const c of inFlight) c.signal('SIGKILL')
  await waitForChildren(EXIT_DRAIN_MS + 1000)
}

// Last resort: whatever path ends the process, no engine grandchild outlives it.
process.on('exit', () => {
  for (const c of inFlight) c.signal('SIGKILL')
})

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
    const harnessReason = pure.childHarnessReason(child)
    if (child.pipesHeld) {
      log(`  ${home.slug}: the pipes stayed open ${EXIT_DRAIN_MS / 1000}s after the child exited; its group was killed`)
    }
    const parsed = harnessReason ? null : pure.parseDryRunStdout(child.stdout, home.slug)
    if (parsed && 'dry' in parsed) {
      let rawPath: string | null = null
      if (rawDir) {
        rawPath = path.posix.join('raw', runId, `${home.slug}.json`)
        writeAtomic(path.join(rawDir, `${home.slug}.json`), JSON.stringify(parsed.dry, null, 2))
        if (parsed.dry.ok !== true) writeAtomic(path.join(rawDir, `${home.slug}.stderr.log`), child.stderr)
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
  if (rawDir && last) writeAtomic(path.join(rawDir, `${home.slug}.stderr.log`), last.stderr)
  return pure.scoreHome(home, result, { minComps: minComps ?? pure.FLEET_MIN_COMPS_DEFAULT, priceThresholdPct: config.priceThresholdPct })
}

// Rule 8's floor: lib/cma/comps MIN_COMPS on a live run (set in main); the
// pure default when --from-json keeps the DAL graph out of the process.
let minComps: number | null = null
let stopping = false
/** Set when the worker pool starts: from then on an uncaught throw is a harness error (3), not "nothing ran" (2). */
let poolStarted = false

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

  const { includeArchived } = pure.queueReadOptions(config)
  const { rows, truncated } = await listCmaQueue({ limit: CMA_QUEUE_READ_LIMIT, includeArchived })
  if (rows.length === 0) return { unusable: 'UNREADABLE: the queue came back empty' }
  log(`queue rows: ${rows.length} (truncated: ${truncated}, archived ${includeArchived ? 'included' : 'excluded'})`)

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
          const la = coordOf(raw?.['Latitude'])
          const ln = coordOf(raw?.['Longitude'])
          if (la != null && ln != null) {
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
          const la = coordOf(resolved.subject?.latitude)
          const ln = coordOf(resolved.subject?.longitude)
          if (la != null && ln != null) {
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
  startGroupChild = (await import('@/lib/cma/fleet-child')).startGroupChild
  const parsed = pure.parseFleetArgs(process.argv.slice(2))
  if ('usageError' in parsed) {
    log(`usage error: ${parsed.usageError}`)
    log(pure.FLEET_USAGE)
    return pure.fleetExitCode({ usageError: parsed.usageError })
  }
  for (const w of parsed.warnings) log(`warning: ${w}`)
  let config: FleetConfig = parsed.config

  // Resume first: the partial file IS the config, so it is read before
  // anything else and a bad one, or a conflicting flag, is exit 2 with nothing
  // written.
  let resumeRun: FleetRun | null = null
  let resumeFile: string | null = null
  if (config.resume) {
    resumeFile = path.resolve(repoRoot, config.resume)
    const r = loadRun(resumeFile)
    if ('error' in r || r.run.complete) {
      log(`--resume ${resumeFile} is unusable: ${'error' in r ? r.error : 'that run is complete, not a partial'}`)
      return pure.fleetExitCode({ unusable: true })
    }
    resumeRun = r.run
    const resumed = pure.resumeConfig({ cli: config, given: parsed.given, stored: resumeRun.config })
    if ('refuse' in resumed) {
      log(resumed.refuse)
      return pure.fleetExitCode({ unusable: true })
    }
    config = resumed.config
    log(`resuming ${resumeRun.runId} with the settings it started with: ${pure.fleetCommand(config)}`)
  }

  const outDir = path.resolve(repoRoot, config.outDir)
  const fromJson = config.fromJson != null

  // What code this run is. A resume on different code is refused: one run
  // file must not hold two engines' homes.
  const provenance: RunProvenance = {
    gitSha: git(['rev-parse', 'HEAD']),
    ...gitTreeState(outDir),
    dryRunScriptSha1: sha1OfFile(path.join(repoRoot, DRY_RUN_SCRIPT)),
  }
  if (resumeRun) {
    const changes = pure.resumeProvenanceChanges(resumeRun, provenance)
    if (changes.length > 0) {
      log(`--resume refused: the code changed since ${resumeRun.runId} started: ${changes.join('; ')}.`)
      log('A resumed run would score one fleet with two engines. Start a fresh run instead:')
      log(`  ${pure.fleetCommand(config)}`)
      return pure.fleetExitCode({ unusable: true })
    }
  }

  // Baseline before anything runs, so a bad requested one is exit 2 with nothing written.
  let baselineRun: FleetRun | null = null
  let baselineFile: string | null = null
  const source = pure.baselineSource(config, resumeRun ? { partialBaseline: resumeRun.baseline } : null)
  if (source.kind === 'latest') {
    const latest = path.join(outDir, 'latest.json')
    if (fs.existsSync(latest)) {
      const r = loadRun(latest)
      if ('run' in r) {
        baselineRun = r.run
        baselineFile = latest
      } else {
        const d = pure.baselineUnreadable('latest', rel(latest), r.error)
        if ('refuse' in d) {
          log(d.refuse)
          return pure.fleetExitCode({ unusable: true })
        }
        log(`warning: ${d.warn}`)
      }
    }
  } else if (source.kind === 'file') {
    const file = path.resolve(repoRoot, source.file)
    const r = loadRun(file)
    if ('error' in r) {
      const d = pure.baselineUnreadable('file', file, r.error)
      log('refuse' in d ? d.refuse : d.warn)
      return pure.fleetExitCode({ unusable: true })
    }
    baselineRun = r.run
    baselineFile = file
  } else if (source.kind === 'resume') {
    // The recorded file first; latest.json may since hold a newer run, so the
    // baseline's own <runId>.json beside it, and in this out-dir, next.
    const ref = source.ref
    const recorded = path.resolve(repoRoot, ref.file)
    const candidates = [
      ...new Set([recorded, path.join(path.dirname(recorded), `${ref.runId}.json`), path.join(outDir, `${ref.runId}.json`)]),
    ]
    const misses: string[] = []
    for (const f of candidates) {
      const r = loadRun(f)
      if ('run' in r && pure.isBaselineFor(ref, r.run)) {
        baselineRun = r.run
        baselineFile = f
        break
      }
      misses.push(`${rel(f)}: ${'error' in r ? r.error : `holds run ${r.run.runId}${r.run.complete ? '' : ' (partial)'}`}`)
    }
    if (!baselineRun) {
      const d = pure.baselineUnreadable('resume', `run ${ref.runId}`, misses.join('; '))
      log('refuse' in d ? d.refuse : d.warn)
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
  if (resumeFile && path.resolve(resumeFile) !== partialFile) {
    log(`note: the partial was read from ${rel(resumeFile)}; this run writes its partial to ${rel(partialFile)} and leaves the original in place`)
  }

  const meta = {
    schemaVersion: 1 as const,
    runId,
    startedAt,
    gitSha: provenance.gitSha,
    gitBranch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    gitDirty: provenance.gitDirty,
    gitDirtySha1: provenance.gitDirtySha1,
    dryRunScriptSha1: provenance.dryRunScriptSha1,
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
  /** The stop paths flush once more; a failed write there is reported, not thrown. */
  const flushPartialSafely = () => {
    try {
      flushPartial()
    } catch (e) {
      log(`could not write the partial file ${rel(partialFile)}: ${errText(e)}`)
    }
  }
  const printResumeHint = () => {
    if (fs.existsSync(partialFile)) log(`resume with: ${pure.resumeCommand(rel(partialFile))}`)
    else log(`no partial file was written; start a fresh run: ${pure.fleetCommand(config)}`)
  }

  let interrupted = false
  const onSignal = (sig: NodeJS.Signals) => {
    if (interrupted) {
      log(`${sig} again: exiting now; every in-flight child group gets SIGKILL`)
      process.exit(130)
    }
    interrupted = true
    stopping = true
    log(`\n${sig}: stopping launches, terminating ${inFlight.size} in-flight child group(s), flushing the partial file`)
    for (const c of inFlight) c.signal('SIGTERM')
    flushPartialSafely()
    printResumeHint()
    // The pool returns once its children settle and main exits 130; this is
    // the backstop for a child that ignores SIGTERM.
    void waitForChildren(KILL_GRACE_MS).then(() => {
      for (const c of inFlight) c.signal('SIGKILL')
      process.exit(130)
    })
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
  poolStarted = true
  let poolFailed = false
  let poolError: unknown = null
  try {
    await Promise.all(Array.from({ length: fromJson ? 1 : config.concurrency }, () => worker()))
  } catch (e) {
    poolFailed = true
    poolError = e
  }
  if (poolFailed) {
    // One worker threw; the others are still running children. Stop
    // launching, kill every in-flight group, keep what was scored.
    stopping = true
    log(`harness error mid-run: ${poolError instanceof Error ? (poolError.stack ?? poolError.message) : String(poolError)}`)
    log(`stopping: terminating ${inFlight.size} in-flight child group(s), flushing the partial file`)
    await stopChildren()
    flushPartialSafely()
    printResumeHint()
    return pure.fleetExitCode({ aborted: true })
  }
  if (stopping) return 130

  // Completion.
  const run = assemble(true)
  const runText = JSON.stringify(run, null, 2)
  const files: string[] = []
  writeAtomic(runFile, runText)
  files.push(rel(runFile))
  if (fs.existsSync(partialFile)) fs.unlinkSync(partialFile)
  const rawDirMb = rawDir ? dirSizeMb(rawDir) : null
  const report = () => pure.renderReport(run, { files, rawDirMb })
  if (run.totals.harnessErrors === 0 && config.latest) {
    writeAtomic(latestFile, runText)
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
    writeAtomic(dest, runText)
    files.push(rel(dest))
  }
  writeAtomic(reportFile, `# CMA fleet dry run ${runId}\n\n\`\`\`\n${report()}\n\`\`\`\n`)
  files.push(rel(reportFile))

  await writeStdout(config.json ? `${runText}\n` : `${report()}\n`)
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
    if ((e as NodeJS.ErrnoException)?.code === 'ERR_MODULE_NOT_FOUND' && /'@\//.test(errText(e))) {
      log('the @/ imports resolve through the tsconfig found from the current directory: run `npm run cma:fleet`, or tsx from the repo root')
    }
    // Before the pool nothing ran (2); after it started, a harness error (3).
    // The exit hook kills any child group still running.
    process.exit(poolStarted ? 3 : 2)
  })
