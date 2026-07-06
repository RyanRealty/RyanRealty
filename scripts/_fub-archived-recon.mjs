#!/usr/bin/env node
// READ-ONLY recon: log into FUB, list Automations + their status, and open a
// contact that received the "archived" emails to see what is scheduling them.
// Saves screenshots + a text dump to tmp/fub-archived/. Changes nothing.
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const OUT = path.join(process.cwd(), 'tmp/fub-archived')
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
  await page.locator('button[type="submit"], button:has-text("Log In"), button:has-text("Sign In")').first().click().catch(()=>{})
  for (let i=0;i<30;i++){ await page.waitForTimeout(1500); if(/\/2\//.test(page.url())) break }
  say('post-login URL:', page.url())

  // Automations admin page (FUB 2.0)
  await page.goto('https://ryan-realty.followupboss.com/2/automations', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{})
  await page.waitForTimeout(5000)
  say('automations URL:', page.url())
  await page.screenshot({ path: path.join(OUT, 'automations.png'), fullPage: true })
  const autoText = await page.evaluate(() => document.body.innerText)
  say('\n=== AUTOMATIONS PAGE TEXT ===')
  for (const line of autoText.split('\n').map(s=>s.trim()).filter(Boolean)) {
    if (/archiv|nurture|remote|expired|active|paused|on|off|automation/i.test(line) && line.length < 90) say(' ·', line)
  }

  // A recipient of the archived emails (Nadean, fub 27007)
  await page.goto('https://ryan-realty.followupboss.com/2/people/view/27007', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{})
  await page.waitForTimeout(5000)
  say('\ncontact URL:', page.url())
  await page.screenshot({ path: path.join(OUT, 'contact-27007.png'), fullPage: true })
  const cText = await page.evaluate(() => document.body.innerText)
  say('\n=== CONTACT TEXT (scheduled / automation / archived lines) ===')
  for (const line of cText.split('\n').map(s=>s.trim()).filter(Boolean)) {
    if (/schedul|upcoming|automation|action plan|archiv|email|queued|will send/i.test(line) && line.length < 110) say(' ·', line)
  }
} catch (e) { say('ERR', e.message) } finally {
  await fs.writeFile(path.join(OUT, 'recon.txt'), log.join('\n'))
  await browser.close()
  say('\nsaved to tmp/fub-archived/')
}
