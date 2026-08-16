/**
 * _loop-status-shot.mjs — screenshot /admin/loop (pre-arm item 1 verification)
 * on the local prod server (port 3021), desktop + mobile.
 *
 * Auth: one-time magic-link token for the superuser via the service-role admin
 * API, verified by the app's own /auth/callback — a real admin session,
 * read-only otherwise. Same pattern as _ws4-shot-delivery-tab.mjs.
 */
import fs from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const BASE = process.env.LOOP_SHOT_BASE || 'http://localhost:3021'
const OUT = process.env.LOOP_SHOT_OUT || 'out/loop-status'
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
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, deviceScaleFactor: 1.5 })
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})

await page.goto(`${BASE}/auth/callback?token_hash=${tokenHash}&type=magiclink&next=/admin/loop`, {
  waitUntil: 'domcontentloaded',
  timeout: 90000,
})
await page.waitForTimeout(1800)
if (!page.url().includes('/admin/loop')) {
  await page.goto(`${BASE}/admin/loop`, { waitUntil: 'domcontentloaded', timeout: 90000 })
}
await page.waitForTimeout(2200)
await page.screenshot({ path: `${OUT}/loop-desktop.png` })
await page.screenshot({ path: `${OUT}/loop-desktop-full.png`, fullPage: true })
console.log('desktop shots done at', page.url())

const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const cookies = await ctx.cookies()
await mctx.addCookies(cookies)
const mpage = await mctx.newPage()
await mpage.goto(`${BASE}/admin/loop`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await mpage.waitForTimeout(2200)
await mpage.screenshot({ path: `${OUT}/loop-mobile.png`, fullPage: true })
console.log('mobile shot done')

console.log('console errors:', consoleErrors.length ? consoleErrors : 'none')
await browser.close()
console.log('ALL DONE')
