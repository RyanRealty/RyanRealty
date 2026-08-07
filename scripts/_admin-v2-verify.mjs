// Admin v2 migration verifier (P11C). For each route, at 375 AND 1280:
//   - HTTP status is 200
//   - exactly ONE <main> landmark (ConsoleShell owns it; a page must not add one)
//   - no PAGE-level horizontal scroll (a grid may scroll inside its own box)
//   - console errors captured
// Usage: node scripts/_admin-v2-verify.mjs /admin/newsletters /admin/media ...
// Auth: mints a fresh magic-link session for matt@ (the storage state expires).
import { chromium } from 'playwright'
import { createClient as createSb } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const BASE = process.env.VERIFY_BASE || 'http://localhost:3000'
const routes = process.argv.slice(2)
if (!routes.length) {
  console.error('usage: node scripts/_admin-v2-verify.mjs <route> [route...]')
  process.exit(2)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createSb(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: link } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: 'matt@ryan-realty.com',
})
const anonC = createSb(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
let v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
if (v.error) v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
if (v.error) { console.error('auth failed:', v.error.message); process.exit(1) }
const session = v.data.session
const jar = {}
const ssr = createServerClient(url, anon, {
  cookies: {
    getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
    setAll: (l) => l.forEach(({ name, value }) => { jar[name] = value }),
  },
})
await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
const cookies = Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE }))

const browser = await chromium.launch({ headless: true })
const results = []

for (const width of [375, 1280]) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 375 ? 812 : 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  await ctx.addCookies(cookies)
  for (const route of routes) {
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)))
    let status = 0
    try {
      const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 })
      status = resp?.status() ?? 0
      await page.waitForTimeout(1200)
    } catch (e) {
      results.push({ route, width, status: 'NAV_FAIL', error: String(e).slice(0, 160) })
      await page.close()
      continue
    }
    const probe = await page.evaluate(() => {
      const de = document.documentElement
      // Widest element that pokes past the viewport, for a fixable report.
      let worst = null
      if (de.scrollWidth > de.clientWidth + 1) {
        let max = 0
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const r = el.getBoundingClientRect()
          if (r.right > max) { max = r.right; worst = el.tagName.toLowerCase() + '.' + (el.className?.toString?.().slice(0, 60) || '') }
        }
      }
      return {
        mains: document.querySelectorAll('main').length,
        h1s: document.querySelectorAll('h1').length,
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        worst,
        title: document.title,
        bodyLen: document.body.innerText.trim().length,
      }
    })
    results.push({ route, width, status, ...probe, errors: errors.slice(0, 4) })
    await page.close()
  }
  await ctx.close()
}
await browser.close()

let fails = 0
console.log('route'.padEnd(46), 'w'.padStart(5), 'code'.padStart(5), 'main'.padStart(5), 'hscroll'.padStart(9), 'text'.padStart(6))
for (const r of results) {
  const hscroll = r.scrollWidth > r.clientWidth + 1 ? `${r.scrollWidth}>${r.clientWidth}` : 'no'
  const bad = r.status !== 200 || r.mains !== 1 || hscroll !== 'no'
  if (bad) fails++
  console.log(
    (bad ? '✗ ' : '  ') + String(r.route).padEnd(44),
    String(r.width).padStart(5),
    String(r.status).padStart(5),
    String(r.mains ?? '-').padStart(5),
    hscroll.padStart(9),
    String(r.bodyLen ?? '-').padStart(6),
    r.worst ? ` widest=${r.worst}` : '',
    r.errors?.length ? ` ERR:${r.errors[0]}` : '',
  )
}
console.log(fails === 0 ? `\n✓ ${results.length} checks passed` : `\n✗ ${fails}/${results.length} checks FAILED`)
process.exit(fails === 0 ? 0 : 1)
