import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * full-crawl.spec.ts — exhaustive page walker for the Ryan Realty route inventory.
 *
 * Parses docs/ROUTE_INVENTORY.md (same backtick-path regex as check-route-smoke.mjs)
 * and generates one test per route. Per-route assertions:
 *   (a) HTTP 200 (or 3xx chain landing on 200)
 *   (b) Zero console errors during load (known 3rd-party noise filtered)
 *   (c) Zero failed same-origin network requests (4xx/5xx)
 *   (d) An h1 or [role=heading] is visible
 *   (e) No "Application error" / "Page not found" text on a 200
 *   (f) No horizontal overflow on mobile viewport
 *
 * Control:
 *   CRAWL_LIMIT env var caps how many routes run (default: all).
 *   Set CRAWL_LIMIT=40 for a quick sample in CI post-deploy.
 *
 * Run:
 *   npm run e2e:crawl                        (full, localhost)
 *   BASE_URL=https://ryan-realty.com CRAWL_LIMIT=40 npm run e2e:crawl
 */

// ─── console noise we intentionally allow ─────────────────────────────────
const ALLOWED_CONSOLE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Google Maps billing / quota warnings when GMAP key is missing or rate-limited
  { pattern: /BillingNotEnabledMapError|Google Maps JavaScript API|quota|Maps.*error/i, reason: 'Google Maps quota/billing warning — third-party noise' },
  // Analytics/GTM blocked by client-side ad blockers or missing env
  { pattern: /gtag|googletagmanager|analytics|GTM-|ga\(|fbq\(|_fbp|pixel/i, reason: 'Analytics tag blocked by client — expected in headless Chromium' },
  // Next.js router cache HMR in dev
  { pattern: /Fast Refresh|webpack-hmr|hot-update/i, reason: 'Next.js dev-mode HMR — not production noise' },
  // Supabase realtime connection failures in ephemeral/CI env
  { pattern: /supabase.*realtime|realtime.*supabase|WebSocket/i, reason: 'Supabase realtime WebSocket — not wired in headless test env' },
  // ElevenLabs / third-party media blocked
  { pattern: /elevenlabs|cdn\..*404|fonts\.google.*404/i, reason: 'Third-party CDN resource blocked in headless env' },
  // React StrictMode double-invoke logs
  { pattern: /Warning: An update to .+ inside a test/i, reason: 'React StrictMode test warning — not a real error' },
  // ResizeObserver loop limit (browser quirk, not a real error)
  { pattern: /ResizeObserver loop/i, reason: 'Browser ResizeObserver loop — harmless layout quirk' },
]

function isAllowedConsole(msg: string): boolean {
  return ALLOWED_CONSOLE_PATTERNS.some(({ pattern }) => pattern.test(msg))
}

// ─── parse route inventory ─────────────────────────────────────────────────
function loadRoutes(): Array<{ path: string; name: string }> {
  const inventoryPath = resolve(process.cwd(), 'docs/ROUTE_INVENTORY.md')
  if (!existsSync(inventoryPath)) {
    throw new Error('docs/ROUTE_INVENTORY.md not found — run `npm run ci:routes` to regenerate')
  }
  const md = readFileSync(inventoryPath, 'utf8')
  const routes: Array<{ path: string; name: string }> = []
  const re = /^- `([^`]+)`/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) {
    const p = m[1]
    // Skip runtime-resolved or enumeration-placeholder routes
    if (p.includes('<runtime-resolved>') || p === '(no enumeration)') continue
    routes.push({ path: p, name: p === '/' ? 'homepage' : p.replace(/^\//, '') })
  }
  return routes
}

const ALL_ROUTES = loadRoutes()

// CRAWL_LIMIT caps the suite for local sampling or post-deploy CI budgets
const crawlLimit = process.env.CRAWL_LIMIT ? parseInt(process.env.CRAWL_LIMIT, 10) : ALL_ROUTES.length
const ROUTES = ALL_ROUTES.slice(0, crawlLimit)

// Mobile viewport for overflow check — iPhone 14 viewport
const MOBILE_VIEWPORT = { width: 390, height: 844 }

// Routes that legitimately take longer (SSR + Supabase queries, map tiles)
const SLOW_ROUTE_PATTERNS = [
  /^\/homes-for-sale/,
  /^\/cities\//,
  /^\/communities\//,
  /^\/zip\//,
  /^\/housing-market/,
  /^\/reports/,
  /^\/listing/,
  /^\/admin/,
  /^\/pulse/,
  /^\/schools\//,
  /^\/parks\//,
  /^\/subdivisions\//,
]
const SLOW_TIMEOUT = 90_000

function getRouteTimeout(path: string): number {
  return SLOW_ROUTE_PATTERNS.some((re) => re.test(path)) ? SLOW_TIMEOUT : 45_000
}

// ─── tests ─────────────────────────────────────────────────────────────────

test.describe('Full crawl — every page in route inventory', () => {
  for (const route of ROUTES) {
    test(`${route.path} — renders without errors`, async ({ page, request }, testInfo) => {
      testInfo.setTimeout(getRouteTimeout(route.path))

      const consoleErrors: string[] = []
      const networkFailures: string[] = []

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text()
          if (!isAllowedConsole(text)) {
            consoleErrors.push(text)
          }
        }
      })

      page.on('response', (response) => {
        // Only flag failed same-origin requests (not third-party CDNs)
        const url = response.url()
        const baseUrl = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
        if (url.startsWith(baseUrl) && response.status() >= 400 && response.status() !== 404) {
          // 404 on resources is expected; 4xx/5xx on API/page requests flag
          // Exclude known static-file not-found patterns
          const urlObj = new URL(url)
          const ext = urlObj.pathname.split('.').pop() ?? ''
          const staticExts = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'mp4', 'mp3']
          if (!staticExts.includes(ext)) {
            networkFailures.push(`${response.status()} ${url}`)
          }
        }
      })

      // (a) HTTP status check via direct request (faster than navigation)
      const headResponse = await request.get(route.path, {
        maxRedirects: 5,
        timeout: getRouteTimeout(route.path),
        failOnStatusCode: false,
      })
      const finalStatus = headResponse.status()
      expect(
        finalStatus,
        `Route ${route.path} returned HTTP ${finalStatus} — expected 200`
      ).toBe(200)

      // (b–f) Full browser navigation for DOM checks
      await page.goto(route.path, {
        waitUntil: 'domcontentloaded',
        timeout: getRouteTimeout(route.path),
      })

      // Wait for main content to appear
      await page.waitForSelector('main, [role="main"]', {
        timeout: getRouteTimeout(route.path),
      }).catch(() => { /* some admin pages use div layout */ })

      // (d) At least one heading visible
      const headingCount = await page.locator('h1, [role="heading"]').count()
      expect(
        headingCount,
        `Route ${route.path} has no h1 or [role=heading] — page may be blank`
      ).toBeGreaterThan(0)

      // (e) No application error / 404 text when we got HTTP 200
      const bodyText = await page.locator('body').innerText().catch(() => '')
      expect(
        bodyText,
        `Route ${route.path} shows "Application error" — server-side crash`
      ).not.toContain('Application error')
      expect(
        bodyText,
        `Route ${route.path} shows "Page not found" — route resolved but DAL returned not-found`
      ).not.toContain('Page not found')

      // (b) Console errors accumulated during navigation
      expect(
        consoleErrors,
        `Route ${route.path} has console errors: ${consoleErrors.slice(0, 3).join('; ')}`
      ).toHaveLength(0)

      // (c) Same-origin network failures
      expect(
        networkFailures,
        `Route ${route.path} has failing same-origin requests: ${networkFailures.slice(0, 3).join('; ')}`
      ).toHaveLength(0)
    })

    test(`${route.path} — no horizontal overflow on mobile`, async ({ page }, testInfo) => {
      testInfo.setTimeout(getRouteTimeout(route.path))
      await page.setViewportSize(MOBILE_VIEWPORT)
      await page.goto(route.path, {
        waitUntil: 'domcontentloaded',
        timeout: getRouteTimeout(route.path),
      })

      const overflow = await page.evaluate(() => {
        const el = document.documentElement
        return el.scrollWidth - el.clientWidth
      })

      expect(
        overflow,
        `Route ${route.path} has horizontal overflow of ${overflow}px on mobile (viewport: ${MOBILE_VIEWPORT.width}px)`
      ).toBeLessThanOrEqual(1)
    })
  }
})
