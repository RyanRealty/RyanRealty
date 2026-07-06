#!/usr/bin/env node
// READ-ONLY: log into FUB UI, then pull the timeline AuditLog/CreationInfo JSON
// for given person ids via the internal API from page context (session-cookied).
// Usage: node scripts/_fub-auditlog-pull.mjs 21801 8253 16186
// Saves tmp/fub-changelog/audit-<id>.json. Changes nothing.
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const ids = process.argv.slice(2).map(Number).filter(Boolean)
if (!ids.length) { console.error('usage: node scripts/_fub-auditlog-pull.mjs <personId...>'); process.exit(1) }
const OUT = path.join(process.cwd(), 'tmp/fub-changelog')
await fs.mkdir(OUT, { recursive: true })
const env = {}
for (const line of (await fs.readFile('.env.local', 'utf8')).split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
}

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage()
try {
  await page.goto('https://app.followupboss.com/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('input[type="email"], input[name*="email" i]').first().fill(env.FUB_LOGIN_EMAIL)
  await page.locator('input[type="password"]').first().fill(env.FUB_LOGIN_PASSWORD)
  await page.locator('button:has-text("LOGIN"), button[type="submit"]').first().click().catch(() => {})
  await page.keyboard.press('Enter').catch(() => {})
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1500)
    if (/\/2\//.test(page.url())) break
    if (i === 12) { // retry the submit once
      await page.locator('button:has-text("LOGIN"), button[type="submit"]').first().click().catch(() => {})
      await page.keyboard.press('Enter').catch(() => {})
    }
  }
  console.log('post-login URL:', page.url())
  if (!/followupboss\.com\/2\//.test(page.url())) throw new Error('login failed')

  // The internal API rejects bare fetches (CSRF headers), so let the SPA make
  // its own timeline calls and capture the response bodies.
  for (const pid of ids) {
    const captured = []
    const onResp = async (r) => {
      if (r.url().includes('/api/v1/timeline') && r.url().includes(`personId=${pid}`)) {
        try { captured.push(await r.text()) } catch { /* stream gone */ }
      }
    }
    page.on('response', onResp)
    await page.goto(`https://ryan-realty.followupboss.com/2/people/view/${pid}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(9000)
    page.off('response', onResp)
    await fs.writeFile(path.join(OUT, `audit-${pid}.json`), JSON.stringify(captured.map((c) => { try { return JSON.parse(c) } catch { return c } }), null, 1))
    console.log(`\n===== person ${pid} — captured ${captured.length} timeline responses (page: ${page.url()})`)
    for (const c of captured) {
      try {
        const j = JSON.parse(c)
        const items = j.timeline ?? j.items ?? j.data ?? []
        for (const it of Array.isArray(items) ? items : []) {
          const s = JSON.stringify(it)
          if (/audit|name|creation|changed|updated/i.test(s)) console.log(' ·', s.slice(0, 420))
        }
      } catch { /* non-json */ }
    }
  }
} finally {
  await browser.close()
}
