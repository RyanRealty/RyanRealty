#!/usr/bin/env node
/**
 * Reproduce the served FLEET-PUNCH blog slice (v7) at 390+1280.
 *
 *   node scripts/probe-blog-punch-v7.mjs
 *   BASE_URL=https://ryan-realty.com PREFIX=before_ node scripts/probe-blog-punch-v7.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PREFIX || 'before_'
const PAGES = [
  { slug: 'retirement-central-oregon', extra: 'cta-numbers' },
  { slug: 'broken-top-bend-golf-community', extra: 'homes-hoa' },
  { slug: 'moving-to-bend-relocation-guide', extra: 'nav' },
  { slug: 'price-per-sqft-trends-central-oregon', extra: 'sunriver' },
  { slug: 'bend-oregon-market-report-june-2026', extra: 'active' },
  { slug: 'best-neighborhoods-bend-families', extra: 'homes' },
]

function textish(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

async function inspect(page) {
  return page.evaluate(() => {
    const relatedHomes = document.querySelector('#related-homes')
    const prices = relatedHomes
      ? [...relatedHomes.querySelectorAll('a')].map((a) => ({
          href: a.getAttribute('href'),
          text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140),
        }))
      : []
    const ctas = [...document.querySelectorAll('a')].map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
    }))
    const talk = ctas.filter((c) => /talk to a broker/i.test(c.text))
    const seeHomes = ctas.filter((c) => /^see .+ homes$/i.test(c.text))
    const body = document.body.innerText
    const money = [...body.matchAll(/\$[\d,]+(?:\s*[–-]\s*\$?[\d,]+)?/g)].map((m) => m[0])
    const snippets = {}
    const needles = [
      /40k|\$40|60k|sales tax|2,000|4,000|2,800|6,000/i,
      /HOA|golf|\$300|\$500|\$800|\$1,000|\$1,300/i,
      /Sunriver[^\n]{0,80}/gi,
      /503|531|502|active listings/i,
      /7–10%|7-10%|saves \$/i,
    ]
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
    snippets.tax = lines.filter((l) => /40|60|sales tax|2,000|4,000|annually/i.test(l)).slice(0, 8)
    snippets.hoa = lines.filter((l) => /hoa|golf|\$300|\$500|\$800|1,000|1,300/i.test(l)).slice(0, 10)
    snippets.sunriver = lines.filter((l) => /sunriver/i.test(l)).slice(0, 12)
    snippets.active = lines.filter((l) => /503|531|502|active listing/i.test(l)).slice(0, 12)
    return {
      url: location.href,
      title: document.querySelector('h1')?.textContent?.trim() || null,
      hasRelatedHomes: Boolean(relatedHomes),
      relatedHomesHeading: relatedHomes?.querySelector('h2')?.textContent?.trim() || null,
      relatedHomeRows: prices.slice(0, 8),
      talk: talk.slice(0, 6),
      seeHomes: seeHomes.slice(0, 6),
      money: [...new Set(money)].slice(0, 30),
      snippets,
      needlesHit: needles.map((n) => n.toString()),
    }
  })
}

async function scrollWatch(page) {
  const events = []
  const start = page.url()
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      events.push({ kind: 'nav', url: frame.url(), t: Date.now() })
    }
  })
  const pagesOpened = []
  const context = page.context()
  context.on('page', (p) => {
    pagesOpened.push(p.url())
  })
  const height = await page.evaluate(() => document.body.scrollHeight)
  const steps = 12
  for (let i = 1; i <= steps; i++) {
    await page.evaluate(
      ({ i, steps, height }) => window.scrollTo(0, Math.round((height * i) / steps)),
      { i, steps, height },
    )
    await page.waitForTimeout(350)
  }
  await page.waitForTimeout(800)
  return {
    start,
    end: page.url(),
    navigated: page.url() !== start,
    navEvents: events,
    extraPages: pagesOpened,
  }
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const report = { fetchedAt: new Date().toISOString(), base: BASE, pages: {} }

  const browser = await chromium.launch({ headless: true })
  for (const width of [390, 1280]) {
    const height = width === 390 ? 844 : 900
    const context = await browser.newContext({
      viewport: { width, height },
      extraHTTPHeaders: CI_PROBE_HEADERS,
    })
    const page = await context.newPage()
    for (const spec of PAGES) {
      const url = `${BASE}/blog/${spec.slug}`
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await page.waitForTimeout(1800)
      const html = await page.content()
      const view = await inspect(page)
      const key = spec.slug
      report.pages[key] ??= { extra: spec.extra }
      report.pages[key][`http${width}`] = res?.status() ?? null
      report.pages[key][`view${width}`] = view
      report.pages[key][`hasHomesHtml${width}`] = /id="related-homes"/.test(html)
      report.pages[key][`textLen${width}`] = textish(html).length
      await page.screenshot({ path: `${ART}/${PREFIX}${spec.slug}_${width}_top.png` })

      if (spec.extra === 'nav') {
        const watch = await scrollWatch(page)
        report.pages[key][`nav${width}`] = watch
        await page.screenshot({ path: `${ART}/${PREFIX}${spec.slug}_${width}_scrolled.png` })
        if (page.url() !== url) {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
          await page.waitForTimeout(800)
        }
      } else {
        const homes = page.locator('#related-homes')
        if (await homes.count()) {
          await homes.scrollIntoViewIfNeeded()
          await page.waitForTimeout(250)
          await page.screenshot({ path: `${ART}/${PREFIX}${spec.slug}_${width}_homes.png` })
        } else {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.78))
          await page.waitForTimeout(250)
          await page.screenshot({ path: `${ART}/${PREFIX}${spec.slug}_${width}_end.png` })
        }
      }
    }
    await context.close()
  }
  await browser.close()

  writeFileSync(`${ART}/${PREFIX}blog_punch_v7.json`, JSON.stringify(report, null, 2))
  const summary = {}
  for (const spec of PAGES) {
    const row = report.pages[spec.slug]
    summary[spec.slug] = {
      http: [row.http390, row.http1280],
      homes: [row.view390?.hasRelatedHomes, row.view1280?.hasRelatedHomes],
      talk: [(row.view390?.talk || []).length, (row.view1280?.talk || []).length],
      seeHomes: [(row.view390?.seeHomes || []).map((c) => c.text), (row.view1280?.seeHomes || []).map((c) => c.text)],
      nav: [row.nav390, row.nav1280],
      tax: row.view1280?.snippets?.tax,
      hoa: row.view1280?.snippets?.hoa,
      sunriver: row.view1280?.snippets?.sunriver,
      active: row.view1280?.snippets?.active,
    }
  }
  console.log(JSON.stringify({ base: BASE, prefix: PREFIX, summary }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
