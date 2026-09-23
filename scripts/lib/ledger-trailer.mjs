/**
 * ledger-trailer.mjs — a ranking-affecting commit names what it should move
 * (visibility audit gsc-trend-3, Matt 2026-09-23 directive).
 *
 * In September the site queue landed hundreds of commits that change what
 * Google sees (titles, canonicals, index policy, sitemaps, redirects, ISR) and
 * the improvement ledger got one row, so no ranking change could be read back
 * against the commit that caused it. The rule (docs/RUN_LOOP.md §6): a commit
 * that touches metadata, canonicals, robots, sitemaps, redirects, middleware
 * routing, ISR / revalidate, or a URL builder carries
 *
 *   Ledger: <site_improvement_ledger id>
 *   Ledger: <page class> · <clicks|position|impressions|ctr> · <query or path>
 *   Ledger: none (<why this cannot move a ranking>)
 *
 * ci:process-canon reports a commit in the push range without one. It WARNS
 * by default, because a hard fail would block every lane that booted before
 * the rule existed; LEDGER_TRAILER_STRICT=1 makes it fail.
 *
 * Pure predicates plus one git reader (`ledgerTrailerFindings`), no top-level
 * side effects, so the test imports it directly.
 */
import { execFileSync } from 'node:child_process'

/** Files whose whole purpose is what a crawler sees or how URLs resolve. */
export const RANKING_PATH_RES = Object.freeze([
  /^app\/robots\.ts$/,
  /^app\/sitemap\.ts$/,
  /^app\/sitemaps\//,
  /^app\/llms\.txt\//,
  /^lib\/sitemap[^/]*\.ts$/,
  /^lib\/seo\//,
  /^lib\/slug\.ts$/,
  /^lib\/site\/page-metadata\.ts$/,
  /^lib\/site\/place-href\.ts$/,
  /^lib\/(site|search)\/[^/]*(-href|area-link)[^/]*\.ts$/,
  /^middleware\.ts$/,
  /^proxy\.ts$/,
  /^next\.config\.(ts|mjs|js)$/,
])

/** Where a changed line can carry a ranking signal. */
const CODE_FILE_RE = /^(app|lib|components)\/.+\.(tsx?|mjs|js)$|^vercel\.json$/

/** Tests, fixtures and docs never reach a crawler. */
const NOT_SHIPPED_RE = /(^|\/)__tests__\/|\.(test|spec|int\.test|contract\.test)\.[cm]?[jt]sx?$|\.md$/

/**
 * Changed-line signals (added or removed lines only). Each names the thing it
 * catches so a WARN says why the commit counted.
 */
export const RANKING_LINE_SIGNALS = Object.freeze([
  { id: 'metadata', re: /\bgenerateMetadata\b|\bexport\s+const\s+metadata\b/ },
  { id: 'canonical', re: /\bcanonical\b|\balternates\s*:/ },
  { id: 'robots', re: /\brobots\s*:|\bnoindex\b|\bnofollow\b|\bindex\s*:\s*(true|false)\b/ },
  { id: 'revalidate', re: /\brevalidate\b|\bexport\s+const\s+dynamic\b/ },
  { id: 'redirect', re: /\bpermanentRedirect\s*\(|\bredirect\s*\(|"redirects"|\bredirects\s*\(|"permanent"\s*:/ },
  { id: 'sitemap', re: /\bsitemap\b/i },
])

export const LEDGER_TRAILER_RE = /^Ledger:\s*(.+?)\s*$/gim
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NONE_RE = /^none\s*\(\s*\S.{3,}\)$/i
const METRIC_RE = /\b(clicks|position|impressions|ctr)\b/i

/** Is this trailer value a ledger reference the rule accepts? */
export function isValidLedgerValue(value) {
  const v = String(value ?? '').trim()
  if (!v) return false
  if (UUID_RE.test(v) || NONE_RE.test(v)) return true
  const m = v.match(METRIC_RE)
  if (!m) return false
  // A page class has to come before the metric: "community · position …".
  return /[a-z]/i.test(v.slice(0, m.index).replace(/[·|,:;-]/g, ' '))
}

/** Every `Ledger:` value in a commit message. */
export function ledgerTrailerValues(message) {
  return [...String(message ?? '').matchAll(LEDGER_TRAILER_RE)].map((m) => m[1])
}

export function hasValidLedgerTrailer(message) {
  return ledgerTrailerValues(message).some(isValidLedgerValue)
}

/** Why a set of changed files makes a commit ranking-affecting (empty = it does not). */
export function rankingReasons(files, changedLines = '') {
  const reasons = new Set()
  const shipped = (files ?? []).filter((f) => !NOT_SHIPPED_RE.test(f))
  for (const f of shipped) {
    if (RANKING_PATH_RES.some((re) => re.test(f))) reasons.add(`path ${f}`)
  }
  const lines = String(changedLines ?? '')
    .split('\n')
    .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)\s/.test(l))
    .join('\n')
  for (const s of RANKING_LINE_SIGNALS) {
    if (s.re.test(lines)) reasons.add(s.id)
  }
  return [...reasons]
}

/**
 * Inside a git hook, git exports GIT_DIR / GIT_INDEX_FILE and friends, which
 * point every child git at the hook's repo whatever `cwd` says. A caller that
 * names `cwd` means THAT repo, so those variables are dropped for it.
 */
function gitEnv(cwd) {
  if (!cwd) return process.env
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')))
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      env: gitEnv(cwd),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

/**
 * The commit range the push is about to ship, same order of preference as
 * committedDiff in scripts/lib/ci-gates-select.mjs: GitHub's push range, the PR
 * base, the local upstream range, else the tip commit alone.
 */
export function commitRange(env = process.env, cwd) {
  const onCi = env.GITHUB_ACTIONS === 'true' || env.GITHUB_ACTIONS === '1'
  const before = String(env.GITHUB_EVENT_BEFORE ?? '').trim()
  const sha = String(env.GITHUB_SHA ?? '').trim()
  if (onCi && before && !/^0+$/.test(before) && sha) return [`${before}..${sha}`]
  const baseRef = String(env.GITHUB_BASE_REF ?? '').trim()
  if (onCi && baseRef) return [`origin/${baseRef}..HEAD`]
  if (!onCi && git(['rev-parse', '--abbrev-ref', '@{u}'], cwd)) return ['@{u}..HEAD']
  return ['-1', 'HEAD']
}

/**
 * One finding per non-merge commit in the range that is ranking-affecting and
 * carries no valid Ledger trailer. [] when git cannot answer (a shallow CI
 * checkout, no repo): this check never invents a finding.
 */
export function ledgerTrailerFindings({ env = process.env, cwd } = {}) {
  const log = git(['log', '--no-merges', '--format=%H', ...commitRange(env, cwd)], cwd)
  if (log == null) return []
  const out = []
  for (const sha of log.split('\n').map((s) => s.trim()).filter(Boolean)) {
    const message = git(['log', '-1', '--format=%B', sha], cwd) ?? ''
    if (hasValidLedgerTrailer(message)) continue
    const files = (git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha], cwd) ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const code = files.filter((f) => (CODE_FILE_RE.test(f) || RANKING_PATH_RES.some((re) => re.test(f))) && !NOT_SHIPPED_RE.test(f))
    if (code.length === 0) continue
    const diff = git(['show', '--format=', '-U0', sha, '--', ...code], cwd) ?? ''
    const reasons = rankingReasons(code, diff)
    if (reasons.length === 0) continue
    out.push({ sha: sha.slice(0, 10), subject: message.split('\n')[0], reasons })
  }
  return out
}

/** The one-line report for a finding. */
export function formatLedgerFinding(f) {
  return `${f.sha} "${f.subject}" changes ${f.reasons.join(', ')} with no Ledger: trailer (docs/RUN_LOOP.md §6: Ledger: <ledger id> | <page class> · <gsc metric> · <query> | none (<why>)).`
}
