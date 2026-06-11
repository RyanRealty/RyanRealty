/**
 * Captures three screenshots of the editorial mega-menu:
 *   out/menu-areas.png   — Desktop 1440 × Areas panel open
 *   out/menu-homes.png   — Desktop 1440 × Homes panel open
 *   out/menu-mobile.png  — Mobile 390 × Sheet drawer open
 *
 * Requires: playwright (already a dev dep), the Next.js dev server on port 3000.
 * Animations disabled for stable shots (prefers-reduced-motion pattern).
 */

import { chromium } from '@playwright/test'
import { mkdir } from 'fs/promises'

const BASE = 'http://localhost:3000'
const ANIMATIONS_OFF = `
  *, *::before, *::after {
    animation-duration: 0ms !important;
    animation-delay: 0ms !important;
    transition-duration: 0ms !important;
    transition-delay: 0ms !important;
  }
`
// Real browser UA to bypass the bot screen
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

await mkdir('out', { recursive: true })

const browser = await chromium.launch({ headless: true })

/** Dismiss any modal overlay (sign-in prompt, cookie banner, etc.) */
async function dismissOverlays(page) {
  // Hide any fixed/absolute overlays that might block clicks
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"], [aria-modal="true"]').forEach((el) => {
      el.remove()
    })
    // Also remove any backdrop overlays
    document.querySelectorAll('[class*="bg-primary/50"], [class*="inset-0"][class*="fixed"]').forEach((el) => {
      el.remove()
    })
  })
  await page.waitForTimeout(200)
}

// ── Desktop: Areas panel ──────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: UA,
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.addStyleTag({ content: ANIMATIONS_OFF })
  await dismissOverlays(page)

  // Click the Explore trigger (third button in the primary nav)
  const exploreTrigger = page.getByRole('navigation', { name: 'Primary' })
    .getByRole('button', { name: /Explore/i })
  await exploreTrigger.click()
  await page.waitForTimeout(400)

  // Clip to the header + open panel
  await page.screenshot({
    path: 'out/menu-areas.png',
    clip: { x: 0, y: 0, width: 1440, height: 600 },
  })
  await ctx.close()
  console.log('✓ out/menu-areas.png')
}

// ── Desktop: Homes panel ──────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: UA,
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.addStyleTag({ content: ANIMATIONS_OFF })
  await dismissOverlays(page)

  const homesTrigger = page.getByRole('navigation', { name: 'Primary' })
    .getByRole('button', { name: /Homes/i })
  await homesTrigger.click()
  await page.waitForTimeout(400)

  await page.screenshot({
    path: 'out/menu-homes.png',
    clip: { x: 0, y: 0, width: 1440, height: 550 },
  })
  await ctx.close()
  console.log('✓ out/menu-homes.png')
}

// ── Mobile: Sheet drawer open ─────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.addStyleTag({ content: ANIMATIONS_OFF })
  await dismissOverlays(page)

  // Open the hamburger
  const hamburger = page.getByRole('button', { name: /Open navigation menu/i })
  await hamburger.click()
  await page.waitForTimeout(500)

  await page.screenshot({ path: 'out/menu-mobile.png', fullPage: false })
  await ctx.close()
  console.log('✓ out/menu-mobile.png')
}

await browser.close()
console.log('All menu screenshots done.')
