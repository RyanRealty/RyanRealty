#!/usr/bin/env node
/**
 * Generalized authenticated-session capture. Replaces the SkySlope-only
 * `_skyslope-login-capture.mjs` and works identically on macOS and Linux, so a
 * cloud VM can do everything the Mac mini used to do.
 *
 * Usage:
 *   node scripts/_auth-capture.mjs                 # capture every registered site
 *   node scripts/_auth-capture.mjs skyslope        # capture one site
 *   node scripts/_auth-capture.mjs --verify        # only re-login if state is stale
 *   node scripts/_auth-capture.mjs --headed        # show the window (first-time MFA enrolment)
 *   node scripts/_auth-capture.mjs --list          # print the registry and credential status
 *
 * Design notes:
 *   - Headless is the DEFAULT. Verified 2026-07-25: SkySlope's Okta flow
 *     completes headless with no MFA prompt, so no human is required.
 *   - `--headed` stays available for a site that later enrols MFA. On Linux
 *     that needs xvfb; the script says so rather than failing opaquely.
 *   - Sessions are cached to tmp/ but are NEVER the source of truth. A fresh
 *     cloud session has no tmp/, so every consumer path must tolerate a
 *     cold start — `--verify` re-logs in automatically when state is missing
 *     or rejected.
 *   - Credentials come from the environment. On the VM those are real env
 *     vars; locally they fall back to .env.local. Never hardcode.
 *
 * Adding a site: append one entry to SITES. Everything else is generic.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { loadEnv } from '../lib/platform/env.mjs'

await loadEnv()

// ── Site registry ───────────────────────────────────────────────────────────
// successUrl : regex that means "we are logged in"
// rejectUrl  : regex that means "still on the login wall" (never save on this)
// verifyUrl  : an authenticated page used as a cookie smoke test
const SITES = [
  {
    id: 'skyslope',
    label: 'SkySlope (transaction management)',
    statePath: 'tmp/skyslope-session.json',
    loginUrl: 'https://app.skyslope.com/LoginIntegrated.aspx',
    verifyUrl: 'https://app.skyslope.com/ManageTransactions.aspx',
    successUrl: /app\.skyslope\.com\/(?!.*LoginIntegrated)/i,
    rejectUrl: /LoginIntegrated\.aspx|id\.skyslope\.com.*oauth2/i,
    emailEnv: 'SKYSLOPE_LOGIN_EMAIL',
    passwordEnv: 'SKYSLOPE_LOGIN_PASSWORD',
    totpEnv: 'SKYSLOPE_TOTP_SECRET', // optional; only if MFA is ever enrolled
  },
]

const argv = process.argv.slice(2)
const HEADED = argv.includes('--headed')
const VERIFY_ONLY = argv.includes('--verify')
const LIST = argv.includes('--list')
const wanted = argv.filter((a) => !a.startsWith('--'))

const EMAIL_SEL = [
  'input[type="email"]',
  'input[name="username"]',
  'input[name*="username" i]',
  'input[name*="email" i]',
  'input[id*="username" i]',
  'input[id="okta-signin-username"]',
  'input[autocomplete="username"]',
].join(', ')
const PW_SEL = 'input[type="password"], input[name="password"], input[id="okta-signin-password"]'
const NEXT_BTN = [
  'input[type="submit"][value="Next"]',
  'button:has-text("Next")',
  'button:has-text("Continue")',
  'input[type="submit"]',
  'button[type="submit"]',
]
const SUBMIT_BTN = [
  'input[type="submit"][value="Verify"]',
  'button:has-text("Verify")',
  'button:has-text("Sign In")',
  'input[type="submit"]',
  'button[type="submit"]',
]

if (LIST) {
  console.log('Registered sites:\n')
  for (const s of SITES) {
    const hasEmail = Boolean(process.env[s.emailEnv])
    const hasPw = Boolean(process.env[s.passwordEnv])
    const hasTotp = Boolean(s.totpEnv && process.env[s.totpEnv])
    console.log(`  ${s.id.padEnd(12)} ${s.label}`)
    console.log(`  ${''.padEnd(12)} state:  ${s.statePath}`)
    console.log(
      `  ${''.padEnd(12)} creds:  ${s.emailEnv}=${hasEmail ? 'set' : 'MISSING'}  ` +
        `${s.passwordEnv}=${hasPw ? 'set' : 'MISSING'}  totp=${hasTotp ? 'set' : 'none'}\n`,
    )
  }
  process.exit(0)
}

/** Find the scope holding the login form — main document or an iframe. */
async function loginScope(page) {
  const main = page.locator(EMAIL_SEL).first()
  if (await main.count()) {
    try {
      await main.waitFor({ state: 'visible', timeout: 5000 })
      return page
    } catch {
      /* fall through to frames */
    }
  }
  for (const frame of page.frames()) {
    const f = frame.locator(EMAIL_SEL).first()
    if (await f.count()) {
      try {
        await f.waitFor({ state: 'visible', timeout: 5000 })
        return frame
      } catch {
        /* next frame */
      }
    }
  }
  return page
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

/** Generate a TOTP code without adding a dependency (RFC 6238, SHA-1, 6 digits). */
async function totpCode(base32Secret) {
  const { createHmac } = await import('node:crypto')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const ch of base32Secret.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')) {
    const idx = alphabet.indexOf(ch)
    if (idx === -1) continue
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)))
  const counter = Buffer.alloc(8)
  counter.writeUInt32BE(Math.floor(Date.now() / 1000 / 30), 4)
  const hmac = createHmac('sha1', bytes).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0')
  return code
}

/** Is the cached state still good? Cheap headless probe against verifyUrl. */
async function stateIsValid(site) {
  const abs = path.join(process.cwd(), site.statePath)
  try {
    await fs.access(abs)
  } catch {
    return false
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext({ storageState: abs })
    const page = await ctx.newPage()
    await page.goto(site.verifyUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(2000)
    return !site.rejectUrl.test(page.url())
  } catch {
    return false
  } finally {
    await browser.close()
  }
}

async function capture(site) {
  const email = process.env[site.emailEnv]
  const password = process.env[site.passwordEnv]
  const totpSecret = site.totpEnv ? process.env[site.totpEnv] : null

  if (!email || !password) {
    console.error(`  ✗ ${site.id}: missing ${site.emailEnv} / ${site.passwordEnv} in the environment`)
    return false
  }

  if (HEADED && process.platform === 'linux' && !process.env.DISPLAY) {
    console.error(`  ✗ ${site.id}: --headed on Linux needs a display. Run under xvfb-run, or drop --headed.`)
    return false
  }

  const browser = await chromium.launch({ headless: !HEADED })
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await ctx.newPage()

  try {
    console.log(`  → ${site.id}: opening login (${HEADED ? 'headed' : 'headless'})`)
    await page.goto(site.loginUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const scope = await loginScope(page)

    const emailInput = scope.locator(EMAIL_SEL).first()
    await emailInput.waitFor({ state: 'visible', timeout: 60000 })
    await emailInput.fill(email)
    await page.waitForTimeout(400)
    await clickFirst(scope, NEXT_BTN)

    const pwInput = scope.locator(PW_SEL).first()
    await pwInput.waitFor({ state: 'visible', timeout: 30000 })
    await pwInput.fill(password)
    await page.waitForTimeout(400)
    await clickFirst(scope, SUBMIT_BTN)
    console.log(`  → ${site.id}: credentials submitted`)

    // Optional TOTP step — only engages if the site presents a code field.
    if (totpSecret) {
      const codeSel = 'input[name*="code" i], input[name*="otp" i], input[autocomplete="one-time-code"]'
      const codeInput = page.locator(codeSel).first()
      const appeared = await codeInput
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => true)
        .catch(() => false)
      if (appeared) {
        await codeInput.fill(await totpCode(totpSecret))
        await clickFirst(page, SUBMIT_BTN)
        console.log(`  → ${site.id}: TOTP submitted`)
      }
    }

    // Wait for a real authenticated URL, never saving mid-OAuth.
    const deadline = Date.now() + (HEADED ? 20 : 3) * 60 * 1000
    while (Date.now() < deadline) {
      await page.waitForTimeout(2000)
      const url = page.url()
      if (!site.successUrl.test(url) || site.rejectUrl.test(url)) continue

      await page.waitForTimeout(3000)
      await page.goto(site.verifyUrl, { waitUntil: 'domcontentloaded' }).catch(() => {})
      await page.waitForTimeout(2000)
      if (site.rejectUrl.test(page.url())) continue // bounced — keep waiting

      const abs = path.join(process.cwd(), site.statePath)
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await ctx.storageState({ path: abs })
      console.log(`  ✓ ${site.id}: session saved → ${site.statePath}`)
      return true
    }

    console.error(`  ✗ ${site.id}: timed out waiting for an authenticated URL (last: ${page.url()})`)
    return false
  } catch (e) {
    console.error(`  ✗ ${site.id}: ${e.message.slice(0, 200)}`)
    return false
  } finally {
    await browser.close()
  }
}

const targets = wanted.length ? SITES.filter((s) => wanted.includes(s.id)) : SITES
if (!targets.length) {
  console.error(`No matching site. Known: ${SITES.map((s) => s.id).join(', ')}`)
  process.exit(1)
}

let failed = 0
for (const site of targets) {
  if (VERIFY_ONLY && (await stateIsValid(site))) {
    console.log(`  ✓ ${site.id}: cached session still valid, skipping login`)
    continue
  }
  if (!(await capture(site))) failed++
}

if (failed) {
  console.error(`\n${failed} site(s) failed to capture.`)
  process.exit(1)
}
console.log('\nAll sessions captured.')
