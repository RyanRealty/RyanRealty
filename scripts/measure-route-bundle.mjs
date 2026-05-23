#!/usr/bin/env node
/**
 * SITE_SPEC §50 — Measure initial JS bundle size per route.
 *
 * Fetches each route's HTML from production, enumerates every <script
 * src="/_next/static/..."> tag, fetches the asset, and totals up:
 *   - transferred bytes (gzip/br as served)
 *   - uncompressed bytes (Content-Length / response.text().length)
 *
 * Outputs a route × size table for SITE_SPEC §50 budget tracking. The
 * 250 KB target is uncompressed; transferred is for "what users actually pay".
 *
 * Usage:  node scripts/measure-route-bundle.mjs [--base=https://ryanrealty.vercel.app]
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/)
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), 'true']
  }),
)

const BASE = (args.base ?? 'https://ryanrealty.vercel.app').replace(/\/$/, '')

const ROUTES = [
  ['homepage', '/'],
  ['city LP', '/cities/bend'],
  ['neighborhood LP', '/cities/bend/awbrey-butte'],
  ['community LP', '/communities/tetherow'],
  ['zip LP', '/zip/97703'],
  ['listing detail', '/homes-for-sale/bend/southeast-bend/stonegate/60320-sage-stone-220221963'],
]

async function fetchScriptSizes(routePath) {
  const url = `${BASE}${routePath}`
  const htmlRes = await fetch(url, { redirect: 'follow' })
  const html = await htmlRes.text()
  // Match <script src="/_next/static/..."> tags
  const scriptMatches = [...html.matchAll(/<script[^>]+src="(\/_next\/static\/[^"]+)"/g)]
  const scriptUrls = scriptMatches.map((m) => m[1])
  // Also pick up link rel="modulepreload" — these are still part of the initial bundle
  const preloadMatches = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="(\/_next\/static\/[^"]+)"/g)]
  for (const m of preloadMatches) scriptUrls.push(m[1])
  const uniq = Array.from(new Set(scriptUrls))
  let totalTransferred = 0
  let totalUncompressed = 0
  for (const path of uniq) {
    try {
      const assetUrl = `${BASE}${path}`
      const res = await fetch(assetUrl, { headers: { 'Accept-Encoding': 'gzip, br' } })
      const contentLen = Number(res.headers.get('content-length') ?? 0)
      const bodyText = await res.text()
      totalTransferred += contentLen
      totalUncompressed += bodyText.length
    } catch {
      // ignore individual chunk failures
    }
  }
  return { count: uniq.length, transferred: totalTransferred, uncompressed: totalUncompressed }
}

;(async () => {
  console.log(`Measuring bundle size on ${BASE}`)
  console.log('')
  console.log('Route'.padEnd(22) + 'Chunks'.padStart(8) + 'Transferred'.padStart(14) + 'Uncompressed'.padStart(15))
  console.log('─'.repeat(60))
  const kb = (n) => `${Math.round(n / 1024)} KB`.padStart(11)
  for (const [label, path] of ROUTES) {
    try {
      const r = await fetchScriptSizes(path)
      console.log(label.padEnd(22) + String(r.count).padStart(8) + kb(r.transferred) + kb(r.uncompressed))
    } catch (err) {
      console.log(label.padEnd(22) + ' ERR: ' + String(err))
    }
  }
  console.log('')
  console.log('SITE_SPEC §50 budget: 250 KB uncompressed per route')
})()
