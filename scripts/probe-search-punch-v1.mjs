#!/usr/bin/env node
/**
 * Reproduce / accept the FLEET-PUNCH search slice (8 lines).
 *
 *   node scripts/probe-search-punch-v1.mjs
 *   BASE_URL=https://ryan-realty.com PREFIX=before_ node scripts/probe-search-punch-v1.mjs
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
      await page.waitForTimeout(300)
    }
  }
}

async function inspectSearch(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const h1 = document.querySelector('h1')
    const body = document.body.innerText
    const buttons = [...document.querySelectorAll('button, a, [role="button"]')].map((el) => ({
      tag: el.tagName,
      text: text(el).slice(0, 80),
      href: el.getAttribute('href'),
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
      display: getComputedStyle(el).display,
      parentDisplay: el.parentElement ? getComputedStyle(el.parentElement).display : null,
    }))
    const chipLabels = ['Beds', 'Baths', 'Price', 'For sale', 'Home type', 'All filters']
    const chips = chipLabels.map((label) => {
      const el = [...document.querySelectorAll('button, [role="button"]')].find((n) =>
        new RegExp(`^${label}`, 'i').test(text(n)),
      )
      if (!el) return { label, found: false }
      const r = el.getBoundingClientRect()
      const parent = el.parentElement
      return {
        label,
        found: true,
        w: Math.round(r.width),
        h: Math.round(r.height),
        display: getComputedStyle(el).display,
        parentDisplay: parent ? getComputedStyle(parent).display : null,
        visible: r.width > 0 && r.height > 0,
        text: text(el).slice(0, 60),
      }
    })
    const save = buttons.filter((b) => /save this search|search saved|save search/i.test(b.text))
    const alerts = buttons.filter((b) => /\balerts?\b|get alerts/i.test(b.text))
    const timeout = /search took too long/i.test(body)
    const summerfield = [...document.querySelectorAll('a')].filter((a) =>
      /summerfield/i.test(text(a)),
    )
    const rainier = [...document.querySelectorAll('a')].filter((a) => /rainier/i.test(text(a)))
    const cards = [...document.querySelectorAll('a')].filter((a) =>
      /homes-for-sale|\/listing\//.test(a.getAttribute('href') || ''),
    )
    const cardSnips = cards.slice(0, 12).map((a) => ({
      href: a.getAttribute('href'),
      text: text(a).slice(0, 180),
      price: (text(a).match(/\$[\d,]+/) || [])[0] || null,
    }))
    const summerfieldCard = summerfield[0]
      ? {
          href: summerfield[0].getAttribute('href'),
          text: text(summerfield[0]).slice(0, 240),
          price: (text(summerfield[0]).match(/\$[\d,]+/) || [])[0] || null,
        }
      : null
    const rainierCard = rainier[0]
      ? {
          href: rainier[0].getAttribute('href'),
          text: text(rainier[0]).slice(0, 240),
        }
      : null
    const history = [...document.querySelectorAll('h2,h3,section,[id]')].filter((el) =>
      /price history|status history/i.test(text(el) + (el.id || '')),
    )
    return {
      title: text(h1),
      dest: text(h1).slice(0, 120),
      timeout,
      bodyHead: body.replace(/\s+/g, ' ').trim().slice(0, 400),
      chips,
      save: save.slice(0, 6),
      alerts: alerts.slice(0, 6),
      summerfieldCard,
      rainierCard,
      cardSnips,
      history: history.slice(0, 6).map((el) => ({
        tag: el.tagName,
        id: el.id,
        text: text(el).slice(0, 80),
      })),
      url: location.href,
    }
  })
}

async function inspectListing(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const h1 = document.querySelector('h1')
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((el) => {
      try {
        return JSON.parse(el.textContent || '{}')
      } catch {
        return null
      }
    })
    const offers = jsonLd.flatMap((block) => {
      const nodes = Array.isArray(block) ? block : [block]
      return nodes.flatMap((n) => {
        if (!n) return []
        if (n.offers) return [n.offers]
        if (n['@graph']) return n['@graph'].flatMap((g) => (g?.offers ? [g.offers] : []))
        return []
      })
    })
    const history = [...document.querySelectorAll('h2,h3,[id]')].filter((el) =>
      /price history|status history/i.test(text(el) + (el.id || '')),
    )
    return {
      title: text(h1),
      h1Price: (text(h1).match(/\$[\d,]+/) || [])[0] || null,
      offerPrices: offers.map((o) => o.price ?? o.lowPrice ?? null),
      history: history.slice(0, 8).map((el) => ({
        tag: el.tagName,
        id: el.id,
        text: text(el).slice(0, 80),
      })),
      url: location.href,
    }
  })
}

async function inspectSheet(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return { open: false }
    const r = dialog.getBoundingClientRect()
    const overflowing = [...dialog.querySelectorAll('label, span, p, button')].filter((el) => {
      const box = el.getBoundingClientRect()
      return box.right > r.right + 2 && box.width > 20
    })
    const owner = [...dialog.querySelectorAll('label, span')].find((el) =>
      /owner finan/i.test(text(el)),
    )
    return {
      open: true,
      w: Math.round(r.width),
      h: Math.round(r.height),
      overflowX: getComputedStyle(dialog).overflowX,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
      scrollWidth: dialog.scrollWidth,
      clientWidth: dialog.clientWidth,
      clipped: dialog.scrollWidth > dialog.clientWidth + 2,
      overflowing: overflowing.slice(0, 8).map((el) => ({
        text: text(el).slice(0, 60),
        right: Math.round(el.getBoundingClientRect().right),
        dialogRight: Math.round(r.right),
      })),
      owner: owner
        ? {
            text: text(owner),
            w: Math.round(owner.getBoundingClientRect().width),
            right: Math.round(owner.getBoundingClientRect().right),
            dialogRight: Math.round(r.right),
            clipped: owner.getBoundingClientRect().right > r.right + 1,
          }
        : null,
      labels: [...dialog.querySelectorAll('label')]
        .slice(0, 20)
        .map((el) => text(el).slice(0, 40)),
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
    const key = `w${width}`
    report.views[key] = {}

    const bendRes = await page.goto(`${BASE}/homes-for-sale/bend`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2500)
    await dismissChrome(page)
    const bend = await inspectSearch(page)
    report.views[key].bendHttp = bendRes?.status() ?? null
    report.views[key].bend = bend
    await shot(page, `${PREFIX}bend_${width}_top`)

    if (bend.summerfieldCard?.href) {
      const listingRes = await page.goto(new URL(bend.summerfieldCard.href, BASE).toString(), {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      })
      await page.waitForTimeout(1500)
      await dismissChrome(page)
      report.views[key].summerfieldListingHttp = listingRes?.status() ?? null
      report.views[key].summerfieldListing = await inspectListing(page)
      await shot(page, `${PREFIX}summerfield_${width}_h1`)
    }

    const searchRes = await page.goto(`${BASE}/homes-for-sale`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2500)
    await dismissChrome(page)
    const search = await inspectSearch(page)
    report.views[key].searchHttp = searchRes?.status() ?? null
    report.views[key].search = search
    await shot(page, `${PREFIX}search_${width}_top`)

    const allFilters = page.getByRole('button', { name: /all filters/i }).first()
    if (await allFilters.isVisible().catch(() => false)) {
      await allFilters.click()
      await page.waitForTimeout(800)
      report.views[key].sheet = await inspectSheet(page)
      await shot(page, `${PREFIX}search_${width}_filters`)

      const beds3 = page.getByRole('button', { name: /^3\+$/ }).first()
      if (await beds3.isVisible().catch(() => false)) {
        await beds3.click().catch(() => {})
        await page.waitForTimeout(200)
      }
      const maxPrice = page.getByLabel(/max price/i).first()
      if (await maxPrice.isVisible().catch(() => false)) {
        await maxPrice.fill('800000').catch(() => {})
        await page.waitForTimeout(200)
      }
      report.views[key].sheetDraftUrl = page.url()
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
      report.views[key].afterDismissUrl = page.url()
      report.views[key].afterDismiss = await inspectSearch(page)
      await shot(page, `${PREFIX}search_${width}_after_dismiss`)
    }

    const soldStarted = Date.now()
    const soldRes = await page.goto(`${BASE}/homes-for-sale?status=Sold`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(4000)
    await dismissChrome(page)
    const sold = await inspectSearch(page)
    report.views[key].soldHttp = soldRes?.status() ?? null
    report.views[key].soldMs = Date.now() - soldStarted
    report.views[key].sold = sold
    await shot(page, `${PREFIX}sold_${width}_top`)

    if (search.rainierCard?.href) {
      const rainierRes = await page.goto(new URL(search.rainierCard.href, BASE).toString(), {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      })
      await page.waitForTimeout(1500)
      await dismissChrome(page)
      report.views[key].rainierListingHttp = rainierRes?.status() ?? null
      report.views[key].rainierListing = await inspectListing(page)
      await shot(page, `${PREFIX}rainier_${width}_top`)
    } else {
      const rainierSearch = await page.goto(`${BASE}/homes-for-sale?q=2736+Rainier`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      })
      await page.waitForTimeout(2000)
      report.views[key].rainierSearchHttp = rainierSearch?.status() ?? null
      report.views[key].rainierSearch = await inspectSearch(page)
    }

    await page.close()
  }
  await browser.close()

  writeFileSync(`${ART}/${PREFIX}search_punch_v1.json`, JSON.stringify(report, null, 2))
  const summary = {}
  for (const width of [390, 1280]) {
    const v = report.views[`w${width}`]
    summary[width] = {
      bendHttp: v.bendHttp,
      bendTitle: v.bend?.title,
      summerfieldCard: v.bend?.summerfieldCard,
      summerfieldH1: v.summerfieldListing?.h1Price,
      summerfieldOffers: v.summerfieldListing?.offerPrices,
      searchHttp: v.searchHttp,
      chips: v.search?.chips,
      save: v.search?.save,
      alerts: v.search?.alerts,
      sheet: v.sheet,
      afterDismissUrl: v.afterDismissUrl,
      afterDismissChips: v.afterDismiss?.chips,
      soldHttp: v.soldHttp,
      soldTimeout: v.sold?.timeout,
      soldTitle: v.sold?.title,
      soldHead: v.sold?.bodyHead,
      rainierCard: v.search?.rainierCard,
      rainierHistory: v.rainierListing?.history ?? v.search?.history,
      rainierSearch: v.rainierSearch?.rainierCard ?? null,
    }
  }
  console.log(JSON.stringify({ base: BASE, prefix: PREFIX, summary }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
