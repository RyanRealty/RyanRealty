#!/usr/bin/env node
/**
 * Opens a headed Chromium window pointed at Gmail so Matt can log in
 * manually (handling 2FA / device approval), then saves the post-login
 * cookies + localStorage to tmp/gmail-session-<slug>.json for reuse by
 * the cross-broker gmail search scripts.
 *
 * Use this for any Gmail account that's NOT under the ryan-realty.com
 * Google Workspace (i.e. service-account DWD impersonation won't work).
 *
 * Current target: matt.lists.homes@gmail.com (Matt's listing-side
 * personal Gmail). Add `--account <email>` to capture a different one.
 *
 * Usage:
 *   node scripts/_gmail-login-capture.mjs
 *   node scripts/_gmail-login-capture.mjs --account some.other@gmail.com
 *   node scripts/_gmail-login-capture.mjs --keep-open
 *
 * Behaviour:
 *   - Opens chromium HEADED, navigates to gmail.com
 *   - Waits up to 20 minutes for the user to complete login (detects
 *     redirect to mail.google.com/mail/u/...)
 *   - Saves storage state to tmp/gmail-session-<slug>.json
 *   - Closes browser after 8s (use --keep-open to leave it up)
 *
 * Re-run any time Google flags the session for re-auth (typically every
 * 14 days; sooner if you change passwords or revoke devices).
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const accountIdx = args.indexOf('--account')
const ACCOUNT = accountIdx >= 0 ? args[accountIdx + 1] : 'matt.lists.homes@gmail.com'
const KEEP_OPEN = args.includes('--keep-open')
const HEADLESS = args.includes('--headless')

const slug = ACCOUNT.replace(/@.*/, '').replace(/[^a-z0-9]/gi, '-')
const STATE_PATH = path.join(process.cwd(), `tmp/gmail-session-${slug}.json`)
const LOGIN_URL = 'https://accounts.google.com/signin/v2/identifier?service=mail&continue=https://mail.google.com/mail/'
const POST_LOGIN_SUBSTR = 'mail.google.com/mail/'
const MAX_WAIT_MS = 20 * 60 * 1000

console.log(`Capturing Gmail session for: ${ACCOUNT}`)
console.log(`Will save to: ${STATE_PATH}\n`)

await fs.mkdir(path.dirname(STATE_PATH), { recursive: true })

const browser = await chromium.launch({ headless: HEADLESS })
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await context.newPage()

console.log(`Opening Gmail login page...`)
console.log(`When the page loads, sign in as ${ACCOUNT} and complete any 2FA prompts.\n`)
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })

// Pre-fill the email field if the page is on the identifier step
try {
  await page.waitForSelector('input[type="email"]', { timeout: 5000 })
  await page.fill('input[type="email"]', ACCOUNT)
  console.log(`Pre-filled email field with ${ACCOUNT}.`)
  console.log(`Click Next + enter your password + complete 2FA.\n`)
} catch {
  // Already past identifier step or different page
}

// Poll for post-login redirect
console.log(`Waiting up to 20 minutes for login to complete...`)
const startedAt = Date.now()
let didLogIn = false
while (Date.now() - startedAt < MAX_WAIT_MS) {
  const currentUrl = page.url()
  if (currentUrl.includes(POST_LOGIN_SUBSTR)) {
    didLogIn = true
    break
  }
  await new Promise((r) => setTimeout(r, 1500))
}
if (!didLogIn) {
  console.error(`Login did not complete within 20 minutes. Exiting.`)
  await browser.close()
  process.exit(1)
}

console.log(`Detected post-login URL: ${page.url()}`)
console.log(`Waiting 5s for any cookies/localStorage to settle...`)
await new Promise((r) => setTimeout(r, 5000))

await context.storageState({ path: STATE_PATH })
console.log(`\nSession saved → ${STATE_PATH}`)
console.log(`Reuse via: chromium.launch + newContext({ storageState: "${STATE_PATH}" })`)
console.log(`\nNote: Google sessions can re-prompt for verification when accessed`)
console.log(`from a new IP / device. If a script using this state hits a login screen,`)
console.log(`re-run this capture script.\n`)

if (KEEP_OPEN) {
  console.log(`--keep-open: browser stays up. Ctrl-C to exit.`)
  await new Promise(() => {})
} else {
  console.log(`Closing browser in 8 seconds...`)
  await new Promise((r) => setTimeout(r, 8000))
  await browser.close()
}
