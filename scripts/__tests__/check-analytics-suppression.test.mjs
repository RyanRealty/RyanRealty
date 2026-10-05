import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { findViolations } from '../check-analytics-suppression.mjs'

const one = (rel, src) => findViolations([{ rel, src }])

describe('ci:analytics-suppression (Matt 2026-10-05, GA cleanup)', () => {
  it('passes on the wired tree', () => {
    const result = spawnSync(process.execPath, ['scripts/check-analytics-suppression.mjs'], { encoding: 'utf8' })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    expect(result.stdout).toMatch(/ci:analytics-suppression OK/)
  })

  it('fails a script that launches Playwright or Puppeteer directly', () => {
    expect(one('scripts/probe-x-prod.mjs', "import { chromium } from 'playwright'\nawait chromium.launch()")).toHaveLength(1)
    expect(one('scripts/probe-x.mjs', "import { chromium, devices } from 'playwright';")).toHaveLength(1)
    expect(one('scripts/a.js', "const { chromium } = require('playwright');")).toHaveLength(1)
    expect(one('scripts/a.mjs', "import { chromium } from '@playwright/test'")).toHaveLength(1)
    expect(one('scripts/a.mjs', "import * as pw from 'playwright'")).toHaveLength(1)
    expect(one('scripts/a.mjs', "import puppeteer from 'puppeteer'")).toHaveLength(1)
    expect(one('scripts/a.ts', "const m = await import('puppeteer-core')")).toHaveLength(1)
    expect(one('shot.mjs', "import { webkit } from 'playwright-core'")).toHaveLength(1)
  })

  it('passes the wrappers, type-only imports, the test runner fixtures, and lib renderers that never navigate', () => {
    expect(one('scripts/a.mjs', "import { chromium } from './lib/marked-playwright.mjs'")).toEqual([])
    expect(one('scripts/a.mjs', "import puppeteer from './lib/marked-puppeteer.mjs'")).toEqual([])
    expect(one('e2e/a.spec.ts', "import { test, expect, type Page } from '@playwright/test'")).toEqual([])
    expect(one('scripts/a.ts', "import type { Page } from 'puppeteer-core'\nfunction f(p: import('puppeteer-core').Page) {}")).toEqual([])
    expect(one('scripts/a.mjs', "/** @param {import('playwright').Browser} b */\n// import { chromium } from 'playwright'")).toEqual([])
    expect(one('lib/cma-pdf.ts', "import puppeteer from 'puppeteer-core'\nawait page.setContent(html)")).toEqual([])
    expect(one('lib/x.ts', "import puppeteer from 'puppeteer-core'\nawait page.goto('https://ryan-realty.com')")).toHaveLength(1)
  })

  it('fails automation that grants analytics consent or clicks Accept all', () => {
    const grant = "document.cookie = 'ryan_realty_cookie_consent=' + encodeURIComponent(JSON.stringify({ analytics: true, marketing: true }))"
    expect(one('scripts/take-route-shots.mjs', `import { chromium } from './lib/marked-playwright.mjs'\n${grant}`)).toHaveLength(1)
    expect(one('e2e/a.spec.ts', "await page.getByRole('button', { name: 'Accept all' }).click()")).toHaveLength(1)
    const decline = grant.replace('analytics: true, marketing: true', 'analytics: false, marketing: false')
    expect(one('scripts/take-route-shots.mjs', decline)).toEqual([])
    // The site's own banner writes the visitor's real answer.
    expect(one('components/CookieConsentBanner.tsx', grant)).toEqual([])
  })
})
