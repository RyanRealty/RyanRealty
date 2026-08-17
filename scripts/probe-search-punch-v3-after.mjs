#!/usr/bin/env node
/**
 * After-READY probe for the pending status class-fix.
 *
 *   PREFIX=after_ node scripts/probe-search-punch-v3-after.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PREFIX || 'after_'

async function dismissChrome(page) {
  for (const label of ['Not now', 'Essential only', 'Accept all']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(250)
    }
  }
}

async function inspectPending(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        text: text(el).slice(0, 80),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0,
      }
    }
    const chips = [...document.querySelectorAll('button')].filter((el) =>
      /^(For Sale|Under contract only|Sold|Active \+ under contract|All statuses)/i.test(text(el)),
    )
    const badges = [...document.querySelectorAll('*')].filter((el) => {
      const t = text(el)
      return /^(Pending|Under contract|Sold)$/i.test(t) && el.children.length === 0
    })
    const cards = [...document.querySelectorAll('a')].filter((a) =>
      /\/homes-for-sale\/.+-\d{6,}/.test(a.getAttribute('href') || ''),
    )
    return {
      url: location.href,
      title: text(document.querySelector('h1')),
      statusChips: chips.slice(0, 6).map(box),
      pendingBadges: badges.slice(0, 12).map((el) => ({
        ...box(el),
        parent: text(el.parentElement).slice(0, 40),
      })),
      cardCount: cards.length,
      firstCard: cards[0] ? { href: cards[0].getAttribute('href'), ...box(cards[0]) } : null,
    }
  })
}

async function shot(page, name) {
  const path = `${ART}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  return path
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const report = { fetchedAt: new Date().toISOString(), base: BASE, views: {} }
  const browser = await chromium.launch({ headless: true })
  for (const width of [390, 1280]) {
    const height = width === 390 ? 844 : 900
    const page = await browser.newPage({
      viewport: { width, height },
      extraHTTPHeaders: CI_PROBE_HEADERS,
    })
    await page.goto(`${BASE}/homes-for-sale/bend/awbrey-butte/pending`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2800)
    await dismissChrome(page)
    report.views[`w${width}`] = await inspectPending(page)
    await shot(page, `${PREFIX}pending_${width}_top`)
    await page.evaluate(() => window.scrollTo(0, 720))
    await page.waitForTimeout(400)
    await shot(page, `${PREFIX}pending_${width}_cards`)
    await page.close()
  }
  await browser.close()
  writeFileSync(`${ART}/${PREFIX}search_punch_v3.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ base: BASE, prefix: PREFIX, views: report.views }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
