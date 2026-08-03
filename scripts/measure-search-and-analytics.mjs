#!/usr/bin/env node
/**
 * measure-search-and-analytics.mjs — the measured half of the website audit.
 *
 * WHY. `docs/audits/WEBSITE_AUDIT_2026-08-02.md` had to mark indexation,
 * traffic, bounce, dwell, and Core Web Vitals "Not measured": the cloud
 * container that produced it held no Google credentials, so it substituted
 * proxies and said so. Audit item 21 is "instrument GSC + GA4 and measure
 * indexed-per-class". This is that instrument.
 *
 * It re-runs every figure in `docs/audits/MEASURED_METRICS_2026-08-02.md`, so a
 * later session can diff against that snapshot rather than trusting it. Numbers
 * in this repo have to be reproducible on demand (CLAUDE.md §0) and a table
 * pasted into a markdown file is not reproducible by itself.
 *
 * Read-only: Search Console `webmasters.readonly`, GA4 `analytics.readonly`.
 * Never prints a credential.
 *
 * Env: GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
 *      GOOGLE_GA4_PROPERTY_ID  (loaded from .env.local when present)
 *
 * CLI: default human tables · --json (machine-readable to stdout)
 */
import { existsSync } from 'node:fs'
import { config as loadEnv } from 'dotenv'
import { google } from 'googleapis'

for (const f of ['.env.local', '.env']) if (existsSync(f)) loadEnv({ path: f })

const SITE = 'https://ryan-realty.com/'
const asJson = process.argv.slice(2).includes('--json')
const out = {}
const say = (...a) => { if (!asJson) console.log(...a) }
const BAR = '='.repeat(78)

const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL
const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n')
const ga4Property = process.env.GOOGLE_GA4_PROPERTY_ID

if (!clientEmail || !privateKey) {
  console.error(
    'measure-search-and-analytics: missing GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL or ' +
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY. This script is read-only but still needs the ' +
      'service account that holds Search Console + GA4 read access.'
  )
  process.exit(1)
}

const authFor = (scopes) =>
  new google.auth.JWT({ email: clientEmail, key: privateKey, scopes })

/** GSC data lags 2-3 days; end the window 3 days back so the last day is complete. */
const iso = (d) => d.toISOString().slice(0, 10)
const end = new Date(Date.now() - 3 * 86_400_000)
const start = new Date(end.getTime() - 27 * 86_400_000)
const prevEnd = new Date(start.getTime() - 86_400_000)
const prevStart = new Date(prevEnd.getTime() - 27 * 86_400_000)

const searchconsole = google.searchconsole({
  version: 'v1',
  auth: authFor(['https://www.googleapis.com/auth/webmasters.readonly']),
})
const analyticsdata = google.analyticsdata({
  version: 'v1beta',
  auth: authFor(['https://www.googleapis.com/auth/analytics.readonly']),
})

// ── Sitemaps: what Google actually holds, per class ──────────────────────────
say(BAR); say('SEARCH CONSOLE — SITEMAPS'); say(BAR)
const { data: smData } = await searchconsole.sitemaps.list({ siteUrl: SITE })
out.sitemaps = (smData.sitemap ?? []).map((s) => ({
  path: s.path.replace('https://ryan-realty.com', ''),
  submitted: (s.contents ?? []).reduce((n, c) => n + Number(c.submitted ?? 0), 0),
  errors: Number(s.errors ?? 0),
  warnings: Number(s.warnings ?? 0),
  lastDownloaded: s.lastDownloaded ?? null,
}))
for (const s of out.sitemaps) {
  say(
    `  ${s.path.padEnd(30)} urls=${String(s.submitted).padStart(6)}  ` +
      `errors=${s.errors}  warnings=${s.warnings}  ` +
      `lastDownloaded=${(s.lastDownloaded ?? 'NEVER').slice(0, 10)}`
  )
}

// ── Search analytics ─────────────────────────────────────────────────────────
const sa = async (startDate, endDate, dimensions, rowLimit = 25) => {
  const { data } = await searchconsole.searchanalytics.query({
    siteUrl: SITE,
    requestBody: { startDate, endDate, ...(dimensions ? { dimensions } : {}), rowLimit },
  })
  return data.rows ?? []
}

say(''); say(BAR)
say(`SEARCH CONSOLE — SEARCH ANALYTICS  ${iso(start)} .. ${iso(end)}  (vs prior 28d)`)
say(BAR)
const [cur] = await sa(iso(start), iso(end))
const [prev] = await sa(iso(prevStart), iso(prevEnd))
out.window = { current: [iso(start), iso(end)], previous: [iso(prevStart), iso(prevEnd)] }
out.totals = { current: cur ?? null, previous: prev ?? null }
if (cur) {
  say(`  clicks      ${String(cur.clicks).padStart(6)}   (prior ${prev?.clicks ?? 0})`)
  say(`  impressions ${String(cur.impressions).padStart(6)}   (prior ${prev?.impressions ?? 0})`)
  say(`  CTR         ${(cur.ctr * 100).toFixed(2).padStart(6)}%  (prior ${((prev?.ctr ?? 0) * 100).toFixed(2)}%)`)
  say(`  avg pos     ${cur.position.toFixed(1).padStart(6)}   (prior ${(prev?.position ?? 0).toFixed(1)})`)
}

for (const [dim, title] of [['query', 'TOP QUERIES'], ['page', 'TOP PAGES']]) {
  say(''); say(`  --- ${title} ---`)
  const rows = await sa(iso(start), iso(end), [dim], 20)
  out[`top_${dim}s`] = rows
  for (const r of rows) {
    const key = dim === 'page' ? (r.keys[0].replace('https://ryan-realty.com', '') || '/') : r.keys[0]
    say(
      `    ${key.slice(0, 58).padEnd(58)} clk=${String(r.clicks).padStart(4)} ` +
        `imp=${String(r.impressions).padStart(6)} pos=${r.position.toFixed(1).padStart(5)}`
    )
  }
}

// ── Brand split + position distribution over named queries ───────────────────
// GSC withholds rare queries for privacy, so the named set is a SUBSET of total
// impressions. The coverage line below is not decoration: without it these
// percentages get restated as if they described all traffic, which they do not.
const BRAND = ['ryan realty', 'ryanrealty', 'ryan real estate', 'matt ryan', 'ryan-realty']
const named = await sa(iso(start), iso(end), ['query'], 25000)
const isBrand = (q) => BRAND.some((b) => q.toLowerCase().includes(b))
const agg = (rs) => ({
  clicks: rs.reduce((n, r) => n + r.clicks, 0),
  impressions: rs.reduce((n, r) => n + r.impressions, 0),
  queries: rs.length,
})
out.brand = agg(named.filter((r) => isBrand(r.keys[0])))
out.non_brand = agg(named.filter((r) => !isBrand(r.keys[0])))

say(''); say(`  --- BRAND vs NON-BRAND (${named.length} named queries) ---`)
say(`    brand      clicks=${String(out.brand.clicks).padStart(5)} impressions=${String(out.brand.impressions).padStart(7)} queries=${out.brand.queries}`)
say(`    non-brand  clicks=${String(out.non_brand.clicks).padStart(5)} impressions=${String(out.non_brand.impressions).padStart(7)} queries=${out.non_brand.queries}`)

const BUCKETS = [['1-3', 3], ['4-10', 10], ['11-20', 20], ['21-50', 50], ['51+', Infinity]]
const dist = Object.fromEntries(BUCKETS.map(([b]) => [b, { queries: 0, impressions: 0 }]))
for (const r of named) {
  const b = BUCKETS.find(([, max]) => r.position <= max)[0]
  dist[b].queries += 1
  dist[b].impressions += r.impressions
}
const namedImpressions = Object.values(dist).reduce((n, d) => n + d.impressions, 0)
out.position_distribution = dist
out.named_query_coverage = {
  named_impressions: namedImpressions,
  total_impressions: cur?.impressions ?? 0,
  share: cur?.impressions ? namedImpressions / cur.impressions : null,
}

say(''); say('  --- POSITION DISTRIBUTION (named queries only) ---')
say(`    ${'bucket'.padEnd(8)}${'queries'.padStart(9)}${'impressions'.padStart(13)}${'% impr'.padStart(9)}`)
for (const [b] of BUCKETS) {
  const d = dist[b]
  const pct = namedImpressions ? ((d.impressions / namedImpressions) * 100).toFixed(1) : '0.0'
  say(`    ${b.padEnd(8)}${String(d.queries).padStart(9)}${String(d.impressions).padStart(13)}${(pct + '%').padStart(9)}`)
}
const coverPct = out.named_query_coverage.share
say(
  `    COVERAGE: these ${namedImpressions} impressions are ` +
    `${coverPct === null ? 'n/a' : (coverPct * 100).toFixed(0) + '%'} of the ` +
    `${cur?.impressions ?? 0} total. Google withholds rare queries; the rest cannot be named.`
)

// ── GA4 ──────────────────────────────────────────────────────────────────────
if (ga4Property) {
  say(''); say(BAR); say('GA4 — TRAFFIC (last 28 complete days)'); say(BAR)
  const runReport = async (metrics, dimensions, limit = 15) => {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${ga4Property}`,
      requestBody: {
        dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
        metrics: metrics.map((name) => ({ name })),
        ...(dimensions
          ? {
              dimensions: dimensions.map((name) => ({ name })),
              limit,
              orderBys: [{ metric: { metricName: metrics[0] }, desc: true }],
            }
          : {}),
      },
    })
    return data
  }

  const totals = await runReport([
    'sessions', 'totalUsers', 'screenPageViews',
    'engagementRate', 'bounceRate', 'averageSessionDuration',
  ])
  out.ga4 = Object.fromEntries(
    (totals.metricHeaders ?? []).map((h, i) => [h.name, totals.rows?.[0]?.metricValues?.[i]?.value ?? null])
  )
  for (const [k, v] of Object.entries(out.ga4)) {
    const n = Number(v)
    const shown = /Rate$/.test(k) ? `${(n * 100).toFixed(1)}%`
      : /Duration$/.test(k) ? `${n.toFixed(0)}s`
      : n.toFixed(0)
    say(`  ${k.padEnd(26)}${shown.padStart(10)}`)
  }

  for (const [dim, title, key] of [
    ['sessionDefaultChannelGroup', 'CHANNELS', 'ga4_channels'],
    ['landingPage', 'LANDING PAGES', 'ga4_landing'],
  ]) {
    say(''); say(`  --- ${title} ---`)
    const r = await runReport(['sessions'], [dim], 15)
    out[key] = (r.rows ?? []).map((x) => ({
      key: x.dimensionValues[0].value,
      sessions: Number(x.metricValues[0].value),
    }))
    for (const row of out[key]) say(`    ${row.key.slice(0, 58).padEnd(58)}${String(row.sessions).padStart(6)}`)
  }
} else {
  say('\n[SKIP] GA4 — GOOGLE_GA4_PROPERTY_ID not set')
}

// ── Core Web Vitals field data (CrUX API) ────────────────────────────────────
// Queries the Chrome UX Report API DIRECTLY, not PageSpeed Insights. PSI embeds
// a CrUX view but reported "no field data" for this origin on 2026-08-02 while
// the CrUX API returned a full histogram for the same origin in the same
// minute — PSI's loadingExperience is URL-scoped and falls back inconsistently.
// The CrUX API is the source of record for field data, so ask it.
//
// Needs GOOGLE_CRUX_API_KEY (GCP project ryanrealty, Chrome UX Report API +
// PageSpeed Insights API enabled 2026-08-02). Without it the anonymous quota
// 429s on every call.
say(''); say(BAR); say('CORE WEB VITALS — CrUX field data (Chrome UX Report API)'); say(BAR)
out.cwv = {}
const cruxKey = process.env.GOOGLE_CRUX_API_KEY
if (!cruxKey) {
  say('  [SKIP] GOOGLE_CRUX_API_KEY not set — the anonymous PSI quota 429s, so this is unmeasurable without it.')
  out.cwv = { measured: false, reason: 'GOOGLE_CRUX_API_KEY not set' }
} else {
  const GOOD = { largest_contentful_paint: 2500, interaction_to_next_paint: 200, cumulative_layout_shift: 0.1,
                 first_contentful_paint: 1800, experimental_time_to_first_byte: 800 }
  for (const formFactor of ['PHONE', 'DESKTOP', null]) {
    const label = formFactor ? formFactor.toLowerCase() : 'all form factors'
    try {
      const res = await fetch(
        `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${cruxKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ origin: 'https://ryan-realty.com', ...(formFactor ? { formFactor } : {}) }),
          signal: AbortSignal.timeout(60_000),
        }
      )
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 200)
        say(`  [${label}] HTTP ${res.status}: ${detail}`)
        out.cwv[label] = { measured: false, reason: `HTTP ${res.status}` }
        continue
      }
      const d = await res.json()
      const metrics = d.record?.metrics ?? {}
      out.cwv[label] = { measured: true, period: d.record?.collectionPeriod ?? null, metrics: {} }
      say(`  [${label}]`)
      for (const [name, m] of Object.entries(metrics)) {
        const p75 = m.percentiles?.p75
        if (p75 === undefined) continue
        const good = GOOD[name]
        const verdict = good === undefined ? '' : (Number(p75) <= good ? '  GOOD' : '  NEEDS WORK')
        out.cwv[label].metrics[name] = { p75, threshold: good ?? null }
        say(`      ${name.padEnd(34)} p75=${String(p75).padStart(8)}${verdict}`)
      }
    } catch (err) {
      say(`  [${label}] error: ${String(err.message).slice(0, 160)}`)
      out.cwv[label] = { measured: false, reason: String(err.message).slice(0, 160) }
    }
  }
}

if (asJson) console.log(JSON.stringify(out, null, 2))
