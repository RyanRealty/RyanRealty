// Read-only proof capture for the notes-ranking fix (broker notes above system
// notes). Mints a matt@ryan-realty.com session and screenshots the Notes view
// on desktop (18157: 1 broker note + 38 packets) and mobile (18187: 212 packets
// → all in the collapsed "Automated activity" group). Run from repo root:
//   node scripts/_verify-notes-ranking.mjs
import { chromium, devices } from 'playwright'
import { createClient as createSb } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { readFileSync, mkdirSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const BASE = 'http://localhost:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createSb(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'matt@ryan-realty.com' })
const anonC = createSb(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
let v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
if (v.error) v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
const session = v.data.session
const jar = {}
const ssr = createServerClient(url, anon, {
  cookies: {
    getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
    setAll: (l) => l.forEach(({ name, value }) => { jar[name] = value }),
  },
})
await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })

mkdirSync('out/crm-notes-ranking', { recursive: true })
const browser = await chromium.launch({ headless: true })

async function withCtx(opts, fn) {
  const ctx = await browser.newContext(opts)
  await ctx.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await fn(page)
  await ctx.close()
  return errors
}

// --- Desktop: 18157 Notes tab (1 broker note floats above 38 collapsed system) ---
const deskErrors = await withCtx({ ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, async (page) => {
  await page.goto(`${BASE}/admin/console/leads/18157`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: /^Notes/ }).first().click().catch(() => {})
  await page.waitForTimeout(1200)
  const txt = await page.evaluate(() => document.body.innerText)
  console.log('DESKTOP 18157 — human note first:', txt.includes('Suggested follow-up'))
  console.log('DESKTOP 18157 — Automated activity group:', /Automated activity/.test(txt))
  await page.screenshot({ path: 'out/crm-notes-ranking/desktop-18157-notes.png', fullPage: false })
})
console.log('DESKTOP console errors:', deskErrors.length ? deskErrors : 'none')

// --- Mobile: 18187 Notes tab (212 system packets, 0 broker → all collapsed) ---
const mobErrors = await withCtx({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }, async (page) => {
  await page.goto(`${BASE}/admin/console/leads/18187?view=mobile`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2000)
  // switch to the Notes tab in the mobile detail strip
  await page.getByText(/^Notes$/).first().click().catch(() => {})
  await page.waitForTimeout(1200)
  const txt = await page.evaluate(() => document.body.innerText)
  console.log('MOBILE 18187 — Automated activity group:', /Automated activity/.test(txt))
  console.log('MOBILE 18187 — no team-notes msg:', txt.includes('No notes from your team yet'))
  await page.screenshot({ path: 'out/crm-notes-ranking/mobile-18187-notes.png', fullPage: false })
})
console.log('MOBILE console errors:', mobErrors.length ? mobErrors : 'none')

await browser.close()
