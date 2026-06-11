#!/usr/bin/env node
/**
 * Opens a headed Chromium window pointed at app.followupboss.com so Matt can
 * log in once. Saves the post-login cookies + localStorage to
 * tmp/fub-session.json for reuse by _fub-ui-wire-smart-list-filters.mjs
 * (and any other FUB UI scripts).
 *
 * Pattern modeled on _skyslope-login-capture.mjs. Auth-only — does NOT do any
 * wiring/clicking on Matt's behalf. Once the session is saved, the wire script
 * takes over.
 *
 * Usage:
 *   node scripts/_fub-login-capture.mjs           # opens visible Chromium, waits for login
 *   node scripts/_fub-login-capture.mjs --keep-open  # don't close after capture
 *
 * Optional env (.env.local) for auto-fill:
 *   FUB_LOGIN_EMAIL=...
 *   FUB_LOGIN_PASSWORD=...
 * If absent, Matt types it in the visible window himself (~30 seconds incl MFA).
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/fub-session.json')
const LOGIN_URL = 'https://app.followupboss.com/login'
const POST_LOGIN_PROBE = 'https://app.followupboss.com/'
const MAX_WAIT_MS = 20 * 60 * 1000

async function loadEnvLocal() {
  const raw = await fs.readFile('.env.local', 'utf8').catch(() => '')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}
await loadEnvLocal()

const AUTO_EMAIL = process.env.FUB_LOGIN_EMAIL
const AUTO_PASSWORD = process.env.FUB_LOGIN_PASSWORD
const HEADLESS = process.argv.includes('--headless')
const KEEP_OPEN = process.argv.includes('--keep-open')

const browser = await chromium.launch({ headless: HEADLESS })
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await context.newPage()

console.log(
  `Opening ${LOGIN_URL} — ${AUTO_EMAIL ? 'attempting auto-login' : 'please log in to Follow Up Boss in the visible window.'}`,
)
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

// Bring the Playwright window forward on macOS so Matt can see the login + type/MFA.
if (!HEADLESS && process.platform === 'darwin') {
  const { execSync } = await import('node:child_process')
  try {
    execSync('osascript -e \'tell application "Chromium" to activate\'', { stdio: 'ignore' })
  } catch {
    try { execSync('osascript -e \'tell application "Google Chrome for Testing" to activate\'', { stdio: 'ignore' }) } catch {}
  }
}

async function clickFirst(scope, selectors) {
  for (const sel of selectors) {
    const loc = scope.locator(sel).first()
    if (await loc.count()) {
      await loc.click({ timeout: 5000 }).catch(() => {})
      return true
    }
  }
  return false
}

if (AUTO_EMAIL && AUTO_PASSWORD) {
  try {
    await page.waitForTimeout(1500)
    const emailInput = page
      .locator('input[type="email"], input[name*="email" i], input[id*="email" i], input[autocomplete="username"]')
      .first()
    await emailInput.waitFor({ state: 'visible', timeout: 30000 })
    await emailInput.fill(AUTO_EMAIL)
    const pwInput = page.locator('input[type="password"]').first()
    await pwInput.waitFor({ state: 'visible', timeout: 10000 })
    await pwInput.fill(AUTO_PASSWORD)
    await clickFirst(page, [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Log In")',
      'input[type="submit"]',
    ])
    console.log('Auto-login: submitted. If FUB MFA is enabled, approve on your phone — script waits up to 20 min.')
  } catch (e) {
    console.log(`Auto-login attempt errored (${e.message.slice(0, 200)}); waiting for manual login.`)
  }
}

const start = Date.now()
let savedOnce = false
let lastUrl = ''
let snapCount = 0
const SNAP_DIR = path.join(process.cwd(), 'tmp/fub-login-snaps')
await fs.mkdir(SNAP_DIR, { recursive: true })
while (Date.now() - start < MAX_WAIT_MS) {
  await page.waitForTimeout(2000)
  const url = page.url()
  if (url !== lastUrl) {
    console.log(`[t+${Math.round((Date.now()-start)/1000)}s] URL: ${url}`)
    lastUrl = url
    snapCount += 1
    await page.screenshot({ path: path.join(SNAP_DIR, `snap-${String(snapCount).padStart(3,'0')}.png`), fullPage: false }).catch(() => {})
  }
  // Periodic snapshot every ~20s even if URL didn't change, so we see MFA prompts
  if ((Date.now() - start) % 20000 < 2100 && snapCount > 0) {
    snapCount += 1
    await page.screenshot({ path: path.join(SNAP_DIR, `snap-${String(snapCount).padStart(3,'0')}.png`), fullPage: false }).catch(() => {})
  }
  // FUB redirects logged-in users to one of:
  //   https://app.followupboss.com/...    (FUB 1.0)
  //   https://<tenant>.followupboss.com/2/...  (FUB 2.0, e.g. ryan-realty.followupboss.com/2/)
  // Accept any followupboss.com subdomain as "in the app" — narrow only on /login and OAuth intermediaries.
  const onFub = /\.followupboss\.com/i.test(url)
  const onLogin = /\/login(\?|$|\/)/i.test(url)
  const onOAuth = /oauth|sso|saml|auth0|okta|mfa|two.factor|verify/i.test(url)
  if (onFub && !onLogin && !onOAuth) {
    console.log(`Detected post-login URL: ${url}`)
    await page.waitForTimeout(2500)
    // Cookie smoke test: navigate to app root, ensure we don't bounce to /login.
    await page.goto(POST_LOGIN_PROBE, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(1500)
    if (/\/login/i.test(page.url())) {
      console.log('Bounced back to /login — session not valid. Continuing to wait.')
      continue
    }
    await fs.mkdir(path.dirname(STATE_PATH), { recursive: true })
    await context.storageState({ path: STATE_PATH })
    console.log(`Saved storage state → ${STATE_PATH}`)
    savedOnce = true
    break
  }
}

if (!savedOnce) {
  console.error('Timeout waiting for login.')
  await browser.close()
  process.exit(1)
}

if (KEEP_OPEN) {
  console.log('Session saved. Browser stays open (--keep-open). Close the window when done.')
  await new Promise(() => {})
} else {
  console.log('Session saved. Closing browser in 6 seconds.')
  await page.waitForTimeout(6000)
  await browser.close()
  console.log('Done. Session is in tmp/fub-session.json.')
}
