#!/usr/bin/env node
/**
 * Better SkySlope login automation. Drives the login form end-to-end
 * (typing email + password + clicking submit) and only requires Matt
 * to tap the MFA push on his phone. Saves session cookies to
 * tmp/skyslope-session.json for downstream Playwright scripts.
 *
 * Improvements over _skyslope-login-capture.mjs:
 *  - Inspects the actual SkySlope wrapper login form (NOT Okta directly).
 *  - Detects both the SkySlope-hosted form AND the Okta SSO form.
 *  - Uses multiple selector candidates and explicit waits for visibility.
 *  - Headed by default (Chromium window is visible so Matt can see MFA prompt
 *    if needed); pass --headless to suppress window.
 *  - Surfaces meaningful errors instead of timing out silently.
 *
 * Usage:
 *   node scripts/_skyslope-login-auto.mjs            # headed (visible window)
 *   node scripts/_skyslope-login-auto.mjs --headless # headless (no window)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const LOGIN_URL = 'https://app.skyslope.com/LoginIntegrated.aspx'
const POST_LOGIN_URL = 'https://app.skyslope.com/ManageTransactions.aspx'
const HEADLESS = process.argv.includes('--headless')

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

const EMAIL = process.env.SKYSLOPE_LOGIN_EMAIL
const PASSWORD = process.env.SKYSLOPE_LOGIN_PASSWORD
if (!EMAIL || !PASSWORD) {
  console.error('Missing SKYSLOPE_LOGIN_EMAIL / SKYSLOPE_LOGIN_PASSWORD in .env.local')
  process.exit(1)
}

console.log(`Headless: ${HEADLESS}. Email: ${EMAIL}.  Password length: ${PASSWORD.length}.`)

const browser = await chromium.launch({ headless: HEADLESS })
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await context.newPage()

// Verbose console listener to debug what's on the page.
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log(`  [browser-err] ${msg.text().slice(0, 200)}`)
})

console.log(`Navigating to ${LOGIN_URL}...`)
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
console.log(`Landed at: ${page.url()}`)

async function probeForm() {
  // Probe what's actually on the page. Return a description.
  const allInputs = await page.$$eval('input', (els) =>
    els
      .filter((e) => e.offsetParent !== null) // visible only
      .map((e) => ({
        type: e.type,
        name: e.name,
        id: e.id,
        placeholder: e.placeholder,
        value: e.value?.slice(0, 20) ?? '',
      })),
  )
  console.log(`  Visible inputs (${allInputs.length}):`)
  for (const i of allInputs) console.log(`    type=${i.type} name=${i.name} id=${i.id} placeholder=${i.placeholder}`)
  return allInputs
}

// Stage 1: find email input. Try a bunch of selectors.
console.log('\nStage 1: Email field')
const emailSelectors = [
  'input[type="email"]',
  'input[name*="username" i]',
  'input[name*="email" i]',
  'input[id*="username" i]',
  'input[id*="email" i]',
  'input[placeholder*="email" i]',
  'input[placeholder*="username" i]',
  '#okta-signin-username',
  '#username',
  '#email',
  '#Email',
  'input[name="Email"]',
  'input[name="UserName"]',
  'input[name="userName"]',
  'input[type="text"]:not([type="hidden"])',
]

let emailFilled = false
for (const sel of emailSelectors) {
  const loc = page.locator(sel).first()
  if (await loc.count().catch(() => 0) === 0) continue
  const visible = await loc.isVisible().catch(() => false)
  if (!visible) continue
  console.log(`  Email selector matched: ${sel}`)
  await loc.fill(EMAIL)
  emailFilled = true
  break
}

if (!emailFilled) {
  console.log('  No email selector matched. Probing form structure:')
  await probeForm()
  console.log('  Falling back to first visible text input.')
  const firstText = page.locator('input[type="text"]:visible, input:not([type]):visible').first()
  if (await firstText.count()) {
    await firstText.fill(EMAIL)
    emailFilled = true
  }
}

if (!emailFilled) {
  console.error('Could not fill email field. Bailing.')
  if (!HEADLESS) {
    console.log('Leaving window open for inspection. Press Ctrl+C to exit.')
    await new Promise(() => {})
  }
  process.exit(2)
}

console.log('  Email filled. Clicking Next/Submit...')
await page.waitForTimeout(400)

// Click Next / Continue / Sign In
const nextSelectors = [
  'input[type="submit"][value="Sign In"]',
  'input[type="submit"][value*="Next" i]',
  'button[type="submit"]',
  'input[type="submit"]',
  'button:has-text("Sign In")',
  'button:has-text("Next")',
  'button:has-text("Continue")',
  'button:has-text("Log in")',
  'button:has-text("Login")',
  'a:has-text("Sign In")',
]
for (const sel of nextSelectors) {
  const loc = page.locator(sel).first()
  if (await loc.count().catch(() => 0) === 0) continue
  const visible = await loc.isVisible().catch(() => false)
  if (!visible) continue
  console.log(`  Next button selector matched: ${sel}`)
  await loc.click().catch(() => {})
  break
}

// Stage 2: password field
console.log('\nStage 2: Password field')
const passwordSelectors = [
  'input[type="password"]',
  'input[name*="password" i]',
  'input[id*="password" i]',
  '#password',
  '#Password',
]

let pwFilled = false
for (let attempt = 0; attempt < 30; attempt++) {
  for (const sel of passwordSelectors) {
    const loc = page.locator(sel).first()
    if (await loc.count().catch(() => 0) === 0) continue
    const visible = await loc.isVisible().catch(() => false)
    if (!visible) continue
    console.log(`  Password selector matched: ${sel} (attempt ${attempt + 1})`)
    await loc.fill(PASSWORD)
    pwFilled = true
    break
  }
  if (pwFilled) break
  await page.waitForTimeout(1000)
}

if (!pwFilled) {
  console.error('Could not find password field after 30s. Probing:')
  await probeForm()
  console.log(`Current URL: ${page.url()}`)
  if (!HEADLESS) {
    console.log('Leaving window open for manual completion.')
    await new Promise(() => {})
  }
  process.exit(3)
}

console.log('  Password filled. Submitting...')
await page.waitForTimeout(400)
for (const sel of nextSelectors) {
  const loc = page.locator(sel).first()
  if (await loc.count().catch(() => 0) === 0) continue
  const visible = await loc.isVisible().catch(() => false)
  if (!visible) continue
  console.log(`  Submit selector matched: ${sel}`)
  await loc.click().catch(() => {})
  break
}

// Stage 3: wait for MFA OR redirect.
console.log('\nStage 3: Waiting for post-login redirect (MFA may prompt on your phone)...')
const MAX_MS = 10 * 60 * 1000
const start = Date.now()
let saved = false
while (Date.now() - start < MAX_MS) {
  await page.waitForTimeout(2000)
  const url = page.url()
  const onAppPath = /app\.skyslope\.com/i.test(url)
  const onLogin = /LoginIntegrated\.aspx/i.test(url)
  const onOAuth = /id\.skyslope\.com.*(oauth|authorize|login)/i.test(url)
  process.stdout.write(`\r  url=${url.slice(0, 100).padEnd(100)} `)
  if (onAppPath && !onLogin && !onOAuth) {
    console.log(`\n  Detected logged-in URL.`)
    await page.waitForTimeout(2500)
    await page.goto(POST_LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(1500)
    if (/LoginIntegrated/i.test(page.url())) {
      console.log('  Bounced back to login. Continuing wait.')
      continue
    }
    await fs.mkdir(path.dirname(STATE_PATH), { recursive: true })
    await context.storageState({ path: STATE_PATH })
    console.log(`  Saved storage state → ${STATE_PATH}`)
    saved = true
    break
  }
}

if (!saved) {
  console.error('\nTimeout waiting for login completion (10 min). MFA push not approved?')
  await browser.close()
  process.exit(4)
}

await browser.close()
console.log('Login captured. You can now run downstream Playwright scripts.')
