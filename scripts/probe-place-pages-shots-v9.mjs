#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_place_v9_'
const CASES = [
  { id: 'aero', url: 'https://ryan-realty.com/subdivisions/aero-acres' },
  { id: 'anderson', url: 'https://ryan-realty.com/subdivisions/anderson-acres' },
  { id: 'crr', url: 'https://ryan-realty.com/communities/crooked-river-ranch' },
  { id: 'ranch1880', url: 'https://ryan-realty.com/subdivisions/1880-ranch' },
  { id: 'park27', url: 'https://ryan-realty.com/subdivisions/27th-park' },
  { id: 'addition27', url: 'https://ryan-realty.com/subdivisions/27th-street-addition' },
  { id: 'crossing27', url: 'https://ryan-realty.com/subdivisions/27th-street-crossing' },
  { id: 'brentwood', url: 'https://ryan-realty.com/subdivisions/brentwood' },
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
        const h1 = document.querySelector('h1')
        const h1Box = h1?.getBoundingClientRect()
        const body = document.body.innerText.replace(/\s+/g, ' ')
        const listingLinks = [...document.querySelectorAll('a[href*="/homes-for-sale/"]')]
          .map((a) => a.getAttribute('href') ?? '')
          .filter((h) => /\/homes-for-sale\/[^?]/.test(h))
        const seeHomes = [...document.querySelectorAll('a')]
          .map((a) => ({ text: (a.textContent ?? '').replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') }))
          .filter((a) => /see .+ homes/i.test(a.text))
        return {
          title: document.title,
          h1: h1?.getAttribute('aria-label') ?? h1?.textContent?.trim() ?? null,
          h1Visible: Boolean(h1 && h1Box && h1Box.width > 0 && h1Box.height > 0),
          h1W: h1Box ? Math.round(h1Box.width) : 0,
          h1H: h1Box ? Math.round(h1Box.height) : 0,
          emptyState: /No active listings/i.test(body),
          emptySnippet: body.match(/No active listings[^.]{0,80}\./)?.[0] ?? null,
          seeHomes,
          listingDoorCount: listingLinks.length,
          listingDoors: [...new Set(listingLinks)].slice(0, 6),
          chromeOnly:
            Boolean(document.querySelector('header, .site-header, nav')) &&
            !h1 &&
            !/No active listings|See .+ homes|homes for sale/i.test(body),
        }
      })
      if (c.id === 'crr') {
        await page.evaluate(() => {
          const el = [...document.querySelectorAll('a, h2, section')].find((n) =>
            /See Crooked River Ranch homes|#homes|homes for sale/i.test(n.textContent ?? ''),
          )
          el?.scrollIntoView({ block: 'center' })
        })
        await page.waitForTimeout(400)
        rec.shotHomes = `${ART}/${PREFIX}${c.id}_${width}_homes.png`
        await page.screenshot({ path: rec.shotHomes, fullPage: false })
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
        metrics: rec.metrics,
        error: rec.error,
      }),
    )
  }
  await page.close()
  return rows
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
  })
  const out = { fetchedAt: new Date().toISOString(), viewports: {} }
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    out.viewports[String(w)] = await runViewport(browser, w, h)
  }
  await browser.close()
  writeFileSync(`${ART}/${PREFIX}facts.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/${PREFIX}facts.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
