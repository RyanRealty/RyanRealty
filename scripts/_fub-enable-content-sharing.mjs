#!/usr/bin/env node
// One continuous headless session: log into FUB, open email settings, report
// (and optionally flip) the email-content sharing control that gates API
// content visibility. --apply actually changes the setting; default is recon.
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const APPLY = process.argv.includes('--apply')
const SNAP = path.join(process.cwd(), 'tmp/fub-sharing-snaps')
await fs.mkdir(SNAP, { recursive: true })

const raw = await fs.readFile('.env.local', 'utf8')
const env = {}
for (const line of raw.split('\n')) {
  const i = line.indexOf('=')
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
const page = await context.newPage()

await page.goto('https://app.followupboss.com/login', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
async function clickFirst(scope, selectors) {
  for (const sel of selectors) {
    const loc = scope.locator(sel).first()
    if (await loc.count()) { await loc.click({ timeout: 5000 }).catch(() => {}); return true }
  }
  return false
}
try {
  const emailInput = page.locator('input[type="email"], input[name*="email" i], input[id*="email" i], input[autocomplete="username"]').first()
  await emailInput.waitFor({ state: 'visible', timeout: 30000 })
  await emailInput.fill(env.FUB_LOGIN_EMAIL)
  const pwInput = page.locator('input[type="password"]').first()
  await pwInput.waitFor({ state: 'visible', timeout: 10000 })
  await pwInput.fill(env.FUB_LOGIN_PASSWORD)
  await clickFirst(page, ['button[type="submit"]', 'button:has-text("Sign In")', 'button:has-text("Log In")', 'input[type="submit"]'])
} catch (e) { console.log('login fill warn:', e.message.slice(0, 120)) }
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000)
  if (/followupboss\.com\/2\//.test(page.url())) break
}
console.log('post-login URL:', page.url())

// Email settings (FUB 2.0)
await page.goto('https://ryan-realty.followupboss.com/2/settings/email', { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForTimeout(5000)
console.log('settings URL:', page.url())
await page.screenshot({ path: path.join(SNAP, 'email-settings.png'), fullPage: true })

const text = await page.evaluate(() => document.body.innerText)
console.log('--- PAGE TEXT (sharing-relevant lines) ---')
for (const line of text.split('\n')) {
  if (/shar|privacy|content|visib/i.test(line)) console.log(' ·', line.trim())
}

// Find sharing-related controls
const controls = await page.evaluate(() => {
  const out = []
  document.querySelectorAll('select, input[type="radio"], input[type="checkbox"], button[role="combobox"], [class*="select" i]').forEach((el) => {
    const label = (el.closest('label')?.innerText || el.closest('[class*="field" i], [class*="row" i], section, fieldset')?.innerText || '').slice(0, 140)
    if (/shar|content|visib|privacy/i.test(label)) {
      out.push({ tag: el.tagName, type: el.type ?? null, label: label.replace(/\n+/g, ' '), value: el.value ?? null, checked: el.checked ?? null })
    }
  })
  return out
})
console.log('--- SHARING CONTROLS ---')
console.log(JSON.stringify(controls, null, 1))

if (APPLY && controls.length) {
  // Select the most permissive sharing option on a <select>-style control
  const changed = await page.evaluate(() => {
    let did = []
    document.querySelectorAll('select').forEach((sel) => {
      const ctx = (sel.closest('label, [class*="field" i], [class*="row" i], section, fieldset')?.innerText || '')
      if (!/shar/i.test(ctx)) return
      const opts = [...sel.options]
      const target = opts.find((o) => /everyone|all users|share with everyone/i.test(o.text))
      if (target && sel.value !== target.value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
        setter.call(sel, target.value)
        sel.dispatchEvent(new Event('change', { bubbles: true }))
        did.push(ctx.slice(0, 80) + ' → ' + target.text)
      }
    })
    return did
  })
  console.log('APPLIED:', JSON.stringify(changed))
  await page.waitForTimeout(2000)
  // press any visible Save
  const save = page.locator('button:has-text("Save")').first()
  if (await save.count()) { await save.click().catch(() => {}); console.log('clicked Save') }
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(SNAP, 'after-apply.png'), fullPage: true })
}

await context.storageState({ path: 'tmp/fub-session.json' })
await browser.close()
console.log('done — snaps in tmp/fub-sharing-snaps/')
