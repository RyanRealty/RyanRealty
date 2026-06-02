#!/usr/bin/env node
/**
 * GA4 404 report — find pages getting real page_view traffic that resolve to a
 * 404 on the live site, so we can add redirects (legacy-redirects.json) for the
 * high-traffic ones and stop bleeding SEO equity + frustrating visitors after
 * the ryan-realty.com cutover.
 *
 * What it does:
 *   1. Pulls pagePath + pageTitle + screenPageViews + totalUsers from the GA4
 *      Data API for a date window (default last 30 days), ranked by views.
 *   2. Classifies each path: already-redirected (in legacy-redirects.json),
 *      candidate (needs a live check), or known query-noise.
 *   3. Optionally (--probe) curls each candidate against the live site with a
 *      browser UA, following redirects, and records the FINAL HTTP status.
 *      Final status 404 => a dead URL that needs a redirect.
 *
 * Auth: reuses GOOGLE_GA4_PROPERTY_ID + GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL +
 *       GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY from .env.local (read-only scope).
 *
 * Usage:
 *   node scripts/ga4-404-report.mjs                 # pull + print, last 30d
 *   node scripts/ga4-404-report.mjs --days=60       # custom window
 *   node scripts/ga4-404-report.mjs --probe         # also live-check candidates
 *   node scripts/ga4-404-report.mjs --probe --limit=120
 *
 * Output: out/ga4-404/report.json (+ console table).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { google } from 'googleapis'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = join(__dirname, '..')

const args = process.argv.slice(2)
const DAYS = Number((args.find((a) => a.startsWith('--days=')) || '--days=30').split('=')[1]) || 30
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '--limit=500').split('=')[1]) || 500
const PROBE = args.includes('--probe')
const SITE = (args.find((a) => a.startsWith('--site=')) || '--site=https://ryan-realty.com').split('=')[1]

function loadEnv() {
  const envPath = join(REPO_ROOT, '.env.local')
  if (!existsSync(envPath)) {
    console.error('FATAL: .env.local not found at', envPath)
    process.exit(1)
  }
  const text = readFileSync(envPath, 'utf8')
  const env = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

const env = loadEnv()
const PROPERTY_ID = env.GOOGLE_GA4_PROPERTY_ID?.trim()
const CLIENT_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
const PRIVATE_KEY = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()?.replace(/\\n/g, '\n')

if (!PROPERTY_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error('FATAL: missing GOOGLE_GA4_PROPERTY_ID / GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  process.exit(1)
}

// Known-good top-level route segments (real pages exist under these). Used only
// to *flag* paths that are very likely real so the probe can prioritize the rest.
const KNOWN_PREFIXES = [
  'about','accessibility','account','area-guides','auth','blog','buy','cities',
  'cma-drafts','communities','compare','contact','cookies','dashboard','dmca',
  'fair-housing','faq','feed','forgot-password','guides','home-valuation',
  'homes-for-sale','housing-market','join','listing','login','lp','marketing',
  'motivated-sellers','offline','open-houses','our-homes','privacy','pulse',
  'reports','resources','reviews','search','sell','signup','subdivisions',
  'team','terms','tools','videos','zip',
]

function normPath(p) {
  if (!p) return p
  // strip query + hash, lowercase, drop trailing slash
  let s = p.split('#')[0].split('?')[0]
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  return s.toLowerCase()
}

async function pullGa4() {
  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
  const data = google.analyticsdata({ version: 'v1beta', auth })
  const res = await data.properties.runReport({
    property: `properties/${PROPERTY_ID}`,
    requestBody: {
      dateRanges: [{ startDate: `${DAYS}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: LIMIT,
    },
  })
  const rows = res.data.rows || []
  return rows.map((r) => ({
    path: r.dimensionValues[0].value,
    title: r.dimensionValues[1].value,
    views: Number(r.metricValues[0].value),
    users: Number(r.metricValues[1].value),
  }))
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

async function probeStatus(path) {
  // Follow redirects; report final status + final URL. 404 => dead URL.
  const url = SITE.replace(/\/$/, '') + path
  try {
    const { execSync } = await import('node:child_process')
    const out = execSync(
      `curl -sS -L -m 20 -A '${UA}' -o /dev/null -w '%{http_code} %{url_effective}' '${url.replace(/'/g, "%27")}'`,
      { encoding: 'utf8' },
    )
    const [code, ...rest] = out.trim().split(' ')
    return { status: Number(code), finalUrl: rest.join(' ') }
  } catch (e) {
    return { status: 0, finalUrl: '', error: String(e?.message || e).slice(0, 120) }
  }
}

async function main() {
  console.log(`GA4 404 report — property ${PROPERTY_ID}, last ${DAYS} days, limit ${LIMIT}\n`)
  const rows = await pullGa4()
  const legacy = JSON.parse(readFileSync(join(REPO_ROOT, 'data/legacy-redirects.json'), 'utf8'))
  const legacyKeys = new Set(Object.keys(legacy))

  // Annotate
  for (const r of rows) {
    const np = normPath(r.path)
    r.norm = np
    r.firstSeg = np.split('/')[1] || ''
    r.alreadyRedirected = legacyKeys.has(np)
    r.knownPrefix = KNOWN_PREFIXES.includes(r.firstSeg)
  }

  // Candidates = not the root, not already redirected. (knownPrefix paths can
  // still 404 on a bad slug, so we keep them as candidates but rank by views.)
  const candidates = rows.filter((r) => r.norm !== '/' && !r.alreadyRedirected)

  if (PROBE) {
    console.log(`Probing ${Math.min(candidates.length, LIMIT)} candidate paths against ${SITE} ...\n`)
    let i = 0
    for (const c of candidates) {
      i++
      const { status, finalUrl, error } = await probeStatus(c.path)
      c.liveStatus = status
      c.finalUrl = finalUrl
      if (error) c.probeError = error
      if (i % 25 === 0) console.log(`  ...${i}/${candidates.length}`)
    }
  }

  const out = { generatedAt: new Date().toISOString(), property: PROPERTY_ID, days: DAYS, site: SITE, totalRows: rows.length, rows }
  mkdirSync(join(REPO_ROOT, 'out/ga4-404'), { recursive: true })
  writeFileSync(join(REPO_ROOT, 'out/ga4-404/report.json'), JSON.stringify(out, null, 2))

  // Print: top candidates (probed 404s if --probe, else all candidates) by views.
  const dead = PROBE ? candidates.filter((c) => c.liveStatus === 404) : candidates
  dead.sort((a, b) => b.views - a.views)

  const totalViews = rows.reduce((s, r) => s + r.views, 0)
  const deadViews = dead.reduce((s, r) => s + r.views, 0)
  console.log(`\nTotal page_view rows: ${rows.length}  |  total views: ${totalViews}`)
  if (PROBE) console.log(`Confirmed-404 candidate paths: ${dead.length}  |  views on 404s: ${deadViews}`)
  else console.log(`Candidate (not-yet-redirected) paths: ${dead.length}  |  views: ${deadViews}`)
  console.log('\n  views  users  status  path  ->  (title)')
  console.log('  '.padEnd(80, '-'))
  for (const r of dead.slice(0, 80)) {
    const st = PROBE ? String(r.liveStatus ?? '') : ''
    console.log(`  ${String(r.views).padStart(5)} ${String(r.users).padStart(5)}  ${st.padStart(4)}   ${r.path}   (${(r.title || '').slice(0, 40)})`)
  }
  console.log(`\nFull JSON: out/ga4-404/report.json`)
}

main().catch((e) => {
  console.error('ERROR:', e?.response?.data || e?.message || e)
  process.exit(1)
})
