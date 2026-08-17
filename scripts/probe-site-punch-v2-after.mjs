#!/usr/bin/env node
/**
 * After-READY probe for the homepage regional-grain + remainder class-fix.
 *
 *   node scripts/probe-site-punch-v2-after.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'

async function dismissChrome(page) {
  for (const label of ['Not now', 'Essential only', 'Accept all', 'NOT NOW']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => {})
    }
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const h1 = document.querySelector('h1')
    const heroSection = h1?.closest('section') || document.querySelector('.hero')
    const remainder = document.querySelector('.towns-remainder')
    return {
      title: document.title,
      heroText: text(heroSection).slice(0, 500),
      namesRegionalGrain: /across Central Oregon/i.test(text(heroSection)),
      namesSixTownsAsCount: /Bend, Redmond, Sisters, Sunriver, La Pine, and Prineville/i.test(
        text(heroSection),
      ),
      remainderText: text(remainder),
      remainderVisible: Boolean(remainder && remainder.getBoundingClientRect().height > 8),
    }
  })
}

async function runViewport(browser, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1800)
  await dismissChrome(page)
  const hero = await measure(page)
  const heroShot = `${ART}/after_home_${width}_hero.png`
  await page.screenshot({ path: heroShot, fullPage: false })

  const townsEl = page.locator('.town-row, .towns-remainder').first()
  if (await townsEl.count()) {
    await townsEl.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
  }
  const remainderEl = page.locator('.towns-remainder').first()
  if (await remainderEl.count()) {
    await remainderEl.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
  }
  const towns = await measure(page)
  const townsShot = `${ART}/after_home_${width}_towns.png`
  await page.screenshot({ path: townsShot, fullPage: false })
  await context.close()
  return { width, hero, heroShot, towns, townsShot }
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const out = { fetchedAt: new Date().toISOString(), base: BASE, viewports: {} }
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    out.viewports[String(w)] = await runViewport(browser, w, h)
  }
  await browser.close()
  const ok =
    out.viewports['390'].hero.namesRegionalGrain &&
    out.viewports['1280'].hero.namesRegionalGrain &&
    out.viewports['390'].towns.remainderVisible &&
    out.viewports['1280'].towns.remainderVisible &&
    !out.viewports['390'].hero.namesSixTownsAsCount &&
    !out.viewports['1280'].hero.namesSixTownsAsCount
  out.ok = ok
  writeFileSync(`${ART}/site_punch_v2_after.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
  if (!ok) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
