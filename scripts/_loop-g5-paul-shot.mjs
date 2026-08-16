/**
 * Signed-in accept for G5: Paul walks /admin/today and /admin/people.
 * Magic-link only — does not send mail. Read-only after session.
 *
 *   LOOP_SHOT_BASE=http://localhost:3021 node scripts/_loop-g5-paul-shot.mjs
 */
import fs from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const BASE = process.env.LOOP_SHOT_BASE || 'http://localhost:3021'
const OUT = process.env.LOOP_SHOT_OUT || 'out/g5-paul-day-one'
fs.mkdirSync(OUT, { recursive: true })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await sb.auth.admin.generateLink({
  type: 'magiclink',
  email: 'paul@ryan-realty.com',
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})

await page.goto(`${BASE}/auth/callback?token_hash=${tokenHash}&type=magiclink&next=/admin/today`, {
  waitUntil: 'domcontentloaded',
  timeout: 90000,
})
await page.waitForTimeout(2200)
if (!page.url().includes('/admin/today')) {
  await page.goto(`${BASE}/admin/today`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1800)
}
const todayText = await page.locator('body').innerText()
await page.screenshot({ path: `${OUT}/paul-today-1280.png`, fullPage: true })
console.log('today url', page.url())
console.log('today has Day one', /Day one/i.test(todayText))
console.log('today has scoped', /scoped to paul/i.test(todayText))
console.log('today leaked company book', /23009|23,009/.test(todayText))

await page.goto(`${BASE}/admin/people`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(2200)
const peopleText = await page.locator('body').innerText()
await page.screenshot({ path: `${OUT}/paul-people-1280.png`, fullPage: true })
console.log('people url', page.url())
console.log('people leaked company book', /23009|23,009/.test(peopleText))

const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const cookies = await ctx.cookies()
await mctx.addCookies(cookies)
const mpage = await mctx.newPage()
await mpage.goto(`${BASE}/admin/today`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await mpage.waitForTimeout(1800)
await mpage.screenshot({ path: `${OUT}/paul-today-390.png`, fullPage: true })
console.log('mobile today done')

console.log('console errors:', consoleErrors.length ? consoleErrors : 'none')
fs.writeFileSync(
  `${OUT}/accept.json`,
  JSON.stringify(
    {
      todayUrl: page.url(),
      todayHasDayOne: /Day one/i.test(todayText),
      todayHasScoped: /scoped to paul/i.test(todayText),
      todayLeakedCompanyBook: /23009|23,009/.test(todayText),
      peopleLeakedCompanyBook: /23009|23,009/.test(peopleText),
      consoleErrors,
    },
    null,
    2,
  ),
)
await browser.close()
console.log('ALL DONE', OUT)
