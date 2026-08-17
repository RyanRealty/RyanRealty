#!/usr/bin/env node
/**
 * Reproduce the served fleet:public-ux:place-pages punch slice (v5).
 *
 *   node scripts/probe-place-pages-punch-v5.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const OUT = 'out/place-pages-punch-v5'
mkdirSync(OUT, { recursive: true })

const CASES = [
  { id: 'calaveras', url: 'https://ryan-realty.com/subdivisions/calaveras' },
  { id: '1925-townhomes', url: 'https://ryan-realty.com/subdivisions/1925-townhomes' },
  { id: 'blakley-heights', url: 'https://ryan-realty.com/subdivisions/blakley-heights' },
  { id: 'aspenwood', url: 'https://ryan-realty.com/subdivisions/aspenwood' },
  { id: 'canyon-breeze', url: 'https://ryan-realty.com/subdivisions/canyon-breeze' },
  { id: 'aubrey-heights', url: 'https://ryan-realty.com/subdivisions/aubrey-heights' },
  { id: 'summit-west', url: 'https://ryan-realty.com/cities/bend/summit-west' },
  { id: 'bend-park', url: 'https://ryan-realty.com/subdivisions/bend-park' },
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

function extract(html) {
  const text = textish(html)
  const heroCount = text.match(/(\d+)\s+homes? for sale/i)?.[1] ?? null
  const emptyList = /No active listings in .+ right now/i.test(text)
  const seeHomes = /See homes/i.test(text)
  const closed30 = text.match(/(\d[\d,]*)\s+Closed\s*[·•]\s*30 days/i)?.[1] ?? null
  const closedLast30 = text.match(/(\d[\d,]*)\s+closed in the last 30 days/i)?.[1] ?? null
  const medianList = text.match(/Median list\s+\$([\d,]+)/i)?.[1] ?? null
  const pendingDays = text.match(/Pending in\s+([\d.]+)\s+days/i)?.[1] ?? null
  const regionalPair = /\$756,000/.test(text) && /18 days/.test(text)
  const salesHistorySfr = text.match(/(\d+)\s+single-family/i)?.[1] ?? null
  const celilo2035 = /\$2,035,000/.test(text)
  const celilo20345 = /\$2,034,500/.test(text)
  const jsonLd = extractJsonLd(html)
  const listingCards = (html.match(/lst-card|v3-field-item|place-split-row|kb-featured/gi) ?? []).length
  const listingHrefs = [...html.matchAll(/href="(\/homes-for-sale\/[^"]+)"/g)].map((m) => m[1])
  return {
    heroCount,
    emptyList,
    seeHomes,
    closed30,
    closedLast30,
    medianList,
    pendingDays,
    regionalPair,
    salesHistorySfr,
    celilo2035,
    celilo20345,
    listingCards,
    listingHrefCount: listingHrefs.length,
    listingHrefs: listingHrefs.slice(0, 12),
    jsonLdPrices: jsonLd.prices,
    hasV3: /v3-root|V3Chrome|data-v3/.test(html),
    hasKb: /kb-root|class="hero"/.test(html),
    snippet: text.slice(0, 900),
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
  writeFileSync(`${OUT}/${c.id}.html`, page.html)
  console.log(JSON.stringify(row, null, 2))
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2))
console.log(`wrote ${OUT}/summary.json`)
