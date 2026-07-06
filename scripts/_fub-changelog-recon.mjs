#!/usr/bin/env node
// READ-ONLY recon: log into FUB UI and pull the per-contact CHANGELOG for the
// name-corruption investigation (Kevin Hoffman 21801, Lanny Olivier 8253,
// Lanny Olivieri 16186). The changelog exists only in the UI, not the API.
// Saves screenshots + text to tmp/fub-changelog/. Changes nothing.
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const OUT = path.join(process.cwd(), 'tmp/fub-changelog')
await fs.mkdir(OUT, { recursive: true })
const env = {}
for (const line of (await fs.readFile('.env.local', 'utf8')).split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
}

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage()
const log = []
const say = (...a) => { console.log(...a); log.push(a.join(' ')) }

try {
  await page.goto('https://app.followupboss.com/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.locator('input[type="email"], input[name*="email" i]').first().fill(env.FUB_LOGIN_EMAIL)
  await page.locator('input[type="password"]').first().fill(env.FUB_LOGIN_PASSWORD)
  await page.locator('button:has-text("LOGIN"), button[type="submit"], button:has-text("Log In"), button:has-text("Sign In")').first().click().catch(() => {})
  await page.keyboard.press('Enter').catch(() => {})
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(1500); if (/\/2\//.test(page.url())) break }
  say('post-login URL:', page.url())

  // Capture the UI's own API traffic so we can find the changelog endpoint.
  const apiHits = []
  page.on('response', (r) => {
    const u = r.url()
    if (/changelog|history|audit|events/i.test(u)) apiHits.push(u)
  })

  for (const pid of [21801, 8253, 16186]) {
    await page.goto(`https://ryan-realty.followupboss.com/2/people/view/${pid}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(6000)
    say(`\n===== person ${pid} — ${page.url()}`)
    await page.screenshot({ path: path.join(OUT, `person-${pid}.png`), fullPage: false })

    // Try to open a changelog / history affordance.
    for (const sel of ['text=Changelog', 'text=Change Log', 'text=History', '[aria-label*="hangelog"]']) {
      const el = page.locator(sel).first()
      if (await el.count().catch(() => 0)) { await el.click().catch(() => {}); await page.waitForTimeout(2500); say('clicked', sel); break }
    }
    // Also try the ... / kebab menu.
    const kebab = page.locator('button[aria-label*="more" i], button:has-text("···"), [data-testid*="menu"]').first()
    if (await kebab.count().catch(() => 0)) {
      await kebab.click().catch(() => {})
      await page.waitForTimeout(1200)
      const dump = await page.evaluate(() => document.body.innerText)
      const menuLines = dump.split('\n').map((s) => s.trim()).filter((s) => /changelog|history|log/i.test(s) && s.length < 40)
      say('kebab menu candidates:', JSON.stringify(menuLines))
      const cl = page.locator('text=/changelog/i').first()
      if (await cl.count().catch(() => 0)) { await cl.click().catch(() => {}); await page.waitForTimeout(3000); say('opened changelog via kebab') }
      else await page.keyboard.press('Escape').catch(() => {})
    }
    await page.screenshot({ path: path.join(OUT, `person-${pid}-after.png`), fullPage: true })
    const text = await page.evaluate(() => document.body.innerText)
    await fs.writeFile(path.join(OUT, `person-${pid}.txt`), text)
    const interesting = text.split('\n').map((s) => s.trim()).filter((s) =>
      /changed|updated|renamed|name|merge|created|changelog/i.test(s) && s.length > 8 && s.length < 140)
    say(`text lines of interest (${interesting.length}):`)
    for (const l of interesting.slice(0, 40)) say(' ·', l)
  }
  say('\nAPI endpoints seen:', JSON.stringify([...new Set(apiHits)].slice(0, 10), null, 1))
} catch (e) { say('ERR', e.message) } finally {
  await fs.writeFile(path.join(OUT, 'recon.txt'), log.join('\n'))
  await browser.close()
  say('saved to tmp/fub-changelog/')
}
