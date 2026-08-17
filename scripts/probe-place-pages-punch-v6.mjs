#!/usr/bin/env node
/**
 * Reproduce the served fleet:public-ux:place-pages punch slice (v6).
 *
 *   node scripts/probe-place-pages-punch-v6.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const OUT = 'out/place-pages-punch-v6'
mkdirSync(OUT, { recursive: true })

const CASES = [
  { id: 'big-sky', url: 'https://ryan-realty.com/subdivisions/big-sky' },
  { id: 'calaveras', url: 'https://ryan-realty.com/subdivisions/calaveras' },
  { id: 'housing-market', url: 'https://ryan-realty.com/housing-market' },
  { id: 'larkspur', url: 'https://ryan-realty.com/cities/bend/larkspur' },
  { id: 'tetherow', url: 'https://ryan-realty.com/communities/tetherow' },
  { id: 'communities', url: 'https://ryan-realty.com/communities' },
  { id: 'neighborhoods-tetherow', url: 'https://ryan-realty.com/neighborhoods/tetherow' },
  { id: 'neighborhoods', url: 'https://ryan-realty.com/neighborhoods' },
  { id: 'home', url: 'https://ryan-realty.com/' },
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

function tetherowBits(text) {
  const hits = []
  const re = /Tetherow[^.]{0,160}/gi
  let m
  while ((m = re.exec(text))) hits.push(m[0].replace(/\s+/g, ' ').trim())
  return hits.slice(0, 8)
}

function extract(html) {
  const text = textish(html)
  const heroCount = text.match(/(\d+)\s+homes? for sale/i)?.[1] ?? null
  const emptyList = /No active listings in .+ right now/i.test(text)
  const seeHomes = /See homes/i.test(text)
  const medianList = text.match(/Median list\s+\$([\d,]+)/i)?.[1] ?? null
  const pendingDays = text.match(/Pending in\s+([\d.]+)\s+days/i)?.[1] ?? null
  const regionalPair = /\$756,000/.test(text) && /18 days/.test(text)
  const grotto1238000 = /\$1,238,000/.test(text)
  const grotto1238136 = /\$1,238,136/.test(text)
  const jsonLd = extractJsonLd(html)
  const listingHrefs = [...html.matchAll(/href="(\/homes-for-sale\/[^"]+)"/g)].map((m) => m[1])
  return {
    heroCount,
    emptyList,
    seeHomes,
    medianList,
    pendingDays,
    regionalPair,
    grotto1238000,
    grotto1238136,
    listingHrefCount: listingHrefs.length,
    listingHrefs: listingHrefs.slice(0, 16),
    jsonLdPrices: jsonLd.prices,
    tetherowHits: tetherowBits(text),
    hasV3: /v3-root|V3Chrome|data-v3/.test(html),
    snippet: text.slice(0, 1100),
  }
}

const results = []
for (const c of CASES) {
  const page = await fetchPage(c.url)
  const extracted = extract(page.html)
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
      medianList: row.medianList,
      pendingDays: row.pendingDays,
      regionalPair: row.regionalPair,
      grotto1238000: row.grotto1238000,
      grotto1238136: row.grotto1238136,
      seeHomes: row.seeHomes,
      listingHrefCount: row.listingHrefCount,
      tetherowHits: row.tetherowHits,
    }),
  )
}

writeFileSync(`${OUT}/html-probe.json`, JSON.stringify(results, null, 2))
console.log('wrote', `${OUT}/html-probe.json`)
