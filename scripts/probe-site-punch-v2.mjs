#!/usr/bin/env node
/**
 * Reproduce the served FLEET-PUNCH site slice (8 homepage lines) at 390+1280.
 *
 *   node scripts/probe-site-punch-v2.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'

function contrastRatio(fg, bg) {
  const lum = (c) => {
    const s = c.map((v) => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]
  }
  const L1 = lum(fg)
  const L2 = lum(bg)
  const hi = Math.max(L1, L2)
  const lo = Math.min(L1, L2)
  return (hi + 0.05) / (lo + 0.05)
}

function parseRgb(str) {
  const m = String(str || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

async function dismissChrome(page) {
  for (const label of ['Not now', 'Essential only', 'Accept all', 'NOT NOW']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(300)
    }
  }
}

async function measureHome(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0,
      }
    }
    const overlaps = (a, b) => {
      if (!a || !b) return false
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    }
    const css = (el, prop) => (el ? getComputedStyle(el)[prop] : null)

    const hero = document.querySelector('.hero, section.hero, .kb-hero, [class*="hero"]')
    const h1 = document.querySelector('h1')
    const heroSection = h1?.closest('section') || hero
    const heroText = text(heroSection)

    const heroCtas = [...(heroSection?.querySelectorAll('a, button') || [])]
      .map((el) => {
        const r = el.getBoundingClientRect()
        const st = getComputedStyle(el)
        return {
          text: text(el),
          href: el.getAttribute('href'),
          tag: el.tagName,
          className: el.className,
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
          bg: st.backgroundColor,
          color: st.color,
          border: st.borderColor,
          fontWeight: st.fontWeight,
          visible: r.width > 0 && r.height > 8,
        }
      })
      .filter((x) => x.visible && /see homes|value my home|search/i.test(x.text))

    const searchBtn = [...(heroSection?.querySelectorAll('button') || [])]
      .map((el) => ({ text: text(el), className: el.className, box: box(el) }))
      .filter((x) => /search/i.test(x.text))

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
        box: box(el),
      }
    })

    const comm = document.querySelector('#communities, section.comm')
    const commHead = comm?.querySelector('.sec-head, h2')
    const commHint = comm?.querySelector('.comm-hint')
    const commCta = comm
      ? [...comm.querySelectorAll('a')].find((a) => /see every community/i.test(text(a)))
      : null
    const commCards = comm
      ? [...comm.querySelectorAll('.comm-card, a')].filter((el) => el.classList.contains('comm-card') || /active|community guide/i.test(text(el)))
      : []
    const featuredCards = [...document.querySelectorAll('.lst-card, .comm-card, [id*="featured"] a, #featured-plats a')].map((el) => ({
      text: text(el).slice(0, 80),
      href: el.getAttribute('href'),
      hasZeroActive: /0\s*active/i.test(text(el)),
      box: box(el),
    }))

    const watching = [...document.querySelectorAll('[role="region"], [class*="watch"], [aria-label*="watching" i], [aria-label*="alert" i]')]
      .map((el) => ({
        label: el.getAttribute('aria-label'),
        text: text(el).slice(0, 160),
        box: box(el),
        visible: Boolean(box(el)?.visible),
      }))
      .filter((x) => /watching|not now|manage in account/i.test(`${x.label} ${x.text}`))

    const platTiles = [...document.querySelectorAll('#featured-plats a, [id*="plat"] a, .plat-card')].map((el) => ({
      text: text(el).slice(0, 100),
      href: el.getAttribute('href'),
      zero: /0\s*active/i.test(text(el)),
    }))

    const bodyZeroActive = (document.body.innerText.match(/0\s*ACTIVE/gi) || []).length
    const heroCount = heroText.match(/([\d,]+)\s+homes/i)?.[1] ?? null
    const townSum = towns.reduce((n, t) => {
      const m = t.stats.match(/([\d,]+)/)
      return n + (m ? Number(m[1].replace(/,/g, '')) : 0)
    }, 0)

    return {
      title: document.title,
      heroText: heroText.slice(0, 420),
      heroCount,
      heroCtas,
      searchBtn,
      towns,
      townSum,
      townCount: towns.length,
      comm: comm
        ? {
            head: text(commHead).slice(0, 80),
            hint: text(commHint),
            hintColor: commHint ? getComputedStyle(commHint).color : null,
            hintBg: comm ? getComputedStyle(comm).backgroundColor : null,
            headColor: commHead ? getComputedStyle(commHead).color : null,
            cta: commCta
              ? {
                  text: text(commCta),
                  box: box(commCta),
                  color: getComputedStyle(commCta).color,
                  bg: getComputedStyle(commCta).backgroundColor,
                }
              : null,
            headBox: box(commHead),
            hintBox: box(commHint),
            cardCount: commCards.length,
            cards: commCards.slice(0, 16).map((el) => ({
              text: text(el).slice(0, 90),
              href: el.getAttribute('href'),
              zero: /0\s*active/i.test(text(el)),
            })),
          }
        : null,
      featuredCards: featuredCards.slice(0, 20),
      featuredZero: featuredCards.filter((c) => c.hasZeroActive).length,
      featuredCount: featuredCards.length,
      platTiles,
      bodyZeroActive,
      watching,
      watchingVisible: watching.some((w) => w.visible),
    }
  })
}

async function shot(page, name) {
  const path = `${ART}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  return path
}

async function runViewport(browser, width, height, { withResidual = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  if (withResidual) {
    await context.addInitScript(() => {
      localStorage.setItem(
        'rr_guest_alert_watch',
        JSON.stringify({ label: 'homes you chose', href: '/homes-for-sale', setAt: Date.now() }),
      )
    })
  }
  const page = await context.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1800)
  if (!withResidual) await dismissChrome(page)
  const top = await measureHome(page)
  const topShot = await shot(page, `v2_home_${width}${withResidual ? '_residual' : ''}_top`)

  const townsEl = page.locator('.town-row').first()
  if (await townsEl.count()) {
    await townsEl.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
  }
  const towns = await measureHome(page)
  const townsShot = await shot(page, `v2_home_${width}_towns`)

  const commEl = page.locator('#communities, section.comm').first()
  let commShot = null
  let commCtaShot = null
  if (await commEl.count()) {
    await commEl.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    commShot = await shot(page, `v2_home_${width}_comm`)
    const cta = page.getByRole('link', { name: /see every community/i }).first()
    if (await cta.count()) {
      await cta.scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)
      commCtaShot = await shot(page, `v2_home_${width}_comm_cta`)
    }
  }
  const comm = await measureHome(page)

  const featuredEl = page.locator('.lst-card, #featured-plats').first()
  let featuredShot = null
  if (await featuredEl.count()) {
    await featuredEl.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    featuredShot = await shot(page, `v2_home_${width}_featured`)
  }
  const featured = await measureHome(page)

  await context.close()
  return {
    width,
    withResidual,
    top,
    topShot,
    towns,
    townsShot,
    comm,
    commShot,
    commCtaShot,
    featured,
    featuredShot,
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
    out.viewports[String(w)] = await runViewport(browser, w, h, { withResidual: false })
  }
  out.residual390 = await runViewport(browser, 390, 844, { withResidual: true })
  await browser.close()

  const v390 = out.viewports['390']
  const v1280 = out.viewports['1280']
  const heroN = Number(String(v1280.top.heroCount || '').replace(/,/g, '')) || 0
  const townSum = v1280.towns.townSum
  const comm1280 = v1280.comm.comm
  const comm390 = v390.comm.comm
  const fg = comm1280?.hintColor ? parseRgb(comm1280.hintColor) : null
  const bg = comm1280?.hintBg ? parseRgb(comm1280.hintBg) : null
  const hintContrast = fg && bg ? Number(contrastRatio(fg, bg).toFixed(2)) : null
  const headFg = comm1280?.headColor ? parseRgb(comm1280.headColor) : null
  const headContrast = headFg && bg ? Number(contrastRatio(headFg, bg).toFixed(2)) : null
  const ctaBox = comm1280?.cta?.box
  const headBox = comm1280?.headBox
  const ctaOverlapsHead =
    ctaBox && headBox
      ? ctaBox.y < headBox.y + headBox.h && ctaBox.y + ctaBox.h > headBox.y
      : false

  out.verdict = {
    platZeroOnHome: {
      featuredZero390: v390.featured.featuredZero,
      featuredZero1280: v1280.featured.featuredZero,
      featuredCount390: v390.featured.featuredCount,
      featuredCount1280: v1280.featured.featuredCount,
      platTiles390: v390.featured.platTiles,
      platTiles1280: v1280.featured.platTiles,
      bodyZeroActive390: v390.top.bodyZeroActive,
      bodyZeroActive1280: v1280.top.bodyZeroActive,
      commCards1280: comm1280?.cards,
    },
    townVsHero: {
      heroCount: v1280.top.heroCount,
      townSum,
      delta: heroN - townSum,
      towns: v1280.towns.towns.map((t) => `${t.name} ${t.stats}`),
    },
    townRowsWork: {
      visible390: v390.towns.towns.filter((t) => t.visible).length,
      visible1280: v1280.towns.towns.filter((t) => t.visible).length,
      fills390: v390.towns.towns.map((t) => ({ name: t.name, hasFill: t.hasFill, opacity: t.fillOpacity, bg: (t.bg || '').slice(0, 80) })),
    },
    commOverlap: {
      ctaOverlapsHead,
      hintContrast,
      headContrast,
      cta390: comm390?.cta,
      cta1280: comm1280?.cta,
      hint390: comm390?.hint,
      hint1280: comm1280?.hint,
    },
    heroCtas: {
      ctas390: v390.top.heroCtas,
      ctas1280: v1280.top.heroCtas,
      search390: v390.top.searchBtn,
      search1280: v1280.top.searchBtn,
    },
    watching: {
      clean390: v390.top.watchingVisible,
      clean1280: v1280.top.watchingVisible,
      residual390: out.residual390.top.watchingVisible,
      residualItems: out.residual390.top.watching,
    },
  }

  writeFileSync(`${ART}/site_punch_v2.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ fetchedAt: out.fetchedAt, verdict: out.verdict }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
