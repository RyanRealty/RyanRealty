#!/usr/bin/env node
// Indexing health check via Google Search Console API.
// Run: node --env-file=.env.local scripts/_gsc-index-check.mjs
import { google } from 'googleapis'

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/webmasters'],
})
const wm = google.webmasters({ version: 'v3', auth })
const sc = google.searchconsole({ version: 'v1', auth })
const day = (off) => { const t = new Date(); t.setDate(t.getDate() - off); return t.toISOString().slice(0, 10) }

// ── which properties can we see ──────────────────────────────────────────────
const sites = (await wm.sites.list()).data.siteEntry || []
const rr = sites.filter((s) => (s.siteUrl || '').includes('ryan-realty.com'))
console.log('GSC properties visible to the service account:')
rr.forEach((s) => console.log(`  ${s.siteUrl}  —  ${s.permissionLevel}`))
const siteUrl = (rr.find((s) => s.siteUrl.startsWith('sc-domain:'))?.siteUrl) || 'https://ryan-realty.com/'
console.log(`Using property: ${siteUrl}\n`)

// ── sitemaps registered in GSC ───────────────────────────────────────────────
console.log('Sitemaps registered in GSC:')
const sm = (await wm.sitemaps.list({ siteUrl })).data.sitemap || []
if (!sm.length) console.log('  (none registered)')
for (const s of sm) {
  const c = (s.contents || []).map((x) => `${x.type}=${x.submitted}`).join(', ')
  console.log(`  ${s.path}`)
  console.log(`     lastDownloaded:${s.lastDownloaded || 'NEVER'} pending:${s.isPending || false} errors:${s.errors || 0} warnings:${s.warnings || 0}${c ? '  submitted[' + c + ']' : ''}`)
}

// ── live sitemap: how many URLs does the NEW site actually declare ────────────
try {
  const r = await fetch('https://ryan-realty.com/sitemap.xml', { headers: { 'user-agent': 'Mozilla/5.0' } })
  const xml = await r.text()
  if (xml.includes('<sitemapindex')) {
    const kids = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    let total = 0
    for (const k of kids) { try { const cx = await (await fetch(k, { headers: { 'user-agent': 'Mozilla/5.0' } })).text(); total += (cx.match(/<url>/g) || []).length } catch {} }
    console.log(`\nLive /sitemap.xml -> index of ${kids.length} child sitemaps, ${total} total URLs declared`)
  } else {
    console.log(`\nLive /sitemap.xml -> ${(xml.match(/<url>/g) || []).length} URLs declared (HTTP ${r.status})`)
  }
} catch (e) { console.log('\nLive sitemap fetch error:', e.message) }

// ── search performance (indexed & serving) ───────────────────────────────────
const end = day(3), start = day(30)
const pages = (await sc.searchanalytics.query({ siteUrl, requestBody: { startDate: start, endDate: end, dimensions: ['page'], rowLimit: 25000 } })).data.rows || []
const tot = pages.reduce((a, r) => ({ c: a.c + (r.clicks || 0), i: a.i + (r.impressions || 0) }), { c: 0, i: 0 })
console.log(`\nSearch performance ${start} .. ${end} (GSC lags ~3 days):`)
console.log(`  distinct pages receiving impressions (a floor on 'indexed & serving'): ${pages.length}`)
console.log(`  total clicks: ${tot.c}   total impressions: ${tot.i}`)
console.log('  top pages by clicks:')
pages.sort((a, b) => b.clicks - a.clicks).slice(0, 12).forEach((r) => console.log(`    ${String(r.clicks).padStart(4)}c ${String(r.impressions).padStart(6)}i  ${r.keys[0]}`))

const byDate = (await sc.searchanalytics.query({ siteUrl, requestBody: { startDate: start, endDate: end, dimensions: ['date'], rowLimit: 1000 } })).data.rows || []
console.log('  daily trend (date / clicks / impressions):')
byDate.forEach((r) => console.log(`    ${r.keys[0]}  ${String(r.clicks).padStart(4)}  ${r.impressions}`))

// ── URL inspection on key pages (authoritative per-URL index state) ───────────
const urls = [
  'https://ryan-realty.com/', 'https://ryan-realty.com/homes-for-sale', 'https://ryan-realty.com/sell',
  'https://ryan-realty.com/housing-market', 'https://ryan-realty.com/about', 'https://ryan-realty.com/cities/bend',
  'https://ryan-realty.com/communities', 'https://ryan-realty.com/blog',
]
console.log('\nURL inspection (Google\'s actual index state per page):')
for (const u of urls) {
  try {
    const r = await sc.urlInspection.index.inspect({ requestBody: { inspectionUrl: u, siteUrl } })
    const i = r.data.inspectionResult?.indexStatusResult || {}
    console.log(`  ${u.replace('https://ryan-realty.com', '') || '/'}`)
    console.log(`     ${i.coverageState || '?'}  | verdict:${i.verdict || '?'} | lastCrawl:${(i.lastCrawlTime || 'never').slice(0, 10)} | canonical:${(i.googleCanonical || '').replace('https://ryan-realty.com', '') || 'n/a'}`)
  } catch (e) { console.log(`  ${u} -> ERR ${String(e.message).slice(0, 90)}`) }
}
