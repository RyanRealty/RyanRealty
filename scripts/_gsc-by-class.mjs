#!/usr/bin/env node
/**
 * Ad-hoc, read-only: every Search Console page bucketed by route class over the trailing
 * 90 days (ending 3 days back, GSC lag). Impressions, clicks, CTR, average position, and
 * page count per class, sorted by impressions. This is the pull behind the site queue's
 * round two (2026-09-08): it showed a 1.05% site-wide CTR with the gap between classes
 * driven by rank (subdivisions at position 10.7 and 1.72% CTR; cities at 21.0 and 0.04%),
 * not by copy. Re-run it when a round-two measurement window comes due.
 *
 *   node scripts/_gsc-by-class.mjs
 */
import { existsSync } from 'node:fs'
import { config as loadEnv } from 'dotenv'
import { google } from 'googleapis'
for (const f of ['.env.local', '.env']) if (existsSync(f)) loadEnv({ path: f })
const SITE = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || 'https://ryan-realty.com/'
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
  key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
})
const sc = google.searchconsole({ version: 'v1', auth })
const fmt = (d) => d.toISOString().slice(0, 10)
const end = new Date(Date.now() - 3 * 86400000)
const start = new Date(end.getTime() - 89 * 86400000)
const { data } = await sc.searchanalytics.query({
  siteUrl: SITE,
  requestBody: { startDate: fmt(start), endDate: fmt(end), dimensions: ['page'], rowLimit: 25000 },
})
const rows = (data.rows ?? []).map((r) => ({
  path: r.keys[0].replace(/^https:\/\/(www\.)?ryan-realty\.com/, '').replace(/\/$/, '') || '/',
  clicks: r.clicks, impressions: r.impressions, position: r.position,
}))
function classify(p) {
  const s = [
    [/^\/$/, 'homepage'],
    [/^\/cities\/[^/]+\/types\//, '/cities/[slug]/types/[type]'],
    [/^\/cities\/[^/]+\/[^/]+$/, '/cities/[slug]/[hood]'],
    [/^\/cities\/[^/]+$/, '/cities/[slug]'],
    [/^\/communities\/[^/]+\/types\//, '/communities/[slug]/types'],
    [/^\/communities\/[^/]+$/, '/communities/[slug]'],
    [/^\/subdivisions\/[^/]+$/, '/subdivisions/[slug]'],
    [/^\/schools\/[^/]+$/, '/schools/[slug]'],
    [/^\/parks\/[^/]+$/, '/parks/[slug]'],
    [/^\/listing\//, '/listing/[key]'],
    [/^\/blog\/[^/]+$/, '/blog/[slug]'],
    [/^\/housing-market\/reports\//, '/housing-market/reports/*'],
    [/^\/housing-market/, '/housing-market/*'],
    [/^\/reports\//, '/reports/*'],
    [/^\/search/, '/search'],
    [/^\/buy/, '/buy*'],
    [/^\/sell/, '/sell*'],
    [/^\/lp\//, '/lp/*'],
    [/^\/team/, '/team*'],
    [/^\/central-oregon\//, '/central-oregon/*'],
    [/^\/open-houses/, '/open-houses*'],
    [/^\/price-drops/, '/price-drops*'],
    [/^\/motivated-sellers/, '/motivated-sellers*'],
    [/^\/zip\//, '/zip/[zip]'],
    [/^\/oregon\//, '/oregon/[city]'],
    [/^\/areas\//, '/areas/[slug]'],
    [/^\/builders/, '/builders*'],
    [/^\/tools\//, '/tools/*'],
    [/^\/faq/, '/faq*'],
  ]
  for (const [re, name] of s) if (re.test(p)) return name
  return p
}
const by = new Map()
for (const r of rows) {
  const k = classify(r.path)
  const c = by.get(k) ?? { cls: k, pages: 0, clicks: 0, impressions: 0, posSum: 0 }
  c.pages++; c.clicks += r.clicks; c.impressions += r.impressions; c.posSum += r.position
  by.set(k, c)
}
const out = [...by.values()].sort((a, b) => b.impressions - a.impressions)
const t = out.reduce((a, c) => ({ clicks: a.clicks + c.clicks, impr: a.impr + c.impressions }), { clicks: 0, impr: 0 })
console.log(`GSC ${fmt(start)}..${fmt(end)} · ${rows.length} pages · ${t.clicks} clicks · ${t.impr} impressions`)
console.log('\nimpressions  clicks   ctr    avgpos  pages  class')
for (const c of out.slice(0, 32)) {
  const ctr = c.impressions ? (c.clicks / c.impressions * 100).toFixed(2) : '0.00'
  console.log(String(c.impressions).padStart(11), String(c.clicks).padStart(7), (ctr + '%').padStart(7), (c.posSum / c.pages).toFixed(1).padStart(7), String(c.pages).padStart(6), ' ', c.cls)
}
