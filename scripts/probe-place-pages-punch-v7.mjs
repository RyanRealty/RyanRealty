#!/usr/bin/env node
/**
 * Reproduce the served fleet:public-ux:place-pages punch slice (v7).
 *
 *   node scripts/probe-place-pages-punch-v7.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const OUT = 'out/place-pages-punch-v7'
mkdirSync(OUT, { recursive: true })

const CASES = [
  { id: 'terrebonne', url: 'https://ryan-realty.com/cities/terrebonne' },
  { id: 'la-pine', url: 'https://ryan-realty.com/cities/la-pine' },
  { id: 'cities-index', url: 'https://ryan-realty.com/cities' },
  { id: 'neighborhoods', url: 'https://ryan-realty.com/neighborhoods' },
  { id: 'communities', url: 'https://ryan-realty.com/communities' },
  { id: 'eagle-crest', url: 'https://ryan-realty.com/communities/redmond-eagle-crest-resort' },
  { id: 'housing-market', url: 'https://ryan-realty.com/housing-market' },
  { id: 'century-west', url: 'https://ryan-realty.com/cities/bend/century-west' },
  { id: 'awbrey-butte', url: 'https://ryan-realty.com/cities/bend/awbrey-butte' },
]

function textish(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

function extractJsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  const prices = []
  const names = []
  for (const m of blocks) {
    try {
      const data = JSON.parse(m[1])
      const walk = (node) => {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) {
          node.forEach(walk)
          return
        }
        if (node.price != null) prices.push(Number(node.price))
        if (node.lowPrice != null) prices.push(Number(node.lowPrice))
        if (node.highPrice != null) prices.push(Number(node.highPrice))
        if (typeof node.name === 'string') names.push(node.name)
        for (const v of Object.values(node)) walk(v)
      }
      walk(data)
    } catch {
      /* ignore */
    }
  }
  return { prices: prices.filter((n) => Number.isFinite(n)), names }
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
  const heroCount = text.match(/(\d+)\s+homes? for sale/i)?.[1] ?? null
  const activeSingles = [...text.matchAll(/Active single[^.?]{0,80}/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim())
  const sixHomes = [...text.matchAll(/6 homes[^.?]{0,80}/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim())
  const medianListHits = [...text.matchAll(/Median list[^.]{0,40}/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim())
  const doubledDollar = [...html.matchAll(/\$\$[\d,]+/g)].map((m) => m[0])
  const doubledDollarText = [...text.matchAll(/\$\$[\d,]+/g)].map((m) => m[0])
  const dollarPrices = [...text.matchAll(/\$[\d,]+/g)].map((m) => m[0]).slice(0, 40)
  const listingHrefs = [...html.matchAll(/href="(\/homes-for-sale\/[^"]+)"/g)].map((m) => m[1])
  const imgSrcs = [...html.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1]).slice(0, 12)
  const ogImage = html.match(/property="og:image" content="([^"]+)"/)?.[1] ?? null
  const eagleHits = [...text.matchAll(/Eagle Crest[^.]{0,160}/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim()).slice(0, 8)
  const laPineHits = [...text.matchAll(/La Pine[^.]{0,160}/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim()).slice(0, 8)
  const compositionHits = [...text.matchAll(/2024[^.]{0,220}/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim()).slice(0, 8)
  const sourceHits = [...text.matchAll(/closed_cte|service_area_v1|StandardStatus|composition[^.]{0,180}/gi)].map((m) =>
    m[0].replace(/\s+/g, ' ').trim(),
  )
  const palmHits = /palm/i.test(text) || /palm/i.test(html)
  const jsonLd = extractJsonLd(html)
  return {
    heroCount,
    activeSingles: activeSingles.slice(0, 8),
    sixHomes: sixHomes.slice(0, 8),
    medianListHits: medianListHits.slice(0, 12),
    doubledDollar,
    doubledDollarText,
    dollarPrices,
    listingHrefCount: listingHrefs.length,
    listingHrefs: listingHrefs.slice(0, 20),
    imgSrcs,
    ogImage,
    eagleHits,
    laPineHits,
    compositionHits,
    sourceHits,
    palmHits,
    jsonLdPrices: jsonLd.prices,
    hasV3: /v3-root|V3Chrome|data-v3/.test(html),
    snippet: text.slice(0, 1400),
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
    ...extracted,
  }
  results.push(row)
  console.log(
    JSON.stringify({
      id: c.id,
      status: row.status,
      loc: row.location,
      heroCount: row.heroCount,
      medianListHits: row.medianListHits,
      doubledDollar: row.doubledDollar,
      doubledDollarText: row.doubledDollarText,
      listingHrefCount: row.listingHrefCount,
      eagleHits: row.eagleHits,
      laPineHits: row.laPineHits,
      sourceHits: row.sourceHits,
      palmHits: row.palmHits,
      ogImage: row.ogImage,
      imgSrcs: row.imgSrcs.slice(0, 4),
    }),
  )
}

writeFileSync(`${OUT}/html-probe.json`, JSON.stringify(results, null, 2))
console.log('wrote', `${OUT}/html-probe.json`)
