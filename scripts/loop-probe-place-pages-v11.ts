/**
 * Reproduce-or-reject probe: place-pages punch slice v11.
 * Seven subdivision chrome-only lines + Summit West desk stamp.
 *
 *   npx tsx scripts/loop-probe-place-pages-v11.ts
 */
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const CASES = [
  { id: 'alder-glen', url: 'https://ryan-realty.com/subdivisions/alder-glen' },
  { id: 'blue-ridge', url: 'https://ryan-realty.com/subdivisions/blue-ridge' },
  { id: 'boyd-crossing', url: 'https://ryan-realty.com/subdivisions/boyd-crossing' },
  { id: 'summit-west', url: 'https://ryan-realty.com/cities/bend/summit-west' },
  { id: 'canyon-ridge-phase-3', url: 'https://ryan-realty.com/subdivisions/canyon-ridge-phase-3' },
  { id: 'canyon-view', url: 'https://ryan-realty.com/subdivisions/canyon-view' },
  { id: 'ambrosia-acres', url: 'https://ryan-realty.com/subdivisions/ambrosia-acres' },
  { id: 'cascade', url: 'https://ryan-realty.com/subdivisions/cascade' },
] as const

function textish(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function probe(id: string, url: string) {
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { ...CI_PROBE_HEADERS, 'user-agent': 'RyanRealty-loop-probe/place-pages-v11' },
  })
  const html = await res.text()
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  )
  const text = textish(html)
  const updatedHits = [...text.matchAll(/Updated[^.]{0,80}/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim()).slice(0, 8)
  const asOfHits = [...text.matchAll(/as of[^.]{0,60}/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim()).slice(0, 8)
  const deskHits = [...text.matchAll(/(Live · MLS|Market desk|Updated \d)/gi)].map((m) => m[0])
  const hasEmptyState = /no active listings/i.test(text)
  const hasSalesHistory = /sales history/i.test(text)
  const listingCardCount = (html.match(/data-listing-card|listing-card/gi) ?? []).length
  const chromeOnly = h1s.length === 0 && !hasEmptyState && !hasSalesHistory && text.length < 400
  return {
    id,
    status: res.status,
    location: res.headers.get('location'),
    cache: res.headers.get('x-vercel-cache'),
    title,
    h1s,
    hasEmptyState,
    hasSalesHistory,
    listingCardCount,
    bodyChars: text.length,
    bodyPreview: text.slice(0, 320),
    updatedHits,
    asOfHits,
    deskHits,
    chromeOnly,
  }
}

async function main() {
  const rows = []
  for (const c of CASES) {
    rows.push(await probe(c.id, c.url))
  }
  console.log(JSON.stringify({ fetchedAt: new Date().toISOString(), rows }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
