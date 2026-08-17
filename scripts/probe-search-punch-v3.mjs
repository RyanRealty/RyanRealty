#!/usr/bin/env node
/**
 * Reproduce the FLEET-PUNCH fleet:public-ux:search slice (8 lines).
 *
 *   node scripts/probe-search-punch-v3.mjs
 *   BASE_URL=https://ryan-realty.com PREFIX=before_ node scripts/probe-search-punch-v3.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PREFIX || 'before_'

async function dismissChrome(page) {
  for (const label of ['Not now', 'Essential only', 'Accept all']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(250)
    }
  }
}

async function inspectSearchChrome(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        text: text(el).slice(0, 120),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
        display: cs.display,
        overflow: cs.overflow,
        pointerEvents: cs.pointerEvents,
        zIndex: cs.zIndex,
      }
    }
    const byLabel = (re) =>
      [...document.querySelectorAll('button, [role="button"], a')].find((n) => re.test(text(n)))
    const chipLabels = ['For sale', 'Pending', 'Sold', 'Price', 'Beds', 'Baths', 'Home type', 'All filters']
    const chips = chipLabels.map((label) => {
      const el = byLabel(new RegExp(`^${label}`, 'i'))
      return { label, found: !!el, ...(box(el) || {}) }
    })
    const save = [...document.querySelectorAll('button, a')].filter((el) =>
      /save this search|search saved|save search/i.test(text(el)),
    )
    const alerts = [...document.querySelectorAll('button, a')].filter((el) =>
      /get listing alerts|\balerts?\b/i.test(text(el)),
    )
    const sort = document.querySelector('[aria-label="Sort results"]')
    const countRow = [...document.querySelectorAll('p, div')].find((el) =>
      /homes in this map view|homes match|homes found|No homes/i.test(text(el)),
    )
    const header = document.querySelector('header')
    const mapList = [...document.querySelectorAll('button, [role="tab"], a')].filter((el) =>
      /^(map|list)$/i.test(text(el)),
    )
    const cards = [...document.querySelectorAll('a')].filter((a) =>
      /\/homes-for-sale\/.+-\d{6,}/.test(a.getAttribute('href') || ''),
    )
    const firstCard = cards[0] || null
    const pendingBadges = [...document.querySelectorAll('*')].filter((el) => {
      const t = text(el)
      return /^(pending|under contract)$/i.test(t) && el.children.length === 0
    }).slice(0, 8)
    const headerH = header ? Math.round(header.getBoundingClientRect().bottom) : 0
    const sortBox = box(sort)
    const countBox = box(countRow)
    const mapListBoxes = mapList.map((el) => ({
      ...box(el),
      href: el.getAttribute('href'),
    }))
    const chipRow = [...document.querySelectorAll('div')].find((el) => {
      const t = text(el)
      return /All filters/i.test(t) && /Beds/i.test(t)
    })
    const chipRowBox = box(chipRow)
    return {
      url: window.location.href,
      title: text(document.querySelector('h1')).slice(0, 160),
      bodyHead: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 360),
      chips,
      save: save.slice(0, 4).map(box),
      alerts: alerts.slice(0, 6).map((el) => ({
        ...box(el),
        href: el.getAttribute('href'),
      })),
      sort: sortBox,
      count: countBox,
      mapList: mapListBoxes,
      firstCard: firstCard
        ? { href: firstCard.getAttribute('href'), ...box(firstCard) }
        : null,
      cardCount: cards.length,
      pendingBadges: pendingBadges.map((el) => text(el)),
      headerBottom: headerH,
      sortClippedByHeader: sortBox ? sortBox.y + 4 < headerH && sortBox.visible : false,
      countClippedByHeader: countBox ? countBox.y + 4 < headerH && countBox.visible : false,
      chipRow: chipRowBox,
    }
  })
}

function overlaps(a, b) {
  if (!a || !b || !a.visible || !b.visible) return false
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

async function shot(page, name) {
  const path = `${ART}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  return path
}

async function inspectSaveDialog(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const dialog =
      document.querySelector('[data-slot="dialog-content"]') ||
      document.querySelector('[data-slot="sheet-content"]') ||
      document.querySelector('[role="dialog"]')
    if (!dialog) return { open: false }
    const r = dialog.getBoundingClientRect()
    const inputs = [...dialog.querySelectorAll('input, textarea')].map((el) => ({
      type: el.getAttribute('type') || el.tagName.toLowerCase(),
      name: el.getAttribute('name'),
      placeholder: el.getAttribute('placeholder'),
      required: el.required,
    }))
    return {
      open: true,
      w: Math.round(r.width),
      h: Math.round(r.height),
      text: text(dialog).slice(0, 400),
      inputs,
      hasEmail: inputs.some((i) => /email/i.test(`${i.type} ${i.name} ${i.placeholder}`)),
      hasSignIn: /sign in|google|continue with/i.test(text(dialog)),
    }
  })
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
    const crashes = []
    page.on('crash', () => crashes.push(page.url()))
    const key = `w${width}`
    report.views[key] = { crashes }

    // 1. acreage page (Aw Snap)
    const acreageStarted = Date.now()
    const acreageRes = await page
      .goto(`${BASE}/homes-for-sale/bend/old-farm-district/acreage`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      })
      .catch((err) => ({ error: String(err) }))
    await page.waitForTimeout(2500)
    await dismissChrome(page)
    report.views[key].acreage = {
      http: acreageRes?.status?.() ?? acreageRes?.error ?? null,
      ms: Date.now() - acreageStarted,
      crashed: crashes.length > 0,
      chrome: await inspectSearchChrome(page).catch((err) => ({ error: String(err) })),
    }
    await shot(page, `${PREFIX}acreage_${width}`)

    // 2. pending neighborhood
    const pendingRes = await page.goto(`${BASE}/homes-for-sale/bend/awbrey-butte/pending`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2500)
    await dismissChrome(page)
    report.views[key].pending = {
      http: pendingRes?.status() ?? null,
      chrome: await inspectSearchChrome(page),
    }
    await shot(page, `${PREFIX}pending_${width}`)

    // 3/4/5/6/7. bare search
    const searchRes = await page.goto(`${BASE}/homes-for-sale`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2800)
    await dismissChrome(page)
    const searchChrome = await inspectSearchChrome(page)
    const mapToggle = searchChrome.mapList.find((el) => /^map$/i.test(el.text || ''))
    const listToggle = searchChrome.mapList.find((el) => /^list$/i.test(el.text || ''))
    report.views[key].search = {
      http: searchRes?.status() ?? null,
      chrome: searchChrome,
      mapListOverlappedByChips: overlaps(searchChrome.chipRow, mapToggle) || overlaps(searchChrome.chipRow, listToggle),
    }
    await shot(page, `${PREFIX}search_${width}_top`)

    // First card click (do not invent a listing — follow the live href)
    if (searchChrome.firstCard?.href) {
      const href = searchChrome.firstCard.href
      const [nav] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => null),
        page.locator(`a[href="${href}"]`).first().click({ timeout: 5000 }).catch((err) => ({ error: String(err) })),
      ])
      await page.waitForTimeout(1500)
      report.views[key].firstCardClick = {
        href,
        landed: page.url(),
        status: nav?.response()?.status() ?? null,
        isListing: /\/homes-for-sale\/.+-\d{6,}/.test(page.url()),
        isSubdivisions: /\/subdivisions/.test(page.url()),
      }
      await shot(page, `${PREFIX}first_card_${width}`)
      await page.goto(`${BASE}/homes-for-sale`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await page.waitForTimeout(1800)
      await dismissChrome(page)
    } else {
      report.views[key].firstCardClick = { skipped: true, reason: 'no listing card href' }
    }

    // 8. beds=3 save dialog (do not submit a real email)
    await page.goto(`${BASE}/homes-for-sale?beds=3`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2000)
    await dismissChrome(page)
    report.views[key].beds3 = await inspectSearchChrome(page)
    await shot(page, `${PREFIX}beds3_${width}_top`)
    const saveBtn = page.getByRole('button', { name: /save this search/i }).first()
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click()
      await page.waitForTimeout(800)
      report.views[key].saveDialog = await inspectSaveDialog(page)
      await shot(page, `${PREFIX}beds3_${width}_save`)
      await page.keyboard.press('Escape')
    } else {
      report.views[key].saveDialog = { open: false, reason: 'Save this search not visible' }
    }

    await page.close()
  }
  await browser.close()

  writeFileSync(`${ART}/${PREFIX}search_punch_v3.json`, JSON.stringify(report, null, 2))
  const summary = {}
  for (const width of [390, 1280]) {
    const v = report.views[`w${width}`]
    summary[width] = {
      acreageHttp: v.acreage?.http,
      acreageCrashed: v.acreage?.crashed,
      acreageTitle: v.acreage?.chrome?.title,
      pendingTitle: v.pending?.chrome?.title,
      pendingChips: v.pending?.chrome?.chips?.filter((c) => c.found),
      pendingBadges: v.pending?.chrome?.pendingBadges,
      pendingBody: v.pending?.chrome?.bodyHead,
      firstCard: v.search?.chrome?.firstCard,
      firstCardClick: v.firstCardClick,
      save: v.search?.chrome?.save,
      alerts: v.search?.chrome?.alerts,
      sort: v.search?.chrome?.sort,
      count: v.search?.chrome?.count,
      sortClippedByHeader: v.search?.chrome?.sortClippedByHeader,
      countClippedByHeader: v.search?.chrome?.countClippedByHeader,
      headerBottom: v.search?.chrome?.headerBottom,
      mapList: v.search?.chrome?.mapList,
      mapListOverlappedByChips: v.search?.mapListOverlappedByChips,
      chipRow: v.search?.chrome?.chipRow,
      saveDialog: v.saveDialog,
    }
  }
  console.log(JSON.stringify({ base: BASE, prefix: PREFIX, summary }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
