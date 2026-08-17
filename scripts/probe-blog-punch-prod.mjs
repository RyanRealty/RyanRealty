#!/usr/bin/env node
/**
 * Reproduce the served FLEET-PUNCH blog slice on production.
 *
 *   node scripts/probe-blog-punch-prod.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const SLUGS = [
  'moving-to-redmond-oregon-guide',
  'preparing-home-for-sale-checklist',
  'oregons-hb-2001-middle-housing-bend',
  'retirement-central-oregon',
  'understanding-months-of-supply',
]

function textish(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

async function boxes(page) {
  return page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        left: Math.round(r.left),
      }
    }
    const firstText = document.querySelector('#article-body .prose p, #article-body p, #article-body')
    const firstChar = firstText
      ? (() => {
          const r = firstText.getBoundingClientRect()
          return { x: Math.round(r.x), left: Math.round(r.left), text: (firstText.textContent || '').slice(0, 48) }
        })()
      : null
    const share = [...document.querySelectorAll('button, a')].find((el) =>
      /share/i.test(el.textContent || el.getAttribute('aria-label') || ''),
    )
    const shareBox = share
      ? (() => {
          const r = share.getBoundingClientRect()
          return { x: Math.round(r.x), left: Math.round(r.left), w: Math.round(r.width), clipped: r.left < 0 || r.right > window.innerWidth }
        })()
      : null
    const h1 = document.querySelector('h1')
    const h1Box = h1
      ? (() => {
          const r = h1.getBoundingClientRect()
          return { x: Math.round(r.x), left: Math.round(r.left) }
        })()
      : null
    const footer = document.querySelector('footer')
    const footerBox = footer
      ? (() => {
          const r = footer.getBoundingClientRect()
          return { x: Math.round(r.x), left: Math.round(r.left) }
        })()
      : null
    const related = [...document.querySelectorAll('a[href^="/blog/"]')].map((a) => {
      const r = a.getBoundingClientRect()
      return {
        href: a.getAttribute('href'),
        x: Math.round(r.x),
        w: Math.round(r.width),
        right: Math.round(r.right),
      }
    })
    return {
      vw: window.innerWidth,
      article: rect('#article-body'),
      prose: rect('#article-body .prose') || rect('#article-body'),
      firstChar,
      share: shareBox,
      h1: h1Box,
      footer: footerBox,
      related,
    }
  })
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const report = { fetchedAt: new Date().toISOString(), pages: {} }

  for (const slug of SLUGS) {
    const url = `${BASE}/blog/${slug}`
    const res = await fetch(url, { headers: CI_PROBE_HEADERS })
    const html = await res.text()
    const text = textish(html)
    const mosHits = [...text.matchAll(/(\d+(?:\.\d+)?)\s+months(?:\s+of\s+supply)?/gi)].map((m) => m[0])
    report.pages[slug] = {
      status: res.status,
      cache: res.headers.get('x-vercel-cache'),
      hasArticle: /id="article-body"/.test(html),
      mosHits: mosHits.slice(0, 20),
      has65: /6\.5/.test(text),
      has60: /\b6\.0\b/.test(text),
      snippet: text.slice(text.search(/months of supply/i), text.search(/months of supply/i) + 400),
    }
  }

  const browser = await chromium.launch({ headless: true })
  for (const width of [390, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 900 },
      extraHTTPHeaders: CI_PROBE_HEADERS,
    })
    for (const slug of SLUGS) {
      const url = `${BASE}/blog/${slug}`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await page.waitForTimeout(1800)
      const layout = await boxes(page)
      report.pages[slug][`layout${width}`] = layout
      await page.screenshot({ path: `${ART}/blog_${slug}_${width}_top.png` })
      if (slug === 'retirement-central-oregon') {
        const start = page.url()
        await page.mouse.move(width - 40, 420)
        for (let i = 0; i < 12; i += 1) {
          await page.mouse.wheel(0, 700)
          await page.waitForTimeout(250)
        }
        const afterScroll = page.url()
        report.pages[slug][`nav${width}`] = { start, afterScroll, changed: start !== afterScroll }
        await page.screenshot({ path: `${ART}/blog_${slug}_${width}_scrolled.png` })
      }
      if (slug === 'understanding-months-of-supply') {
        const body = await page.evaluate(() => document.body.innerText)
        report.pages[slug][`visible${width}`] = {
          has65: /6\.5/.test(body),
          has60: /\b6\.0\b/.test(body),
          overall: (body.match(/Central Oregon[^\n.]{0,80}(\d+(?:\.\d+)?)\s+months/i) || [])[0] || null,
          june: (body.match(/June[^\n.]{0,120}(\d+(?:\.\d+)?)/i) || [])[0] || null,
        }
        await page.screenshot({ path: `${ART}/blog_${slug}_${width}_mos.png`, fullPage: true })
      }
    }
    await page.close()
  }
  await browser.close()
  const layoutOk = SLUGS.every((slug) => {
    const page = report.pages[slug]
    const a390 = page.layout390
    const a1280 = page.layout1280
    if (!a390?.firstChar || !a390.h1 || !a1280?.firstChar || !a1280.h1) return false
    const gutter390 = a390.firstChar.left >= a390.h1.left - 2
    const gutter1280 = a1280.firstChar.left >= a1280.h1.left - 2
    const share390 = a390.share && a390.share.left >= 16 && !a390.share.clipped
    const share1280 = a1280.share && a1280.share.left >= 60 && !a1280.share.clipped
    return gutter390 && gutter1280 && share390 && share1280
  })
  const mos = report.pages['understanding-months-of-supply']
  const mosOk = mos.visible390?.has65 === false && mos.visible1280?.has65 === false
  const navOk =
    report.pages['retirement-central-oregon'].nav390?.changed === false &&
    report.pages['retirement-central-oregon'].nav1280?.changed === false

  report.accept = { layoutOk, mosOk, navUnchanged: navOk }
  writeFileSync(`${ART}/blog_punch_probe.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.accept, null, 2))
  if (!report.accept.layoutOk || !report.accept.mosOk) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
