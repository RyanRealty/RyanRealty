#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_'
const CASES = [
  { id: 'alder-glen', url: 'https://ryan-realty.com/subdivisions/alder-glen' },
  { id: 'blue-ridge', url: 'https://ryan-realty.com/subdivisions/blue-ridge' },
  { id: 'boyd-crossing', url: 'https://ryan-realty.com/subdivisions/boyd-crossing' },
  { id: 'summit-west', url: 'https://ryan-realty.com/cities/bend/summit-west' },
  { id: 'canyon-ridge-phase-3', url: 'https://ryan-realty.com/subdivisions/canyon-ridge-phase-3' },
  { id: 'canyon-view', url: 'https://ryan-realty.com/subdivisions/canyon-view' },
  { id: 'ambrosia-acres', url: 'https://ryan-realty.com/subdivisions/ambrosia-acres' },
  { id: 'cascade', url: 'https://ryan-realty.com/subdivisions/cascade' },
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
      await page.waitForSelector('h1', { timeout: 20_000 }).catch(() => null)
      await page.waitForTimeout(800)
      rec.shotTop = `${ART}/${PREFIX}${c.id}_${width}.png`
      await page.screenshot({ path: rec.shotTop, fullPage: false })
      rec.metrics = await page.evaluate(() => {
        const body = document.body.innerText.replace(/\s+/g, ' ')
        const h1 = document.querySelector('h1')
        const h1Box = h1?.getBoundingClientRect()
        const clock = document.querySelector('.mkt-clock')?.textContent?.trim() ?? null
        const asOf = [...body.matchAll(/as of[^.]{0,60}/gi)].map((m) => m[0].trim()).slice(0, 6)
        const updated = [...body.matchAll(/Updated[^.]{0,80}/gi)].map((m) => m[0].trim()).slice(0, 6)
        return {
          title: document.title,
          h1: h1?.textContent?.trim() ?? null,
          h1Visible: Boolean(h1 && h1Box && h1Box.height > 0 && h1Box.width > 0),
          h1Top: h1Box ? Math.round(h1Box.top) : null,
          emptyState: /No active listings/i.test(body),
          salesHistory: /sales history/i.test(body),
          listingCards: document.querySelectorAll('[data-listing-card], a[href*="/homes-for-sale/"]').length,
          clock,
          asOf,
          updated,
          chromeOnly:
            !document.querySelector('h1') &&
            !/No active listings/i.test(body) &&
            !/sales history/i.test(body),
        }
      })
      if (c.id === 'summit-west') {
        const clockEl = await page.$('.mkt-clock, .mkt-chrome')
        if (clockEl) {
          await clockEl.scrollIntoViewIfNeeded()
          await page.waitForTimeout(250)
          rec.shotDesk = `${ART}/${PREFIX}${c.id}_${width}_desk.png`
          await page.screenshot({ path: rec.shotDesk, fullPage: false })
        }
      }
      if (rec.metrics?.h1 && rec.metrics.h1Top != null && rec.metrics.h1Top > height * 0.4) {
        await page.evaluate(() => document.querySelector('h1')?.scrollIntoView({ block: 'center' }))
        await page.waitForTimeout(300)
        rec.shotH1 = `${ART}/${PREFIX}${c.id}_${width}_h1.png`
        await page.screenshot({ path: rec.shotH1, fullPage: false })
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
  writeFileSync(`${ART}/${PREFIX}place_pages_v11.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/${PREFIX}place_pages_v11.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
