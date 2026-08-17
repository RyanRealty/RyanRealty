#!/usr/bin/env node
/**
 * Reproduce / accept the FLEET-PUNCH blog slice (8 lines).
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
  { slug: 'bend-oregon-market-report-june-2026', key: 'june' },
  { slug: 'living-in-nw-crossing-bend', key: 'nwx' },
  { slug: 'schools-central-oregon-guide-families', key: 'schools' },
  { slug: 'eagle-crest-affordable-resort-redmond', key: 'eagle' },
  { slug: 'bend-buyers-market-shift-2026', key: 'buyers' },
  { slug: 'dining-craft-beer-bend', key: 'dining' },
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
    const explore = document.querySelector('#explore')
    const related = document.querySelector('#related')
    const h1 = document.querySelector('h1')
    const body = document.body.innerText
    const article = document.querySelector('#article-body')
    const articleText = article?.innerText || ''
    const ctas = [...document.querySelectorAll('a')].map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
    }))
    const headings = [...document.querySelectorAll('h1,h2,h3')].map((el) =>
      (el.textContent || '').replace(/\s+/g, ' ').trim(),
    )
    const mayHits = [...body.matchAll(/\bMay\b/g)].length
    const juneHits = [...body.matchAll(/\bJune\b/g)].length
    const money = [...body.matchAll(/\$[\d,]+/g)].map((m) => m[0])
    const mos = [...body.matchAll(/(\d+(?:\.\d+)?)\s+months(?: of supply)?/gi)].map((m) =>
      m[0].replace(/\s+/g, ' '),
    )
    const buyersHits = [...body.matchAll(/buyer/gi)].map((m) => m[0])
    const sellerHits = [...body.matchAll(/seller/gi)].map((m) => m[0])
    const under500 = /under \$500,000|keep costs under \$500/i.test(body)
    const from475 = /\$475,000/.test(body)
    const valueMyHome = ctas.filter((c) => /value my home/i.test(c.text))
    const talk = ctas.filter((c) => /talk to a broker/i.test(c.text))
    const seeHomes = ctas.filter((c) => /^see .+ homes$/i.test(c.text))
    const exploreItems = explore
      ? [...explore.querySelectorAll('a, p, li')].map((el) =>
          (el.textContent || '').replace(/\s+/g, ' ').trim(),
        )
      : []
    const relatedPosts = related
      ? [...related.querySelectorAll('a')].map((a) => ({
          href: a.getAttribute('href'),
          text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140),
        }))
      : []
    const relatedHomeRows = relatedHomes
      ? [...relatedHomes.querySelectorAll('a')].map((a) => ({
          href: a.getAttribute('href'),
          text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140),
        }))
      : []
    return {
      title: h1?.textContent?.trim() || null,
      headings: headings.slice(0, 16),
      hasRelatedHomes: Boolean(relatedHomes),
      relatedHomesHeading: relatedHomes?.querySelector('h2')?.textContent?.trim() || null,
      relatedHomeRows: relatedHomeRows.slice(0, 8),
      relatedPosts: relatedPosts.slice(0, 8),
      exploreBlank: explore ? (explore.innerText || '').trim().length < 40 : true,
      exploreText: (explore?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400),
      exploreItems: exploreItems.filter(Boolean).slice(0, 16),
      talk: talk.slice(0, 4),
      seeHomes: seeHomes.slice(0, 4),
      valueMyHome: valueMyHome.slice(0, 4),
      mayHits,
      juneHits,
      money: [...new Set(money)].slice(0, 24),
      mos: [...new Set(mos)].slice(0, 16),
      buyersHits: buyersHits.length,
      sellerHits: sellerHits.length,
      under500,
      from475,
      articleSnippet: articleText.replace(/\s+/g, ' ').trim().slice(0, 900),
      bodySnippet: body.replace(/\s+/g, ' ').trim().slice(0, 500),
      scrollH: document.documentElement.scrollHeight,
      clientH: document.documentElement.clientHeight,
    }
  })
}

async function scrollProbe(page) {
  const before = await page.evaluate(() => ({
    y: window.scrollY,
    h: document.documentElement.scrollHeight,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((el) =>
      (el.textContent || '').replace(/\s+/g, ' ').trim(),
    ),
  }))
  await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 1.2)))
  await page.waitForTimeout(400)
  const mid = await page.evaluate(() => ({
    y: window.scrollY,
    h: document.documentElement.scrollHeight,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((el) =>
      (el.textContent || '').replace(/\s+/g, ' ').trim(),
    ),
    atFooter: Boolean(document.querySelector('footer') && window.scrollY + window.innerHeight > document.documentElement.scrollHeight - 80),
  }))
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(400)
  const bottom = await page.evaluate(() => ({
    y: window.scrollY,
    h: document.documentElement.scrollHeight,
    atFooter: Boolean(
      document.querySelector('footer') &&
        window.scrollY + window.innerHeight > document.documentElement.scrollHeight - 120,
    ),
  }))
  await page.evaluate(() => window.scrollBy(0, -Math.round(window.innerHeight * 1.4)))
  await page.waitForTimeout(400)
  const up = await page.evaluate(() => ({
    y: window.scrollY,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((el) =>
      (el.textContent || '').replace(/\s+/g, ' ').trim(),
    ),
  }))
  return {
    before,
    mid,
    bottom,
    up,
    headingsUnchanged:
      JSON.stringify(before.headings) === JSON.stringify(mid.headings) &&
      JSON.stringify(before.headings) === JSON.stringify(up.headings),
    skippedToFooterOnFirstScroll: mid.atFooter && before.h > before.y + 2000,
  }
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const report = { fetchedAt: new Date().toISOString(), base: BASE, pages: {} }

  const browser = await chromium.launch({ headless: true })
  for (const width of [390, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 900 },
      extraHTTPHeaders: CI_PROBE_HEADERS,
    })
    for (const spec of PAGES) {
      const url = `${BASE}/blog/${spec.slug}`
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await page.waitForTimeout(1800)
      const html = await page.content()
      const view = await inspect(page)
      let scroll = null
      if (spec.key === 'schools') {
        scroll = await scrollProbe(page)
      }
      report.pages[spec.key] ??= { slug: spec.slug }
      report.pages[spec.key][`http${width}`] = res?.status() ?? null
      report.pages[spec.key][`view${width}`] = view
      report.pages[spec.key][`hasHomesHtml${width}`] = /id="related-homes"/.test(html)
      report.pages[spec.key][`textLen${width}`] = textish(html).length
      if (scroll) report.pages[spec.key][`scroll${width}`] = scroll
      await page.screenshot({ path: `${ART}/${PREFIX}${spec.key}_${width}_top.png` })
      const homes = page.locator('#related-homes')
      if (await homes.count()) {
        await homes.scrollIntoViewIfNeeded()
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/${PREFIX}${spec.key}_${width}_homes.png` })
      }
      const explore = page.locator('#explore')
      if (await explore.count()) {
        await explore.scrollIntoViewIfNeeded()
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/${PREFIX}${spec.key}_${width}_explore.png` })
      }
      if (spec.key === 'june' || spec.key === 'nwx' || spec.key === 'buyers') {
        await page.evaluate(() => window.scrollTo(0, Math.min(1400, document.body.scrollHeight * 0.35)))
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/${PREFIX}${spec.key}_${width}_body.png` })
      }
    }
    await page.close()
  }
  await browser.close()

  writeFileSync(`${ART}/${PREFIX}blog_punch_v7.json`, JSON.stringify(report, null, 2))
  const summary = {}
  for (const spec of PAGES) {
    const row = report.pages[spec.key]
    summary[spec.key] = {
      http: [row.http390, row.http1280],
      title: row.view1280?.title,
      homes: [row.view390?.hasRelatedHomes, row.view1280?.hasRelatedHomes],
      homesHeading: row.view1280?.relatedHomesHeading,
      seeHomes: row.view1280?.seeHomes,
      talk: row.view1280?.talk,
      valueMyHome: row.view1280?.valueMyHome,
      mayHits: row.view1280?.mayHits,
      juneHits: row.view1280?.juneHits,
      money: row.view1280?.money,
      mos: row.view1280?.mos,
      under500: row.view1280?.under500,
      from475: row.view1280?.from475,
      exploreBlank: row.view1280?.exploreBlank,
      exploreText: row.view1280?.exploreText,
      relatedPosts: row.view1280?.relatedPosts,
      scroll390: row.scroll390
        ? {
            headingsUnchanged: row.scroll390.headingsUnchanged,
            skippedToFooterOnFirstScroll: row.scroll390.skippedToFooterOnFirstScroll,
            midY: row.scroll390.mid.y,
            bottomY: row.scroll390.bottom.y,
          }
        : null,
    }
  }
  console.log(JSON.stringify({ base: BASE, prefix: PREFIX, summary }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
