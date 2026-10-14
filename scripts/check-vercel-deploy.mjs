#!/usr/bin/env node
/**
 * Verify the production Vercel deploy for the current HEAD commit.
 *
 * Why this exists: between 2026-04-15 and 2026-04-21, every production
 * deploy errored because of a partial-commit (lib/tiktok.ts left untracked).
 * `git push` succeeded silently while Vercel rejected each build. Two weeks
 * of "shipped" work never reached production. The fix is to never trust the
 * push alone — verify the deploy reaches READY for the SHA you just pushed.
 *
 * Usage:
 *   node scripts/check-vercel-deploy.mjs                 # check HEAD SHA
 *   node scripts/check-vercel-deploy.mjs <commitSha>     # check a specific SHA
 *   npm run deploy:verify                                # alias
 *   npm run deploy:verify -- --no-file [<commitSha>]     # read and print, write nothing
 *                                                        # (or DEPLOY_VERIFY_NO_FILE=1)
 *
 * Behavior:
 *   - Polls Vercel API for the production deployment matching the SHA.
 *   - Waits up to 15 minutes for READY or ERROR (queue + generate).
 *   - Docs/scripts/skills tips: SKIP (exit 0) if no deploy appears in ~45s
 *     (Vercel ignoreCommand). CANCELED + a newer production BUILDING/READY
 *     is SUPERSEDED (exit 0), not a failed compile.
 *   - On ERROR: fetches the last build-log lines and prints them.
 *   - Exit codes: 0 = READY | SKIP | SUPERSEDED, 1 = ERROR, 2 = TIMEOUT/missing-config.
 *   - On READY it runs the live checks (runLiveChecks) and hands each failure to the
 *     work graph as ONE claimable DEPLOY-* node, or prints who already holds it, and
 *     closes the open node of a check that now passes. Filing never changes the exit
 *     code and never throws; see lib/data/loop/deploy-defects.ts.
 *
 * Setup (one-time):
 *   - VERCEL_TOKEN in .env.local or shell env (https://vercel.com/account/tokens).
 *   - .vercel/project.json present (`npx vercel link` once), or
 *     VERCEL_PROJECT_ID + VERCEL_ORG_ID, or the documented Ryan Realty ids.
 *   - Cloud agents without a Vercel token fall back to `gh` commit status
 *     (context "Vercel") so READY/ERROR is still environment-verified.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'
import { homedir } from 'os'
// The live probe speaks the shared CI user agent: the middleware bot screen
// 403s an unknown UA, and ci:probe-ua fails any raw-HTTP probe without it.
import { CI_PROBE_USER_AGENT } from './lib/ci-probe-ua.mjs'
// One retry on a dropped tunnel; an HTTP status is never retried (scripts/lib/transport-retry.mjs).
import { fetchWithTransportRetry } from './lib/transport-retry.mjs'
import { formatSitemapSmoke, probeSitemapClasses } from './lib/sitemap-smoke.mjs'
import { LIVE_SEO_UA, runLiveSeoAudit } from './lib/live-seo-audit.mjs'
import {
  DEFAULT_DEPLOY_SITEMAP_URL_HEALTH_MAX,
  runSitemapUrlHealth,
} from './lib/sitemap-url-health.mjs'
import { checkInlineScripts, formatInlineScriptReport } from './lib/inline-script-health.mjs'
// Every failure files ONE claimable work node (or says who holds it); a pass closes it.
import { createDefectReport, noFileRequested } from './lib/deploy-defect-report.mjs'
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_SKIP_WAIT_MS,
  classifyTip,
  isSkippableTip,
  findSupersedingDeploy,
  concurrentBuilds,
} from './lib/deploy-verify-policy.mjs'

const TIMEOUT_MS = Number(process.env.DEPLOY_VERIFY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
const SKIP_WAIT_MS = Number(process.env.DEPLOY_VERIFY_SKIP_WAIT_MS ?? DEFAULT_SKIP_WAIT_MS)
const POLL_INTERVAL_MS = Number(process.env.DEPLOY_VERIFY_POLL_MS ?? 8000)

const argv = process.argv.slice(2)
// Flags (--no-file) are not the SHA: only a bare 7-40 hex argument names a commit.
const positional = argv.filter((a) => !a.startsWith('-'))
const targetSha = positional[0] && /^[0-9a-f]{7,40}$/.test(positional[0]) ? positional[0] : null

function out(msg) {
  process.stdout.write(`[deploy:verify] ${msg}\n`)
}
function err(msg) {
  process.stderr.write(`[deploy:verify] ${msg}\n`)
}

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return {}
  try {
    const raw = readFileSync(path, 'utf8')
    const env = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\n/g, '\n')
      else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
      env[key] = val
    }
    return env
  } catch {
    return {}
  }
}

function loadVercelCliToken() {
  const explicitPath = process.env.VERCEL_AUTH_CONFIG?.trim()
  const candidates = [
    explicitPath,
    resolve(homedir(), '.vercel/auth.json'),
    resolve(homedir(), 'Library/Application Support/com.vercel.cli/auth.json'),
  ].filter(Boolean)
  for (const authPath of candidates) {
    if (!existsSync(authPath)) continue
    try {
      const raw = JSON.parse(readFileSync(authPath, 'utf8'))
      const token = String(raw?.token ?? '').trim()
      if (token) return token
    } catch {
      // try the next known CLI auth path
    }
  }
  return ''
}

function parseJsonFromOutput(raw) {
  const firstBrace = raw.indexOf('{')
  if (firstBrace < 0) return null
  try {
    return JSON.parse(raw.slice(firstBrace))
  } catch {
    return null
  }
}

function findDeploymentForShaViaCli(sha) {
  try {
    const output = execSync(
      `npx vercel ls --environment production --meta githubCommitSha=${sha} --format json`,
      { encoding: 'utf8' },
    )
    const parsed = parseJsonFromOutput(output)
    const deployments = parsed?.deployments
    if (!Array.isArray(deployments) || deployments.length === 0) return null
    const hit = deployments[0]
    return {
      id: `cli-${sha.slice(0, 7)}`,
      state: String(hit?.state ?? 'UNKNOWN').toUpperCase(),
      url: hit?.url,
      inspectorUrl: null,
      meta: { githubCommitSha: hit?.meta?.githubCommitSha ?? sha },
    }
  } catch {
    return null
  }
}

function findDeploymentForShaViaGithub(sha) {
  try {
    const output = execSync(
      `gh api repos/RyanRealty/RyanRealty/commits/${sha}/status`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const parsed = JSON.parse(output)
    const vercel = (parsed.statuses ?? []).find((s) => s.context === 'Vercel')
    if (!vercel) return null
    const stateMap = {
      success: 'READY',
      pending: 'BUILDING',
      failure: 'ERROR',
      error: 'ERROR',
    }
    const inspectorUrl = vercel.target_url || null
    const idMatch = inspectorUrl ? inspectorUrl.match(/\/([^/?#]+)$/) : null
    return {
      id: idMatch?.[1] ?? `gh-${sha.slice(0, 7)}`,
      uid: idMatch?.[1] ?? null,
      state: stateMap[vercel.state] || 'UNKNOWN',
      url: null,
      inspectorUrl,
      meta: { githubCommitSha: sha },
    }
  } catch {
    return null
  }
}

function loadProjectMeta() {
  const fileEnv = loadEnvLocal()
  const envProject = (process.env.VERCEL_PROJECT_ID || fileEnv.VERCEL_PROJECT_ID || '').trim()
  const envTeam = (process.env.VERCEL_ORG_ID || fileEnv.VERCEL_ORG_ID || '').trim()
  if (envProject && envTeam) {
    return { projectId: envProject, teamId: envTeam }
  }
  const path = resolve(process.cwd(), '.vercel/project.json')
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    if (raw.projectId && raw.orgId) {
      return { projectId: raw.projectId, teamId: raw.orgId }
    }
  }
  // Documented in docs/TC_BUILD_SPEC.md. Cloud agents often lack `vercel link`.
  return {
    projectId: 'prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA',
    teamId: 'team_zwYQPapH0CpleD7RzJ7WctGO',
  }
}

function getHeadSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    err('Could not read HEAD commit SHA. Are you inside a git repo?')
    process.exit(2)
  }
}

async function vercelGet(token, path) {
  const url = `https://api.vercel.com${path}`
  const resp = await fetchWithTransportRetry(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Vercel API ${resp.status} on ${path}: ${text.slice(0, 200)}`)
  }
  return resp.json()
}

function normalizeDeploy(d) {
  if (!d) return null
  return {
    id: d.uid ?? d.id,
    uid: d.uid ?? d.id,
    state: String(d.state ?? 'UNKNOWN').toUpperCase(),
    created: Number(d.created ?? d.createdAt ?? 0),
    url: d.url,
    inspectorUrl: d.inspectorUrl ?? null,
    sha: d.meta?.githubCommitSha ?? d.sha,
    meta: d.meta ?? { githubCommitSha: d.sha },
    // The build window, for concurrentBuilds (G70): a slow build that shared
    // the database with another production build is contended, not regressed.
    buildingAt: Number(d.buildingAt) || 0,
    ready: Number(d.ready) || 0,
  }
}

async function listProductionDeployments(token, projectId, teamId) {
  const data = await vercelGet(
    token,
    `/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=20&target=production`,
  )
  return (data?.deployments ?? []).map(normalizeDeploy).filter(Boolean)
}

async function findDeploymentForSha(token, projectId, teamId, sha) {
  const list = await listProductionDeployments(token, projectId, teamId)
  const want = String(sha || '').toLowerCase()
  return (
    list.find((d) => {
      const got = String(d?.sha || d?.meta?.githubCommitSha || '').toLowerCase()
      return got && want && (got === want || got.startsWith(want) || want.startsWith(got))
    }) ?? null
  )
}

async function getBuildLogs(token, deploymentId, teamId, limit = 60) {
  const events = await vercelGet(
    token,
    `/v3/deployments/${deploymentId}/events?teamId=${teamId}&limit=${limit}&direction=backward`,
  )
  return Array.isArray(events) ? events : (events?.events ?? [])
}

function stripAnsi(s) {
  return String(s).replace(/\u001b\[[0-9;]*m/g, '')
}

function formatLogTail(events) {
  // Build logs come as { text, type, level } records; show only error/last frames.
  const lines = events
    .map((e) => ({
      text: stripAnsi(e?.text ?? '').replace(/\s+$/, ''),
      level: e?.level ?? '',
      type: e?.type ?? '',
    }))
    .filter((e) => e.text.length > 0)
  // Show last 40 lines, prioritising error frames.
  return lines.slice(-40)
}

// ── build telemetry — the tripwire for the 2026-08-21 build-cost class ───────
//
// Reads the READY deployment's build log and extracts the three numbers that
// define build health: compile time, "Generating static pages" duration, and
// withTimeoutFallback rail-timeout count. Founding baseline after the G70 +
// skippableRail work: compile ~53s, SSG ~76s (499 pages), 0 timeouts — down
// from 11.2min SSG and 352 timeouts. Thresholds are set at "the class came
// back", not at noise level: SSG > 300s or > 50 rail timeouts is a regression
// (deploy:verify exits 1) so the regression is caught the day it ships, from
// the REAL build log — no static gate can see this. BUILD_TELEMETRY_ALLOW_SLOW=1
// acknowledges a known-slow deploy. Fails open: telemetry unavailable (no
// token, API error) never blocks a READY verdict (reportBuildTelemetry returns null).
//
// CONTENDED, NOT REGRESSED (2026-10-14): a slow build whose window overlapped
// another production build's (concurrentBuilds, deploy-verify-policy.mjs) is
// reported as BUILD CONTENDED with the crowd named, exits 0 and files as
// skipped: nine builds in 48 minutes that afternoon read 192 to 372 s each
// while every solo build read 106 to 168 s, and three of them tripped this
// alert as regressions. A crowded build proves nothing about the code; the
// next solo build is the measurement, and it still fails here when slow.
const SSG_ALERT_SECONDS = 300
const RAIL_TIMEOUT_ALERT = 50

function durationToSeconds(raw) {
  const m = /([\d.]+)\s*(min|m|s)/.exec(raw)
  if (!m) return null
  const n = Number(m[1])
  return m[2] === 's' ? n : n * 60
}

async function reportBuildTelemetry(apiToken, teamId, deployId, concurrent = []) {
  try {
    const qs = teamId ? `?builds=1&limit=3000&teamId=${teamId}` : '?builds=1&limit=3000'
    const res = await fetch(`https://api.vercel.com/v3/deployments/${deployId}/events${qs}`, {
      headers: { authorization: `Bearer ${apiToken}` },
    })
    if (!res.ok) return null
    const events = await res.json()
    if (!Array.isArray(events)) return null
    const texts = events.map((e) => e?.payload?.text ?? e?.text ?? '').filter(Boolean)

    let compileSecs = null
    let ssgSecs = null
    let ssgPages = null
    let timeouts = 0
    for (const t of texts) {
      const compiled = /Compiled successfully in ([\d.]+\s*(?:min|m|s))/.exec(t)
      if (compiled) compileSecs = durationToSeconds(compiled[1])
      const ssg = /✓ Generating static pages[^(]*\((\d+)\/\d+\) in ([\d.]+\s*(?:min|m|s))/.exec(t)
      if (ssg) {
        ssgPages = Number(ssg[1])
        ssgSecs = durationToSeconds(ssg[2])
      }
      if (t.includes('timed out after')) timeouts += 1
    }
    if (ssgSecs == null && compileSecs == null) return null

    const summary =
      `compile ${compileSecs ?? '?'}s · SSG ${ssgSecs ?? '?'}s` +
      `${ssgPages ? ` (${ssgPages} pages)` : ''} · ${timeouts} rail timeout(s)` +
      ` · ${concurrent.length} concurrent production build(s)`
    out(`build telemetry: ${summary}`)
    // The keys name the alert crossed, never the measured number: a re-run that reads
    // 305s then 310s is the same defect (lib/data/loop/deploy-defects.ts fingerprint).
    const keys = []
    if (ssgSecs != null && ssgSecs > SSG_ALERT_SECONDS) keys.push(`static generation over the ${SSG_ALERT_SECONDS}s alert`)
    if (timeouts > RAIL_TIMEOUT_ALERT) keys.push(`withTimeoutFallback rail timeouts over the ${RAIL_TIMEOUT_ALERT} alert`)
    const slow = keys.length > 0
    const allowed = process.env.BUILD_TELEMETRY_ALLOW_SLOW === '1'
    const contended = slow && !allowed && concurrent.length > 0
    if (contended) {
      const crowd = concurrent.map((c) => `${c.sha || c.id} ${c.state}`).join(', ')
      out(`⚠ BUILD CONTENDED — the build was slow, but ${concurrent.length} other production build(s) overlapped it: ${crowd}.`)
      out(`  SSG ${ssgSecs}s (alert > ${SSG_ALERT_SECONDS}s) · ${timeouts} rail timeouts (alert > ${RAIL_TIMEOUT_ALERT}).`)
      out('  A build that shared the database with another proves nothing about the code; the next solo build is the measurement (docs/MECHANICAL_GATES.md G70).')
    } else if (slow && !allowed) {
      out('✗ BUILD REGRESSION — the deploy is READY but the build-cost class returned:')
      out(`  SSG ${ssgSecs}s (alert > ${SSG_ALERT_SECONDS}s) · ${timeouts} rail timeouts (alert > ${RAIL_TIMEOUT_ALERT}).`)
      out('  See docs/MECHANICAL_GATES.md G70. BUILD_TELEMETRY_ALLOW_SLOW=1 acknowledges a known-slow deploy.')
    }
    return {
      regressed: slow && !allowed && !contended,
      contended,
      acknowledged: slow && allowed,
      keys,
      detail: [summary],
      evidence: summary,
    }
  } catch {
    return null
  }
}

// ── the live checks, run against the READY production deploy ────────────────
//
// Every check records its result with `defects` (scripts/lib/deploy-defect-report.mjs)
// and the whole run's failures and passes go to the work graph ONCE, before this
// returns: a failure files one claimable DEPLOY-* node (or says who already holds
// it), a pass closes the open node for that check (lib/data/loop/deploy-defects.ts,
// ci:deploy-defect-filing). On 2026-10-14 two sessions saw this check flag the same
// noindex sitemap URLs and both built a fix.
//
// EXIT CODE. The first problem decides it, exactly as when each failing check
// exited at once: 1 = a check failed, 2 = a check could not run. Every check now
// runs even after an earlier one fails, so each distinct failure is filed in the
// same run; filing never changes the code, and it never throws (a database that
// cannot be reached prints a line and the verdict stands). `--no-file` (or
// DEPLOY_VERIFY_NO_FILE=1) reads and prints, and writes nothing.
async function runLiveChecks({ defects, apiToken, projectId, teamId, deployId, usingCliFallback }) {
  let code = 0
  const problem = (c) => {
    if (code === 0) code = c
  }
  const finish = () => {
    const { lines } = defects.flush()
    if (lines.length > 0) {
      out(defects.write ? 'deploy-found defects:' : 'deploy-found defects (--no-file: nothing written):')
      for (const l of lines) out(`  ${l}`)
    }
    return code
  }
  const guarded = async (family, fn) => {
    try {
      await fn()
    } catch (e) {
      err(`${family} check could not run: ${e instanceof Error ? e.message : String(e)}`)
      problem(2)
    }
  }

  out('check production URL: https://ryan-realty.com')
  let homeHtml = ''
  try {
    const live = await fetchWithTransportRetry('https://ryan-realty.com/', {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': CI_PROBE_USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    })
    out(`ryan-realty.com GET ${live.status}`)
    if (live.status >= 500) {
      err(`production host https://ryan-realty.com returned ${live.status}`)
      defects.record({ family: 'homepage', status: 'fail', keys: [`https://ryan-realty.com/ returned HTTP ${live.status}`] })
      problem(1)
      // The host is down: no other live check can say anything useful.
      return finish()
    }
    defects.record({ family: 'homepage', status: 'pass', evidence: `GET / answered ${live.status}` })
    homeHtml = await live.text()
  } catch (e) {
    err(`ryan-realty.com check failed: ${e instanceof Error ? e.message : String(e)}`)
    problem(2)
    return finish()
  }

  // ── inline-script parse + GTM loader (TRACK-2) ─────────────────────
  // 2026-09-17..09-22: the homepage's inline GTM bootstrap was a
  // SyntaxError, so gtm.js never loaded and browser GA4 read zero for
  // five days while this deploy check (200, READY) and every gate passed.
  // Parse every inline classic <script> production actually served and
  // require the gtm.js loader text. INLINE_SCRIPT_CHECK_SKIP=1 is the
  // acknowledged-outage escape.
  await guarded('inline-scripts', async () => {
    if (process.env.INLINE_SCRIPT_CHECK_SKIP === '1') {
      out('inline scripts: SKIPPED (INLINE_SCRIPT_CHECK_SKIP=1)')
      defects.record({ family: 'inline-scripts', status: 'skipped' })
      return
    }
    const scripts = checkInlineScripts(homeHtml)
    const report = formatInlineScriptReport(scripts)
    for (const line of report.lines) out(`inline scripts: ${line}`)
    if (!report.ok) {
      err('✗ INLINE SCRIPT CHECK FAILED — the homepage ships a script that cannot run, or no GTM loader.')
      err('  A classic <script> with a parse error executes nothing; browser analytics stops with it.')
      problem(1)
      defects.record({
        family: 'inline-scripts',
        status: 'fail',
        keys: [
          ...scripts.failures.map((f) => `inline script #${f.index}: ${f.message}`),
          ...(scripts.hasGtmLoader ? [] : ['homepage has no GTM loader text (googletagmanager.com/gtm.js)']),
        ],
        lines: report.lines,
      })
    } else {
      defects.record({ family: 'inline-scripts', status: 'pass', evidence: report.lines[0] })
    }
  })

  // ── retired /_next/image answers at the edge (TRACK-3) ─────────────
  // images.unoptimized (Matt lock 2026-09-13) removed the optimizer; every
  // stale /_next/image?url=X then rendered the ~143 KB HTML 404 page.
  // middleware.ts now 308s it to X (lib/routing/legacy-next-image.ts).
  // The unit test proves the mapping; only production can prove Vercel
  // routes /_next/image through middleware, so ask it.
  await guarded('legacy-image', async () => {
    if (process.env.LEGACY_IMAGE_SMOKE_SKIP === '1') {
      out('legacy /_next/image: SKIPPED (LEGACY_IMAGE_SMOKE_SKIP=1)')
      defects.record({ family: 'legacy-image', status: 'skipped' })
      return
    }
    let probe
    try {
      probe = await fetchWithTransportRetry('https://ryan-realty.com/_next/image?url=%2Ffavicon.ico&w=64&q=75', {
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': CI_PROBE_USER_AGENT },
        signal: AbortSignal.timeout(20_000),
      })
    } catch (e) {
      err(`legacy /_next/image check failed: ${e instanceof Error ? e.message : String(e)}`)
      problem(2)
      return
    }
    const location = probe.headers.get('location') ?? ''
    out(`legacy /_next/image: ${probe.status} -> ${location || '(no location)'}`)
    if (probe.status !== 308 || !/^(https:\/\/ryan-realty\.com)?\/favicon\.ico$/.test(location)) {
      err('✗ LEGACY IMAGE CHECK FAILED — /_next/image?url=/favicon.ico did not 308 to /favicon.ico.')
      err('  Stale optimizer URLs are rendering the app instead of resolving to the image.')
      problem(1)
      defects.record({
        family: 'legacy-image',
        status: 'fail',
        keys: ['/_next/image?url=/favicon.ico: want a 308 to /favicon.ico'],
        lines: [`/_next/image?url=/favicon.ico: ${probe.status} -> ${location || '(no location)'}`],
      })
    } else {
      defects.record({ family: 'legacy-image', status: 'pass', evidence: `308 -> ${location}` })
    }
  })

  // ── sitemap smoke (SITE-54) ────────────────────────────────────────
  // The index plus all five children, browser-clearing UA, concurrent,
  // 300s each (the route's own maxDuration). On 2026-09-09 geo.xml and
  // core.xml both returned 504 on production while the deploy was READY,
  // `/` answered 200 and build telemetry was green — nothing in the repo
  // could see it. SITEMAP_SMOKE_SKIP=1 is the acknowledged-outage escape.
  await guarded('sitemap-smoke', async () => {
    if (process.env.SITEMAP_SMOKE_SKIP === '1') {
      out('sitemap smoke: SKIPPED (SITEMAP_SMOKE_SKIP=1)')
      defects.record({ family: 'sitemap-smoke', status: 'skipped' })
      return
    }
    const smokeTimeout = Number(process.env.SITEMAP_SMOKE_TIMEOUT_MS ?? 300_000)
    const smoke = await probeSitemapClasses('https://ryan-realty.com', {
      timeoutMs: smokeTimeout,
    })
    for (const line of formatSitemapSmoke(smoke.results)) out(`sitemap smoke: ${line}`)
    if (!smoke.ok) {
      err('✗ SITEMAP SMOKE FAILED — a sitemap Google reads is not a 200 with entries.')
      err('  Google cannot discover the affected URL class while this is red.')
      problem(1)
      const bad = smoke.results.filter((r) => !(r.status === 200 && r.entries > 0))
      defects.record({
        family: 'sitemap-smoke',
        status: 'fail',
        keys: bad.map((r) => `${r.path}: ${r.status == null ? 'no response' : r.status !== 200 ? `HTTP ${r.status}` : 'urlset has no entries'}`),
        lines: formatSitemapSmoke(bad),
      })
    } else {
      defects.record({ family: 'sitemap-smoke', status: 'pass', evidence: `${smoke.results.length} sitemaps answered 200 with entries` })
    }
  })

  // ── live SEO baseline (Matt 2026-10-04) ────────────────────────────
  // robots groups, the image sitemap, and a sample of every sitemap's
  // pages as Google is served them: title, description, canonical, one
  // H1, BreadcrumbList, alt attributes, the listing lead photo's
  // priority. Rules: scripts/lib/live-seo-audit.mjs. LIVE_SEO_SKIP=1 is
  // the acknowledged-outage escape, same as the sitemap smoke.
  await guarded('live-seo', async () => {
    if (process.env.LIVE_SEO_SKIP === '1') {
      out('live seo: SKIPPED (LIVE_SEO_SKIP=1)')
      defects.record({ family: 'live-seo', status: 'skipped' })
      return
    }
    const seo = await runLiveSeoAudit('https://ryan-realty.com', { ua: LIVE_SEO_UA })
    for (const l of seo.lines) out(`live seo: ${l}`)
    for (const w of seo.warns) out(`live seo: warn · ${w}`)
    if (seo.fails.length > 0) {
      err(`✗ LIVE SEO FAILED (${seo.fails.length}) — production serves a page below the SEO baseline:`)
      for (const f of seo.fails) err(`  - ${f}`)
      problem(1)
      defects.record({ family: 'live-seo', status: 'fail', keys: seo.fails })
    } else {
      out('live seo: ✓ baseline holds')
      defects.record({
        family: 'live-seo',
        status: 'pass',
        evidence: seo.lines.join('; '),
        scope: { checkedPaths: seo.checkedPaths, listedPaths: seo.listedPaths },
      })
    }
  })

  // ── every sitemap URL (200, self canonical, not noindex) ──────────
  // The sample above is the rich baseline. This walk is the inventory:
  // every loc Google is given must stay a real indexable page on
  // https://ryan-realty.com. SITEMAP_URL_HEALTH_SKIP=1 is the escape.
  // The URLs an open deploy-found node names are walked even under the cap, so a
  // pass proves they are fixed (or gone from the sitemap), not merely unsampled.
  await guarded('sitemap-url-health', async () => {
    if (process.env.SITEMAP_URL_HEALTH_SKIP === '1') {
      out('sitemap url health: SKIPPED (SITEMAP_URL_HEALTH_SKIP=1)')
      defects.record({ family: 'sitemap-url-health', status: 'skipped' })
      return
    }
    const maxUrls = process.env.SITEMAP_URL_HEALTH_MAX
      ? Number(process.env.SITEMAP_URL_HEALTH_MAX)
      : DEFAULT_DEPLOY_SITEMAP_URL_HEALTH_MAX
    const health = await runSitemapUrlHealth('https://ryan-realty.com', {
      ua: LIVE_SEO_UA,
      maxUrls,
      concurrency: Number(process.env.SITEMAP_URL_HEALTH_CONCURRENCY ?? 8),
      priorityUrls: defects.priorityPaths('sitemap-url-health').map((p) => `https://ryan-realty.com${p}`),
    })
    for (const line of health.lines) out(`sitemap url health: ${line}`)
    if (health.fails.length > 0) {
      err(`✗ SITEMAP URL HEALTH FAILED (${health.fails.length} of ${health.checked}):`)
      for (const f of health.fails) err(`  - ${f}`)
      problem(1)
      defects.record({ family: 'sitemap-url-health', status: 'fail', keys: health.fails })
    } else {
      out(`sitemap url health: ✓ ${health.checked} URLs are 200, self-canonical, indexable`)
      defects.record({
        family: 'sitemap-url-health',
        status: 'pass',
        evidence: `${health.checked} URLs are 200, self-canonical, indexable`,
        scope: { checkedPaths: health.checkedPaths, listedPaths: health.listedPaths },
      })
    }
  })

  if (!usingCliFallback) {
    await guarded('build-telemetry', async () => {
      // Which other production builds overlapped this one. Unknown (API error,
      // deploy not in the latest twenty) reads as none, so the alert keeps its
      // old strictness rather than passing a slow build on a missing list.
      let concurrent = []
      try {
        const list = await listProductionDeployments(apiToken, projectId, teamId)
        const ours = list.find((d) => (d.uid ?? d.id) === deployId) ?? null
        concurrent = ours ? concurrentBuilds(ours, list) : []
      } catch {
        concurrent = []
      }
      const t = await reportBuildTelemetry(apiToken, teamId, deployId, concurrent)
      if (!t) return
      if (t.regressed) {
        problem(1)
        defects.record({ family: 'build-telemetry', status: 'fail', keys: t.keys, lines: t.detail })
      } else if (t.acknowledged || t.contended) {
        // Neither proves nor refutes the build-cost class: no node opens, none closes.
        defects.record({ family: 'build-telemetry', status: 'skipped' })
      } else {
        defects.record({ family: 'build-telemetry', status: 'pass', evidence: t.evidence })
      }
    })
  }
  return finish()
}

async function main() {
  const fileEnv = loadEnvLocal()
  const apiToken = (
    process.env.VERCEL_TOKEN ||
    fileEnv.VERCEL_TOKEN ||
    loadVercelCliToken() ||
    ''
  ).trim()
  // let, not const: an INVALID token (expired/rotated → API 403 invalidToken)
  // flips us to the CLI fallback mid-run instead of dying (2026-08-15: a token
  // went stale and every deploy:verify errored while the CLI stayed authed).
  let usingCliFallback = !apiToken

  const { projectId, teamId } = loadProjectMeta()
  const sha = (targetSha || getHeadSha()).toLowerCase()
  const defects = createDefectReport({ sha, write: !noFileRequested(argv) })

  if (usingCliFallback) {
    out('no API token found; using Vercel CLI, then GitHub Vercel status, for deploy checks')
  }

  // The commit being verified, never the checkout's HEAD (classifyTip).
  const tipClass = classifyTip(sha)
  const skippableTip = isSkippableTip(tipClass.status)
  // let, not const (2026-09-08): the short SKIP window exists to stop a docs-only
  // tip from waiting 15 minutes for a deploy Vercel will never make. Once a
  // deployment for this SHA is actually FOUND, that reasoning is spent — the
  // deploy exists and is building, so the full budget applies. Leaving it const
  // made every site round time out at 45s on a BUILDING deploy and exit 2, which
  // is indistinguishable from a real production ERROR: the net that catches a
  // broken generate was being read as noise.
  let waitMs = skippableTip ? SKIP_WAIT_MS : TIMEOUT_MS
  if (skippableTip) {
    out(
      `tip is Next-skippable (${tipClass.status}, ${tipClass.files.length} file(s)) — SKIP if no deploy in ${SKIP_WAIT_MS / 1000}s`,
    )
  }

  out(`waiting for production deploy of ${sha.slice(0, 7)} (project ${projectId})`)

  const startedAt = Date.now()
  let deployment = null
  let lastState = null
  let usingGithubFallback = false
  let productionList = []

  while (Date.now() - startedAt < waitMs) {
    if (usingCliFallback) {
      deployment = findDeploymentForShaViaGithub(sha)
      if (deployment && !usingGithubFallback) {
        out('no Vercel API token; using GitHub Vercel commit status')
        usingGithubFallback = true
      }
      if (!deployment) {
        deployment = findDeploymentForShaViaCli(sha)
      }
    } else {
      try {
        deployment = await findDeploymentForSha(apiToken, projectId, teamId, sha)
      } catch (e) {
        const msg = String(e?.message ?? '')
        if (msg.includes('invalidToken') || msg.includes(' 403 ') || msg.includes(' 401 ')) {
          out('API token rejected — switching to Vercel CLI auth fallback (rotate VERCEL_TOKEN when convenient)')
          usingCliFallback = true
          continue
        }
        throw e
      }
    }
    if (deployment) {
      const deployId = deployment.uid ?? deployment.id
      const state = deployment.state ?? 'UNKNOWN'
      if (waitMs !== TIMEOUT_MS) {
        // The deploy exists: give it the real budget, not the skip window.
        waitMs = TIMEOUT_MS
        out(`deploy found for a tip classified skippable — waiting the full ${TIMEOUT_MS / 60000} min`)
      }
      if (state !== lastState) {
        out(`deploy ${deployId}: ${state}`)
        lastState = state
      }
      if (state === 'READY') {
        const url = deployment.url ? `https://${deployment.url}` : '(no url)'
        out(`READY in ${(Date.now() - startedAt) / 1000}s — ${url}`)
        process.exit(await runLiveChecks({ defects, apiToken, projectId, teamId, deployId, usingCliFallback }))
      }
      if (state === 'CANCELED') {
        if (skippableTip) {
          out(
            `SKIP — Next-skippable tip; Vercel canceled/ignored ${deployId} in ${(Date.now() - startedAt) / 1000}s`,
          )
          process.exit(0)
        }
        if (!usingCliFallback) {
          try {
            productionList = await listProductionDeployments(apiToken, projectId, teamId)
          } catch {
            productionList = []
          }
        }
        const newer = findSupersedingDeploy(normalizeDeploy(deployment), productionList, sha)
        if (newer) {
          out(
            `SUPERSEDED in ${(Date.now() - startedAt) / 1000}s — ${deployId} CANCELED; ${newer.uid ?? newer.id} is ${newer.state} (${String(newer.sha || '').slice(0, 7) || 'no sha'})`,
          )
          process.exit(0)
        }
        err(`deployment CANCELED for SHA ${sha.slice(0, 7)} (id ${deployId}) and no newer production deploy`)
        err(`inspector: ${deployment.inspectorUrl ?? '(none)'}`)
        process.exit(1)
      }
      if (state === 'ERROR') {
        err(`deployment ${state} for SHA ${sha.slice(0, 7)} (id ${deployId})`)
        err(`inspector: ${deployment.inspectorUrl ?? '(none)'}`)
        if (usingCliFallback) {
          err('build-log tail unavailable in CLI fallback mode (set VERCEL_TOKEN to enable)')
        } else {
          try {
            const events = await getBuildLogs(apiToken, deployId, teamId, 80)
            const tail = formatLogTail(events)
            err('---- last build-log frames ----')
            for (const line of tail) process.stderr.write(line.text + '\n')
            err('-------------------------------')
          } catch (e) {
            err(`could not fetch build logs: ${e.message}`)
          }
        }
        process.exit(1)
      }
    } else if (lastState !== 'WAITING_FOR_VERCEL') {
      out('no deployment yet for that SHA — waiting for Vercel to pick up the push…')
      lastState = 'WAITING_FOR_VERCEL'
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  if (skippableTip && !deployment) {
    out(`SKIP — no production deploy in ${SKIP_WAIT_MS / 1000}s for a Next-skippable tip (ignoreCommand)`)
    process.exit(0)
  }

  err(`timeout after ${waitMs / 1000}s without READY/ERROR for SHA ${sha.slice(0, 7)}.`)
  if (deployment) {
    err(`last seen state: ${deployment.state}; inspector: ${deployment.inspectorUrl ?? '(none)'}`)
  }
  process.exit(2)
}

main().catch((e) => {
  err(`unexpected error: ${e.message}`)
  process.exit(2)
})
