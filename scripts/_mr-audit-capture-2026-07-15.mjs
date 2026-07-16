#!/usr/bin/env node
// 2026-07-15 market-report conversion audit — asset capture.
// Captures the homeowner-recipient journey as it exists BEFORE this session's fixes.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('/Users/matthewryan/RyanRealty/package.json')
const { chromium } = require('playwright')

const OUT = '/Users/matthewryan/RyanRealty/docs/design-audit/assets'
mkdirSync(OUT, { recursive: true })
const BASE = 'http://localhost:3000'
const shots = []

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` })
  shots.push(name)
}

const browser = await chromium.launch()

// ── Mobile context, prompts suppressed (clean content shots) ────────────────
const mob = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  reducedMotion: 'reduce', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
await mob.addInitScript(() => {
  try { localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now())) } catch {}
  try { localStorage.setItem('rr_consent', JSON.stringify({ level: 'essential', at: Date.now() })) } catch {}
})
const p = await mob.newPage()

// 1. The CMA document (what the expired-outreach SMS links to)
await p.goto(`${BASE}/cma/cma-55438-heierman`, { waitUntil: 'networkidle' })
await shoot(p, 'mr-cma-mobile-01-top')
await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(400)
await shoot(p, 'mr-cma-mobile-02-value')
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 844)); await p.waitForTimeout(400)
await shoot(p, 'mr-cma-mobile-03-end')

// 2. The market-report email (real Bend figures, exact renderer)
await p.goto(`${BASE}/__audit-preview/mr-email-preview.html`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.screenshot({ path: `${OUT}/mr-email-mobile-full.png`, fullPage: true }); shots.push('mr-email-mobile-full')

// 3. /cities/bend — the email CTA destination
await p.goto(`${BASE}/cities/bend`, { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
await shoot(p, 'mr-cities-bend-mobile-01-hero')
await p.evaluate(() => window.scrollTo(0, 1764)); await p.waitForTimeout(600)
await shoot(p, 'mr-cities-bend-mobile-02-market')
await p.evaluate(() => window.scrollTo(0, 19832)); await p.waitForTimeout(600)
await shoot(p, 'mr-cities-bend-mobile-03-kbsell-24-screens-deep')

// 4. /communities/tetherow — resort report destination
await p.goto(`${BASE}/communities/tetherow`, { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
await shoot(p, 'mr-tetherow-mobile-01-hero')
await p.evaluate(() => window.scrollTo(0, 3686)); await p.waitForTimeout(600)
await shoot(p, 'mr-tetherow-mobile-02-market')

// 5. Weekly report page — breadcrumb collision + AI banner
await p.goto(`${BASE}/reports/weekly-2026-06-28`, { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
await shoot(p, 'mr-weekly-report-mobile-01-top')
await p.evaluate(() => window.scrollTo(0, 820)); await p.waitForTimeout(400)
await shoot(p, 'mr-weekly-report-mobile-02-ai-banner')
await mob.close()

// ── Fresh mobile context, NO suppression — the real second-pageview modal ──
const mob2 = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  reducedMotion: 'reduce',
})
const p2 = await mob2.newPage()
await p2.goto(`${BASE}/cities/bend?agent=matt`, { waitUntil: 'networkidle' })
await p2.waitForTimeout(1600)
await shoot(p2, 'mr-cities-bend-mobile-04-first-pageview')
// second pageview: the recipient taps deeper — modal fires here
await p2.goto(`${BASE}/cities/bend/awbrey-butte`, { waitUntil: 'networkidle' })
await p2.waitForTimeout(2200)
await shoot(p2, 'mr-cities-bend-mobile-05-modal-second-pageview')
await mob2.close()

// ── Desktop context ─────────────────────────────────────────────────────────
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, reducedMotion: 'reduce' })
await desk.addInitScript(() => {
  try { localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now())) } catch {}
})
const d = await desk.newPage()
await d.goto(`${BASE}/cities/bend`, { waitUntil: 'networkidle' }); await d.waitForTimeout(800)
await shoot(d, 'mr-cities-bend-desktop-hero')
await d.goto(`${BASE}/__audit-preview/mr-email-preview.html`, { waitUntil: 'networkidle' }); await d.waitForTimeout(1000)
await d.screenshot({ path: `${OUT}/mr-email-desktop-full.png`, fullPage: true }); shots.push('mr-email-desktop-full')
await d.goto(`${BASE}/cma/cma-55438-heierman`, { waitUntil: 'networkidle' })
await shoot(d, 'mr-cma-desktop-top')
await desk.close()

await browser.close()
console.log('CAPTURED', shots.length, 'shots:', shots.join(', '))
