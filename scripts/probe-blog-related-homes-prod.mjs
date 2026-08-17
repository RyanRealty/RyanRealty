#!/usr/bin/env node
/**
 * Reproduce the served FLEET-PUNCH blog slice (related homes + leftover gutter/nav).
 *
 *   node scripts/probe-blog-related-homes-prod.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PAGES = [
  { slug: 'eagle-crest-affordable-resort-redmond', kind: 'place' },
  { slug: 'moving-to-redmond-oregon-guide', kind: 'place' },
  { slug: 'preparing-home-for-sale-checklist', kind: 'checklist' },
  { slug: 'oregons-hb-2001-middle-housing-bend', kind: 'policy' },
  { slug: 'arts-culture-central-oregon', kind: 'guide' },
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
    const rect = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { left: Math.round(r.left), x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) }
    }
    const firstText =
      document.querySelector('.v3-article-island .prose p') ||
      document.querySelector('.v3-article-island .prose') ||
      document.querySelector('.v3-article-island')
    const firstChar = firstText
      ? (() => {
          const r = firstText.getBoundingClientRect()
          return { left: Math.round(r.left), text: (firstText.textContent || '').slice(0, 64) }
        })()
      : null
    const h1 = document.querySelector('h1')
    const h1Box = h1
      ? { left: Math.round(h1.getBoundingClientRect().left), text: (h1.textContent || '').trim() }
      : null
    const keepReading = [...document.querySelectorAll('h2, [class*="eyebrow"]')].map((el) =>
      (el.textContent || '').trim(),
    )
    const relatedPostHrefs = [...document.querySelectorAll('a[href^="/blog/"]')]
      .map((a) => a.getAttribute('href'))
      .filter((href, i, arr) => href && arr.indexOf(href) === i)
    const listingHrefs = [...document.querySelectorAll('a[href*="/homes-for-sale/"]')]
      .map((a) => a.getAttribute('href'))
      .filter((href, i, arr) => href && arr.indexOf(href) === i)
    const communityHrefs = [...document.querySelectorAll('a[href^="/communities/"], a[href^="/cities/"]')]
      .map((a) => a.getAttribute('href'))
      .filter((href, i, arr) => href && arr.indexOf(href) === i)
    const body = document.body.innerText
    const driveHits = [...body.matchAll(/(\d+(?:\s*[–-]\s*\d+)?)\s*(?:min(?:ute)?s?)/gi)].map((m) => m[0])
    const priceHits = [...body.matchAll(/\$[\d,]+(?:k|K)?(?:\s*[–-]\s*\$?[\d,]+(?:k|K)?)?/g)].map((m) => m[0])
    const belowHits = [...body.matchAll(/\$?[\d,]+k?\s*[–-]\s*\$?[\d,]+k?\s+below/gi)].map((m) => m[0])
    return {
      url: location.href,
      title: document.title,
      vw: window.innerWidth,
      firstChar,
      h1: h1Box,
      keepReading: keepReading.filter((t) => /keep reading|related posts|related homes|homes for sale/i.test(t)),
      relatedPostHrefs,
      listingHrefs: listingHrefs.slice(0, 20),
      communityHrefs,
      driveHits: driveHits.slice(0, 20),
      priceHits: priceHits.slice(0, 20),
      belowHits,
      hasRelatedHomesHeading: /related homes/i.test(body),
      hasRelatedPostsHeading: /related posts/i.test(body),
      keepReadingCount: (body.match(/keep reading/gi) || []).length,
    }
  })
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const report = { fetchedAt: new Date().toISOString(), pages: {} }

  for (const { slug } of PAGES) {
    const url = `${BASE}/blog/${slug}`
    const res = await fetch(url, { headers: CI_PROBE_HEADERS })
    const html = await res.text()
    const text = textish(html)
    report.pages[slug] = {
      status: res.status,
      cache: res.headers.get('x-vercel-cache'),
      hasArticle: /id="article-body"/.test(html),
      htmlListingHrefs: [...html.matchAll(/href="(\/homes-for-sale\/[^"]+)"/g)].map((m) => m[1]).slice(0, 12),
      htmlRelatedPosts: /Related posts/i.test(html),
      htmlRelatedHomes: /Related homes/i.test(html),
      snippet: text.slice(0, 240),
    }
  }

  const browser = await chromium.launch({ headless: true })
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      extraHTTPHeaders: CI_PROBE_HEADERS,
    })
    const popups = []
    context.on('page', (p) => {
      popups.push({ width, url: p.url(), opener: true })
    })
    const page = await context.newPage()
    for (const { slug } of PAGES) {
      const url = `${BASE}/blog/${slug}`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await page.waitForTimeout(1600)
      const startUrl = page.url()
      const startTitle = await page.title()
      const layout = await inspect(page)
      report.pages[slug][`layout${width}`] = layout
      await page.screenshot({ path: `${ART}/blog2_${slug}_${width}_top.png` })
      const prose = page.locator('.v3-article-island .prose, .v3-article-island').first()
      if (await prose.count()) {
        await prose.scrollIntoViewIfNeeded()
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${ART}/blog2_${slug}_${width}_body.png` })
      }
      if (slug === 'eagle-crest-affordable-resort-redmond') {
        await page.mouse.move(width - 40, 420)
        for (let i = 0; i < 14; i += 1) {
          await page.mouse.wheel(0, 700)
          await page.waitForTimeout(220)
        }
        const afterScroll = page.url()
        const afterTitle = await page.title()
        report.pages[slug][`nav${width}`] = {
          startUrl,
          startTitle,
          afterScroll,
          afterTitle,
          urlChanged: startUrl !== afterScroll,
          titleFlippedToRetirement: /retirement-central-oregon/i.test(afterScroll) || /retirement/i.test(afterTitle),
          popupCount: popups.filter((p) => p.width === width).length,
          popups: popups.filter((p) => p.width === width),
        }
        await page.screenshot({ path: `${ART}/blog2_${slug}_${width}_scrolled.png` })
        const related = page.locator('#related, [id*="related"]').first()
        if (await related.count()) {
          await related.scrollIntoViewIfNeeded()
          await page.waitForTimeout(200)
          await page.screenshot({ path: `${ART}/blog2_${slug}_${width}_related.png` })
        }
      }
      if (slug === 'moving-to-redmond-oregon-guide') {
        const related = page.locator('#related, [id*="related"]').first()
        if (await related.count()) {
          await related.scrollIntoViewIfNeeded()
          await page.waitForTimeout(200)
          await page.screenshot({ path: `${ART}/blog2_${slug}_${width}_related.png` })
        }
      }
    }
    await context.close()
  }
  await browser.close()

  const gutter = (slug) => {
    const a390 = report.pages[slug].layout390
    const a1280 = report.pages[slug].layout1280
    if (!a390?.firstChar || !a390.h1 || !a1280?.firstChar || !a1280.h1) return false
    return a390.firstChar.left >= a390.h1.left - 2 && a1280.firstChar.left >= a1280.h1.left - 2
  }
  const homes = (slug) => (report.pages[slug].layout1280?.listingHrefs || []).length > 0
  const nav = report.pages['eagle-crest-affordable-resort-redmond']
  report.accept = {
    eagleGutterOk: gutter('eagle-crest-affordable-resort-redmond'),
    artsGutterOk: gutter('arts-culture-central-oregon'),
    eagleUrlUnchanged:
      nav.nav390?.urlChanged === false &&
      nav.nav1280?.urlChanged === false &&
      nav.nav390?.titleFlippedToRetirement === false &&
      nav.nav1280?.titleFlippedToRetirement === false,
    eagleNoPopup: (nav.nav390?.popupCount ?? 1) === 0 && (nav.nav1280?.popupCount ?? 1) === 0,
    movingHasHomes: homes('moving-to-redmond-oregon-guide'),
    preparingHasHomes: homes('preparing-home-for-sale-checklist'),
    hbHasHomes: homes('oregons-hb-2001-middle-housing-bend'),
    eagleHasHomes: homes('eagle-crest-affordable-resort-redmond'),
    movingDriveHits: report.pages['moving-to-redmond-oregon-guide'].layout1280?.driveHits || [],
    movingPriceHits: report.pages['moving-to-redmond-oregon-guide'].layout1280?.priceHits || [],
    movingBelowHits: report.pages['moving-to-redmond-oregon-guide'].layout1280?.belowHits || [],
  }
  writeFileSync(`${ART}/blog_related_homes_probe.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.accept, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
