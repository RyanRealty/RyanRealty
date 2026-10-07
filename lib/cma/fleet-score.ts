/**
 * CMA fleet dry run: the PURE half (Matt 2026-10-07, "turn we fix what we hit
 * into measurable improvement").
 *
 * Everything that decides something lives here: flag parsing, the selection
 * filters and the city test, parsing one dry-run child's stdout, scoring one
 * home, diffing a run against the last baseline and against the stored rows,
 * the headline, the exit code, and the text report. The script
 * (scripts/cma-fleet-dryrun.ts) only wires: it reads the queue, fetches
 * coordinates and the polygon through the DAL, spawns the dry run per slug,
 * writes files, and prints what this module returns.
 *
 * Imports: types, and the two ring helpers from lib/geo/project-svg. Nothing
 * from the DAL graph, no fs, no child_process, no console, so every function
 * here runs under the vitest unit project without a database.
 */
import { outerRings, pointInRings, type Ring } from '@/lib/geo/project-svg'
import type { CmaQueueRow, CmaQueueState } from '@/lib/data/cma/unified-queue'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Rule 8's floor. The script passes lib/cma/comps MIN_COMPS in; this default
 * exists so the pure module never imports that module's DAL graph. The unit
 * test asserts the two are equal.
 */
export const FLEET_MIN_COMPS_DEFAULT = 5

/** Every CmaQueueState, as a runtime list the parser can validate against. */
export const CMA_QUEUE_STATES = [
  'ready',
  'audit-failed',
  'unvetted',
  'flagged',
  'queued',
  'sent',
  'archived',
  'failed',
  'building',
] as const satisfies readonly CmaQueueState[]

/** The open Bend expired set: everything a rebuild could still change. */
export const FLEET_DEFAULT_STATES: readonly CmaQueueState[] = ['failed', 'flagged', 'ready', 'audit-failed', 'unvetted']

/** The dry run hits production PostgREST; five was the safe ceiling on 2026-10-07. */
export const FLEET_MAX_CONCURRENCY = 5

export const FLEET_SCHEMA_VERSION = 1

// ---------------------------------------------------------------------------
// Config and flag parsing
// ---------------------------------------------------------------------------

export type FleetKind = 'expired' | 'fsbo' | 'all'

export type FleetConfig = {
  /** City slug for the boundaries polygon, or 'any' to skip the city test. */
  city: string
  states: CmaQueueState[]
  /** True when --states names 'archived' (flips listCmaQueue includeArchived). */
  includeArchived: boolean
  kind: FleetKind
  /** YYYY-MM-DD, applied to (offMarketAt ?? createdAt) at UTC midnight. */
  since: string | null
  limit: number | null
  /** Explicit slug list; replaces the queue filters when set. */
  slugs: string[] | null
  concurrency: number
  timeoutSec: number
  retries: number
  resume: string | null
  outDir: string
  raw: boolean
  latest: boolean
  saveAs: string | null
  /** 'auto' (latest.json when present), 'none', or an explicit file. */
  baseline: string
  priceThresholdPct: number
  allowRegressions: boolean
  json: boolean
  dry: boolean
  /** Print the selected slugs, one per line, and exit. */
  dryList: boolean
  /** Score already-captured dry-run JSON files from this directory; no queue, no engine. */
  fromJson: string | null
}

const VALUE_FLAGS = new Set([
  '--city',
  '--states',
  '--kind',
  '--since',
  '--limit',
  '--slugs',
  '--concurrency',
  '--timeout-sec',
  '--retries',
  '--resume',
  '--out-dir',
  '--save-as',
  '--baseline',
  '--price-threshold-pct',
  '--from-json',
])

const BOOL_FLAGS = new Set(['--no-raw', '--no-latest', '--allow-regressions', '--json', '--dry', '--dry-list'])

export const FLEET_USAGE =
  'usage: npm run cma:fleet -- [--city bend|any] [--states csv] [--kind expired|fsbo|all] [--since YYYY-MM-DD] ' +
  '[--limit N] [--slugs csv]... [--concurrency N] [--timeout-sec N] [--retries N] [--out-dir dir] ' +
  '[--no-raw] [--no-latest] [--save-as path] [--baseline file|none] [--price-threshold-pct N] [--allow-regressions] ' +
  '[--json] [--dry] [--dry-list] [--from-json dir]\n' +
  '       npm run cma:fleet -- --resume <out-dir>/<runId>.partial.json   (every setting comes from the partial file)'

function parseInteger(raw: string, flag: string, min: number): number | { usageError: string } {
  if (!/^-?\d+$/.test(raw.trim())) return { usageError: `${flag} needs an integer, got '${raw}'` }
  const n = Number(raw.trim())
  if (n < min) return { usageError: `${flag} must be >= ${min}, got ${n}` }
  return n
}

function isUsageError(v: unknown): v is { usageError: string } {
  return typeof v === 'object' && v != null && 'usageError' in v
}

function csvTokens(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
}

/**
 * One value per flag (--flag value), booleans take none, anything else is a
 * usage error. `given` lists every flag the command line named, in order, once
 * each: --resume refuses any of them that disagrees with the partial file.
 */
export function parseFleetArgs(
  argv: readonly string[],
): { config: FleetConfig; warnings: string[]; given: string[] } | { usageError: string } {
  const values = new Map<string, string>()
  const slugLists: string[] = []
  const bools = new Set<string>()
  const given: string[] = []
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i]!
    if (!tok.startsWith('--')) return { usageError: `unexpected argument '${tok}' (slugs go through --slugs)` }
    if (!given.includes(tok) && (BOOL_FLAGS.has(tok) || VALUE_FLAGS.has(tok))) given.push(tok)
    if (BOOL_FLAGS.has(tok)) {
      bools.add(tok)
      continue
    }
    if (!VALUE_FLAGS.has(tok)) return { usageError: `unknown flag '${tok}'` }
    const value = argv[i + 1]
    if (value == null || value.startsWith('--')) return { usageError: `${tok} needs a value` }
    i += 1
    if (tok === '--slugs') slugLists.push(value)
    else values.set(tok, value)
  }

  const warnings: string[] = []
  const config: FleetConfig = {
    city: 'bend',
    states: [...FLEET_DEFAULT_STATES],
    includeArchived: false,
    kind: 'expired',
    since: null,
    limit: null,
    slugs: null,
    concurrency: 3,
    timeoutSec: 600,
    retries: 1,
    resume: null,
    outDir: 'out/cma-fleet',
    raw: !bools.has('--no-raw'),
    latest: !bools.has('--no-latest'),
    saveAs: null,
    baseline: 'auto',
    priceThresholdPct: 1,
    allowRegressions: bools.has('--allow-regressions'),
    json: bools.has('--json'),
    dry: bools.has('--dry'),
    dryList: bools.has('--dry-list'),
    fromJson: null,
  }

  const city = values.get('--city')
  if (city != null) {
    const slug = city.trim().toLowerCase()
    if (!slug) return { usageError: '--city needs a slug or any' }
    config.city = slug
  }

  const states = values.get('--states')
  if (states != null) {
    const tokens = csvTokens(states)
    if (tokens.length === 0) return { usageError: '--states needs at least one state' }
    const known = new Set<string>(CMA_QUEUE_STATES)
    const bad = tokens.filter((t) => !known.has(t))
    if (bad.length) return { usageError: `--states: unknown state '${bad[0]}' (valid: ${CMA_QUEUE_STATES.join(', ')})` }
    config.states = [...new Set(tokens)] as CmaQueueState[]
  }
  config.includeArchived = config.states.includes('archived')

  const kind = values.get('--kind')
  if (kind != null) {
    const k = kind.trim().toLowerCase()
    if (k !== 'expired' && k !== 'fsbo' && k !== 'all') return { usageError: `--kind must be expired, fsbo or all, got '${kind}'` }
    config.kind = k
  }

  const since = values.get('--since')
  if (since != null) {
    const s = since.trim()
    const ms = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T00:00:00.000Z`) : NaN
    if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== s) {
      return { usageError: `--since must be a real YYYY-MM-DD date, got '${since}'` }
    }
    config.since = s
  }

  const limit = values.get('--limit')
  if (limit != null) {
    const n = parseInteger(limit, '--limit', 1)
    if (isUsageError(n)) return n
    config.limit = n
  }

  if (slugLists.length) {
    const merged = [...new Set(slugLists.flatMap(csvTokens))]
    if (merged.length === 0) return { usageError: '--slugs needs at least one slug' }
    config.slugs = merged
  }

  const concurrency = values.get('--concurrency')
  if (concurrency != null) {
    const n = parseInteger(concurrency, '--concurrency', 1)
    if (isUsageError(n)) return n
    if (n > FLEET_MAX_CONCURRENCY) {
      warnings.push(`--concurrency ${n} clamped to ${FLEET_MAX_CONCURRENCY}: the dry run hits production PostgREST`)
      config.concurrency = FLEET_MAX_CONCURRENCY
    } else config.concurrency = n
  }

  const timeoutSec = values.get('--timeout-sec')
  if (timeoutSec != null) {
    const n = parseInteger(timeoutSec, '--timeout-sec', 1)
    if (isUsageError(n)) return n
    config.timeoutSec = n
  }

  const retries = values.get('--retries')
  if (retries != null) {
    const n = parseInteger(retries, '--retries', 0)
    if (isUsageError(n)) return n
    config.retries = n
  }

  const threshold = values.get('--price-threshold-pct')
  if (threshold != null) {
    const n = Number(threshold.trim())
    if (!Number.isFinite(n) || n < 0) return { usageError: `--price-threshold-pct must be a number >= 0, got '${threshold}'` }
    config.priceThresholdPct = n
  }

  const baseline = values.get('--baseline')
  if (baseline != null) {
    const b = baseline.trim()
    if (!b) return { usageError: '--baseline needs a file path or none' }
    config.baseline = b.toLowerCase() === 'none' ? 'none' : b
  }

  for (const [flag, key] of [
    ['--resume', 'resume'],
    ['--out-dir', 'outDir'],
    ['--save-as', 'saveAs'],
    ['--from-json', 'fromJson'],
  ] as const) {
    const v = values.get(flag)
    if (v == null) continue
    if (!v.trim()) return { usageError: `${flag} needs a path` }
    config[key] = v.trim()
  }

  return { config, warnings, given }
}

// ---------------------------------------------------------------------------
// Resume: the partial file is the config, and the code must not have moved
// ---------------------------------------------------------------------------

/** The FleetConfig key each command-line flag sets (--resume aside). */
const FLAG_KEY: ReadonlyMap<string, keyof FleetConfig> = new Map<string, keyof FleetConfig>([
  ['--city', 'city'],
  ['--states', 'states'],
  ['--kind', 'kind'],
  ['--since', 'since'],
  ['--limit', 'limit'],
  ['--slugs', 'slugs'],
  ['--concurrency', 'concurrency'],
  ['--timeout-sec', 'timeoutSec'],
  ['--retries', 'retries'],
  ['--out-dir', 'outDir'],
  ['--save-as', 'saveAs'],
  ['--baseline', 'baseline'],
  ['--price-threshold-pct', 'priceThresholdPct'],
  ['--from-json', 'fromJson'],
  ['--no-raw', 'raw'],
  ['--no-latest', 'latest'],
  ['--allow-regressions', 'allowRegressions'],
  ['--json', 'json'],
  ['--dry', 'dry'],
  ['--dry-list', 'dryList'],
])

function defaultFleetConfig(): FleetConfig {
  const parsed = parseFleetArgs([])
  if ('usageError' in parsed) throw new Error(parsed.usageError)
  return parsed.config
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isStrOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'

/**
 * A partial file's stored config, checked field by field. Null when anything
 * is missing or the wrong type: a resume never guesses a setting.
 */
export function readStoredConfig(stored: unknown): FleetConfig | null {
  if (typeof stored !== 'object' || stored == null || Array.isArray(stored)) return null
  const c = stored as Record<string, unknown>
  const known = new Set<string>(CMA_QUEUE_STATES)
  const ok =
    isStr(c.city) &&
    Array.isArray(c.states) &&
    c.states.length > 0 &&
    c.states.every((s) => isStr(s) && known.has(s)) &&
    isBool(c.includeArchived) &&
    (c.kind === 'expired' || c.kind === 'fsbo' || c.kind === 'all') &&
    isStrOrNull(c.since) &&
    (c.limit === null || isNum(c.limit)) &&
    (c.slugs === null || (Array.isArray(c.slugs) && c.slugs.every(isStr))) &&
    isNum(c.concurrency) &&
    isNum(c.timeoutSec) &&
    isNum(c.retries) &&
    isStrOrNull(c.resume) &&
    isStr(c.outDir) &&
    isBool(c.raw) &&
    isBool(c.latest) &&
    isStrOrNull(c.saveAs) &&
    isStr(c.baseline) &&
    isNum(c.priceThresholdPct) &&
    isBool(c.allowRegressions) &&
    isBool(c.json) &&
    isBool(c.dry) &&
    isBool(c.dryList) &&
    isStrOrNull(c.fromJson)
  if (!ok) return null
  return {
    city: c.city as string,
    states: [...(c.states as CmaQueueState[])],
    includeArchived: c.includeArchived as boolean,
    kind: c.kind as FleetKind,
    since: c.since as string | null,
    limit: c.limit as number | null,
    slugs: c.slugs == null ? null : [...(c.slugs as string[])],
    concurrency: c.concurrency as number,
    timeoutSec: c.timeoutSec as number,
    retries: c.retries as number,
    resume: c.resume as string | null,
    outDir: c.outDir as string,
    raw: c.raw as boolean,
    latest: c.latest as boolean,
    saveAs: c.saveAs as string | null,
    baseline: c.baseline as string,
    priceThresholdPct: c.priceThresholdPct as number,
    allowRegressions: c.allowRegressions as boolean,
    json: c.json as boolean,
    dry: c.dry as boolean,
    dryList: c.dryList as boolean,
    fromJson: c.fromJson as string | null,
  }
}

/** Order-free for the two list flags, so `--states a,b` matches a stored [b, a]. */
function comparable(key: keyof FleetConfig, v: unknown): string {
  if ((key === 'states' || key === 'slugs') && Array.isArray(v)) return JSON.stringify([...v].sort())
  return JSON.stringify(v ?? null)
}

function shown(v: unknown): string {
  if (Array.isArray(v)) return v.join(',')
  return v == null ? 'none' : String(v)
}

/**
 * --resume <partial>: every setting comes from the partial file (selection,
 * out-dir, baseline, raw, latest, concurrency, timeouts, output format), so the
 * printed resume command needs nothing but the file. A flag on the command
 * line that names the stored value is harmless; one that disagrees is refused,
 * because the resumed run would otherwise select or write differently from the
 * run it continues.
 */
export function resumeConfig(args: {
  cli: FleetConfig
  given: readonly string[]
  stored: unknown
}): { config: FleetConfig } | { refuse: string } {
  const stored = readStoredConfig(args.stored)
  if (!stored) return { refuse: "--resume: the partial file's config is missing or unreadable; start a fresh run" }
  const conflicts: string[] = []
  for (const flag of args.given) {
    const key = FLAG_KEY.get(flag)
    if (!key) continue
    if (comparable(key, args.cli[key]) === comparable(key, stored[key])) continue
    const typed = VALUE_FLAGS.has(flag) ? `${flag} ${shown(args.cli[key])}` : flag
    conflicts.push(`${typed} (the partial has ${key} ${shown(stored[key])})`)
  }
  if (conflicts.length > 0) {
    return {
      refuse:
        `--resume takes every setting from the partial file, and ${conflicts.length === 1 ? 'this flag disagrees' : 'these flags disagree'} ` +
        `with it: ${conflicts.join('; ')}. Drop ${conflicts.length === 1 ? 'it' : 'them'} to resume, or start a fresh run without --resume.`,
    }
  }
  return { config: { ...stored, resume: args.cli.resume, dry: false, dryList: false } }
}

/**
 * The flags that reproduce a config's run: everything that differs from the
 * defaults, never --resume, --dry or --dry-list. parseFleetArgs of the result
 * gives the config back (the unit test round-trips it).
 */
export function fleetArgsFor(config: FleetConfig): string[] {
  const d = defaultFleetConfig()
  const out: string[] = []
  const value = (flag: string, v: string) => out.push(flag, v)
  if (config.city !== d.city) value('--city', config.city)
  if (JSON.stringify(config.states) !== JSON.stringify(d.states)) value('--states', config.states.join(','))
  if (config.kind !== d.kind) value('--kind', config.kind)
  if (config.since != null) value('--since', config.since)
  if (config.limit != null) value('--limit', String(config.limit))
  if (config.slugs != null) value('--slugs', config.slugs.join(','))
  if (config.concurrency !== d.concurrency) value('--concurrency', String(config.concurrency))
  if (config.timeoutSec !== d.timeoutSec) value('--timeout-sec', String(config.timeoutSec))
  if (config.retries !== d.retries) value('--retries', String(config.retries))
  if (config.outDir !== d.outDir) value('--out-dir', config.outDir)
  if (!config.raw) out.push('--no-raw')
  if (!config.latest) out.push('--no-latest')
  if (config.saveAs != null) value('--save-as', config.saveAs)
  if (config.baseline !== d.baseline) value('--baseline', config.baseline)
  if (config.priceThresholdPct !== d.priceThresholdPct) value('--price-threshold-pct', String(config.priceThresholdPct))
  if (config.allowRegressions) out.push('--allow-regressions')
  if (config.json) out.push('--json')
  if (config.fromJson != null) value('--from-json', config.fromJson)
  return out
}

/** POSIX single-quoting, only when the word needs it. */
export function shellQuote(word: string): string {
  return /^[A-Za-z0-9_\-.,/:=@+%]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`
}

function npmCommand(args: readonly string[]): string {
  return args.length === 0 ? 'npm run cma:fleet' : `npm run cma:fleet -- ${args.map(shellQuote).join(' ')}`
}

/** The fresh-run command for a config (what an operator types to start over). */
export function fleetCommand(config: FleetConfig): string {
  return npmCommand(fleetArgsFor(config))
}

/** The whole resume command: the partial file carries every other setting. */
export function resumeCommand(partialFile: string): string {
  return npmCommand(['--resume', partialFile])
}

/**
 * What a run's code was. gitDirtySha1 fingerprints the uncommitted changes
 * (paths and contents), null on a clean tree, so two dirty runs at one commit
 * can be told apart.
 */
export type RunProvenance = {
  gitSha: string
  gitDirty: boolean | 'unknown'
  gitDirtySha1: string | null
  dryRunScriptSha1: string
}

const unknownish = (v: unknown): boolean => v == null || v === 'unknown'

/**
 * Why a partial cannot be resumed on this code, one line per change; empty
 * when it can. A resume must score the rest of the fleet with the same engine
 * as the first part, so the commit, the working tree, and the dry-run script
 * must all match, and a value that cannot be read on either side is a change,
 * because sameness cannot be proven.
 */
export function resumeProvenanceChanges(
  partial: Partial<Record<keyof RunProvenance, unknown>>,
  current: RunProvenance,
): string[] {
  const changes: string[] = []
  if (unknownish(partial.gitSha) || unknownish(current.gitSha)) {
    changes.push(`commit unknown (partial ${shown(partial.gitSha)}, now ${current.gitSha}): sameness cannot be proven`)
  } else if (partial.gitSha !== current.gitSha) {
    changes.push(`commit ${shown(partial.gitSha)} -> ${current.gitSha}`)
  }
  const tree = (v: unknown) => (v === true ? 'dirty' : v === false ? 'clean' : 'unknown')
  if (unknownish(partial.gitDirty) || unknownish(current.gitDirty)) {
    changes.push(`working tree state unknown (partial ${tree(partial.gitDirty)}, now ${tree(current.gitDirty)}): sameness cannot be proven`)
  } else if (partial.gitDirty !== current.gitDirty) {
    changes.push(`working tree ${tree(partial.gitDirty)} -> ${tree(current.gitDirty)}`)
  } else if (current.gitDirty === true) {
    const before = typeof partial.gitDirtySha1 === 'string' ? partial.gitDirtySha1 : null
    if (before == null || current.gitDirtySha1 == null) {
      changes.push('uncommitted changes cannot be compared (no fingerprint recorded)')
    } else if (before !== current.gitDirtySha1) {
      changes.push(`uncommitted changes differ (fingerprint ${before.slice(0, 12)} -> ${current.gitDirtySha1.slice(0, 12)})`)
    }
  }
  if (unknownish(partial.dryRunScriptSha1) || unknownish(current.dryRunScriptSha1)) {
    changes.push('scripts/cma-build-dryrun.ts sha1 unknown: sameness cannot be proven')
  } else if (partial.dryRunScriptSha1 !== current.dryRunScriptSha1) {
    changes.push(`scripts/cma-build-dryrun.ts sha1 ${shown(partial.dryRunScriptSha1).slice(0, 12)} -> ${current.dryRunScriptSha1.slice(0, 12)}`)
  }
  return changes
}

/**
 * Two runs ran the same code: one commit, and either both trees clean or both
 * dirty with the same fingerprint. Anything unreadable is not the same.
 */
export function sameCode(a: Partial<Record<keyof RunProvenance, unknown>>, b: Partial<Record<keyof RunProvenance, unknown>>): boolean {
  if (unknownish(a.gitSha) || a.gitSha !== b.gitSha) return false
  if (a.gitDirty === false && b.gitDirty === false) return true
  return (
    a.gitDirty === true &&
    b.gitDirty === true &&
    typeof a.gitDirtySha1 === 'string' &&
    a.gitDirtySha1 === b.gitDirtySha1
  )
}

// ---------------------------------------------------------------------------
// Baseline choice, queue read, child outcome
// ---------------------------------------------------------------------------

export type BaselineSource =
  | { kind: 'none' }
  /** --baseline auto: out-dir/latest.json when it exists and reads, else no baseline. */
  | { kind: 'latest' }
  | { kind: 'file'; file: string }
  /** A resume diffs against the run its partial recorded, never a newer latest.json. */
  | { kind: 'resume'; ref: BaselineRef }

export function baselineSource(config: Pick<FleetConfig, 'baseline'>, resume: { partialBaseline: BaselineRef | null } | null): BaselineSource {
  if (resume) return resume.partialBaseline ? { kind: 'resume', ref: resume.partialBaseline } : { kind: 'none' }
  if (config.baseline === 'none') return { kind: 'none' }
  if (config.baseline === 'auto') return { kind: 'latest' }
  return { kind: 'file', file: config.baseline }
}

/**
 * A baseline file that does not read. latest.json under the default 'auto'
 * is a convenience, so a corrupt one warns with the recovery and the run goes
 * on with no baseline; an explicit --baseline file, or the baseline a partial
 * recorded, is a request, so it refuses.
 */
export function baselineUnreadable(
  kind: 'latest' | 'file' | 'resume',
  file: string,
  error: string,
): { warn: string } | { refuse: string } {
  if (kind === 'latest') {
    return {
      warn:
        `${file} is unreadable (${error}); continuing with NO baseline, so nothing below is diffed. ` +
        `To recover: delete ${file}, or pass --baseline none. A clean run (no harness errors) writes a fresh latest.json.`,
    }
  }
  if (kind === 'file') return { refuse: `--baseline ${file} is unusable: ${error}` }
  return { refuse: `the partial's baseline ${file} is unusable: ${error}; start a fresh run` }
}

/** A run the partial named as its baseline: same runId, complete. */
export function isBaselineFor(ref: Pick<BaselineRef, 'runId'>, run: Pick<FleetRun, 'runId' | 'complete'>): boolean {
  return run.runId === ref.runId && run.complete === true
}

/**
 * listCmaQueue's read. An explicit --slugs list includes archived rows, so a
 * listed archived slug still carries its stored fields instead of reading as
 * "no queue row".
 */
export function queueReadOptions(config: Pick<FleetConfig, 'includeArchived' | 'slugs'>): { includeArchived: boolean } {
  return { includeArchived: config.includeArchived || config.slugs != null }
}

/** What one child process came back as, before its stdout is read. */
export type ChildOutcomeLike = {
  spawnError: string | null
  overflow: boolean
  timedOut: boolean
  signal: string | null
  exitCode: number | null
}

/**
 * Why a child gave no usable result, or null when its stdout should be
 * parsed. The order is the cause: a spawn failure, then our own kills
 * (overflow, timeout), then a signal from elsewhere, then a nonzero exit.
 */
export function childHarnessReason(c: ChildOutcomeLike): string | null {
  if (c.spawnError) return `spawn-error ${c.spawnError}`
  if (c.overflow) return 'stdout-overflow'
  if (c.timedOut) return 'timeout'
  if (c.signal) return 'signal'
  if (c.exitCode !== 0) return 'nonzero-exit'
  return null
}

// ---------------------------------------------------------------------------
// The dry run's shape, read defensively
// ---------------------------------------------------------------------------

export type HomeStage = 'subject' | 'comps' | 'pricing' | 'contract' | 'complete' | 'harness'

/**
 * The subset of scripts/cma-build-dryrun.ts's DryRun this module reads.
 * Declared here, structurally, so lib/ never imports scripts/. Every field but
 * slug and ok is optional and read through the helpers below.
 */
export type DryRunLike = {
  slug: string
  ok: boolean
  stage?: string | null
  address?: string | null
  city?: string | null
  pricingSource?: string | null
  compCount?: number | null
  comps?: Array<{ key?: string | null }> | null
  recommended?: number | null
  range?: ReadonlyArray<number | null> | null
  valueRange?: ReadonlyArray<number | null> | null
  confidence?: string | number | null
  compPpsfCv?: number | null
  needsReview?: boolean | null
  reviewReason?: string | null
  hardFailures?: string[] | null
  keptCompCount?: number | null
  subjectLastAsk?: { price?: number | null; date?: string | null; historyLine?: string | null } | null
  queueStateStored?: string | null
  queueState?: string | null
  error?: string | null
}

const ENGINE_STAGES: ReadonlySet<string> = new Set(['subject', 'comps', 'pricing', 'contract', 'complete'])

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function stageOf(dry: DryRunLike): Exclude<HomeStage, 'harness'> {
  const s = typeof dry.stage === 'string' ? dry.stage : ''
  if (ENGINE_STAGES.has(s)) return s as Exclude<HomeStage, 'harness'>
  return dry.ok === true ? 'complete' : 'subject'
}

function hardFailuresOf(dry: DryRunLike): string[] {
  return Array.isArray(dry.hardFailures) ? dry.hardFailures.filter((f): f is string => typeof f === 'string') : []
}

export type ParsedDryRunStdout =
  | { dry: DryRunLike; notes: string[] }
  | { harnessReason: 'no-json' | 'bad-json' | 'not-array' | 'slug-mismatch' }

/**
 * The dry run prints `JSON.stringify(out, null, 2)` last, so its outer
 * brackets sit at column 0 and nothing else on stdout does (the actives-settle
 * line and lib logs are indented). Take the last column-0 closer and the
 * nearest column-0 opener before it; everything before that is a note.
 */
export function parseDryRunStdout(stdout: string, expectedSlug: string): ParsedDryRunStdout {
  const lines = stdout.split('\n').map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l))
  let end = -1
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i] === ']' || lines[i] === '}') {
      end = i
      break
    }
  }
  if (end < 0) return { harnessReason: 'no-json' }
  let start = -1
  for (let i = end - 1; i >= 0; i -= 1) {
    if (lines[i] === '[' || lines[i] === '{') {
      start = i
      break
    }
  }
  if (start < 0) return { harnessReason: 'no-json' }
  let parsed: unknown
  try {
    parsed = JSON.parse(lines.slice(start, end + 1).join('\n'))
  } catch {
    return { harnessReason: 'bad-json' }
  }
  if (!Array.isArray(parsed) || parsed.length < 1) return { harnessReason: 'not-array' }
  const first = parsed[0] as Record<string, unknown> | null
  if (!first || typeof first !== 'object' || typeof first.slug !== 'string' || typeof first.ok !== 'boolean') {
    return { harnessReason: 'not-array' }
  }
  if (first.slug !== expectedSlug) return { harnessReason: 'slug-mismatch' }
  const notes = lines
    .slice(0, start)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  return { dry: first as unknown as DryRunLike, notes }
}

/**
 * The one line a report prints for a failure: the first hard failure on a
 * contract stop, else the error's first line before any ' | ' join, capped at
 * 200 characters. Null when the home built.
 */
export function firstReasonLine(dry: DryRunLike): string | null {
  if (dry.ok === true) return null
  const hard = hardFailuresOf(dry)
  const raw = stageOf(dry) === 'contract' && hard.length > 0 ? hard[0]! : strOrNull(dry.error)
  if (!raw) return null
  const line = raw.split('\n')[0]!.split(' | ')[0]!.trim()
  if (!line) return null
  return line.length > 200 ? line.slice(0, 200) : line
}

// ---------------------------------------------------------------------------
// Rule 3
// ---------------------------------------------------------------------------

export type HoldReason = 'over-ask' | 'under-ask-15'

/**
 * SKILL.md §0.3 rule 3, in whole dollars: more than 15% under the last ask or
 * any amount over it is a hold; exactly 15% under is not. `(ask - rec) * 20 >
 * ask * 3` is `rec < ask * 0.85` without the float, so it agrees with
 * lib/cma/gap-hold.ts on every whole-dollar pair. Null when either side is
 * missing or not a price: the rule never invents a number.
 */
export function ruleThreeHold(
  recommended: number | null | undefined,
  lastAsk: number | null | undefined,
): { hold: boolean | null; holdReason: HoldReason | null } {
  if (recommended == null || lastAsk == null) return { hold: null, holdReason: null }
  if (!Number.isFinite(recommended) || !Number.isFinite(lastAsk)) return { hold: null, holdReason: null }
  const rec = Math.round(recommended)
  const ask = Math.round(lastAsk)
  if (ask <= 0 || rec <= 0) return { hold: null, holdReason: null }
  if (rec > ask) return { hold: true, holdReason: 'over-ask' }
  if ((ask - rec) * 20 > ask * 3) return { hold: true, holdReason: 'under-ask-15' }
  return { hold: false, holdReason: null }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export type CityMatch = 'polygon' | 'name-fallback' | 'skipped'

/** What the queue knows about a home before the engine runs on it. */
export type SelectedHome = {
  slug: string
  address: string | null
  city: string | null
  stateAtSelection: CmaQueueState | null
  prospectKind: 'expired' | 'fsbo' | null
  docType: string | null
  offMarketAt: string | null
  createdAt: string | null
  storedRecommended: number | null
  storedCompsCount: number | null
  storedBuildError: string | null
  storedNeedsReview: boolean | null
  theirPrice: number | null
  lat: number | null
  lng: number | null
  inside: boolean | null
  cityMatch: CityMatch
}

/** The queue row fields selection reads; a structural subset of CmaQueueRow. */
export type QueueRowLike = Pick<
  CmaQueueRow,
  | 'slug'
  | 'docKind'
  | 'docType'
  | 'state'
  | 'prospectKind'
  | 'offMarketAt'
  | 'createdAt'
  | 'address'
  | 'city'
  | 'recommendedList'
  | 'compsCount'
  | 'buildError'
  | 'needsReview'
  | 'theirPrice'
>

export type Coordinates = { lat: number; lng: number }

export type SelectionCounts = {
  queueRows: number
  queueTruncated: boolean
  afterDocKind: number
  afterKind: number
  afterStates: number
  afterSince: number
  withCoordinates: number
  insidePolygon: number
  outsidePolygon: number
  nameFallback: number
  afterLimit: number
  boundarySource: { geoType: 'city'; geoSlug: string; rings: number } | null
}

function kindMatches(row: QueueRowLike, kind: FleetKind): boolean {
  if (kind === 'all') return true
  if (kind === 'expired') return row.prospectKind === 'expired' || row.docType === 'expired-audit'
  return row.prospectKind === 'fsbo'
}

function sinceMatches(row: QueueRowLike, since: string | null): boolean {
  if (!since) return true
  const stamp = row.offMarketAt ?? row.createdAt
  if (!stamp) return false
  const ms = Date.parse(stamp)
  return Number.isFinite(ms) && ms >= Date.parse(`${since}T00:00:00.000Z`)
}

/**
 * Step d: the filters that need no coordinates (docKind, --kind, --states,
 * --since), each with its surviving count. The script runs this first so it
 * fetches coordinates for the survivors only; selectHomes runs it again.
 */
export function prefilterQueueRows<T extends QueueRowLike>(
  rows: readonly T[],
  config: Pick<FleetConfig, 'kind' | 'states' | 'since'>,
): { rows: T[]; afterDocKind: number; afterKind: number; afterStates: number; afterSince: number } {
  const afterDocKind = rows.filter((r) => r.docKind === 'cma')
  const afterKind = afterDocKind.filter((r) => kindMatches(r, config.kind))
  const stateSet = new Set<string>(config.states)
  const afterStates = afterKind.filter((r) => stateSet.has(r.state))
  const afterSince = afterStates.filter((r) => sinceMatches(r, config.since))
  return {
    rows: afterSince,
    afterDocKind: afterDocKind.length,
    afterKind: afterKind.length,
    afterStates: afterStates.length,
    afterSince: afterSince.length,
  }
}

/** Point-in-polygon against the outer rings of a Polygon or MultiPolygon (any ring wins). */
export function subjectInsideCity(lng: number, lat: number, geometry: GeoJSON.Geometry | null | undefined): boolean {
  const rings = outerRings(geometry)
  return rings.length > 0 && pointInRings(lng, lat, rings)
}

function cityTest(
  row: QueueRowLike | null,
  coords: Coordinates | undefined,
  config: Pick<FleetConfig, 'city'>,
  rings: readonly Ring[],
): { cityMatch: CityMatch; inside: boolean | null; keep: boolean } {
  if (config.city === 'any' || !row) return { cityMatch: 'skipped', inside: null, keep: true }
  if (coords) {
    const inside = pointInRings(coords.lng, coords.lat, rings)
    return { cityMatch: 'polygon', inside, keep: inside }
  }
  const keep = (row.city ?? '').trim().toLowerCase() === config.city
  return { cityMatch: 'name-fallback', inside: null, keep }
}

function toSelectedHome(
  slug: string,
  row: QueueRowLike | null,
  coords: Coordinates | undefined,
  test: { cityMatch: CityMatch; inside: boolean | null },
): SelectedHome {
  return {
    slug,
    address: row ? strOrNull(row.address) : null,
    city: row?.city ?? null,
    stateAtSelection: row?.state ?? null,
    prospectKind: row?.prospectKind ?? null,
    docType: row?.docType ?? null,
    offMarketAt: row?.offMarketAt ?? null,
    createdAt: row?.createdAt ?? null,
    storedRecommended: row?.recommendedList ?? null,
    storedCompsCount: row?.compsCount ?? null,
    storedBuildError: row?.buildError ?? null,
    storedNeedsReview: row ? row.needsReview === true : null,
    theirPrice: row?.theirPrice ?? null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    inside: test.inside,
    cityMatch: test.cityMatch,
  }
}

/**
 * Step f: the queue filters again, then the city test, then a deterministic
 * sort by slug and --limit. With --slugs the list replaces the filters and the
 * city test is recorded but never drops a home.
 */
export function selectHomes(
  rows: readonly QueueRowLike[],
  opts: {
    config: FleetConfig
    rings: readonly Ring[]
    coordsBySlug: ReadonlyMap<string, Coordinates>
    queueTruncated?: boolean
  },
): { homes: SelectedHome[]; counts: SelectionCounts } {
  const { config, rings, coordsBySlug } = opts
  const boundarySource =
    config.city === 'any' ? null : { geoType: 'city' as const, geoSlug: config.city, rings: rings.length }
  let withCoordinates = 0
  let insidePolygon = 0
  let outsidePolygon = 0
  let nameFallback = 0
  const homes: SelectedHome[] = []

  const tally = (coords: Coordinates | undefined, test: { cityMatch: CityMatch; inside: boolean | null; keep: boolean }) => {
    if (coords) withCoordinates += 1
    if (test.cityMatch === 'polygon') {
      if (test.inside) insidePolygon += 1
      else outsidePolygon += 1
    } else if (test.cityMatch === 'name-fallback' && test.keep) nameFallback += 1
  }

  let afterDocKind: number
  let afterKind: number
  let afterStates: number
  let afterSince: number

  if (config.slugs) {
    // A cma row wins over a bpo row carrying the same slug; a slug with no row
    // still runs, with nothing stored to compare against.
    const bySlug = new Map<string, QueueRowLike>()
    for (const r of rows) {
      const prev = bySlug.get(r.slug)
      if (!prev || (prev.docKind !== 'cma' && r.docKind === 'cma')) bySlug.set(r.slug, r)
    }
    afterDocKind = afterKind = afterStates = afterSince = config.slugs.length
    for (const slug of config.slugs) {
      const row = bySlug.get(slug) ?? null
      const coords = coordsBySlug.get(slug)
      const test = cityTest(row, coords, config, rings)
      tally(coords, test)
      homes.push(toSelectedHome(slug, row, coords, test))
    }
  } else {
    const pre = prefilterQueueRows(rows, config)
    afterDocKind = pre.afterDocKind
    afterKind = pre.afterKind
    afterStates = pre.afterStates
    afterSince = pre.afterSince
    for (const row of pre.rows) {
      const coords = coordsBySlug.get(row.slug)
      const test = cityTest(row, coords, config, rings)
      tally(coords, test)
      if (test.keep) homes.push(toSelectedHome(row.slug, row, coords, test))
    }
  }

  homes.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
  const limited = config.limit != null ? homes.slice(0, config.limit) : homes
  return {
    homes: limited,
    counts: {
      queueRows: rows.length,
      queueTruncated: opts.queueTruncated === true,
      afterDocKind,
      afterKind,
      afterStates,
      afterSince,
      withCoordinates,
      insidePolygon,
      outsidePolygon,
      nameFallback,
      afterLimit: limited.length,
      boundarySource,
    },
  }
}

// ---------------------------------------------------------------------------
// Scoring one home
// ---------------------------------------------------------------------------

export type HomeOutcome = 'build' | 'fail' | 'harness-error'
export type VerdictVsStored = 'now-builds' | 'now-fails' | 'price-moved' | 'same' | 'n/a'

/** What the script hands scoreHome: a parsed dry run, or why there is none. */
export type HomeRunResult = {
  dry?: DryRunLike | null
  notes?: string[]
  /** Set when the child gave no usable result (timeout, crash, bad stdout). */
  harnessReason?: string | null
  stderr?: string | null
  rawPath?: string | null
  attempts?: number
  exitCode?: number | null
  signal?: string | null
  timedOut?: boolean
  durationMs?: number
}

export type HomeScore = {
  slug: string
  address: string | null
  city: string | null
  stateAtSelection: CmaQueueState | null
  prospectKind: 'expired' | 'fsbo' | null
  docType: string | null
  cityMatch: CityMatch
  inside: boolean | null
  lat: number | null
  lng: number | null

  outcome: HomeOutcome
  stage: HomeStage
  reason: string | null
  hardFailures: string[]

  comps: number
  compsFound: number
  compKeys: string[]
  minCompsOk: boolean
  pricingSource: string | null

  recommended: number | null
  conservative: number | null
  highEnd: number | null
  valueLow: number | null
  valueHigh: number | null
  confidence: string | number | null
  compPpsfCv: number | null
  lastAsk: number | null
  askSource: 'dry-run' | 'queue' | null
  askDate: string | null
  pctVsAsk: number | null
  hold: boolean | null
  holdReason: HoldReason | null

  flagged: boolean
  reviewReason: string | null
  queueStateStored: string | null
  queueStateAfter: string | null

  storedBuilt: boolean | null
  storedRecommended: number | null
  storedCompsCount: number | null
  storedBuildError: string | null
  storedDeltaPct: number | null
  verdictVsStored: VerdictVsStored

  dryRunNotes: string[]
  attempts: number
  exitCode: number | null
  signal: string | null
  timedOut: boolean
  durationMs: number
  rawPath: string | null
  ranAt: string
}

/** One decimal, signed, never -0. */
function pct1(n: number): number {
  return Math.round(n * 10) / 10 + 0
}

/** |after - before| as a share of before, against a percent threshold, without the float. */
function movedBeyond(before: number, after: number, thresholdPct: number): boolean {
  return Math.abs(after - before) * 100 > thresholdPct * before
}

function firstStderrLine(stderr: string | null | undefined): string {
  const line = (stderr ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  return (line ?? '').slice(0, 200)
}

export function scoreHome(
  selected: SelectedHome,
  result: HomeRunResult,
  opts: { minComps?: number; priceThresholdPct?: number; ranAt?: string } = {},
): HomeScore {
  const minComps = opts.minComps ?? FLEET_MIN_COMPS_DEFAULT
  const priceThresholdPct = opts.priceThresholdPct ?? 1
  const ranAt = opts.ranAt ?? new Date().toISOString()
  const storedBuilt =
    selected.stateAtSelection == null ? null : !['failed', 'building'].includes(selected.stateAtSelection)
  const harness = {
    attempts: result.attempts ?? 1,
    exitCode: result.exitCode ?? null,
    signal: result.signal ?? null,
    timedOut: result.timedOut === true,
    durationMs: result.durationMs ?? 0,
  }
  const identity = {
    slug: selected.slug,
    stateAtSelection: selected.stateAtSelection,
    prospectKind: selected.prospectKind,
    docType: selected.docType,
    cityMatch: selected.cityMatch,
    inside: selected.inside,
    lat: selected.lat,
    lng: selected.lng,
    storedBuilt,
    storedRecommended: selected.storedRecommended,
    storedCompsCount: selected.storedCompsCount,
    storedBuildError: selected.storedBuildError,
  }

  const dry = result.harnessReason == null ? (result.dry ?? null) : null
  if (!dry) {
    const cause = result.harnessReason ?? 'no-result'
    const tail = firstStderrLine(result.stderr)
    return {
      ...identity,
      address: selected.address,
      city: selected.city,
      outcome: 'harness-error',
      stage: 'harness',
      reason: `${cause}: exit ${harness.exitCode ?? 'null'} signal ${harness.signal ?? 'null'}${tail ? `, ${tail}` : ''}`,
      hardFailures: [],
      comps: 0,
      compsFound: 0,
      compKeys: [],
      minCompsOk: false,
      pricingSource: null,
      recommended: null,
      conservative: null,
      highEnd: null,
      valueLow: null,
      valueHigh: null,
      confidence: null,
      compPpsfCv: null,
      lastAsk: null,
      askSource: null,
      askDate: null,
      pctVsAsk: null,
      hold: null,
      holdReason: null,
      flagged: false,
      reviewReason: null,
      queueStateStored: null,
      queueStateAfter: null,
      storedDeltaPct: null,
      verdictVsStored: 'n/a',
      dryRunNotes: result.notes ?? [],
      ...harness,
      rawPath: null,
      ranAt,
    }
  }

  const outcome: HomeOutcome = dry.ok === true ? 'build' : 'fail'
  const stage = stageOf(dry)
  const comps = numOrNull(dry.keptCompCount) ?? 0
  const compsFound = numOrNull(dry.compCount) ?? 0
  const compKeys = (Array.isArray(dry.comps) ? dry.comps : [])
    .map((c) => (c && typeof c.key === 'string' ? c.key : null))
    .filter((k): k is string => k != null)
    .sort()
  const recommended = numOrNull(dry.recommended)
  const range = Array.isArray(dry.range) ? dry.range : []
  const valueRange = Array.isArray(dry.valueRange) ? dry.valueRange : []
  const dryAsk = numOrNull(dry.subjectLastAsk?.price)
  const lastAsk = dryAsk ?? selected.theirPrice ?? null
  const askSource: HomeScore['askSource'] = dryAsk != null ? 'dry-run' : lastAsk != null ? 'queue' : null
  const pctVsAsk = recommended != null && lastAsk != null && lastAsk > 0 ? pct1(((recommended - lastAsk) / lastAsk) * 100) : null
  const { hold, holdReason } = ruleThreeHold(recommended, lastAsk)
  const storedRecommended = selected.storedRecommended
  const storedDeltaPct =
    recommended != null && storedRecommended != null && storedRecommended > 0
      ? pct1(((recommended - storedRecommended) / storedRecommended) * 100)
      : null

  let verdictVsStored: VerdictVsStored
  if (storedBuilt == null) verdictVsStored = 'n/a'
  else if (!storedBuilt && outcome === 'build') verdictVsStored = 'now-builds'
  else if (storedBuilt && outcome === 'fail') verdictVsStored = 'now-fails'
  else if (
    storedBuilt &&
    outcome === 'build' &&
    recommended != null &&
    storedRecommended != null &&
    storedRecommended > 0 &&
    movedBeyond(storedRecommended, recommended, priceThresholdPct)
  ) {
    verdictVsStored = 'price-moved'
  } else verdictVsStored = 'same'

  return {
    ...identity,
    address: strOrNull(dry.address) ?? selected.address,
    city: strOrNull(dry.city) ?? selected.city,
    outcome,
    stage,
    reason: firstReasonLine(dry),
    hardFailures: hardFailuresOf(dry),
    comps,
    compsFound,
    compKeys,
    minCompsOk: (outcome === 'build' ? comps : compsFound) >= minComps,
    pricingSource: strOrNull(dry.pricingSource),
    recommended,
    conservative: numOrNull(range[0]),
    highEnd: numOrNull(range[1]),
    valueLow: numOrNull(valueRange[0]),
    valueHigh: numOrNull(valueRange[1]),
    confidence: typeof dry.confidence === 'string' || typeof dry.confidence === 'number' ? dry.confidence : null,
    compPpsfCv: numOrNull(dry.compPpsfCv),
    lastAsk,
    askSource,
    askDate: strOrNull(dry.subjectLastAsk?.date),
    pctVsAsk,
    hold,
    holdReason,
    flagged: dry.needsReview === true,
    reviewReason: strOrNull(dry.reviewReason),
    queueStateStored: strOrNull(dry.queueStateStored),
    queueStateAfter: strOrNull(dry.queueState),
    storedDeltaPct,
    verdictVsStored,
    dryRunNotes: result.notes ?? [],
    ...harness,
    rawPath: result.rawPath ?? null,
    ranAt,
  }
}

// ---------------------------------------------------------------------------
// The run file
// ---------------------------------------------------------------------------

export type FleetTotals = {
  homes: number
  build: number
  fail: number
  harnessErrors: number
  hold: number
  flagged: number
  minCompsFail: number
  byStage: Record<HomeStage, number>
  bySource: Record<string, number>
}

export type BaselineRef = {
  file: string
  runId: string
  gitSha: string
  dryRunScriptSha1: string
  startedAt: string
}

export type FleetRun = {
  schemaVersion: typeof FLEET_SCHEMA_VERSION
  runId: string
  startedAt: string
  finishedAt: string | null
  wallSec: number | null
  complete: boolean
  gitSha: string
  gitBranch: string
  gitDirty: boolean | 'unknown'
  /**
   * sha1 over the uncommitted changes (each changed or untracked path and its
   * contents), null on a clean tree. Files written before 2026-10-07's resume
   * fix lack it, so readers treat a missing value as unknown.
   */
  gitDirtySha1: string | null
  dryRunScriptSha1: string
  nodeVersion: string
  childArgv: string[]
  engine: 'deterministic-half'
  /** 'queue' for a live run; 'from-json' when scoring captured dry-run files. */
  source: 'queue' | 'from-json'
  config: FleetConfig
  selection: SelectionCounts
  totals: FleetTotals
  homes: HomeScore[]
  vsStored: StoredDiff
  baseline: BaselineRef | null
  diff: FleetDiff | null
  headline: string
}

export function computeTotals(homes: readonly HomeScore[]): FleetTotals {
  const byStage: Record<HomeStage, number> = { subject: 0, comps: 0, pricing: 0, contract: 0, complete: 0, harness: 0 }
  const bySource: Record<string, number> = {}
  let build = 0
  let fail = 0
  let harnessErrors = 0
  let hold = 0
  let flagged = 0
  let minCompsFail = 0
  for (const h of homes) {
    byStage[h.stage] += 1
    if (h.outcome === 'build') build += 1
    else if (h.outcome === 'fail') fail += 1
    else harnessErrors += 1
    if (h.hold === true) hold += 1
    if (h.flagged) flagged += 1
    if (h.outcome !== 'harness-error' && !h.minCompsOk) minCompsFail += 1
    if (h.outcome !== 'harness-error') {
      const key = h.pricingSource ?? 'none'
      bySource[key] = (bySource[key] ?? 0) + 1
    }
  }
  return { homes: homes.length, build, fail, harnessErrors, hold, flagged, minCompsFail, byStage, bySource }
}

export function sortHomes(homes: readonly HomeScore[]): HomeScore[] {
  return [...homes].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
}

// ---------------------------------------------------------------------------
// Diffs
// ---------------------------------------------------------------------------

export type DiffEntry = {
  slug: string
  address: string | null
  before: Record<string, unknown>
  after: Record<string, unknown>
}
export type PriceMoveEntry = DiffEntry & {
  delta: number
  deltaPct: number
  compKeysChanged: boolean
  dataDriftSuspected: boolean
}
export type CompsChangedEntry = DiffEntry & { keysAdded: string[]; keysRemoved: string[] }
export type SetEntry = { slug: string; address: string | null; state: CmaQueueState | null; outcome: HomeOutcome }
export type HarnessEntry = { slug: string; side: 'baseline' | 'current' | 'both'; reason: string | null }

export type FleetDiff = {
  priceThresholdPct: number
  summary: {
    total: number
    builtNow: number
    builtBefore: number
    added: number
    dropped: number
    harness: number
    medianAbsDeltaPct: number | null
  }
  newlyBuilding: DiffEntry[]
  newlyFailing: DiffEntry[]
  failureMoved: DiffEntry[]
  pricesMoved: PriceMoveEntry[]
  compsChanged: CompsChangedEntry[]
  newlyHolding: DiffEntry[]
  holdCleared: DiffEntry[]
  flaggedChanged: DiffEntry[]
  sourceChanged: DiffEntry[]
  unchanged: number
  added: SetEntry[]
  dropped: SetEntry[]
  harness: HarnessEntry[]
  warnings: string[]
  hasRegressions: boolean
}

export function median(nums: readonly number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

function setEntry(h: HomeScore): SetEntry {
  return { slug: h.slug, address: h.address, state: h.stateAtSelection, outcome: h.outcome }
}

function selectionKey(c: FleetConfig): string {
  return JSON.stringify({ states: [...c.states].sort(), kind: c.kind, city: c.city, since: c.since })
}

/** Keyed by slug. Regression = newlyFailing or newlyHolding non-empty. */
export function diffFleet(baseline: FleetRun, current: FleetRun, opts: { priceThresholdPct: number }): FleetDiff {
  const { priceThresholdPct } = opts
  const base = new Map(baseline.homes.map((h) => [h.slug, h]))
  const cur = new Map(current.homes.map((h) => [h.slug, h]))
  const common = [...cur.keys()].filter((s) => base.has(s)).sort()
  const added = [...cur.keys()]
    .filter((s) => !base.has(s))
    .sort()
    .map((s) => setEntry(cur.get(s)!))
  const dropped = [...base.keys()]
    .filter((s) => !cur.has(s))
    .sort()
    .map((s) => setEntry(base.get(s)!))

  const diff: FleetDiff = {
    priceThresholdPct,
    summary: { total: common.length, builtNow: 0, builtBefore: 0, added: added.length, dropped: dropped.length, harness: 0, medianAbsDeltaPct: null },
    newlyBuilding: [],
    newlyFailing: [],
    failureMoved: [],
    pricesMoved: [],
    compsChanged: [],
    newlyHolding: [],
    holdCleared: [],
    flaggedChanged: [],
    sourceChanged: [],
    unchanged: 0,
    added,
    dropped,
    harness: [],
    warnings: [],
    hasRegressions: false,
  }

  for (const slug of common) {
    const b = base.get(slug)!
    const c = cur.get(slug)!
    if (b.outcome === 'build') diff.summary.builtBefore += 1
    if (c.outcome === 'build') diff.summary.builtNow += 1
    const bHarness = b.outcome === 'harness-error'
    const cHarness = c.outcome === 'harness-error'
    if (bHarness || cHarness) {
      diff.harness.push({
        slug,
        side: bHarness && cHarness ? 'both' : bHarness ? 'baseline' : 'current',
        reason: cHarness ? c.reason : b.reason,
      })
      continue
    }
    const address = c.address ?? b.address
    let changed = false

    if (b.outcome === 'fail' && c.outcome === 'build') {
      changed = true
      diff.newlyBuilding.push({
        slug,
        address,
        before: { outcome: 'fail', stage: b.stage, reason: b.reason },
        after: { outcome: 'build', recommended: c.recommended, comps: c.comps },
      })
    }
    if (b.outcome === 'build' && c.outcome === 'fail') {
      changed = true
      diff.newlyFailing.push({
        slug,
        address,
        before: { outcome: 'build', recommended: b.recommended },
        after: { outcome: 'fail', stage: c.stage, reason: c.reason },
      })
    }
    if (b.outcome === 'fail' && c.outcome === 'fail' && (b.stage !== c.stage || b.reason !== c.reason)) {
      changed = true
      diff.failureMoved.push({
        slug,
        address,
        before: { stage: b.stage, reason: b.reason },
        after: { stage: c.stage, reason: c.reason },
      })
    }
    if (b.outcome === 'build' && c.outcome === 'build') {
      const keysChanged = !sameStringSet(b.compKeys, c.compKeys)
      if (b.recommended != null && c.recommended != null && b.recommended > 0 && movedBeyond(b.recommended, c.recommended, priceThresholdPct)) {
        changed = true
        diff.pricesMoved.push({
          slug,
          address,
          before: { recommended: b.recommended },
          after: { recommended: c.recommended },
          delta: c.recommended - b.recommended,
          deltaPct: pct1(((c.recommended - b.recommended) / b.recommended) * 100),
          compKeysChanged: keysChanged,
          dataDriftSuspected: keysChanged,
        })
      }
      if (b.comps !== c.comps || keysChanged) {
        changed = true
        const before = new Set(b.compKeys)
        const after = new Set(c.compKeys)
        diff.compsChanged.push({
          slug,
          address,
          before: { comps: b.comps, compKeys: b.compKeys },
          after: { comps: c.comps, compKeys: c.compKeys },
          keysAdded: c.compKeys.filter((k) => !before.has(k)),
          keysRemoved: b.compKeys.filter((k) => !after.has(k)),
        })
      }
    }
    if (b.hold !== true && c.hold === true) {
      changed = true
      diff.newlyHolding.push({
        slug,
        address,
        before: { hold: b.hold, holdReason: b.holdReason, ask: b.lastAsk, rec: b.recommended },
        after: { hold: c.hold, holdReason: c.holdReason, ask: c.lastAsk, rec: c.recommended },
      })
    }
    if (b.hold === true && c.hold !== true) {
      changed = true
      diff.holdCleared.push({
        slug,
        address,
        before: { hold: b.hold, holdReason: b.holdReason, ask: b.lastAsk, rec: b.recommended },
        after: { hold: c.hold, holdReason: c.holdReason, ask: c.lastAsk, rec: c.recommended },
      })
    }
    if (b.flagged !== c.flagged) {
      changed = true
      diff.flaggedChanged.push({
        slug,
        address,
        before: { flagged: b.flagged, reviewReason: b.reviewReason },
        after: { flagged: c.flagged, reviewReason: c.reviewReason },
      })
    }
    if (b.pricingSource !== c.pricingSource) {
      changed = true
      diff.sourceChanged.push({
        slug,
        address,
        before: { pricingSource: b.pricingSource },
        after: { pricingSource: c.pricingSource },
      })
    }
    if (!changed) diff.unchanged += 1
  }

  diff.pricesMoved.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct) || (a.slug < b.slug ? -1 : 1))
  diff.summary.harness = diff.harness.length
  diff.summary.medianAbsDeltaPct = median(diff.pricesMoved.map((p) => Math.abs(p.deltaPct)))
  diff.hasRegressions = diff.newlyFailing.length > 0 || diff.newlyHolding.length > 0

  if (baseline.dryRunScriptSha1 !== current.dryRunScriptSha1) {
    diff.warnings.push('the dry-run harness itself changed between runs')
  }
  const gapMs = Math.abs(Date.parse(current.startedAt) - Date.parse(baseline.startedAt))
  if (Number.isFinite(gapMs) && gapMs > 24 * 3600 * 1000) {
    const hours = Math.round(gapMs / 3600000)
    diff.warnings.push(
      `runs are ${hours} h apart; new closes and settled actives make part of any move data drift; ` +
        'baseline immediately before the change, candidate immediately after',
    )
  }
  if (selectionKey(baseline.config) !== selectionKey(current.config)) {
    diff.warnings.push('selection changed; compare only the common set')
  }
  // Same commit is not same code when either tree carried uncommitted
  // changes: measuring an uncommitted engine fix against a clean baseline at
  // the same commit is the normal workflow, and its moves are the fix.
  if (sameCode(baseline, current)) {
    diff.warnings.push('same commit: every move is data drift or nondeterminism')
  }
  return diff
}

export type StoredDiff = {
  compared: number
  nowBuilds: string[]
  nowFails: string[]
  pricesMoved: Array<{ slug: string; stored: number; now: number; deltaPct: number }>
  same: number
  medianAbsDeltaPct: number | null
}

/** This run against the rows the queue holds today. Informational; never an exit code. */
export function diffAgainstStored(current: Pick<FleetRun, 'homes'>, opts: { priceThresholdPct: number }): StoredDiff {
  const out: StoredDiff = { compared: 0, nowBuilds: [], nowFails: [], pricesMoved: [], same: 0, medianAbsDeltaPct: null }
  for (const h of sortHomes(current.homes)) {
    if (h.storedBuilt == null || h.outcome === 'harness-error') continue
    out.compared += 1
    if (!h.storedBuilt && h.outcome === 'build') out.nowBuilds.push(h.slug)
    else if (h.storedBuilt && h.outcome === 'fail') out.nowFails.push(h.slug)
    else if (
      h.storedBuilt &&
      h.outcome === 'build' &&
      h.recommended != null &&
      h.storedRecommended != null &&
      h.storedRecommended > 0 &&
      movedBeyond(h.storedRecommended, h.recommended, opts.priceThresholdPct)
    ) {
      out.pricesMoved.push({
        slug: h.slug,
        stored: h.storedRecommended,
        now: h.recommended,
        deltaPct: pct1(((h.recommended - h.storedRecommended) / h.storedRecommended) * 100),
      })
    } else out.same += 1
  }
  out.medianAbsDeltaPct = median(out.pricesMoved.map((p) => Math.abs(p.deltaPct)))
  return out
}

// ---------------------------------------------------------------------------
// Headline, stored line, exit code
// ---------------------------------------------------------------------------

function fmt1(n: number | null): string {
  return n == null ? 'n/a' : n.toFixed(1)
}

export function headline(diff: FleetDiff | null, current: Pick<FleetRun, 'totals'>): string {
  const e = current.totals.harnessErrors
  const harnessTail = e > 0 ? ` · ${e} harness errors (unscored)` : ''
  if (!diff) {
    return `${current.totals.build} of ${current.totals.homes - e} build (no baseline)${harnessTail}`
  }
  const s = diff.summary
  const c = diff.pricesMoved.length
  const moved = c === 0 ? '0 prices moved' : `${c} prices moved, median |delta| ${fmt1(s.medianAbsDeltaPct)}%`
  let line =
    `${s.builtNow} of ${s.total} build (was ${s.builtBefore}); ` +
    `+${diff.newlyBuilding.length} build, -${diff.newlyFailing.length} fail; ${moved}`
  if (diff.newlyHolding.length > 0) line += ` · ${diff.newlyHolding.length} newly on hold`
  if (s.added > 0 || s.dropped > 0) line += ` · set changed +${s.added}/-${s.dropped}`
  return line + harnessTail
}

export function storedLine(vsStored: StoredDiff): string {
  const c = vsStored.pricesMoved.length
  const med = c === 0 ? 'n/a' : `${fmt1(vsStored.medianAbsDeltaPct)}%`
  return (
    `vs stored rows: +${vsStored.nowBuilds.length} now build (were failed), ` +
    `-${vsStored.nowFails.length} now fail (were built), ${c} prices moved vs stored, median |delta| ${med}`
  )
}

/**
 * 0 ok · 1 regression · 2 unusable (nothing ran) · 3 harness error, which
 * includes a run aborted mid-way by an exception (partial file flushed, resume
 * command printed). Harness outranks regression so a broken box never reads
 * as an engine regression.
 */
export function fleetExitCode(args: {
  usageError?: string | null
  unusable?: boolean
  aborted?: boolean
  harnessErrors?: number
  diff?: FleetDiff | null
  allowRegressions?: boolean
  dry?: boolean
}): 0 | 1 | 2 | 3 {
  if (args.usageError || args.unusable) return 2
  if (args.aborted) return 3
  if (args.dry) return 0
  if ((args.harnessErrors ?? 0) > 0) return 3
  if (args.diff?.hasRegressions && !args.allowRegressions) return 1
  return 0
}

// ---------------------------------------------------------------------------
// Text: the progress line and the report
// ---------------------------------------------------------------------------

export function money(n: number | null | undefined): string {
  return n == null ? 'n/a' : `$${Math.round(n).toLocaleString('en-US')}`
}

function signedPct(n: number | null): string {
  if (n == null) return 'n/a'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

export function homeToken(h: HomeScore): 'HARNESS' | 'FAIL' | 'HOLD' | 'BUILD' {
  if (h.outcome === 'harness-error') return 'HARNESS'
  if (h.outcome === 'fail') return 'FAIL'
  return h.hold === true ? 'HOLD' : 'BUILD'
}

/** One fixed-width line per home; the progress line and the report table share it. */
export function formatHomeLine(h: HomeScore, opts: { index?: number; total?: number } = {}): string {
  const prefix = opts.index != null && opts.total != null ? `[${String(opts.index).padStart(String(opts.total).length)}/${opts.total}] ` : ''
  const token = homeToken(h).padEnd(8)
  const slug = h.slug.padEnd(26)
  const secs = `${Math.round(h.durationMs / 1000)}s`
  const stored = `stored ${h.stateAtSelection ?? 'none'}`.padEnd(20)
  if (h.outcome === 'harness-error') return `${prefix}${token} ${slug} ${(h.reason ?? '').slice(0, 90)}   ${secs}`
  if (h.outcome === 'fail') {
    const reason = (h.reason ?? `failed at ${h.stage}`).slice(0, 72)
    return `${prefix}${token} ${slug} comps    ${reason.padEnd(72)}   ${stored}  ${secs}`
  }
  const holdTag = h.holdReason === 'over-ask' ? ' OVER' : h.holdReason === 'under-ask-15' ? ' UNDER' : ''
  const pct = `${signedPct(h.pctVsAsk)}${holdTag}`.padEnd(14)
  const flagged = (h.flagged ? 'FLAGGED' : '').padEnd(8)
  return (
    `${prefix}${token} ${slug} comps ${String(h.comps).padEnd(2)} rec ${money(h.recommended).padEnd(11)} ` +
    `ask ${money(h.lastAsk).padEnd(11)} ${pct} ${flagged} ${stored}  ${secs}`
  )
}

function reportOrder(h: HomeScore): number {
  const t = homeToken(h)
  return t === 'FAIL' || t === 'HARNESS' ? 0 : t === 'HOLD' ? 1 : 2
}

function entryLine(e: DiffEntry, extra = ''): string {
  return `  ${e.slug.padEnd(26)} ${JSON.stringify(e.before)} -> ${JSON.stringify(e.after)}${extra}`
}

function bucket(title: string, lines: string[]): string[] {
  if (lines.length === 0) return []
  return [`${title} (${lines.length}):`, ...lines, '']
}

function configLine(c: FleetConfig): string {
  return (
    `city ${c.city} · states ${c.states.join(',')} · kind ${c.kind} · since ${c.since ?? 'none'} · limit ${c.limit ?? 'none'}` +
    ` · slugs ${c.slugs ? c.slugs.length : 'none'} · concurrency ${c.concurrency} · timeout ${c.timeoutSec}s · retries ${c.retries}` +
    ` · threshold ${c.priceThresholdPct}% · baseline ${c.baseline} · raw ${c.raw} · latest ${c.latest}` +
    (c.fromJson ? ` · from-json ${c.fromJson}` : '')
  )
}

export function selectionLine(s: SelectionCounts): string {
  const src = s.boundarySource ? `${s.boundarySource.geoType}/${s.boundarySource.geoSlug} (${s.boundarySource.rings} rings)` : 'none'
  return (
    `queue rows ${s.queueRows} (truncated ${s.queueTruncated}) · cma ${s.afterDocKind} · kind ${s.afterKind} · states ${s.afterStates}` +
    ` · since ${s.afterSince} · with coordinates ${s.withCoordinates} · inside ${s.insidePolygon} · outside ${s.outsidePolygon}` +
    ` · name fallback ${s.nameFallback} · selected ${s.afterLimit} · boundary ${src}`
  )
}

/** The whole text report; the script prints it and writes it as <runId>.md. */
export function renderReport(run: FleetRun, extras: { files: string[]; rawDirMb: number | null }): string {
  const out: string[] = []
  out.push(`CMA fleet dry run ${run.runId}`)
  out.push(`git ${run.gitSha}${run.gitDirty === true ? ' (dirty)' : run.gitDirty === 'unknown' ? ' (dirty: unknown)' : ''} on ${run.gitBranch}`)
  out.push(
    run.baseline
      ? `baseline ${run.baseline.runId} @ ${run.baseline.gitSha} (${run.baseline.file})`
      : 'no baseline: this run becomes it',
  )
  out.push(`engine: ${run.engine} (LLM judge and adversarial audit skipped; a build here is a ceiling on a real build)`)
  out.push(`source: ${run.source}${run.source === 'from-json' ? ' (no queue read; stored fields unknown; city filter skipped)' : ''}`)
  out.push(`config: ${configLine(run.config)}`)
  out.push(`selection: ${selectionLine(run.selection)}`)
  if (run.config.since) out.push('since: offMarketAt, createdAt when null')
  for (const w of run.diff?.warnings ?? []) out.push(`WARNING: ${w}`)
  out.push('')

  const ordered = [...run.homes].sort((a, b) => reportOrder(a) - reportOrder(b) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
  for (const h of ordered) out.push(formatHomeLine(h))
  out.push('')
  out.push(run.headline || headline(run.diff, run))
  out.push(storedLine(run.vsStored))
  out.push('')

  const d = run.diff
  if (d) {
    out.push(...bucket('newlyFailing (REGRESSION)', d.newlyFailing.map((e) => entryLine(e))))
    out.push(...bucket('newlyHolding (REGRESSION)', d.newlyHolding.map((e) => entryLine(e))))
    out.push(...bucket('newlyBuilding', d.newlyBuilding.map((e) => entryLine(e))))
    out.push(
      ...bucket(
        'pricesMoved',
        d.pricesMoved.map((e) =>
          entryLine(
            e,
            ` ${signedPct(e.deltaPct)} (${money(e.delta)})${e.dataDriftSuspected ? ' (comps changed: data drift suspected)' : ''}`,
          ),
        ),
      ),
    )
    out.push(...bucket('holdCleared', d.holdCleared.map((e) => entryLine(e))))
    out.push(
      ...bucket(
        'compsChanged',
        d.compsChanged.map((e) => entryLine(e, ` added [${e.keysAdded.join(', ')}] removed [${e.keysRemoved.join(', ')}]`)),
      ),
    )
    out.push(...bucket('failureMoved', d.failureMoved.map((e) => entryLine(e))))
    out.push(...bucket('flaggedChanged', d.flaggedChanged.map((e) => entryLine(e))))
    out.push(...bucket('sourceChanged', d.sourceChanged.map((e) => entryLine(e))))
    out.push(...bucket('added (not counted)', d.added.map((e) => `  ${e.slug.padEnd(26)} ${e.address ?? ''} · ${e.outcome} · stored ${e.state ?? 'none'}`)))
    out.push(...bucket('dropped (not counted)', d.dropped.map((e) => `  ${e.slug.padEnd(26)} ${e.address ?? ''} · ${e.outcome} · stored ${e.state ?? 'none'}`)))
    out.push(...bucket('harness (excluded from every bucket)', d.harness.map((e) => `  ${e.slug.padEnd(26)} ${e.side}: ${e.reason ?? ''}`)))
    out.push(`unchanged: ${d.unchanged} of ${d.summary.total} common homes`)
    out.push('')
  }

  const t = run.totals
  out.push(
    `totals: ${t.homes} homes · build ${t.build} · fail ${t.fail} · harness ${t.harnessErrors} · hold ${t.hold} · flagged ${t.flagged} · under rule 8 ${t.minCompsFail}`,
  )
  out.push(
    `by stage: ${(Object.keys(t.byStage) as HomeStage[]).map((k) => `${k} ${t.byStage[k]}`).join(' · ')}`,
  )
  const sources = Object.entries(t.bySource).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  out.push(`by pricingSource: ${sources.length ? sources.map(([k, v]) => `${k} ${v}`).join(' · ') : 'none'}`)
  out.push('')
  for (const f of extras.files) out.push(`wrote ${f}`)
  if (extras.rawDirMb != null) out.push(`raw directory: ${extras.rawDirMb.toFixed(1)} MB`)
  out.push(
    `every number above is a field of ${run.runId}.json (CLAUDE.md §0 trace); engine = deterministic half, a build here is a ceiling on a real build`,
  )
  return out.join('\n')
}
