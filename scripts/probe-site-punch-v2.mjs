#!/usr/bin/env node
/**
 * Reproduce the served FLEET-PUNCH site slice (8 homepage chrome/hero lines).
 *
 *   node scripts/probe-site-punch-v2.mjs
 *   BASE_URL=https://ryan-realty.com PREFIX=before_ node scripts/probe-site-punch-v2.mjs
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

async function measureClosed(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const h1 = document.querySelector('h1')
    const h1r = h1?.getBoundingClientRect()
    const chrome = document.querySelector('.v3-chrome')
    const chromeBar = document.querySelector('.v3-chrome__bar')
    const overlay = document.querySelector('.v3-chrome__overlay')
    const overlayBar = document.querySelector('.v3-chrome__overlay-bar')
    const quiz = [...document.querySelectorAll('a,button,[role="link"]')].filter((el) =>
      /^(Buy|Sell|Look)$/.test(text(el)),
    )
    const heroCtas = [...document.querySelectorAll('a,button')].filter((el) => {
      const t = text(el)
      return /^(Search|See homes|Value my home|SEE HOMES)/i.test(t) && el.closest('.hero, #top')
    })
    const towns = [...document.querySelectorAll('.town-row')].map((el) => {
      const fill = el.querySelector('.town-fill')
      const r = el.getBoundingClientRect()
      const cs = fill ? getComputedStyle(fill) : null
      return {
        name: text(el.querySelector('.town-name')),
        stats: text(el.querySelector('.town-stats')),
        href: el.getAttribute('href'),
        hasFill: Boolean(fill),
        bg: cs?.backgroundImage ?? 'none',
        fillOpacity: cs?.opacity ?? null,
        fillDisplay: cs?.display ?? null,
        rowH: Math.round(r.height),
        visible: r.width > 0 && r.height > 20,
      }
    })
    const comms = [...document.querySelectorAll('.comm-card')].slice(0, 6).map((el) => {
      const img = el.querySelector('img, video, .comm-img, .comm-media')
      const r = el.getBoundingClientRect()
      return {
        name: text(el.querySelector('.comm-name')),
        hasMedia: Boolean(img),
        mediaTag: img?.tagName ?? null,
        w: Math.round(r.width),
        h: Math.round(r.height),
      }
    })
    const h1Style = h1 ? getComputedStyle(h1) : null
    return {
      title: document.title,
      h1: {
        text: text(h1),
        aria: h1?.getAttribute('aria-label'),
        x: h1r ? Math.round(h1r.x) : null,
        y: h1r ? Math.round(h1r.y) : null,
        w: h1r ? Math.round(h1r.width) : null,
        h: h1r ? Math.round(h1r.height) : null,
        right: h1r ? Math.round(h1r.right) : null,
        overflow: h1Style?.overflow,
        textOverflow: h1Style?.textOverflow,
        whiteSpace: h1Style?.whiteSpace,
        clippedRight: h1r ? h1r.right > window.innerWidth - 8 : null,
        underChrome: h1r && chrome ? h1r.top < chrome.getBoundingClientRect().bottom - 4 : null,
      },
      chrome: chrome
        ? {
            h: Math.round(chrome.getBoundingClientRect().height),
            top: Math.round(chrome.getBoundingClientRect().top),
            pos: getComputedStyle(chrome).position,
            z: getComputedStyle(chrome).zIndex,
          }
        : null,
      chromeBar: chromeBar
        ? {
            h: Math.round(chromeBar.getBoundingClientRect().height),
            top: Math.round(chromeBar.getBoundingClientRect().top),
          }
        : null,
      overlay: overlay
        ? {
            hidden: overlay.hasAttribute('hidden'),
            display: getComputedStyle(overlay).display,
            opacity: getComputedStyle(overlay).opacity,
            bg: getComputedStyle(overlay).backgroundColor,
            h: Math.round(overlay.getBoundingClientRect().height),
            top: Math.round(overlay.getBoundingClientRect().top),
            z: getComputedStyle(overlay).zIndex,
          }
        : null,
      overlayBar: overlayBar
        ? {
            h: Math.round(overlayBar.getBoundingClientRect().height),
            top: Math.round(overlayBar.getBoundingClientRect().top),
            visible: overlayBar.getBoundingClientRect().height > 0 && getComputedStyle(overlay).display !== 'none',
          }
        : null,
      quiz: quiz.map((el) => ({
        text: text(el),
        href: el.getAttribute('href'),
        y: Math.round(el.getBoundingClientRect().y),
        visible: el.getBoundingClientRect().height > 0 && getComputedStyle(el).display !== 'none',
      })),
      heroCtas: heroCtas.map((el) => ({
        tag: el.tagName,
        text: text(el),
        href: el.getAttribute('href'),
        y: Math.round(el.getBoundingClientRect().y),
      })),
      towns,
      comms,
    }
  })
}

async function measureMenu(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('.v3-chrome__overlay')
    const overlayBar = document.querySelector('.v3-chrome__overlay-bar')
    const chrome = document.querySelector('.v3-chrome')
    const close = document.querySelector('.v3-chrome__close')
    const menuBtn = document.querySelector('.v3-chrome__menu-btn')
    const footer = document.querySelector('footer, .foot, .kb-root .foot')
    const review = [...document.querySelectorAll('p, blockquote, .quote, .rev')].find((el) =>
      /review|relationships|broker/i.test(el.textContent || ''),
    )
    const overlayCs = overlay ? getComputedStyle(overlay) : null
    const atCenter = overlay
      ? (() => {
          const x = Math.round(window.innerWidth / 2)
          const y = Math.round(window.innerHeight / 2)
          const el = document.elementFromPoint(x, y)
          return {
            x,
            y,
            tag: el?.tagName ?? null,
            className: typeof el?.className === 'string' ? el.className.slice(0, 120) : null,
            inOverlay: Boolean(el?.closest('.v3-chrome__overlay')),
          }
        })()
      : null
    const closeBox = close?.getBoundingClientRect()
    const closeHit = closeBox
      ? (() => {
          const x = closeBox.left + closeBox.width / 2
          const y = closeBox.top + closeBox.height / 2
          const el = document.elementFromPoint(x, y)
          return {
            x: Math.round(x),
            y: Math.round(y),
            tag: el?.tagName ?? null,
            className: typeof el?.className === 'string' ? el.className.slice(0, 120) : null,
            isClose: Boolean(el?.closest('.v3-chrome__close')),
          }
        })()
      : null
    const menuHit = menuBtn
      ? (() => {
          const r = menuBtn.getBoundingClientRect()
          const x = r.left + r.width / 2
          const y = r.top + r.height / 2
          const el = document.elementFromPoint(x, y)
          return {
            x: Math.round(x),
            y: Math.round(y),
            tag: el?.tagName ?? null,
            className: typeof el?.className === 'string' ? el.className.slice(0, 120) : null,
            isMenu: Boolean(el?.closest('.v3-chrome__menu-btn')),
            isOverlay: Boolean(el?.closest('.v3-chrome__overlay')),
          }
        })()
      : null
    return {
      overlayHidden: overlay?.hasAttribute('hidden') ?? null,
      overlayDisplay: overlayCs?.display ?? null,
      overlayOpacity: overlayCs?.opacity ?? null,
      overlayBg: overlayCs?.backgroundColor ?? null,
      overlayH: overlay ? Math.round(overlay.getBoundingClientRect().height) : null,
      overlayTop: overlay ? Math.round(overlay.getBoundingClientRect().top) : null,
      overlayZ: overlayCs?.zIndex ?? null,
      chromeH: chrome ? Math.round(chrome.getBoundingClientRect().height) : null,
      chromeTop: chrome ? Math.round(chrome.getBoundingClientRect().top) : null,
      overlayBarH: overlayBar ? Math.round(overlayBar.getBoundingClientRect().height) : null,
      overlayBarTop: overlayBar ? Math.round(overlayBar.getBoundingClientRect().top) : null,
      footerVisibleThrough: footer
        ? footer.getBoundingClientRect().top < window.innerHeight &&
          getComputedStyle(footer).visibility !== 'hidden'
        : null,
      reviewSample: review ? (review.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) : null,
      atCenter,
      closeHit,
      menuHit,
    }
  })
}

async function shot(page, name) {
  const path = `${ART}/${PREFIX}${name}.png`
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
  await page.waitForTimeout(1800)
  await dismissChrome(page)
  const closedTop = await measureClosed(page)
  const topShot = await shot(page, `home_${width}_top`)

  await page.evaluate(() => window.scrollTo(0, 220))
  await page.waitForTimeout(400)
  const afterScroll = await measureClosed(page)
  const scrollShot = await shot(page, `home_${width}_scrolled`)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)

  const townsEl = page.locator('.town-row').first()
  if (await townsEl.count()) {
    await townsEl.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
  }
  const townsMeasure = await measureClosed(page)
  const townsShot = await shot(page, `home_${width}_towns`)

  const commEl = page.locator('.comm-card').first()
  if (await commEl.count()) {
    await commEl.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
  }
  const commMeasure = await measureClosed(page)
  const commShot = await shot(page, `home_${width}_comms`)

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  const menuBtn = page.locator('.v3-chrome__menu-btn').first()
  let menuOpen = null
  let menuShot = null
  let closeClick = null
  if (await menuBtn.count()) {
    await menuBtn.click({ timeout: 3000 }).catch((err) => {
      menuOpen = { openError: String(err) }
    })
    await page.waitForTimeout(600)
    menuOpen = { ...(menuOpen || {}), ...(await measureMenu(page)) }
    menuShot = await shot(page, `home_${width}_menu`)
    const closeBtn = page.locator('.v3-chrome__close').first()
    if (await closeBtn.count()) {
      const clicked = await closeBtn.click({ timeout: 3000 }).then(() => true).catch((err) => String(err))
      await page.waitForTimeout(400)
      closeClick = {
        clicked,
        after: await measureMenu(page),
      }
    } else {
      closeClick = { clicked: false, reason: 'no close button' }
    }
  }

  await context.close()
  return {
    width,
    closedTop,
    afterScroll,
    townsMeasure,
    commMeasure,
    menuOpen,
    closeClick,
    shots: { topShot, scrollShot, townsShot, commShot, menuShot },
  }
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const out = { fetchedAt: new Date().toISOString(), base: BASE, prefix: PREFIX, viewports: {} }
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    out.viewports[String(w)] = await runViewport(browser, w, h)
  }
  await browser.close()
  writeFileSync(`${ART}/${PREFIX}site_punch_v2.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
