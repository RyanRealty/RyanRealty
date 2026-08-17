#!/usr/bin/env node
/**
 * Reproduce / accept the FLEET-PUNCH blog slice (8 lines).
 *
 *   node scripts/probe-blog-punch-v8.mjs
 *   BASE_URL=https://ryan-realty.com PREFIX=before_ node scripts/probe-blog-punch-v8.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PREFIX || 'before_'

const PAGES = [
  { path: '/blog/central-oregon-market-report-july-2026', key: 'co_july' },
  { path: '/blog/bend-oregon-market-report-july-2026', key: 'bend_july' },
  { path: '/blog?page=2', key: 'index_p2' },
  { path: '/blog', key: 'index_p1' },
  { path: '/blog/understanding-months-of-supply', key: 'mos_guide' },
  { path: '/blog/preparing-home-for-sale-checklist', key: 'checklist' },
  { path: '/blog/moving-to-redmond-oregon-guide', key: 'redmond' },
  { path: '/blog/what-happens-between-offer-accepted-and-closing', key: 'closing' },
  { path: '/blog/how-to-sell-your-home-bend', key: 'sell_bend' },
]

async function inspect(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('h1')
    const article = document.querySelector('#article-body, article, .prose, main')
    const body = document.body.innerText
    const articleText = article?.innerText || ''
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')].map((el) =>
      (el.textContent || '').replace(/\s+/g, ' ').trim(),
    )
    const ctas = [...document.querySelectorAll('a')].map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
    }))
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((el) => {
      try {
        return JSON.parse(el.textContent || '{}')
      } catch {
        return { parseError: true, raw: (el.textContent || '').slice(0, 200) }
      }
    })
    const itemLists = jsonLd.flatMap((block) => {
      const nodes = Array.isArray(block) ? block : [block]
      return nodes.filter((n) => n && (n['@type'] === 'ItemList' || n.itemListElement))
    })
    const itemNames = itemLists.flatMap((list) =>
      (list.itemListElement || []).map((item) => {
        const node = item.item || item
        return {
          position: item.position ?? null,
          name: node.name || item.name || null,
          url: node.url || item.url || node['@id'] || null,
        }
      }),
    )
    const mosLines = [...body.matchAll(/[^\n.]{0,80}months of supply[^\n.]{0,120}/gi)].map((m) =>
      m[0].replace(/\s+/g, ' ').trim(),
    )
    const mosNumbers = [...body.matchAll(/(\d+(?:\.\d+)?)\s+months(?: of supply)?/gi)].map((m) =>
      m[0].replace(/\s+/g, ' '),
    )
    const verdicts = [...body.matchAll(/\b(seller'?s market|buyer'?s market|balanced market|middl\w+)/gi)].map(
      (m) => m[0],
    )
    const activeHits = [...body.matchAll(/[^\n.]{0,40}active listings[^\n.]{0,80}/gi)].map((m) =>
      m[0].replace(/\s+/g, ' ').trim(),
    )
    const counts = [...body.matchAll(/\b(\d{2,4})\b/g)].map((m) => m[1])
    const excerptCards = [...document.querySelectorAll('a[href*="/blog/"]')].map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 280),
    }))
    const dayHeadings = headings.filter((h) => /\bday\s+\d+/i.test(h))
    const relatedHomes = document.querySelector('#related-homes')
    const explore = document.querySelector('#explore')
    const related = document.querySelector('#related')
    const articleBox = article?.getBoundingClientRect()
    const articleStyle = article ? getComputedStyle(article) : null
    const overflow = {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyLeft: articleBox ? Math.round(articleBox.left) : null,
      bodyPadL: articleStyle ? articleStyle.paddingLeft : null,
      bodyML: articleStyle ? articleStyle.marginLeft : null,
    }
    const overflowing = [...document.querySelectorAll('p, li, h1, h2, h3')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.left < 4 && r.width > 40
    }).slice(0, 8).map((el) => ({
      tag: el.tagName,
      left: Math.round(el.getBoundingClientRect().left),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    }))
    return {
      title: h1?.textContent?.trim() || null,
      headings: headings.slice(0, 40),
      dayHeadings,
      mosLines: [...new Set(mosLines)].slice(0, 16),
      mosNumbers: [...new Set(mosNumbers)].slice(0, 16),
      verdicts: [...new Set(verdicts)],
      activeHits: [...new Set(activeHits)].slice(0, 12),
      counts: [...new Set(counts)].slice(0, 40),
      itemNames,
      itemCount: itemNames.length,
      postsLabel: (body.match(/(\d+)\s+posts?/i) || [])[1] || null,
      mosExcerptCards: excerptCards.filter((c) => /months-of-supply|months of supply/i.test(`${c.href} ${c.text}`)),
      relatedPosts: related
        ? [...related.querySelectorAll('a')].map((a) => ({
            href: a.getAttribute('href'),
            text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140),
          }))
        : [],
      hasRelatedHomes: Boolean(relatedHomes),
      relatedHomesHeading: relatedHomes?.querySelector('h2')?.textContent?.trim() || null,
      exploreText: (explore?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400),
      talk: ctas.filter((c) => /talk to a broker/i.test(c.text)).slice(0, 4),
      seeHomes: ctas.filter((c) => /^see .+ homes$/i.test(c.text)).slice(0, 4),
      valueMyHome: ctas.filter((c) => /value my home/i.test(c.text)).slice(0, 6),
      allPosts: ctas.filter((c) => /all posts|more in /i.test(c.text)).slice(0, 8),
      overflow,
      overflowing,
      articleSnippet: articleText.replace(/\s+/g, ' ').trim().slice(0, 1400),
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
      const url = `${BASE}${spec.path}`
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await page.waitForTimeout(1200)
      const dismiss = page.getByRole('button', { name: /not now|essential only|accept all/i }).first()
      if (await dismiss.count()) {
        await dismiss.click().catch(() => {})
        await page.waitForTimeout(400)
      }
      const view = await inspect(page)
      report.pages[spec.key] ??= { path: spec.path }
      report.pages[spec.key][`http${width}`] = res?.status() ?? null
      report.pages[spec.key][`view${width}`] = view
      await page.screenshot({ path: `${ART}/${PREFIX}${spec.key}_${width}_top.png` })
      if (spec.key === 'co_july' || spec.key === 'bend_july' || spec.key === 'mos_guide') {
        await page.evaluate(() => window.scrollTo(0, Math.min(1800, document.body.scrollHeight * 0.35)))
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/${PREFIX}${spec.key}_${width}_body.png` })
      }
      if (spec.key === 'checklist') {
        await page.evaluate(() => window.scrollTo(0, Math.min(2200, document.body.scrollHeight * 0.4)))
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/${PREFIX}${spec.key}_${width}_days.png` })
      }
      if (spec.key === 'closing' || spec.key === 'redmond' || spec.key === 'sell_bend') {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(250)
        await page.screenshot({ path: `${ART}/${PREFIX}${spec.key}_${width}_end.png` })
      }
      if (spec.key === 'sell_bend') {
        await page.evaluate(() => window.scrollTo(0, 900))
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/${PREFIX}${spec.key}_${width}_gutter.png` })
      }
    }
    await page.close()
  }
  await browser.close()

  writeFileSync(`${ART}/${PREFIX}blog_punch_v8.json`, JSON.stringify(report, null, 2))
  const summary = {}
  for (const spec of PAGES) {
    const row = report.pages[spec.key]
    const v = row.view1280 || {}
    summary[spec.key] = {
      http: [row.http390, row.http1280],
      title: v.title,
      mosLines: v.mosLines,
      mosNumbers: v.mosNumbers,
      verdicts: v.verdicts,
      activeHits: v.activeHits,
      itemCount: v.itemCount,
      itemNames: (v.itemNames || []).map((i) => i.name),
      postsLabel: v.postsLabel,
      dayHeadings: v.dayHeadings,
      mosExcerptCards: v.mosExcerptCards,
      talk: v.talk,
      seeHomes: v.seeHomes,
      valueMyHome: v.valueMyHome,
      allPosts: v.allPosts,
      overflow390: row.view390?.overflow,
      overflowing390: row.view390?.overflowing,
      overflow1280: v.overflow,
      overflowing1280: v.overflowing,
    }
  }
  console.log(JSON.stringify({ base: BASE, prefix: PREFIX, summary }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
