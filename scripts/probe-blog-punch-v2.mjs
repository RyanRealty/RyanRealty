#!/usr/bin/env node
/**
 * Reproduce / accept the FLEET-PUNCH blog slice (8 lines).
 *
 *   node scripts/probe-blog-punch-v2.mjs
 *   BASE_URL=https://ryan-realty.com PREFIX=before_ node scripts/probe-blog-punch-v2.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PREFIX || 'before_'
const PAGES = [
  'bend-oregon-market-report-june-2026',
  'living-in-nw-crossing-bend',
  'schools-central-oregon-guide-families',
  'eagle-crest-affordable-resort-redmond',
  'bend-buyers-market-shift-2026',
  'dining-craft-beer-bend',
]

function textish(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

async function dismissChrome(page) {
  for (const label of ['Not now', 'Essential only', 'Accept all']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(250)
    }
  }
}

async function inspect(page) {
  return page.evaluate(() => {
    const relatedHomes = document.querySelector('#related-homes')
    const explore = document.querySelector('#explore')
    const related = document.querySelector('#related')
    const article = document.querySelector('#article-body')
    const h1 = document.querySelector('h1')
    const body = document.body.innerText
    const ctas = [...document.querySelectorAll('a')].map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
    }))
    const prices = relatedHomes
      ? [...relatedHomes.querySelectorAll('a')].map((a) => ({
          href: a.getAttribute('href'),
          text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140),
        }))
      : []
    return {
      title: h1?.textContent?.trim() || null,
      byline: document.querySelector('#post')?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 240) || null,
      hasRelatedHomes: Boolean(relatedHomes),
      relatedHomesHeading: relatedHomes?.querySelector('h2')?.textContent?.trim() || null,
      relatedHomeRows: prices.slice(0, 8),
      relatedPosts: related
        ? [...related.querySelectorAll('a')].map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8)
        : [],
      exploreText: explore?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 400) || null,
      exploreLinks: explore
        ? [...explore.querySelectorAll('a')].map((a) => ({
            href: a.getAttribute('href'),
            text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
          }))
        : [],
      talk: ctas.filter((c) => /talk to a broker/i.test(c.text)).slice(0, 4),
      seeHomes: ctas.filter((c) => /^see .+ homes$/i.test(c.text)).slice(0, 4),
      valueMyHome: ctas.filter((c) => /value my home/i.test(c.text)).slice(0, 4),
      articleLen: (article?.innerText || '').length,
      mayHits: [...body.matchAll(/\bMay\b/g)].length,
      juneHits: [...body.matchAll(/\bJune\b/g)].length,
      money: [...new Set([...body.matchAll(/\$[\d,]+/g)].map((m) => m[0]))].slice(0, 24),
      mos: [...new Set([...body.matchAll(/(\d+(?:\.\d+)?)\s+months(?:\s+of\s+supply)?/gi)].map((m) => m[0]))].slice(
        0,
        16,
      ),
      verdictHits: {
        buyers: /buyer/i.test(body),
        sellers: /seller/i.test(body),
        balanced: /balanced/i.test(body),
        under500: /under \$500,000|under 500,000|keep costs under/i.test(body),
        from475: /\$475,000/i.test(body),
      },
      scrollHeight: document.documentElement.scrollHeight,
    }
  })
}

async function scrollProbe(page) {
  const before = await page.evaluate(() => ({
    y: window.scrollY,
    h: document.documentElement.scrollHeight,
    midIds: [...document.querySelectorAll('[id]')].map((el) => el.id).slice(0, 30),
  }))
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(400)
  const atBottom = await page.evaluate(() => ({
    y: window.scrollY,
    h: document.documentElement.scrollHeight,
    footer: Boolean(document.querySelector('footer')),
    articleVisible: Boolean(document.querySelector('#article-body')),
    ids: [...document.querySelectorAll('[id]')].map((el) => el.id),
  }))
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  const atTop = await page.evaluate(() => ({
    y: window.scrollY,
    h: document.documentElement.scrollHeight,
    ids: [...document.querySelectorAll('[id]')].map((el) => el.id),
  }))
  return { before, atBottom, atTop, idsChanged: JSON.stringify(before.midIds) !== JSON.stringify(atTop.ids.slice(0, 30)) }
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
    for (const slug of PAGES) {
      const url = `${BASE}/blog/${slug}`
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await page.waitForTimeout(1200)
      await dismissChrome(page)
      await page.waitForTimeout(400)
      const html = await page.content()
      const view = await inspect(page)
      const scroll = slug === 'schools-central-oregon-guide-families' ? await scrollProbe(page) : null
      report.pages[slug] ??= {}
      report.pages[slug][`http${width}`] = res?.status() ?? null
      report.pages[slug][`view${width}`] = view
      report.pages[slug][`hasHomesHtml${width}`] = /id="related-homes"/.test(html)
      report.pages[slug][`textLen${width}`] = textish(html).length
      if (scroll) report.pages[slug][`scroll${width}`] = scroll
      await page.screenshot({ path: `${ART}/${PREFIX}${slug}_${width}_top.png` })
      const homes = page.locator('#related-homes')
      if (await homes.count()) {
        await homes.scrollIntoViewIfNeeded()
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/${PREFIX}${slug}_${width}_homes.png` })
      }
      const explore = page.locator('#explore')
      if (await explore.count()) {
        await explore.scrollIntoViewIfNeeded()
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/${PREFIX}${slug}_${width}_explore.png` })
      } else {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.8))
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/${PREFIX}${slug}_${width}_end.png` })
      }
    }
    await page.close()
  }
  await browser.close()

  writeFileSync(`${ART}/${PREFIX}blog_punch_v2.json`, JSON.stringify(report, null, 2))
  const summary = Object.fromEntries(
    Object.entries(report.pages).map(([slug, row]) => [
      slug,
      {
        http: [row.http390, row.http1280],
        homes: [row.view390?.hasRelatedHomes, row.view1280?.hasRelatedHomes],
        heading: row.view1280?.relatedHomesHeading,
        seeHomes: row.view1280?.seeHomes,
        talk: row.view1280?.talk,
        valueMyHome: row.view1280?.valueMyHome,
        explore: row.view1280?.exploreText,
        title: row.view1280?.title,
        byline: row.view1280?.byline,
        may: row.view1280?.mayHits,
        june: row.view1280?.juneHits,
        money: row.view1280?.money,
        mos: row.view1280?.mos,
        verdict: row.view1280?.verdictHits,
        scrollIdsChanged: row.scroll1280?.idsChanged,
      },
    ]),
  )
  console.log(JSON.stringify({ base: BASE, prefix: PREFIX, summary }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
