#!/usr/bin/env node
// READ-ONLY: login to FUB, navigate to contacts VIA THE SPA (search box — direct
// URL navigation bounces the subdomain session), capture /api/v1/timeline
// responses (types include AuditLog = the UI changelog). Saves JSON per person.
// Usage: node scripts/_fub-auditlog-via-search.mjs "Kevin Hoffman" "Lanny Olivier" "Lanny Olivieri"
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const queries = process.argv.slice(2)
if (!queries.length) { console.error('usage: node scripts/_fub-auditlog-via-search.mjs "<name>"...'); process.exit(1) }
const OUT = path.join(process.cwd(), 'tmp/fub-changelog')
await fs.mkdir(OUT, { recursive: true })
const env = {}
for (const line of (await fs.readFile('.env.local', 'utf8')).split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
}

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage()
const captured = []
page.on('response', async (r) => {
  if (r.url().includes('/api/v1/timeline')) {
    try { captured.push({ url: r.url(), status: r.status(), body: await r.text() }) } catch { /* gone */ }
  }
})

try {
  await page.goto('https://app.followupboss.com/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('input[type="email"], input[name*="email" i]').first().fill(env.FUB_LOGIN_EMAIL)
  await page.locator('input[type="password"]').first().fill(env.FUB_LOGIN_PASSWORD)
  await page.locator('button:has-text("LOGIN"), button[type="submit"]').first().click().catch(() => {})
  await page.keyboard.press('Enter').catch(() => {})
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(1500); if (/\/2\//.test(page.url())) break }
  console.log('post-login URL:', page.url())
  if (!/followupboss\.com\/2\//.test(page.url())) throw new Error('login failed')
  await page.waitForTimeout(5000)

  for (const q of queries) {
    captured.length = 0
    // Open the global search (FUB 2.0 top bar).
    const search = page.locator('input[placeholder*="earch" i], [role="combobox"] input, input[type="search"]').first()
    if (await search.count()) {
      await search.click().catch(() => {})
      await search.fill(q).catch(() => {})
    } else {
      await page.keyboard.press('/').catch(() => {})
      await page.waitForTimeout(800)
      await page.keyboard.type(q)
    }
    await page.waitForTimeout(3500)
    await page.screenshot({ path: path.join(OUT, `search-${q.replace(/\W+/g, '_')}.png`) })
    // Click the first person result mentioning the query's last word.
    const result = page.locator(`text=${q}`).first()
    if (await result.count()) await result.click().catch(() => {})
    else await page.keyboard.press('Enter').catch(() => {})
    await page.waitForTimeout(8000)
    console.log(`\n===== "${q}" — page: ${page.url()} · timeline responses: ${captured.length}`)
    await page.screenshot({ path: path.join(OUT, `person-${q.replace(/\W+/g, '_')}.png`), fullPage: false })
    const all = captured.map((c) => { let j = null; try { j = JSON.parse(c.body) } catch {}; return { url: c.url, status: c.status, json: j } })
    await fs.writeFile(path.join(OUT, `audit-${q.replace(/\W+/g, '_')}.json`), JSON.stringify(all, null, 1))
    for (const c of all) {
      const items = c.json?.timeline ?? c.json?.items ?? []
      for (const it of Array.isArray(items) ? items : []) {
        const s = JSON.stringify(it)
        if (/audit|creation|changed|name/i.test(s)) console.log(' ·', s.slice(0, 420))
      }
    }
  }
} catch (e) { console.log('ERR', e.message) } finally {
  await browser.close()
}
