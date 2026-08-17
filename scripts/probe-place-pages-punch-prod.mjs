#!/usr/bin/env node
/**
 * Reproduce the served fleet:public-ux:place-pages punch slice on production.
 *
 *   node scripts/probe-place-pages-punch-prod.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const OUT = 'out/place-pages-punch-prod'
mkdirSync(OUT, { recursive: true })

const CASES = [
  {
    id: 'south-meadow',
    url: 'https://ryan-realty.com/subdivisions/south-meadow',
    indexHint: 'South Meadow',
  },
  { id: 'tumalo', url: 'https://ryan-realty.com/cities/tumalo' },
  { id: 'deer-park', url: 'https://ryan-realty.com/subdivisions/deer-park' },
  {
    id: 'deschutes-river',
    url: 'https://ryan-realty.com/subdivisions/deschutes-river-recreation-homesites',
  },
  {
    id: 'rivers-edge',
    url: 'https://ryan-realty.com/subdivisions/rivers-edge-village',
  },
  { id: 'boyd-acres', url: 'https://ryan-realty.com/cities/bend/boyd-acres' },
  { id: 'old-bend', url: 'https://ryan-realty.com/cities/bend/old-bend' },
  {
    id: 'southern-crossing',
    url: 'https://ryan-realty.com/cities/bend/southern-crossing',
  },
]

function textish(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

function extractJsonLdPrices(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  const prices = []
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
        for (const v of Object.values(node)) walk(v)
      }
      walk(data)
    } catch {
      /* ignore */
    }
  }
  return prices.filter((n) => Number.isFinite(n))
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
  const heroHomes = text.match(/(\d+)\s+homes for sale/i)
  const noActive = /No active listings/i.test(text)
  const medianList = text.match(/Median list\s+\$([\d,]+)/i)
  const searchCount = text.match(/Search\s+(\d+)\s+homes/i)
  const showing = text.match(/Showing\s+(\d+)\s+of\s+(\d+)/i)
  const h1 = text.match(/([A-Za-z][A-Za-z0-9 '.-]{2,40}),\s+Homes for Sale/)
  const prices = [...text.matchAll(/\$([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')))
  const cardHrefs = [...new Set(html.match(/href="(\/homes-for-sale\/[^"]+-\d+)"/g) ?? [])]
  const rorick = text.match(/20825 Rorick[\s\S]{0,80}\$([\d,]+)/)
  const wrangler = text.match(/63315 Wrangler[\s\S]{0,80}\$([\d,]+)/)
  return {
    titleHint: h1 ? h1[1] : null,
    heroHomes: heroHomes ? Number(heroHomes[1]) : null,
    noActive,
    medianList: medianList ? Number(medianList[1].replace(/,/g, '')) : null,
    searchCount: searchCount ? Number(searchCount[1]) : null,
    showing: showing ? { shown: Number(showing[1]), total: Number(showing[2]) } : null,
    uniqueListingHrefs: cardHrefs.length,
    samplePrices: prices.slice(0, 12),
    rorick: rorick ? Number(rorick[1].replace(/,/g, '')) : null,
    wrangler: wrangler ? Number(wrangler[1].replace(/,/g, '')) : null,
    jsonLdPrices: extractJsonLdPrices(html).slice(0, 12),
    hasBendCopy: /homes for sale in Bend/i.test(text),
    hasTumaloCopy: /Tumalo/i.test(text),
    textSnippet: text.slice(0, 420),
  }
}

async function main() {
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
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
