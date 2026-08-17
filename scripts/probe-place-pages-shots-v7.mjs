#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_v7_'
const CASES = [
  { id: 'terrebonne', url: 'https://ryan-realty.com/cities/terrebonne', extra: 'homes' },
  { id: 'la_pine', url: 'https://ryan-realty.com/cities/la-pine' },
  { id: 'cities', url: 'https://ryan-realty.com/cities', extra: 'la-pine-card' },
  { id: 'neighborhoods', url: 'https://ryan-realty.com/neighborhoods', extra: 'larkspur-card' },
  { id: 'communities', url: 'https://ryan-realty.com/communities', extra: 'eagle-card' },
  { id: 'eagle_crest', url: 'https://ryan-realty.com/communities/redmond-eagle-crest-resort' },
  { id: 'housing_market', url: 'https://ryan-realty.com/housing-market', extra: 'composition' },
  { id: 'century_west', url: 'https://ryan-realty.com/cities/bend/century-west' },
  { id: 'awbrey_butte', url: 'https://ryan-realty.com/cities/bend/awbrey-butte', extra: 'homes' },
]

mkdirSync(ART, { recursive: true })

async function runViewport(browser, width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  const rows = {}
  for (const c of CASES) {
    const rec = { id: c.id, url: c.url }
    try {
      const res = await page.goto(c.url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      rec.status = res?.status() ?? null
      rec.finalUrl = page.url()
      await page.waitForTimeout(1800)
      rec.shot = `${ART}/${PREFIX}${c.id}_${width}_top.png`
      await page.screenshot({ path: rec.shot, fullPage: false })
      rec.metrics = await page.evaluate(() => {
        const body = document.body.innerText.replace(/\s+/g, ' ')
        const medianNodes = [...document.querySelectorAll('p, span, div, dd, dt')]
          .map((el) => (el.textContent ?? '').trim())
          .filter((t) => /^\$\$?\d/.test(t) && t.length < 24)
        const doubledVisible = medianNodes.filter((t) => t.startsWith('$$'))
        const singleVisible = medianNodes.filter((t) => t.startsWith('$') && !t.startsWith('$$'))
        const homes = document.getElementById('homes') || document.querySelector('[id*="homes"], .split, .featured')
        const homeHrefs = homes
          ? [...homes.querySelectorAll('a[href*="/homes-for-sale/"]')].map((a) => a.getAttribute('href') ?? '')
          : []
        const uniqueHomeHrefs = [...new Set(homeHrefs)]
        const heroImg = document.querySelector('main img, .kb-root img, [class*="hero"] img')
        const heroSrc = heroImg?.getAttribute('src') ?? heroImg?.getAttribute('srcset') ?? null
        return {
          heroCount: body.match(/(\d+)\s+homes? for sale/i)?.[1] ?? null,
          medianList: body.match(/Median list\s+(\${1,2}[\d,]+)/i)?.[1] ?? null,
          doubledVisible,
          singleVisible: singleVisible.slice(0, 16),
          bodyHasClosedCte: /closed_cte|service_area_v1|ILIKE/i.test(body),
          closedCteHit: (body.match(/closed_cte[^.]{0,180}|service_area_v1[^.]{0,180}/i) ?? [])[0] ?? null,
          compositionHit: (body.match(/2024 composition[^.]{0,220}|Composition is by closed[^.]{0,180}/i) ?? [])[0] ?? null,
          eagleHits: (body.match(/Eagle Crest[^.]{0,140}/gi) ?? []).slice(0, 6),
          laPineHits: (body.match(/La Pine[^.]{0,80}/gi) ?? []).slice(0, 6),
          uniqueHomeHrefCount: uniqueHomeHrefs.length,
          homeHrefSample: uniqueHomeHrefs.slice(0, 12),
          inAreaHomeCount: uniqueHomeHrefs.filter((h) =>
            /\/terrebonne\/|\/la-pine\/|\/awbrey-butte\/|\/century-west\//i.test(h),
          ).length,
          heroSrc,
          palmInSrc: /1564013799919|palm/i.test(heroSrc ?? ''),
          unsplashHero: /unsplash/i.test(heroSrc ?? ''),
        }
      })
      if (c.extra === 'homes') {
        await page.evaluate(() => {
          const el = document.getElementById('homes') || document.querySelector('.split, .featured, [aria-label*="Homes"]')
          el?.scrollIntoView({ block: 'start' })
        })
        await page.waitForTimeout(400)
        rec.shotHomes = `${ART}/${PREFIX}${c.id}_${width}_homes.png`
        await page.screenshot({ path: rec.shotHomes, fullPage: false })
      }
      if (c.extra === 'la-pine-card') {
        await page.evaluate(() => {
          const el = [...document.querySelectorAll('a, article, li, div')].find((n) =>
            /La Pine/i.test(n.textContent ?? ''),
          )
          el?.scrollIntoView({ block: 'center' })
        })
        await page.waitForTimeout(400)
        rec.shotCard = `${ART}/${PREFIX}${c.id}_${width}_lapine.png`
        await page.screenshot({ path: rec.shotCard, fullPage: false })
        rec.cardText = await page.evaluate(() => {
          const el = [...document.querySelectorAll('article, a')].find((n) =>
            /La Pine/i.test(n.textContent ?? '') && /Median list/i.test(n.textContent ?? ''),
          )
          return (el?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 240)
        })
      }
      if (c.extra === 'larkspur-card') {
        await page.evaluate(() => {
          const el = [...document.querySelectorAll('a, article, h3')].find((n) => /Larkspur/i.test(n.textContent ?? ''))
          el?.scrollIntoView({ block: 'center' })
        })
        await page.waitForTimeout(400)
        rec.shotCard = `${ART}/${PREFIX}${c.id}_${width}_larkspur.png`
        await page.screenshot({ path: rec.shotCard, fullPage: false })
        rec.cardText = await page.evaluate(() => {
          const el = [...document.querySelectorAll('article')].find((n) => /Larkspur/i.test(n.textContent ?? ''))
          const nums = [...(el?.querySelectorAll('.mono-num, p, span') ?? [])].map((n) =>
            (n.textContent ?? '').trim(),
          )
          return { text: (el?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 240), nums: nums.slice(0, 12) }
        })
      }
      if (c.extra === 'eagle-card') {
        await page.evaluate(() => {
          const el = [...document.querySelectorAll('a, article, li')].find((n) =>
            /Eagle Crest/i.test(n.textContent ?? ''),
          )
          el?.scrollIntoView({ block: 'center' })
        })
        await page.waitForTimeout(400)
        rec.shotCard = `${ART}/${PREFIX}${c.id}_${width}_eagle.png`
        await page.screenshot({ path: rec.shotCard, fullPage: false })
        rec.azText = await page.evaluate(() => {
          const items = [...document.querySelectorAll('a, li, button, span')].filter((n) =>
            /Eagle Crest/i.test(n.textContent ?? ''),
          )
          return items.slice(0, 8).map((n) => (n.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120))
        })
      }
      if (c.extra === 'composition') {
        await page.evaluate(() => {
          const el = [...document.querySelectorAll('p, section, div')].find((n) =>
            /composition|closed MLS|Oregon Data Share/i.test(n.textContent ?? ''),
          )
          el?.scrollIntoView({ block: 'center' })
        })
        await page.waitForTimeout(400)
        rec.shotComp = `${ART}/${PREFIX}${c.id}_${width}_composition.png`
        await page.screenshot({ path: rec.shotComp, fullPage: false })
      }
    } catch (err) {
      rec.error = err instanceof Error ? err.message : String(err)
    }
    rows[c.id] = rec
    console.log(
      JSON.stringify({
        w: width,
        id: c.id,
        status: rec.status,
        finalUrl: rec.finalUrl,
        metrics: rec.metrics,
        cardText: rec.cardText,
        azText: rec.azText,
        error: rec.error,
      }),
    )
  }
  await page.close()
  return rows
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const out = { fetchedAt: new Date().toISOString(), viewports: {} }
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    out.viewports[String(w)] = await runViewport(browser, w, h)
  }
  await browser.close()
  writeFileSync(`${ART}/${PREFIX}place_pages_punch_shots.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/${PREFIX}place_pages_punch_shots.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
