#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_'
const CASES = [
  { id: 'bend-park', url: 'https://ryan-realty.com/subdivisions/bend-park' },
  { id: 'braydon-park', url: 'https://ryan-realty.com/subdivisions/braydon-park' },
  { id: 'breckenridge', url: 'https://ryan-realty.com/subdivisions/breckenridge' },
  { id: 'redmond', url: 'https://ryan-realty.com/cities/redmond' },
  { id: 'bradetich-park', url: 'https://ryan-realty.com/subdivisions/bradetich-park' },
  { id: 'crosswater', url: 'https://ryan-realty.com/central-oregon/golf/crosswater' },
  { id: 'tetherow-golf', url: 'https://ryan-realty.com/central-oregon/golf/tetherow-golf-club' },
  { id: 'brookswood-estates', url: 'https://ryan-realty.com/subdivisions/brookswood-estates' },
]

mkdirSync(ART, { recursive: true })

async function runViewport(browser, width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  page.setDefaultTimeout(90_000)
  const rows = {}
  for (const c of CASES) {
    const rec = { id: c.id, url: c.url }
    try {
      const res = await page.goto(c.url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      rec.status = res?.status() ?? null
      rec.finalUrl = page.url()
      rec.titleAfterLoad = await page.title()
      await page.waitForSelector('h1', { timeout: 20_000 }).catch(() => null)
      await page.waitForTimeout(1500)
      rec.crashed = page.isClosed()
      rec.shotTop = `${ART}/${PREFIX}${c.id}_${width}.png`
      await page.screenshot({ path: rec.shotTop, fullPage: false })
      rec.metrics = await page.evaluate(() => {
        const body = document.body.innerText.replace(/\s+/g, ' ')
        const h1 = document.querySelector('h1')
        const h1Box = h1?.getBoundingClientRect()
        const mapEl = document.querySelector('.v3-field__map')
        const mapBox = mapEl?.getBoundingClientRect()
        const mapImgs = mapEl
          ? [...mapEl.querySelectorAll('img')].filter((img) => {
              const src = img.currentSrc || img.src || ''
              return /google|gstatic|maps/i.test(src)
            })
          : []
        const canvas = mapEl?.querySelector('canvas')
        const canvasBox = canvas?.getBoundingClientRect()
        const heroMedian = body.match(/\$[\d,]+ median list price of those homes/i)?.[0] ?? null
        const faqMedian =
          body.match(
            /Are there homes for sale near[\s\S]{0,220}?median list price around \$[\d,]+/i,
          )?.[0] ?? null
        return {
          title: document.title,
          h1: h1?.textContent?.trim() ?? null,
          h1Visible: Boolean(h1 && h1Box && h1Box.height > 0 && h1Box.width > 0),
          h1Top: h1Box ? Math.round(h1Box.top) : null,
          pageNotFound: /Page not found/i.test(body),
          emptyState: /No active listings/i.test(body),
          salesHistory: /sales history/i.test(body),
          listingCards: document.querySelectorAll(
            '[data-listing-card], a[href*="/homes-for-sale/"]',
          ).length,
          awSnap: /Aw,? Snap|Something went wrong while displaying this webpage/i.test(body),
          showingHomes: body.match(/Showing \d+ of \d+ homes/i)?.[0] ?? null,
          heroMedian,
          faqMedian,
          mapClass: mapEl?.className?.toString?.().slice(0, 160) ?? null,
          mapPending: Boolean(mapEl?.querySelector('.v3-field__map-pending')),
          mapLoading: Boolean(mapEl?.querySelector('.v3-field__map-loading')),
          mapBox: mapBox
            ? { w: Math.round(mapBox.width), h: Math.round(mapBox.height), top: Math.round(mapBox.top) }
            : null,
          googleTiles: mapImgs.length,
          canvasBox: canvasBox
            ? {
                w: Math.round(canvasBox.width),
                h: Math.round(canvasBox.height),
                top: Math.round(canvasBox.top),
              }
            : null,
          chromeOnly:
            !document.querySelector('h1') &&
            !/No active listings/i.test(body) &&
            !/sales history/i.test(body) &&
            !/Page not found/i.test(body),
        }
      })
      if (c.id === 'crosswater' || c.id === 'tetherow-golf') {
        const map = page.locator('.v3-field__map').first()
        if (await map.count()) {
          await map.scrollIntoViewIfNeeded()
          await page
            .waitForFunction(
              () => {
                const el = document.querySelector('.v3-field__map')
                if (!el) return false
                const tiles = el.querySelectorAll(
                  'img[src*="googleapis"], img[src*="gstatic"], img[src*="maps"]',
                )
                const canvas = el.querySelector('canvas')
                return tiles.length >= 4 || Boolean(canvas && canvas.width > 20)
              },
              { timeout: 12_000 },
            )
            .catch(() => null)
          await page.waitForTimeout(800)
          rec.metrics = {
            ...rec.metrics,
            ...(await page.evaluate(() => {
              const el = document.querySelector('.v3-field__map')
              const box = el?.getBoundingClientRect()
              const tiles = el
                ? [...el.querySelectorAll('img')].filter((img) =>
                    /google|gstatic|maps/i.test(img.currentSrc || img.src || ''),
                  )
                : []
              const canvas = el?.querySelector('canvas')
              const canvasBox = canvas?.getBoundingClientRect()
              const body = document.body.innerText.replace(/\s+/g, ' ')
              return {
                mapAfterWait: {
                  w: box ? Math.round(box.width) : null,
                  h: box ? Math.round(box.height) : null,
                  top: box ? Math.round(box.top) : null,
                  googleTiles: tiles.length,
                  pending: Boolean(el?.querySelector('.v3-field__map-pending')),
                  loading: Boolean(el?.querySelector('.v3-field__map-loading')),
                  canvas: canvasBox
                    ? { w: Math.round(canvasBox.width), h: Math.round(canvasBox.height) }
                    : null,
                },
                heroMedian:
                  body.match(/\$[\d,]+ median list price of those homes/i)?.[0] ?? null,
                faqMedian:
                  body.match(
                    /Are there homes for sale near[\s\S]{0,220}?median list price around \$[\d,]+/i,
                  )?.[0] ?? null,
              }
            })),
          }
          rec.shotMap = `${ART}/${PREFIX}${c.id}_${width}_map.png`
          await page.screenshot({ path: rec.shotMap, fullPage: false })
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
      rec.crashed = /crash|Target closed|Aw,? Snap/i.test(rec.error)
      try {
        rec.shotError = `${ART}/${PREFIX}${c.id}_${width}_error.png`
        await page.screenshot({ path: rec.shotError, fullPage: false })
      } catch {
        /* page may be gone */
      }
    }
    rows[c.id] = rec
    console.log(
      JSON.stringify({
        w: width,
        id: c.id,
        status: rec.status,
        metrics: rec.metrics,
        error: rec.error,
        crashed: rec.crashed,
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
  writeFileSync(`${ART}/${PREFIX}place_pages_v12.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/${PREFIX}place_pages_v12.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
