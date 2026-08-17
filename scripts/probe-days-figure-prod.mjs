#!/usr/bin/env node
/**
 * Production accept for the place-page days-figure class.
 * FAQ tenths and the market card / about-facts must print the same string.
 *
 * Founding: /communities/black-butte-ranch card 40 vs FAQ 39.5
 *   node scripts/probe-days-figure-prod.mjs
 */
const PAGES = [
  {
    name: 'black-butte-ranch',
    url: 'https://ryan-realty.com/communities/black-butte-ranch',
    stalePair: ['40 days', '39.5 days'],
  },
  {
    name: 'northwest-crossing',
    url: 'https://ryan-realty.com/communities/northwest-crossing',
    stalePair: ['11 days', '10.5 days'],
  },
  {
    name: 'broken-top',
    url: 'https://ryan-realty.com/communities/broken-top',
    stalePair: ['9 days', '8.5 days'],
  },
  {
    name: 'brasada-ranch',
    url: 'https://ryan-realty.com/communities/brasada-ranch',
    stalePair: ['16 days', '15.5 days'],
  },
  {
    name: 'redmond',
    url: 'https://ryan-realty.com/cities/redmond',
    stalePair: ['20 days', '19.5 days'],
  },
  {
    name: 'larkspur',
    url: 'https://ryan-realty.com/cities/bend/larkspur',
    stalePair: ['7 days', '6.5 days'],
  },
]

function textish(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

function extract(html) {
  const text = textish(html)
  const faq = text.match(/took a median of ([\d.]+) days to go pending/)
  const card = html.match(/mkt-kpi-val">([\d.]+ days)</)
  const about = html.match(/about-fact-val[^>]*>\s*([\d.]+ days)/)
  const hero = text.match(/Pending in ([\d.]+ days)/)
  return {
    faq: faq ? `${faq[1]} days` : null,
    card: card ? card[1] : null,
    about: about ? about[1] : null,
    hero: hero ? hero[1] : null,
  }
}

const results = []
for (const page of PAGES) {
  const res = await fetch(page.url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; loop-sentinel/1.0)' },
  })
  if (!res.ok) throw new Error(`${page.url} HTTP ${res.status}`)
  const html = await res.text()
  const figures = extract(html)
  const printed = [figures.faq, figures.card, figures.about, figures.hero].filter(Boolean)
  const unique = [...new Set(printed)]
  const stale = page.stalePair.every((s) => printed.includes(s))
  results.push({ ...page, figures, unique, stale, ok: unique.length <= 1 && !stale && printed.length > 0 })
}

for (const r of results) {
  console.log(
    `${r.ok ? 'ok' : 'FAIL'}  ${r.name} unique=${JSON.stringify(r.unique)} faq=${r.figures.faq} card=${r.figures.card} about=${r.figures.about} hero=${r.figures.hero}`,
  )
}
const failed = results.filter((r) => !r.ok)
if (failed.length) {
  console.error(`\ndays-figure prod: ${failed.length} page(s) still disagree`)
  process.exit(1)
}
console.log(`\ndays-figure prod: ${results.length}/${results.length}`)
