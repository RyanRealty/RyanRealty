// Read-only: render Yahson (52283) + Mary (12967) contact pages on prod with a
// minted session; assert the split is visible. Run from repo root.
import { chromium, devices } from 'playwright'
import { createClient as createSb } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const BASE = 'https://ryan-realty.com'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createSb(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'matt@ryan-realty.com' })
const anonC = createSb(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
let v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
if (v.error) v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
const session = v.data.session
const jar = {}
const ssr = createServerClient(url, anon, { cookies: { getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => { jar[name] = value }) } })
await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } })
await ctx.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
const page = await ctx.newPage()

async function check(route, mustHave, mustNotHave, shot) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const text = await page.evaluate(() => document.body.innerText)
  console.log(`\n== ${route} ==`)
  for (const s of mustHave) console.log(`  HAS "${s}": ${text.includes(s) ? 'YES' : 'NO'}`)
  for (const s of mustNotHave) console.log(`  ABSENT "${s}": ${text.includes(s) ? 'NO — STILL PRESENT' : 'YES'}`)
  await page.screenshot({ path: shot, fullPage: false })
}

await check('/admin/crm/52288',
  ['Martha Detweiler', 'mkddetweiler@gmail.com', '(541) 401-3159', 'Dave Detweiler', 'Spouse'],
  [],
  'out/admin-mobile/split-martha-52288.png')
await check('/admin/crm/52289',
  ['Abby Hogge', 'abby.rowley@gmail.com', '(707) 889-7226', 'Matt Hogge', 'Spouse'],
  [],
  'out/admin-mobile/split-abby-52289.png')
await check('/admin/crm/5566',
  ['Matt Hogge', 'mjhogge@hotmail.com', 'Abby Hogge'],
  ['(707) 889-7226'],
  'out/admin-mobile/split-matthogge-5566.png')
await browser.close()
