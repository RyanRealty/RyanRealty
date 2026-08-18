#!/usr/bin/env node
/**
 * Reproduce the served fleet:public-ux:place-pages punch slice (v8).
 *
 *   node scripts/probe-place-pages-punch-v8.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const OUT = 'out/place-pages-punch-v8'
mkdirSync(OUT, { recursive: true })

const CASES = [
  { id: 'awbrey-butte', url: 'https://ryan-realty.com/cities/bend/awbrey-butte' },
  { id: 'neighborhoods-index', url: 'https://ryan-realty.com/neighborhoods' },
  { id: 'ridge-eagle', url: 'https://ryan-realty.com/subdivisions/ridge-at-eagle-crest' },
  { id: 'subdivisions-index', url: 'https://ryan-realty.com/subdivisions' },
  { id: 'housing-market', url: 'https://ryan-realty.com/housing-market' },
  { id: 'neighborhoods-awbrey', url: 'https://ryan-realty.com/neighborhoods/awbrey-butte' },
  { id: 'river-meadows', url: 'https://ryan-realty.com/subdivisions/river-meadows' },
  { id: 'tetherow', url: 'https://ryan-realty.com/communities/tetherow' },
  { id: 'housing-market-co', url: 'https://ryan-realty.com/housing-market/central-oregon' },
  { id: 'pronghorn', url: 'https://ryan-realty.com/communities/pronghorn' },
  { id: 'crosswater', url: 'https://ryan-realty.com/communities/crosswater' },
  { id: 'eagle-crest', url: 'https://ryan-realty.com/communities/eagle-crest' },
]

function textish(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: CI_PROBE_HEADERS, redirect: 'manual' })
  const loc = res.headers.get('location')
  let html = ''
  let followed = null
  if (res.status >= 300 && res.status < 400 && loc) {
    const abs = loc.startsWith('http') ? loc : new URL(loc, url).href
    const follow = await fetch(abs, { headers: CI_PROBE_HEADERS, redirect: 'follow' })
    html = await follow.text()
    followed = { status: follow.status, url: follow.url, cache: follow.headers.get('x-vercel-cache') }
  } else {
    html = await res.text()
  }
  return {
    status: res.status,
    location: loc,
    cache: res.headers.get('x-vercel-cache'),
    age: res.headers.get('age'),
    html,
    followed,
  }
}

function extract(html, id) {
  const text = textish(html)
  const heroCount = text.match(/(\d[\d,]*)\s+homes? for sale/i)?.[1] ?? null
  const activeHits = [...text.matchAll(/(\d+)\s+ACTIVE/gi)].map((m) => m[0])
  const awbreyHits = [...text.matchAll(/Awbrey Butte[^.]{0,200}/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim()).slice(0, 8)
  const ridgeHits = [...text.matchAll(/Ridge At Eagle Crest[^.]{0,200}/gi)].map((m) =>
    m[0].replace(/\s+/g, ' ').trim(),
  ).slice(0, 8)
  const medianHits = [...text.matchAll(/(Regional median|median)\s+\$[\d,]+/gi)].map((m) =>
    m[0].replace(/\s+/g, ' ').trim(),
  ).slice(0, 16)
  const regionalMedian = [...text.matchAll(/Regional median[^.]{0,80}/gi)].map((m) =>
    m[0].replace(/\s+/g, ' ').trim(),
  )
  const closedCte = [...text.matchAll(/closed_cte[^.]{0,220}|service_area_v1[^.]{0,220}|StandardStatus ILIKE[^.]{0,180}/gi)].map(
    (m) => m[0].replace(/\s+/g, ' ').trim(),
  )
  const composition = [...text.matchAll(/2024[^.]{0,220}|1998[^.]{0,220}/gi)].map((m) =>
    m[0].replace(/\s+/g, ' ').trim(),
  ).slice(0, 10)
  const mlsCodes = [...text.matchAll(/\b(Oww|DrrhTrs|Drrh Trs|OWW2|Bbr|StoneTH|Crr 1|Crr1)\b/g)].map((m) => m[0])
  const pendingHits = [...text.matchAll(/Pending[^.]{0,80}|Under contract[^.]{0,80}/gi)].map((m) =>
    m[0].replace(/\s+/g, ' ').trim(),
  ).slice(0, 12)
  const closedHits = [...text.matchAll(/Closed[^.]{0,80}|Median to pending[^.]{0,80}/gi)].map((m) =>
    m[0].replace(/\s+/g, ' ').trim(),
  ).slice(0, 12)
  const moreAreas = [...text.matchAll(/More areas[^.]{0,300}/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim())
  return {
    heroCount,
    activeHits: activeHits.slice(0, 20),
    awbreyHits,
    ridgeHits,
    medianHits,
    regionalMedian,
    closedCte,
    composition,
    mlsCodes,
    pendingHits,
    closedHits,
    moreAreas,
    snippet: text.slice(0, 1600),
    id,
  }
}

const results = []
for (const c of CASES) {
  const page = await fetchPage(c.url)
  const extracted = extract(page.html, c.id)
  const row = {
    id: c.id,
    url: c.url,
    status: page.status,
    location: page.location,
    cache: page.cache,
    age: page.age,
    followed: page.followed,
    htmlLen: page.html.length,
    ...extracted,
  }
  results.push(row)
  console.log(
    JSON.stringify({
      id: c.id,
      status: row.status,
      loc: row.location,
      heroCount: row.heroCount,
      awbreyHits: row.awbreyHits,
      ridgeHits: row.ridgeHits,
      regionalMedian: row.regionalMedian,
      closedCte: row.closedCte,
      mlsCodes: row.mlsCodes,
      pendingHits: row.pendingHits.slice(0, 6),
      closedHits: row.closedHits.slice(0, 6),
      moreAreas: row.moreAreas,
    }),
  )
}

writeFileSync(`${OUT}/html-probe.json`, JSON.stringify(results, null, 2))
console.log('wrote', `${OUT}/html-probe.json`)
