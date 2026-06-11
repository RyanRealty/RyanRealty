#!/usr/bin/env node
/**
 * Auto-capture the FUB 2.0 internal save endpoint via Playwright network monitoring.
 * No manual interaction needed. Opens Bend - River West, makes a tiny change via
 * Playwright clicks, captures the save request body.
 */
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const SESSION = '/Users/matthewryan/RyanRealty/tmp/fub-session.json'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ storageState: SESSION, viewport: { width: 1500, height: 950 } })
const page = await ctx.newPage()

const apiCalls = []
page.on('request', (req) => {
  const url = req.url()
  if (url.includes('/api/v1/') && !url.includes('fullstory') && !url.includes('stripe')) {
    apiCalls.push({
      ts: Date.now(),
      method: req.method(),
      url,
      body: req.method() === 'GET' ? null : req.postData(),
    })
  }
})

// Check session valid
await page.goto('https://ryan-realty.followupboss.com/2/people/list/152', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)

if (/\/login/i.test(page.url())) {
  console.error('SESSION EXPIRED. Re-run scripts/_fub-login-capture.mjs')
  process.exit(2)
}

console.log('Session OK. Page:', page.url())
console.log('Initial API calls during load:')
for (const c of apiCalls) {
  console.log(`  ${c.method} ${c.url.replace('https://ryan-realty.followupboss.com', '')}`)
}

console.log('\nClearing tracking, now triggering a tiny change via UI...')
apiCalls.length = 0

// Trigger a no-op change: add then remove a stage filter (gives us a clean save)
// Actually simpler: click Update List directly. Some FUB UIs fire save even if no changes.
const updateBtn = page.locator('button:has-text("Update List")').first()
if (await updateBtn.count()) {
  await updateBtn.click()
  console.log('Clicked Update List')
  await page.waitForTimeout(5000)
} else {
  console.log('No Update List button found')
}

console.log('\n=== API CALLS DURING SAVE ===')
for (const c of apiCalls) {
  console.log(`\n${c.method} ${c.url.replace('https://ryan-realty.followupboss.com', '')}`)
  if (c.body) console.log(`BODY: ${c.body.slice(0, 800)}`)
}

// Save full dump
await fs.writeFile('/tmp/fub-api-calls.json', JSON.stringify(apiCalls, null, 2))
console.log('\nFull dump → /tmp/fub-api-calls.json')

await browser.close()
