#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
mkdirSync(ART, { recursive: true })

async function dismiss(page) {
  for (const sel of ['text=Not now', 'role=link[name=/not now/i]', 'role=button[name=/not now/i]']) {
    const loc = page.locator(sel).first()
    if (await loc.count()) {
      await loc.click({ timeout: 3000, force: true }).catch(() => null)
    }
  }
  await page.keyboard.press('Escape').catch(() => null)
  await page.waitForTimeout(400)
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
  })
  const out = { fetchedAt: new Date().toISOString(), rows: {} }

  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      extraHTTPHeaders: CI_PROBE_HEADERS,
    })

    await page.goto('https://ryan-realty.com/housing-market', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForSelector('h1', { timeout: 20_000 })
    await page.waitForTimeout(800)
    await dismiss(page)
    const terrebonne = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('a, li, div, span')]
      const hits = nodes
        .map((el) => el.innerText?.replace(/\s+/g, ' ').trim() ?? '')
        .filter((t) => /^(\d+\s+for sale\s+)?Terrebonne/i.test(t) && t.length < 160)
      const row = nodes.find((el) => /6\s+for sale\s+Terrebonne/i.test(el.innerText ?? ''))
      if (row) row.scrollIntoView({ block: 'center' })
      return {
        hits: [...new Set(hits)].slice(0, 8),
        rowText: row?.innerText?.replace(/\s+/g, ' ').trim() ?? null,
      }
    })
    await page.waitForTimeout(300)
    const hmShot = `${ART}/after_housing-market_${w}_terrebonne.png`
    await page.screenshot({ path: hmShot, fullPage: false })
    out.rows[`housing-market-${w}`] = { ...terrebonne, shot: hmShot }

    await page.goto('https://ryan-realty.com/central-oregon/events/bend-farmers-market', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForSelector('h1', { timeout: 20_000 })
    await page.waitForTimeout(800)
    await dismiss(page)
    await page.waitForTimeout(3500)
    await page.locator('.v3-field__map, .v3-field__map-frame').first().scrollIntoViewIfNeeded().catch(() => null)
    await page.waitForTimeout(600)
    const map = await page.evaluate(() => {
      const el = document.querySelector('.v3-field__map, .v3-field__map-frame')
      const box = el?.getBoundingClientRect()
      return {
        className: el?.className ?? null,
        box: box ? { w: Math.round(box.width), h: Math.round(box.height), top: Math.round(box.top) } : null,
        tiles: document.querySelectorAll('img[src*="googleapis.com/maps"], img[src*="maps.gstatic"], canvas').length,
        overlay: Boolean(document.body.innerText.match(/Continue with Google/i)),
      }
    })
    const mapShot = `${ART}/after_bend-farmers-market_${w}_map.png`
    await page.screenshot({ path: mapShot, fullPage: false })
    out.rows[`farmers-market-${w}`] = { ...map, shot: mapShot }

    await page.close()
    console.log(JSON.stringify({ w, terrebonne, map }))
  }

  await browser.close()
  writeFileSync(`${ART}/after_place_pages_v11_focus.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/after_place_pages_v11_focus.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
