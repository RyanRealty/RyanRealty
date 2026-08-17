#!/usr/bin/env node
/**
 * Reproduce / accept the FLEET-PUNCH blog related-homes slice.
 *
 *   node scripts/probe-blog-related-homes.mjs
 *   BASE_URL=https://ryan-realty.com PREFIX=before_ node scripts/probe-blog-related-homes.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PREFIX || 'before_'
const PAGES = [
  { slug: 'arts-culture-central-oregon', expectHomes: false, expectTalk: true },
  { slug: 'brasada-ranch-central-oregon', expectHomes: true, expectTalk: false },
  { slug: 'best-neighborhoods-bend-retirees', expectHomes: true, expectTalk: false },
  { slug: 'retirement-central-oregon', expectHomes: false, expectTalk: true },
  { slug: 'caldera-springs-buyers-guide', expectHomes: true, expectTalk: false },
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
          text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        }))
      : []
    const ctas = [...document.querySelectorAll('a')].map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
    }))
    const talk = ctas.filter((c) => /talk to a broker/i.test(c.text))
    const seeHomes = ctas.filter((c) => /^see .+ homes$/i.test(c.text))
    const keepReading = [...document.querySelectorAll('[id]')].filter((el) =>
      /keep reading/i.test(el.textContent || ''),
    ).length
    const body = document.body.innerText
    const money = [...body.matchAll(/\$[\d,]+/g)].map((m) => m[0])
    const mos = [...body.matchAll(/(\d+(?:\.\d+)?)\s+months/gi)].map((m) => m[0])
    return {
      title: document.querySelector('h1')?.textContent?.trim() || null,
      hasRelatedHomes: Boolean(relatedHomes),
      relatedHomesHeading: relatedHomes?.querySelector('h2')?.textContent?.trim() || null,
      relatedHomeRows: prices.slice(0, 8),
      talk: talk.slice(0, 4),
      seeHomes: seeHomes.slice(0, 4),
      keepReadingBlocks: keepReading,
      money: [...new Set(money)].slice(0, 20),
      mos: [...new Set(mos)].slice(0, 12),
    }
  })
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
      await page.waitForTimeout(1600)
      const html = await page.content()
      const view = await inspect(page)
      const key = spec.slug
      report.pages[key] ??= { expectHomes: spec.expectHomes, expectTalk: spec.expectTalk }
      report.pages[key][`http${width}`] = res?.status() ?? null
      report.pages[key][`view${width}`] = view
      report.pages[key][`hasHomesHtml${width}`] = /id="related-homes"/.test(html)
      report.pages[key][`textLen${width}`] = textish(html).length
      await page.screenshot({ path: `${ART}/${PREFIX}${spec.slug}_${width}_top.png` })
      const homes = page.locator('#related-homes')
      if (await homes.count()) {
        await homes.scrollIntoViewIfNeeded()
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/${PREFIX}${spec.slug}_${width}_homes.png` })
      } else {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.72))
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/${PREFIX}${spec.slug}_${width}_end.png` })
      }
    }
    await page.close()
  }
  await browser.close()

  const accept = {}
  for (const spec of PAGES) {
    const row = report.pages[spec.slug]
    const homes390 = Boolean(row.view390?.hasRelatedHomes)
    const homes1280 = Boolean(row.view1280?.hasRelatedHomes)
    const talk390 = (row.view390?.talk || []).length > 0
    const talk1280 = (row.view1280?.talk || []).length > 0
    accept[spec.slug] = {
      homes: homes390 && homes1280,
      talk: talk390 && talk1280,
      expectHomes: spec.expectHomes,
      expectTalk: spec.expectTalk,
    }
  }
  report.accept = accept
  writeFileSync(`${ART}/${PREFIX}blog_related_homes_probe.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ base: BASE, prefix: PREFIX, accept }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
