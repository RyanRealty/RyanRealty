#!/usr/bin/env node
/**
 * check-video-sections.mjs — smoke gate: the site-wide "homes with video tours"
 * sections actually render on the surfaces that should carry them.
 *
 * WHY: video is the highest-engagement listing asset, and the strategy is to lead
 * with video-tour homes on the homepage + every geo page. VideoHomesSection is
 * self-fetching and returns null when a scope has fewer than 2 video homes, so
 * the presence of its heading is proof the section rendered real cards (verified
 * inventory: 1,752 active listings carry has_virtual_tour; Bend 492, Mountain
 * View 19). This gate asserts the heading renders so the section can't silently
 * disappear (e.g. a DAL filter regressing has_virtual_tour to empty).
 *
 * Runs against the live deploy. Override the host with VIDEO_SMOKE_BASE.
 *
 * Usage: node scripts/check-video-sections.mjs
 */
const BASE = (process.env.VIDEO_SMOKE_BASE || 'https://ryan-realty.com').replace(/\/$/, '')
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
const LATENCY_BUDGET_MS = 10000

// Each marker only appears when VideoHomesSection rendered >= 2 video-tour cards
// for that scope (it returns null otherwise).
const CASES = [
  { path: '/', label: 'homepage (region)', marker: /Walk through homes on video/i },
  { path: '/cities/bend', label: 'city: Bend', marker: /Video tours in Bend/i },
  { path: '/cities/redmond', label: 'city: Redmond', marker: /Video tours in Redmond/i },
]

async function check(c) {
  const url = `${BASE}${c.path}?_smoke=${Date.now()}`
  const t0 = Date.now()
  let res, html
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    html = await res.text()
  } catch (e) {
    return { ...c, ok: false, reason: `fetch failed: ${e.message}` }
  }
  const ms = Date.now() - t0
  if (res.status !== 200) return { ...c, ok: false, reason: `HTTP ${res.status}`, ms }
  if (!c.marker.test(html))
    return { ...c, ok: false, reason: 'video-tours section did not render (heading absent)', ms }
  if (ms > LATENCY_BUDGET_MS) return { ...c, ok: false, reason: `too slow: ${ms}ms`, ms }
  return { ...c, ok: true, ms }
}

const results = []
for (const c of CASES) results.push(await check(c))

console.log('Video-sections smoke gate')
console.log('=========================\n')
console.log(`Host: ${BASE}\n`)
let failed = 0
for (const r of results) {
  if (r.ok) console.log(`  OK    ${r.label} — video-tours section rendered, ${r.ms}ms`)
  else {
    failed++
    console.log(`  FAIL  ${r.label} — ${r.reason}`)
  }
}
console.log()
if (failed) {
  console.log(`${failed}/${results.length} surfaces missing their "homes with video" section.`)
  process.exit(1)
}
console.log(`All ${results.length} surfaces render their "homes with video" section.`)
process.exit(0)
