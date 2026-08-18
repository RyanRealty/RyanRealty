#!/usr/bin/env node
/**
 * Reproduce fleet:public-ux:place-pages punch slice (chrome-only / no door).
 * Writes HTML + text extracts under /tmp/place-pages-punch-v9/
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = '/tmp/place-pages-punch-v9'
mkdirSync(OUT, { recursive: true })

const URLS = [
  'https://ryan-realty.com/subdivisions/aero-acres',
  'https://ryan-realty.com/subdivisions/anderson-acres',
  'https://ryan-realty.com/communities/crooked-river-ranch',
  'https://ryan-realty.com/subdivisions/1880-ranch',
  'https://ryan-realty.com/subdivisions/27th-park',
  'https://ryan-realty.com/subdivisions/27th-street-addition',
  'https://ryan-realty.com/subdivisions/27th-street-crossing',
  'https://ryan-realty.com/subdivisions/brentwood',
]

function slugFrom(url) {
  return url.replace(/^https:\/\/ryan-realty.com\//, '').replaceAll('/', '_')
}

function strip(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extract(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() ?? null
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1]))
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  const placeDoors = hrefs.filter((h) => /\/homes-for-sale\/[^?]/.test(h))
  const globalDoors = hrefs.filter((h) => /^\/homes-for-sale(\?|$)/.test(h))
  const seeHomes = [...html.matchAll(/See [^<]{0,60} homes/gi)].map((m) => m[0])
  const empty = [...html.matchAll(/No active listings[^<]{0,80}|nothing for sale[^<]{0,40}|Live inventory[^<]{0,80}/gi)].map(
    (m) => m[0],
  )
  const hasMain = /<main[\s>]/i.test(html)
  const hasFooter = /kb-footer|site-footer|<footer[\s>]/i.test(html)
  const hasMap = /kb-map|listing-map|PlaceMapListSplit/i.test(html)
  const hasFeatured = /kb-featured|featured-rail|listing-card/i.test(html)
  return {
    bytes: html.length,
    title,
    h1s,
    hasMain,
    hasFooter,
    hasMap,
    hasFeatured,
    placeDoors: [...new Set(placeDoors)].slice(0, 8),
    placeDoorCount: placeDoors.length,
    globalDoorCount: globalDoors.length,
    seeHomes,
    empty,
  }
}

const rows = []
for (const url of URLS) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; loop-sentinel/1.0)' },
    redirect: 'manual',
  })
  const html = await res.text()
  const slug = slugFrom(url)
  writeFileSync(join(OUT, `${slug}.html`), html)
  const facts = {
    url,
    status: res.status,
    location: res.headers.get('location'),
    ...extract(html),
  }
  rows.push(facts)
  console.log(JSON.stringify(facts, null, 2))
}
writeFileSync(join(OUT, 'facts.json'), JSON.stringify(rows, null, 2))
console.log(`wrote ${OUT}/facts.json`)
