#!/usr/bin/env node
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
mkdirSync(ART, { recursive: true })

async function shot(width, height) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
  })
  const page = await browser.newPage({
    viewport: { width, height },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  await page.goto('https://ryan-realty.com/communities/crooked-river-ranch', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  })
  await page.waitForTimeout(1200)
  const notNow = page.getByRole('button', { name: /not now/i }).or(page.getByText(/^Not now$/i))
  if (await notNow.first().isVisible().catch(() => false)) {
    await notNow.first().click()
    await page.waitForTimeout(800)
  }
  const metrics = await page.evaluate(() => {
    const doors = [...document.querySelectorAll('a')].filter((a) =>
      /See Crooked River Ranch homes/i.test(a.textContent ?? ''),
    )
    return {
      h1: document.querySelector('h1')?.getAttribute('aria-label'),
      doors: doors.map((a) => ({ text: a.textContent?.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') })),
      listingCount: document.body.innerText.match(/(\d[\d,]*)\s+homes? for sale/i)?.[1] ?? null,
      listingHrefs: [...document.querySelectorAll('a[href*="/homes-for-sale/terrebonne/"]')].length,
    }
  })
  const path = `${ART}/before_place_v9_crr_${width}_after_dismiss.png`
  await page.screenshot({ path, fullPage: false })
  await page.evaluate(() => {
    const el = document.querySelector('#homes') ?? [...document.querySelectorAll('a, h2')].find((n) => /See Crooked River Ranch homes|#homes/i.test(n.textContent ?? ''))
    el?.scrollIntoView({ block: 'center' })
  })
  await page.waitForTimeout(400)
  const path2 = `${ART}/before_place_v9_crr_${width}_listings.png`
  await page.screenshot({ path: path2, fullPage: false })
  await browser.close()
  console.log(JSON.stringify({ width, metrics, path, path2 }, null, 2))
}

await shot(390, 844)
await shot(1280, 800)
