#!/usr/bin/env node
/**
 * Ad-hoc: top place pages (/cities/[city]/[hood] and /communities/[slug]) by Search
 * Console impressions and clicks over the trailing 28 days (ending 3 days back, GSC lag).
 * Read-only. Prints the rows the SITE-01 build targets. Usage: node scripts/_gsc-place-pages.mjs [limit]
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
const end = new Date(Date.now() - 3 * 86_400_000)
const start = new Date(end.getTime() - 27 * 86_400_000)
const limit = Number(process.argv[2] || 25)
const { data } = await sc.searchanalytics.query({
  siteUrl: SITE,
  requestBody: { startDate: fmt(start), endDate: fmt(end), dimensions: ['page'], rowLimit: 25000 },
})
const rows = (data.rows ?? []).map((r) => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
const isHood = (p) => /^https:\/\/(www\.)?ryan-realty\.com\/cities\/[^/?#]+\/[^/?#]+\/?$/.test(p)
const isCommunity = (p) => /^https:\/\/(www\.)?ryan-realty\.com\/communities\/[^/?#]+\/?$/.test(p)
const total = rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }), { clicks: 0, impressions: 0 })
const pick = (pred) => rows.filter((r) => pred(r.page)).sort((a, b) => b.impressions - a.impressions)
const hoods = pick(isHood), comms = pick(isCommunity)
const sum = (xs) => xs.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }), { clicks: 0, impressions: 0 })
console.log(`window ${fmt(start)}..${fmt(end)} property ${SITE} pages ${rows.length} total clicks ${total.clicks} impressions ${total.impressions}`)
const show = (label, xs) => {
  const s = sum(xs)
  console.log(`\n== ${label}: ${xs.length} pages, clicks ${s.clicks}, impressions ${s.impressions}`)
  console.log('impr  clicks  ctr    pos   page')
  for (const r of xs.slice(0, limit)) console.log(String(r.impressions).padStart(5), String(r.clicks).padStart(6), (r.ctr * 100).toFixed(2).padStart(6) + '%', r.position.toFixed(1).padStart(5), ' ', r.page.replace(/^https:\/\/(www\.)?ryan-realty\.com/, ''))
}
show('neighborhood pages /cities/*/*', hoods)
show('community pages /communities/*', comms)
