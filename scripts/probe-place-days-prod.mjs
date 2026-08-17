#!/usr/bin/env node
/**
 * Production / local accept for the place days-to-pending class.
 * Hero, glance, market card, and FAQ must share one published figure.
 * A half-day pulse must not appear as an integer on the card.
 *
 *   node scripts/probe-place-days-prod.mjs
 *   BASE_URL=http://127.0.0.1:3000 node scripts/probe-place-days-prod.mjs
 */
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const PAGES = [
  { path: '/', half: '23.5', rounded: '24 days' },
  { path: '/communities/black-butte-ranch', half: '39.5', rounded: '40 days' },
  { path: '/communities/northwest-crossing', half: '10.5', rounded: '11 days' },
  { path: '/communities/broken-top', half: '8.5', rounded: '9 days' },
  { path: '/communities/brasada-ranch', half: '15.5', rounded: '16 days' },
  { path: '/cities/redmond', half: '19.5', rounded: '20 days' },
  { path: '/cities/bend/larkspur', half: '6.5', rounded: '7 days' },
]

function textish(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

async function fetchHtml(path) {
  const url = `${BASE}${path}`
  const res = await fetch(url, { headers: CI_PROBE_HEADERS })
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`)
  return { url, html: await res.text() }
}

let failed = 0
for (const page of PAGES) {
  const { url, html } = await fetchHtml(page.path)
  const text = textish(html)
  const hasHalf = text.includes(`${page.half} days`)
  const hasRounded = new RegExp(`(?<!\\d)${page.rounded}`).test(text) || text.includes(page.rounded)
  const ok = hasHalf && !hasRounded
  console.log(`${ok ? 'ok' : 'FAIL'}  ${url} half=${hasHalf} rounded=${hasRounded}`)
  if (!ok) failed++
}

if (failed) {
  console.error(`\nplace-days probe: ${failed} page(s) still disagree`)
  process.exit(1)
}
console.log(`\nplace-days probe: ${PAGES.length}/${PAGES.length} share one published figure`)
