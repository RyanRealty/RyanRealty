/**
 * Reproduce/accept the homepage ArrivalIntent strip at 390 + 1280.
 *
 *   node scripts/probe-arrival-intent-prod.mjs
 *   BASE_URL=http://127.0.0.1:3000 PREFIX=after_ node scripts/probe-arrival-intent-prod.mjs
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

async function measure(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const quiz = [...document.querySelectorAll('a,button')].filter((el) =>
      /^(Buy|Sell|Look)$/.test(text(el)),
    )
    const header = document.querySelector('header')
    const headerLinks = header
      ? [...header.querySelectorAll('a')].map((a) => text(a)).filter(Boolean)
      : []
    const hero = document.querySelector('h1')
    const heroY = hero ? Math.round(hero.getBoundingClientRect().y) : null
    const quizNav = document.querySelector('nav[aria-label="What are you trying to do"]')
    return {
      title: document.title,
      headerH: header ? Math.round(header.getBoundingClientRect().height) : null,
      headerY: header ? Math.round(header.getBoundingClientRect().y) : null,
      headerLinks: headerLinks.slice(0, 12),
      hero: hero ? text(hero).slice(0, 120) : null,
      heroY,
      quizNav: Boolean(quizNav),
      quizNavY: quizNav ? Math.round(quizNav.getBoundingClientRect().y) : null,
      quiz: quiz.slice(0, 6).map((el) => ({
        text: text(el),
        href: el.getAttribute('href'),
        y: Math.round(el.getBoundingClientRect().y),
        inHeader: Boolean(header && header.contains(el)),
      })),
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
  const data = await measure(page)
  const shot = `${ART}/${PREFIX}home_${width}_top.png`
  await page.screenshot({ path: shot, fullPage: false })
  await context.close()
  return { width, height, shot, ...data }
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  })
  const out = { fetchedAt: new Date().toISOString(), base: BASE, prefix: PREFIX, viewports: {} }
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    out.viewports[String(w)] = await runViewport(browser, w, h)
  }
  await browser.close()
  writeFileSync(`${ART}/${PREFIX}arrival_intent_probe.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
