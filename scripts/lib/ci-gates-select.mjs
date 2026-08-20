/**
 * ci:gates lane selection — which members of package.json `ci:gates:chain`
 * run on this push.
 *
 * `scripts/ci-lanes.json` (when present) classifies every chain member into
 * always | path | nightly | cert. `npm run ci:gates` runs always ∪ matching
 * path globs. Nightly and cert stay off this path. Missing lanes file → the
 * full chain (same as before the diet).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

export const LANES_REL = 'scripts/ci-lanes.json'
export const PROCESS_CANON_GATE = 'ci:process-canon'
export const PROCESS_CANON_FILE = 'docs/DEVELOPMENT_PROCESS.md'
export const PROCESS_CANON_DIR = 'docs/plans/'

const GATE_NAME = /^ci:[\w:-]+$/

/**
 * @param {string} file
 * @returns {boolean}
 */
export function isProcessCanonPath(file) {
  const f = String(file).replaceAll('\\', '/')
  return f === PROCESS_CANON_FILE || f.startsWith(PROCESS_CANON_DIR)
}

/**
 * Parse `package.json` → `ci:gates:chain` into unique `ci:*` names.
 * No minimum count (the 150-gate refuse blocked diet). Zero unique still fails.
 *
 * @param {object} pkg
 * @returns {string[]}
 */
export function parseChain(pkg) {
  const raw = pkg.scripts?.['ci:gates:chain']
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error(
      'package.json scripts["ci:gates:chain"] is missing — that string is the source of truth for which gates run',
    )
  }
  const tokens = raw
    .split('&&')
    .map((s) => s.trim())
    .filter(Boolean)
  const gates = []
  const seen = new Set()
  for (const tok of tokens) {
    const m = tok.match(/^npm run (ci:[\w:-]+)$/)
    if (!m) {
      throw new Error(`ci:gates:chain token is not \`npm run ci:…\`: ${tok}`)
    }
    const name = m[1]
    if (name === 'ci:gates' || name === 'ci:gates:chain') {
      throw new Error(`${name} cannot appear inside ci:gates:chain (recursion)`)
    }
    if (seen.has(name)) continue
    seen.add(name)
    if (!pkg.scripts?.[name]) {
      throw new Error(`ci:gates:chain names ${name} but that script does not exist`)
    }
    gates.push(name)
  }
  if (gates.length === 0) {
    throw new Error('ci:gates:chain parsed 0 unique gates')
  }
  return gates
}

/**
 * Git-style glob: star = one segment, star-star = any depth.
 * Brackets are literals so Next [slug] paths are not character classes.
 */
function stripDotSlash(p) {
  return p.startsWith('./') ? p.slice(2) : p
}

const REGEX_ESCAPE = new Set(['^', '.', '+', '$', '{', '}', '(', ')', '|', '[', ']', '\\'])

function escapeRegexChars(s) {
  let out = ''
  for (const ch of s) {
    if (REGEX_ESCAPE.has(ch)) out += '\\'
    out += ch
  }
  return out
}

export function matchGlob(glob, file) {
  const g = stripDotSlash(String(glob).replaceAll('\\', '/'))
  const f = stripDotSlash(String(file).replaceAll('\\', '/'))
  return globToRegExp(g).test(f)
}

function globToRegExp(glob) {
  let out = '^'
  const parts = glob.split('/')
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i]
    const last = i === parts.length - 1
    if (seg === '**') {
      out += last ? '.*' : '(?:.*/)?'
    } else {
      out += escapeRegexChars(seg).replaceAll('*', '[^/]*').replaceAll('?', '[^/]')
      if (!last) out += '/'
    }
  }
  out += '$'
  return new RegExp(out)
}

/** @param {object | null | undefined} data */
export function normalizeLanes(data) {
  const empty = { version: 1, always: [], path: {}, nightly: [], cert: [] }
  if (!data || typeof data !== 'object') return empty
  const raw = data
  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    always: asGateList(raw.always),
    path: asPathMap(raw.path),
    nightly: asGateList(raw.nightly),
    cert: asGateList(raw.cert),
  }
}

function asGateList(v) {
  if (!Array.isArray(v)) return []
  return v.filter((s) => typeof s === 'string' && GATE_NAME.test(s))
}

function asPathMap(v) {
  const out = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [gate, globs] of Object.entries(v)) {
    if (!GATE_NAME.test(gate)) continue
    const list = Array.isArray(globs) ? globs : typeof globs === 'string' ? [globs] : []
    out[gate] = list.filter((g) => typeof g === 'string' && g.length > 0)
  }
  return out
}

/** @param {string} root @param {object} [opts] */
export function loadLanes(root, opts = {}) {
  const filePath = join(root, LANES_REL)
  const exists = opts.existsSync ?? existsSync
  const read = opts.readFileSync ?? readFileSync
  if (!exists(filePath)) return null
  return normalizeLanes(JSON.parse(read(filePath, 'utf8')))
}

function splitLines(text) {
  return String(text)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

function defaultRunGit(args, cwd) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.status !== 0) return null
  return r.stdout ?? ''
}

function isZeroSha(value) {
  return !value || /^0+$/.test(String(value).trim())
}

/**
 * Committed file list for path matching.
 *
 * GitHub push checkouts have HEAD == origin/main, so `@{u}...HEAD` is empty
 * even though the push has files. Prefer `GITHUB_EVENT_BEFORE...GITHUB_SHA`,
 * then the PR base, then `diff-tree HEAD`. Locally, `@{u}...HEAD` is the
 * unpushed range; an empty range on a tracking branch is a clean tree (do
 * not re-run the tip commit's path gates).
 *
 * `null` = discovery failed (caller must take the safe set).
 *
 * @param {(args: string[], cwd?: string) => string | null} run
 * @param {string | undefined} cwd
 * @param {NodeJS.ProcessEnv} env
 * @returns {string | null}
 */
function committedDiff(run, cwd, env) {
  const onCi = env.GITHUB_ACTIONS === 'true' || env.GITHUB_ACTIONS === '1'
  const before = String(env.GITHUB_EVENT_BEFORE ?? '').trim()
  const sha = String(env.GITHUB_SHA ?? '').trim()
  if (onCi && !isZeroSha(before) && sha) {
    const ranged = run(['diff', '--name-only', `${before}...${sha}`], cwd)
    if (ranged !== null) return ranged
  }
  const baseRef = String(env.GITHUB_BASE_REF ?? '').trim()
  if (onCi && baseRef) {
    const pr = run(['diff', '--name-only', `origin/${baseRef}...HEAD`], cwd)
    if (pr !== null) return pr
  }
  if (onCi) {
    return run(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], cwd)
  }

  const upstream = run(['rev-parse', '--abbrev-ref', '@{u}'], cwd)
  if (upstream) {
    return run(['diff', '--name-only', '@{u}...HEAD'], cwd)
  }
  return run(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], cwd)
}

/**
 * Changed paths for Path-lane matching.
 * Committed range (see committedDiff) plus unstaged, staged, and untracked.
 * `null` = discovery failed (caller must take the safe set).
 *
 * @param {object} [opts]
 * @returns {string[] | null}
 */
export function listChangedFiles(opts = {}) {
  const run = opts.runGit ?? defaultRunGit
  const cwd = opts.cwd
  const env = opts.env ?? process.env
  try {
    const committed = committedDiff(run, cwd, env)
    if (committed === null) return null
    const files = new Set(splitLines(committed))
    const unstaged = run(['diff', '--name-only'], cwd)
    const staged = run(['diff', '--name-only', '--cached'], cwd)
    const untracked = run(['ls-files', '--others', '--exclude-standard'], cwd)
    if (unstaged) for (const f of splitLines(unstaged)) files.add(f)
    if (staged) for (const f of splitLines(staged)) files.add(f)
    if (untracked) for (const f of splitLines(untracked)) files.add(f)
    return [...files]
  } catch {
    return null
  }
}

function addIfInChain(selected, chainSet, name) {
  if (chainSet.has(name)) selected.add(name)
}

function pathGlobsMatch(globs, files) {
  return files.some((file) => globs.some((glob) => matchGlob(glob, file)))
}

/** @param {object} opts */
export function selectGates(opts) {
  const chain = Array.isArray(opts.chain) ? opts.chain : []
  const chainSet = new Set(chain)
  const lanes = opts.lanes
  const mode = opts.mode ?? 'push'
  if (mode === 'nightly' || mode === 'cert') {
    if (!lanes) return { selected: [], skipped: [...chain] }
    const names = new Set(mode === 'nightly' ? lanes.nightly : lanes.cert)
    const selectedList = chain.filter((g) => names.has(g))
    return { selected: selectedList, skipped: chain.filter((g) => !names.has(g)) }
  }
  if (!lanes) {
    return { selected: [...chain], skipped: [] }
  }

  const selected = new Set()
  for (const g of lanes.always) addIfInChain(selected, chainSet, g)

  const pathMap = lanes.path ?? {}
  const changedFiles = opts.changedFiles

  if (changedFiles === null || changedFiles === undefined) {
    for (const gate of Object.keys(pathMap)) addIfInChain(selected, chainSet, gate)
  } else {
    for (const [gate, globs] of Object.entries(pathMap)) {
      if (pathGlobsMatch(globs, changedFiles)) addIfInChain(selected, chainSet, gate)
    }
    if (changedFiles.some(isProcessCanonPath)) {
      addIfInChain(selected, chainSet, PROCESS_CANON_GATE)
    }
  }

  if (selected.size === 0) {
    for (const g of lanes.always) addIfInChain(selected, chainSet, g)
  }

  const selectedList = chain.filter((g) => selected.has(g))
  const skipped = chain.filter((g) => !selected.has(g))
  return { selected: selectedList, skipped }
}
