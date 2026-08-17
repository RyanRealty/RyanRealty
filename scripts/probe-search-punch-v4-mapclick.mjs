#!/usr/bin/env node
/** Click the visible 390 List/Map control on production. */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
mkdirSync(ART, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  extraHTTPHeaders: CI_PROBE_HEADERS,
})
await page.goto(`${BASE}/homes-for-sale`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
await page.waitForTimeout(2500)
for (const label of ['Not now', 'Essential only', 'Accept all']) {
  const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
  if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 2000 }).catch(() => {})
}

const before = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const toggles = [...document.querySelectorAll('button, [role="tab"]')]
    .filter((el) => /^(list|map)$/i.test(text(el)))
    .map((el) => {
      const r = el.getBoundingClientRect()
      return {
        text: text(el),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0,
        pressed: el.getAttribute('aria-pressed') || el.getAttribute('data-state'),
      }
    })
  return { url: location.href, toggles }
})

const mapBtn = page.locator('button, [role="tab"]').filter({ hasText: /^Map$/ }).nth(0)
const box = await mapBtn.boundingBox()
await mapBtn.click({ timeout: 4000 })
await page.waitForTimeout(1200)
await page.screenshot({ path: `${ART}/before_search_390_map_clicked.png`, fullPage: false })

const after = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const toggles = [...document.querySelectorAll('button, [role="tab"]')]
    .filter((el) => /^(list|map)$/i.test(text(el)))
    .map((el) => {
      const r = el.getBoundingClientRect()
      return {
        text: text(el),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0,
        pressed: el.getAttribute('aria-pressed') || el.getAttribute('data-state'),
      }
    })
  const mapImgs = [...document.querySelectorAll('.gm-style img, canvas')].filter((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 40 && r.height > 40
  }).length
  return { url: location.href, toggles, mapImgs }
})

console.log(JSON.stringify({ before, clickBox: box, after }, null, 2))
await browser.close()
