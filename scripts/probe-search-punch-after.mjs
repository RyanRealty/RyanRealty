#!/usr/bin/env node
/**
 * After-READY accept for fleet:public-ux:search slice.
 *
 *   PREFIX=after_ node scripts/probe-search-punch-after.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PREFIX || 'after_'

async function dismissChrome(page) {
  const btn = page.getByRole('button', { name: /not now|essential only|accept all/i }).first()
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(300)
  }
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const report = { fetchedAt: new Date().toISOString(), base: BASE }

  const browser = await chromium.launch({ headless: true })
  for (const width of [390, 1280]) {
    const height = width === 390 ? 844 : 900
    const page = await browser.newPage({
      viewport: { width, height },
      extraHTTPHeaders: CI_PROBE_HEADERS,
    })
    const key = `w${width}`
    report[key] = {}

    const listingRes = await page.goto(`${BASE}/homes-for-sale/listing/220223571`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(1500)
    await dismissChrome(page)
    report[key].listingHttp = listingRes?.status() ?? null
    report[key].listing = await page.evaluate(() => {
      const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      const h1 = document.querySelector('h1')
      return {
        title: text(h1),
        h1Price: (text(h1).match(/\$[\d,]+/) || [])[0] || null,
        bodyPrices: [...document.body.innerText.matchAll(/\$[\d,]+/g)].map((m) => m[0]).slice(0, 12),
      }
    })
    await page.screenshot({ path: `${ART}/${PREFIX}summerfield_${width}_h1.png` })

    const cardRes = await page.goto(`${BASE}/homes-for-sale/bend?q=3729+Summerfield`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2500)
    await dismissChrome(page)
    report[key].cardHttp = cardRes?.status() ?? null
    report[key].card = await page.evaluate(() => {
      const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      const hit = [...document.querySelectorAll('a')].find((a) => /summerfield/i.test(text(a)))
      return {
        title: text(document.querySelector('h1')),
        href: hit?.getAttribute('href') || null,
        text: hit ? text(hit).slice(0, 240) : null,
        price: hit ? (text(hit).match(/\$[\d,]+/) || [])[0] || null : null,
        twoMillion: document.body.innerText.includes('$2,000,000'),
        exact: document.body.innerText.includes('$1,999,900'),
      }
    })
    await page.screenshot({ path: `${ART}/${PREFIX}summerfield_${width}_card.png` })

    await page.goto(`${BASE}/homes-for-sale`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2000)
    await dismissChrome(page)
    const allFilters = page.getByRole('button', { name: /all filters/i }).first()
    if (await allFilters.isVisible().catch(() => false)) {
      await allFilters.click()
      await page.waitForTimeout(900)
      report[key].sheet = await page.evaluate(() => {
        const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
        const dialog = document.querySelector('[data-slot="sheet-content"]') || document.querySelector('[role="dialog"]')
        if (!dialog) return { open: false }
        const r = dialog.getBoundingClientRect()
        const owner = [...dialog.querySelectorAll('label, span')].find((el) =>
          /owner finan/i.test(text(el)),
        )
        return {
          open: true,
          w: Math.round(r.width),
          h: Math.round(r.height),
          owner: owner
            ? {
                text: text(owner),
                w: Math.round(owner.getBoundingClientRect().width),
                right: Math.round(owner.getBoundingClientRect().right),
                dialogRight: Math.round(r.right),
                clipped: owner.getBoundingClientRect().right > r.right + 1,
              }
            : null,
        }
      })
      await page.screenshot({ path: `${ART}/${PREFIX}search_${width}_filters.png` })
    }

    await page.close()
  }
  await browser.close()
  writeFileSync(`${ART}/${PREFIX}search_punch_after.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
