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
  { id: 'braydon-park', url: 'https://ryan-realty.com/subdivisions/braydon-park' },
  { id: 'brooktree', url: 'https://ryan-realty.com/subdivisions/brooktree' },
  { id: 'centennial-glen', url: 'https://ryan-realty.com/subdivisions/centennial-glen' },
  { id: 'choctaw-village', url: 'https://ryan-realty.com/subdivisions/choctaw-village' },
  { id: 'aspen-meadows', url: 'https://ryan-realty.com/subdivisions/aspen-meadows' },
  { id: 'canyon-view', url: 'https://ryan-realty.com/subdivisions/canyon-view' },
  { id: 'alstrup-estates', url: 'https://ryan-realty.com/subdivisions/alstrup-estates' },
  { id: '1925-townhomes', url: 'https://ryan-realty.com/subdivisions/1925-townhomes' },
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
  const heroHomes = text.match(/(\d[\d,]*)\s+homes? for sale/i)
  const noActive = /No active listings/i.test(text)
  const medianList = text.match(/Median list(?: price)?\s+\$([\d,]+)/i)
  const closed30 = text.match(/(\d+)\s+Closed\s*[·•]\s*30 days/i)
  const homesSold = text.match(/Homes sold\s+(\d+)/i)
  const salesSince = text.match(/(\d+)\s+single-family homes have closed[^.]*since\s+(\d{4})/i)
  const pending = text.match(/Pending in\s+(\d+(?:\.\d+)?)\s+days/i)
  const cider = /20431 Cider/i.test(text)
  const seeHomes = /See (?:every |all )?[A-Za-z0-9 '.-]{0,40} home/i.test(text)
  const cardHrefs = [
    ...new Set(
      (html.match(/href="(\/homes-for-sale\/[^"]+-\d+)"/g) ?? []).map((h) =>
        h.replace(/^href="/, '').replace(/"$/, ''),
      ),
    ),
  ]
  return {
    heroHomes: heroHomes ? Number(heroHomes[1].replace(/,/g, '')) : null,
    noActive,
    seeHomes,
    medianList: medianList ? Number(medianList[1].replace(/,/g, '')) : null,
    closed30: closed30 ? Number(closed30[1]) : null,
    homesSold: homesSold ? Number(homesSold[1]) : null,
    salesClosed: salesSince ? Number(salesSince[1]) : null,
    salesSinceYear: salesSince ? Number(salesSince[2]) : null,
    pendingDays: pending ? Number(pending[1]) : null,
    cider,
    uniqueListingHrefs: cardHrefs.length,
    sampleHrefs: cardHrefs.slice(0, 8),
    jsonLdPrices: extractJsonLd(html).slice(0, 12),
    textSnippet: text.slice(0, 700),
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
