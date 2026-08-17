#!/usr/bin/env node
/**
 * Reproduce the served FLEET-PUNCH site slice on production.
 *
 *   node scripts/probe-site-punch-prod.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const FLEET_EMAIL = 'fleet-test+flow@ryan-realty.com'

async function dismissChrome(page) {
  for (const label of ['Not now', 'Essential only', 'Accept all']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(400)
    }
    const link = page.getByRole('link', { name: new RegExp(`^${label}$`, 'i') }).first()
    if (await link.isVisible().catch(() => false)) {
      await link.click({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(400)
    }
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const towns = [...document.querySelectorAll('.town-row')].map((el) => {
      const fill = el.querySelector('.town-fill')
      const r = el.getBoundingClientRect()
      return {
        name: text(el.querySelector('.town-name')),
        stats: text(el.querySelector('.town-stats')),
        href: el.getAttribute('href'),
        hasFill: Boolean(fill),
        bg: fill ? getComputedStyle(fill).backgroundImage : 'none',
        fillOpacity: fill ? getComputedStyle(fill).opacity : null,
        visible: r.width > 0 && r.height > 20,
      }
    })
    const hero = text(document.querySelector('h1')?.closest('section'))
    const map = [...document.querySelectorAll('section, [class*="map"]')].find((el) =>
      /ACTIVE LISTINGS/i.test(el.textContent || ''),
    )
    const chrome = document.querySelector('header')
    const arrival = [...document.querySelectorAll('a')].filter((a) => /^(Buy|Sell|Look)$/.test(text(a)))
    const heroCtas = [...document.querySelectorAll('a')].filter((a) =>
      /see homes|value my home/i.test(text(a)),
    )
    return {
      hero: hero.slice(0, 360),
      towns,
      mapText: map ? text(map).slice(0, 220) : null,
      chromeH: chrome ? Math.round(chrome.getBoundingClientRect().height) : null,
      arrival: arrival.slice(0, 3).map((a) => ({
        text: text(a),
        href: a.getAttribute('href'),
        y: Math.round(a.getBoundingClientRect().y),
      })),
      heroCtas: heroCtas.slice(0, 4).map((a) => ({
        text: text(a),
        href: a.getAttribute('href'),
        y: Math.round(a.getBoundingClientRect().y),
      })),
    }
  })
}

async function shot(page, name) {
  const path = `${ART}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  return path
}

async function runViewport(browser, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1500)
  await dismissChrome(page)
  const homeTop = await measure(page)
  const homeShot = await shot(page, `site_home_${width}_top`)

  const townsEl = page.locator('.town-row').first()
  if (await townsEl.count()) {
    await townsEl.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
  }
  const townsMeasure = await measure(page)
  const townsShot = await shot(page, `site_home_${width}_towns`)

  const mapEl = page.locator('text=/ACTIVE LISTINGS/i').first()
  let mapShot = null
  if (await mapEl.count()) {
    await mapEl.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    mapShot = await shot(page, `site_home_${width}_map`)
  }
  const mapMeasure = await measure(page)

  const alerts = page.locator('form').filter({ hasText: /Get alerts/i }).first()
  let alertResult = null
  if (await alerts.count()) {
    await alerts.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await alerts.locator('input[type="email"]').fill(FLEET_EMAIL)
    const started = Date.now()
    await alerts.locator('button[type="submit"]').click()
    await page.waitForTimeout(2500)
    const pending = await page.getByText('Setting up').isVisible().catch(() => false)
    if (pending) {
      await page.waitForTimeout(8000)
    }
    const confirm = await page.getByText(/Set\. Watch your inbox|You are set/i).isVisible().catch(() => false)
    const error = await page.locator('[role="alert"], .comm-alerts-error').textContent().catch(() => null)
    const stillGetAlerts = await page.getByRole('button', { name: /Get alerts/i }).isVisible().catch(() => false)
    const emailVal = await alerts.locator('input[type="email"]').inputValue().catch(() => null)
    alertResult = {
      ms: Date.now() - started,
      confirm,
      error: error?.trim() || null,
      stillGetAlerts,
      emailVal,
    }
    await shot(page, `site_home_${width}_alerts`)
  }

  await page.goto(`${BASE}/homes-for-sale`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1500)
  await dismissChrome(page)
  await page.waitForTimeout(800)
  const searchBody = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  const searchShot = await shot(page, `site_see_homes_${width}`)
  const searchLanding = {
    url: page.url(),
    showingBendOnly: /showing bend only/i.test(searchBody),
    bendOnly: /bend only/i.test(searchBody),
    snippet: (searchBody.match(/showing.{0,100}|homes for sale.{0,80}|[0-9,]+ homes/i) || []).slice(0, 6),
  }

  await page.goto(`${BASE}/cities/bend`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1500)
  await dismissChrome(page)
  const bendText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  const bendShot = await shot(page, `site_bend_${width}_top`)
  const bend = {
    homes: bendText.match(/[\d,]+ homes for sale/i)?.[0] ?? null,
    median: bendText.match(/Median list \$[\d,]+/i)?.[0] ?? null,
    pending: bendText.match(/Pending in [0-9.]+ days/i)?.[0] ?? null,
  }

  await context.close()
  return {
    width,
    homeTop,
    homeShot,
    townsMeasure,
    townsShot,
    mapMeasure,
    mapShot,
    alertResult,
    searchLanding,
    searchShot,
    bend,
    bendShot,
  }
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
  writeFileSync(`${ART}/site_punch_probe.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
