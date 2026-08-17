#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_v6_'
const CASES = [
  { id: 'big_sky', url: 'https://ryan-realty.com/subdivisions/big-sky' },
  { id: 'calaveras', url: 'https://ryan-realty.com/subdivisions/calaveras' },
  { id: 'housing_market', url: 'https://ryan-realty.com/housing-market', extra: 'scroll' },
  { id: 'larkspur', url: 'https://ryan-realty.com/cities/bend/larkspur', extra: 'homes' },
  { id: 'tetherow', url: 'https://ryan-realty.com/communities/tetherow' },
  { id: 'communities', url: 'https://ryan-realty.com/communities', extra: 'tetherow-card' },
  { id: 'neighborhoods_tetherow', url: 'https://ryan-realty.com/neighborhoods/tetherow' },
  { id: 'neighborhoods', url: 'https://ryan-realty.com/neighborhoods', extra: 'tetherow-card' },
  { id: 'home', url: 'https://ryan-realty.com/', extra: 'tetherow-tile' },
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
      rec.text = (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 900)
      rec.hero = await page.evaluate(() => {
        const body = document.body.innerText.replace(/\s+/g, ' ')
        return {
          heroCount: body.match(/(\d+)\s+homes? for sale/i)?.[1] ?? null,
          medianList: body.match(/Median list\s+\$([\d,]+)/i)?.[1] ?? null,
          pendingDays: body.match(/Pending in\s+([\d.]+)\s+days/i)?.[1] ?? null,
          regionalPair: /\$756,000/.test(body) && /18 days/.test(body),
          grotto1238000: /\$1,238,000/.test(body),
          grotto1238136: /\$1,238,136/.test(body),
          seeHomes: /See homes/i.test(body),
          tetherowHits: (body.match(/Tetherow[^.]{0,140}/gi) ?? []).slice(0, 6),
        }
      })
      if (c.extra === 'homes') {
        await page.evaluate(() => {
          const el = document.getElementById('homes') || document.querySelector('.split, .featured, .section')
          el?.scrollIntoView({ block: 'start' })
        })
        await page.waitForTimeout(400)
        rec.shotHomes = `${ART}/${PREFIX}${c.id}_${width}_homes.png`
        await page.screenshot({ path: rec.shotHomes, fullPage: false })
      }
      if (c.extra === 'tetherow-card' || c.extra === 'tetherow-tile') {
        await page.evaluate(() => {
          const el = [...document.querySelectorAll('a, article, li, div')].find((n) =>
            /Tetherow/i.test(n.textContent ?? ''),
          )
          el?.scrollIntoView({ block: 'center' })
        })
        await page.waitForTimeout(400)
        rec.shotCard = `${ART}/${PREFIX}${c.id}_${width}_tetherow.png`
        await page.screenshot({ path: rec.shotCard, fullPage: false })
      }
      if (c.extra === 'scroll') {
        const before = page.url()
        await page.mouse.wheel(0, 1800)
        await page.waitForTimeout(800)
        await page.mouse.wheel(0, 1800)
        await page.waitForTimeout(800)
        rec.afterScrollUrl = page.url()
        rec.navigatedOnScroll = rec.afterScrollUrl !== before
        rec.shotScroll = `${ART}/${PREFIX}${c.id}_${width}_scroll.png`
        await page.screenshot({ path: rec.shotScroll, fullPage: false })
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
        afterScrollUrl: rec.afterScrollUrl,
        navigatedOnScroll: rec.navigatedOnScroll,
        hero: rec.hero,
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
