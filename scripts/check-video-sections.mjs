#!/usr/bin/env node
/**
 * check-video-sections.mjs — smoke gate: the site's video surfaces actually
 * render (a video section can't silently disappear).
 *
 * Retargeted 2026-07-17. The original cases asserted VideoHomesSection on the
 * homepage + city pages ("Video tours in Bend"), but the KB city-page rebuild
 * (Phase 9) and the v6 homepage replaced that strategy: city pages now carry
 * the per-geo "Watch <City>" area-guide video (KbAreaGuideVideo, a server
 * component that renders nothing when the geo has no approved guide video),
 * and the video-tour-homes grid lives on the /videos hub ("Tour the homes").
 * The old markers made three healthy pages read as failures for weeks.
 *
 * MATCHING GOTCHA: JSX interpolation renders `Watch <!-- -->Bend`, so literal
 * substring checks on raw HTML miss server-rendered headings. Markers match
 * against comment- and tag-STRIPPED text, never raw HTML.
 *
 * Runs against the live deploy. Override the host with VIDEO_SMOKE_BASE.
 *
 * Usage: node scripts/check-video-sections.mjs
 */
const BASE = (process.env.VIDEO_SMOKE_BASE || 'https://ryan-realty.com').replace(/\/$/, '')
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
const LATENCY_BUDGET_MS = 10000

// "Tour the homes" heads the /videos video-tour card grid; "Watch <City>" is
// the KbAreaGuideVideo heading, present only when the geo's guide video
// resolved. All markers verified against live 2026-07-17.
const CASES = [
  { path: '/videos', label: 'videos hub (tour grid)', marker: /Tour the homes/i },
  { path: '/cities/bend', label: 'city: Bend', marker: /Watch\s*Bend/i },
  { path: '/cities/redmond', label: 'city: Redmond', marker: /Watch\s*Redmond/i },
  { path: '/cities/sisters', label: 'city: Sisters', marker: /Watch\s*Sisters/i },
]

/** Comment- and tag-stripped page text (see MATCHING GOTCHA above). */
function stripMarkup(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')
}

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
  if (!c.marker.test(stripMarkup(html)))
    return { ...c, ok: false, reason: 'video section did not render (heading absent)', ms }
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
