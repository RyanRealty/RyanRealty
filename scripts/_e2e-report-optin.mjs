// Targeted E2E: market-report self-subscribe happy path. Toggles Redmond ON
// (Bend already selected), saves, asserts the crm_report_subscriptions row
// updated with both areas.
import { chromium, devices } from 'playwright'
import { createClient as createSb } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const BASE = 'http://localhost:3021'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createSb(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'matt@ryan-realty.com' })
const anonC = createSb(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
let v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
if (v.error) v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
const jar = {}
const ssr = createServerClient(url, anon, { cookies: { getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => { jar[name] = value }) } })
await ssr.auth.setSession({ access_token: v.data.session.access_token, refresh_token: v.data.session.refresh_token })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } })
await ctx.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
const page = await ctx.newPage()
await page.goto(`${BASE}/account/notifications`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(3500)
await page.getByRole('button', { name: /^redmond$/i }).first().click({ timeout: 10000 })
await page.waitForTimeout(400)
await page.getByRole('button', { name: /save market report/i }).first().click({ timeout: 8000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: 'out/saved-search-verify/e2e-c3-happy-save.png', fullPage: false })
const { data } = await admin.from('crm_report_subscriptions').select('areas, is_active, updated_at').eq('person_id', 13168).single()
const ok = data?.areas?.includes('bend') && data?.areas?.includes('redmond') && data?.is_active
console.log(ok ? 'PASS' : 'FAIL', 'report opt-in save:', JSON.stringify(data))
// Restore original state (bend only)
await admin.from('crm_report_subscriptions').update({ areas: ['bend'] }).eq('person_id', 13168)
await browser.close()
process.exit(ok ? 0 : 1)
