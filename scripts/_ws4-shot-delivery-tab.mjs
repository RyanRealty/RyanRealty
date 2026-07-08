/**
 * _ws4-shot-delivery-tab.mjs — screenshot the new Delivery tab on the local dev
 * server (port 3021) for the WS4 verification report.
 *
 * Auth: generates a one-time magic-link token for the superuser via the
 * service-role admin API and lets the app's own /auth/callback verify it, so
 * the Playwright context carries a real admin session. Read-only otherwise.
 */
import fs from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const BASE = 'http://localhost:3021'
const OUT = 'out/ws4'
fs.mkdirSync(OUT, { recursive: true })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await sb.auth.admin.generateLink({
  type: 'magiclink',
  email: 'matt@ryan-realty.com',
})
if (error) {
  console.error('generateLink failed:', error.message)
  process.exit(1)
}
const tokenHash = data.properties?.hashed_token
if (!tokenHash) {
  console.error('no hashed_token in generateLink response')
  process.exit(1)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 })
const page = await ctx.newPage()

// The app's own callback verifies the OTP and sets the session cookies.
await page.goto(`${BASE}/auth/callback?token_hash=${tokenHash}&type=magiclink&next=/admin/crm/subscriptions`, {
  waitUntil: 'domcontentloaded',
  timeout: 90000,
})
await page.waitForTimeout(1500)
if (!page.url().includes('/admin/crm/subscriptions')) {
  await page.goto(`${BASE}/admin/crm/subscriptions`, { waitUntil: 'domcontentloaded', timeout: 90000 })
}
await page.waitForTimeout(2500)

// Open the Delivery tab.
await page.getByRole('tab', { name: 'Delivery' }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/delivery-tab-desktop.png` })
await page.screenshot({ path: `${OUT}/delivery-tab-desktop-full.png`, fullPage: true })
console.log('desktop shots done at', page.url())

// Mobile.
const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const cookies = await ctx.cookies()
await mctx.addCookies(cookies)
const mpage = await mctx.newPage()
await mpage.goto(`${BASE}/admin/crm/subscriptions`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await mpage.waitForTimeout(2500)
await mpage.getByRole('tab', { name: 'Delivery' }).click()
await mpage.waitForTimeout(1200)
await mpage.screenshot({ path: `${OUT}/delivery-tab-mobile.png`, fullPage: true })
console.log('mobile shot done')

await browser.close()
console.log('ALL DONE')
