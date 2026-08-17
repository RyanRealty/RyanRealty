#!/usr/bin/env node
/**
 * Reproduce the served fleet:public-ux:place-pages punch slice (v4).
 *
 *   node scripts/probe-place-pages-punch-v4.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const OUT = 'out/place-pages-punch-v4'
mkdirSync(OUT, { recursive: true })

const CASES = [
  { id: 'southern-crossing', url: 'https://ryan-realty.com/cities/bend/southern-crossing' },
  { id: 'tetherow', url: 'https://ryan-realty.com/communities/tetherow' },
  { id: 'northwest-crossing', url: 'https://ryan-realty.com/communities/northwest-crossing' },
  { id: 'widgi-creek', url: 'https://ryan-realty.com/communities/widgi-creek' },
  { id: 'awbrey-court', url: 'https://ryan-realty.com/subdivisions/awbrey-court' },
  { id: 'amber-springs', url: 'https://ryan-realty.com/subdivisions/amber-springs' },
  { id: 'bailey', url: 'https://ryan-realty.com/subdivisions/bailey' },
  { id: 'bradetich-park', url: 'https://ryan-realty.com/subdivisions/bradetich-park' },
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
  const heroHomes = text.match(/(\d+)\s+homes? for sale/i)
  const noActive = /No active listings/i.test(text)
  const medianList = text.match(/Median list(?: price)?\s+\$([\d,]+)/i)
  const regionalMedian = text.match(/Regional median\s+\$([\d,]+)/i)
  const days = [...text.matchAll(/(\d+(?:\.\d+)?)\s+days/gi)].map((m) => m[1])
  const closed30 = text.match(/(\d+)\s+Closed\s*[·•]\s*30 days/i)
  const salesHistory = text.match(/(\d+)\s+single-family homes have closed/i)
    ?? text.match(/(\d+)\s+homes have closed/i)
    ?? text.match(/sales history[\s\S]{0,80}?(\d+)/i)
  const seeHomes = text.match(/See (?:every |all )?([A-Za-z][A-Za-z0-9 '.-]{0,40}) home/i)
  const highLakes = text.match(/2322 High Lakes[\s\S]{0,120}\$([\d,]+)/i)
  const ordway = [...text.matchAll(/2745 Ordway[\s\S]{0,160}\$([\d,]+)/gi)].map((m) =>
    Number(m[1].replace(/,/g, '')),
  )
  const prices = [...text.matchAll(/\$([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')))
  const cardHrefs = [...new Set((html.match(/href="(\/homes-for-sale\/[^"]+-\d+)"/g) ?? []).map((h) =>
    h.replace(/^href="/, '').replace(/"$/, ''),
  ))]
  const tickerPrices = [...html.matchAll(/ticker-price[^>]*>\s*\$([\d,]+)/g)].map((m) =>
    Number(m[1].replace(/,/g, '')),
  )
  return {
    heroHomes: heroHomes ? Number(heroHomes[1]) : null,
    noActive,
    medianList: medianList ? Number(medianList[1].replace(/,/g, '')) : null,
    regionalMedian: regionalMedian ? Number(regionalMedian[1].replace(/,/g, '')) : null,
    daysSample: days.slice(0, 12),
    closed30: closed30 ? Number(closed30[1]) : null,
    salesHistoryClosed: salesHistory ? Number(salesHistory[1]) : null,
    seeHomes: seeHomes ? seeHomes[0] : null,
    highLakes: highLakes ? Number(highLakes[1].replace(/,/g, '')) : null,
    ordway,
    uniqueListingHrefs: cardHrefs.length,
    sampleHrefs: cardHrefs.slice(0, 6),
    samplePrices: prices.slice(0, 16),
    has920k: prices.includes(920000),
    has919500: prices.includes(919500),
    has1200k: prices.includes(1200000),
    has1199500: prices.includes(1199500),
    has1550k: prices.includes(1550000),
    has1549900: prices.includes(1549900),
    tickerPrices: tickerPrices.slice(0, 12),
    jsonLdPrices: extractJsonLd(html).slice(0, 12),
    textSnippet: text.slice(0, 520),
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
