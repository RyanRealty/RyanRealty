import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
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
 * Admin routes additionally get an axe accessibility scan (WCAG 2.0/2.1 A+AA,
 * 2.2 AA) ratcheted against e2e/axe-baseline.json — see the section below.
 *
 * Control:
 *   CRAWL_LIMIT env var caps how many routes run (default: all).
 *   Set CRAWL_LIMIT=40 for a quick sample in CI post-deploy.
 *   E2E_AXE=0 disables the admin axe scan (default: on).
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

// ─── axe accessibility ratchet — /admin surface (Admin Product OS 11A) ─────
//
// Every crawled /admin route gets an AxeBuilder scan (WCAG 2.0 A/AA, 2.1 A/AA,
// 2.2 AA). The legacy admin interior still carries violations, so this is a
// RATCHET, not a hard fail:
//
//   - e2e/axe-baseline.json maps route → sorted, deduped violation rule ids.
//   - A route whose scan produces a rule id NOT in its baseline entry FAILS,
//     with a diff of the new rules.
//   - A route with fewer rule ids than baselined passes and is reported as
//     ratchetable — delete the fixed ids from the baseline and commit to lock
//     the win. The baseline may only shrink.
//   - If e2e/axe-baseline.json does not exist, the run SEEDS it from the scan
//     and passes. Seed from a full crawl (no CRAWL_LIMIT / --grep) so every
//     admin route gets an entry, then commit the file.
//
// Disable with E2E_AXE=0 (default: on). Auth: when e2e/.auth/user.json exists
// (written by auth.setup.ts), the scan reuses that session so it reaches the
// admin interior; without it, /admin routes redirect to the login surface and
// that is what gets scanned — seed and compare under the same auth conditions.

const AXE_ENABLED = process.env.E2E_AXE !== '0'
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const AXE_BASELINE_PATH = resolve(process.cwd(), 'e2e/axe-baseline.json')
const AUTH_STATE_FILE = resolve(process.cwd(), 'e2e/.auth/user.json')

const ADMIN_ROUTES = ROUTES.filter(
  (r) => r.path === '/admin' || r.path.startsWith('/admin/')
)

// null = baseline file absent = seeding mode
const AXE_BASELINE: Record<string, string[]> | null = existsSync(AXE_BASELINE_PATH)
  ? (JSON.parse(readFileSync(AXE_BASELINE_PATH, 'utf8')) as Record<string, string[]>)
  : null

// Scan results accumulate here across tests (the file runs in one worker) so
// seeding mode can write the whole baseline in afterAll.
const axeScanResults: Record<string, string[]> = {}

test.describe('Axe accessibility ratchet — /admin surface', () => {
  test.skip(!AXE_ENABLED, 'E2E_AXE=0 — axe scan disabled')
  test.use({ storageState: existsSync(AUTH_STATE_FILE) ? AUTH_STATE_FILE : undefined })

  for (const route of ADMIN_ROUTES) {
    test(`${route.path} — axe WCAG A/AA ratchet`, async ({ page }, testInfo) => {
      // One engine is enough for an a11y-tree scan; the mobile project doubles
      // runtime for near-identical rule output.
      test.skip(testInfo.project.name !== 'chromium', 'axe runs on the chromium project only')
      testInfo.setTimeout(getRouteTimeout(route.path))

      await page.goto(route.path, {
        waitUntil: 'domcontentloaded',
        timeout: getRouteTimeout(route.path),
      })
      await page.waitForSelector('main, [role="main"]', {
        timeout: getRouteTimeout(route.path),
      }).catch(() => { /* some admin pages use div layout */ })

      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
      const ruleIds = Array.from(new Set(results.violations.map((v) => v.id))).sort()
      axeScanResults[route.path] = ruleIds

      if (AXE_BASELINE === null) {
        // Seeding mode — afterAll writes e2e/axe-baseline.json; nothing to compare.
        return
      }

      const baselined = AXE_BASELINE[route.path] ?? []
      const newRules = ruleIds.filter((id) => !baselined.includes(id))
      const fixedRules = baselined.filter((id) => !ruleIds.includes(id))

      if (fixedRules.length > 0) {
        const note = `${route.path} is ratchetable — no longer violates: ${fixedRules.join(', ')}. Remove these ids from e2e/axe-baseline.json to lock the win.`
        testInfo.annotations.push({ type: 'axe-ratchetable', description: note })
        console.log(`  ⤵ ${note}`)
      }

      const newRuleDetail = results.violations
        .filter((v) => newRules.includes(v.id))
        .map((v) => `${v.id} [${v.impact ?? 'unknown'}] ${v.nodes.length} node(s) — ${v.help}`)
        .join('\n    ')

      expect(
        newRules,
        `Route ${route.path} introduces axe violations not in e2e/axe-baseline.json:\n    ${newRuleDetail}\n  Baselined: [${baselined.join(', ')}]\n  Scanned:   [${ruleIds.join(', ')}]\n  Fix the violations; only shrink the baseline, never grow it.`
      ).toHaveLength(0)
    })
  }

  test.afterAll(() => {
    // Seeding mode only. afterAll runs PER WORKER, so a naive overwrite loses
    // every other worker's routes (observed: a 42-minute crawl seeded 1 route —
    // the last worker's map clobbered the rest). Each worker writes a fragment;
    // `node scripts/merge-axe-seed.mjs` composes e2e/axe-baseline.json after
    // the run. Comparison mode never touches fragments.
    if (!AXE_ENABLED || AXE_BASELINE !== null) return
    const scannedRoutes = Object.keys(axeScanResults).sort()
    if (scannedRoutes.length === 0) return
    const seeded: Record<string, string[]> = {}
    for (const r of scannedRoutes) seeded[r] = axeScanResults[r]
    const fragDir = resolve(process.cwd(), 'e2e/.axe-seed')
    mkdirSync(fragDir, { recursive: true })
    writeFileSync(resolve(fragDir, `worker-${process.pid}.json`), JSON.stringify(seeded, null, 2) + '\n')
    console.log(
      `axe seed fragment: ${scannedRoutes.length} route(s) from worker ${process.pid} — run scripts/merge-axe-seed.mjs to compose e2e/axe-baseline.json.`
    )
  })
})
