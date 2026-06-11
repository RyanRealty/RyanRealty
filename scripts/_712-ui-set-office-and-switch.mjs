#!/usr/bin/env node
/**
 * Attempt to set Ryan Realty office on 712 via CreateTransaction UI save,
 * then PUT checklistTypeId=1784213 via API.
 *
 * Usage:
 *   node scripts/_712-ui-set-office-and-switch.mjs           # dry-run
 *   node scripts/_712-ui-set-office-and-switch.mjs --execute
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STATE_PATH = path.join(REPO, 'tmp/skyslope-session.json')
const OUT = path.join(REPO, 'tmp/712-ui-office-switch')
const EXECUTE = process.argv.includes('--execute')
const GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'
const TXN_B64 = Buffer.from('21849771').toString('base64')
const URL = `https://app.skyslope.com/CreateTransaction.aspx?TransactionID=${TXN_B64}&ListingID=MA==&checklistId=MA==`
const TEMPLATE_ID = 1784213
const BASE = 'https://api-latest.skyslope.com'

await fs.mkdir(OUT, { recursive: true })

async function loadEnvLocal() {
  const txt = await fs.readFile(path.join(REPO, '.env.local'), 'utf8')
  for (const raw of txt.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = val
  }
}

async function apiLogin() {
  const ts = new Date().toISOString()
  const e = process.env
  const hmac = crypto
    .createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`,
      Timestamp: ts,
    },
    body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}

async function fetchSale(session) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}`, {
    headers: { Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' },
  })
  return (await r.json()).value?.sale ?? {}
}

async function tryPutTemplate(session) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}/checklistType`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Session: session,
      timestamp: new Date().toISOString(),
      Accept: 'application/json',
    },
    body: JSON.stringify({ checklistTypeId: TEMPLATE_ID }),
  })
  return { status: r.status, body: await r.text() }
}

await loadEnvLocal()
const session = await apiLogin()
const beforeSale = await fetchSale(session)
console.log(`Before API: officeGuid=${beforeSale.officeGuid ?? 'null'} checklistType="${beforeSale.checklistType}"`)

const browser = await chromium.launch({ headless: true, slowMo: 100 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await page.screenshot({ path: path.join(OUT, '01-open.png'), fullPage: true })

const formState = await page.evaluate(() => {
  const pick = (id) => {
    const el = document.getElementById(id)
    if (!el) return null
    return {
      id,
      tag: el.tagName,
      disabled: el.disabled,
      value: el.value,
      options: el.tagName === 'SELECT' ? [...el.options].map((o) => ({ text: o.text.trim(), value: o.value })) : undefined,
    }
  }
  return {
    ddlCheckListOffice: pick('ddlCheckListOffice'),
    ddlProperty: pick('ContentPlaceHolder1_ddlProperty'),
    ddlAgentOffice: pick('ContentPlaceHolder1_ddlAgentOffice'),
    ddlOffice: pick('ContentPlaceHolder1_ddlOffice'),
    ddlAgent: pick('ContentPlaceHolder1_ddlAgent'),
    allSelects: [...document.querySelectorAll('select')].map((s) => ({
      id: s.id,
      name: s.name,
      visible: s.offsetParent !== null,
      disabled: s.disabled,
      value: s.value,
      optionCount: s.options.length,
      sampleOptions: [...s.options].slice(0, 8).map((o) => o.text.trim()),
    })),
    saveButtons: [...document.querySelectorAll('input[type="submit"], button, a.btn')].map((b) => ({
      tag: b.tagName,
      id: b.id,
      text: (b.value || b.innerText || '').trim().slice(0, 40),
      visible: b.offsetParent !== null,
    })).filter((b) => /save|update|submit/i.test(b.text + ' ' + b.id) && b.visible),
  }
})
console.log(JSON.stringify(formState, null, 2))

if (EXECUTE) {
  // Force-enable office dropdown if disabled, select Ryan Realty LLC
  await page.evaluate(() => {
    const office = document.getElementById('ddlCheckListOffice')
    if (office) {
      office.disabled = false
      office.value = '28920'
      office.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const agentOffice = document.getElementById('ContentPlaceHolder1_ddlAgentOffice')
    if (agentOffice) {
      agentOffice.disabled = false
      const opt = [...agentOffice.options].find((o) => /Ryan Realty/i.test(o.text))
      if (opt) {
        agentOffice.value = opt.value
        agentOffice.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
  })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: path.join(OUT, '02-office-selected.png'), fullPage: true })

  const saveBtn = page.locator('input[type="submit"][value="Save"], input[type="submit"][value="Update"], #ContentPlaceHolder1_btnSave').first()
  if (await saveBtn.count()) {
    console.log('Clicking Save on CreateTransaction...')
    await saveBtn.click()
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(3000)
    await page.screenshot({ path: path.join(OUT, '03-after-save.png'), fullPage: true })
  } else {
    console.log('No Save button found — probing all submits')
    const submits = await page.evaluate(() =>
      [...document.querySelectorAll('input[type="submit"]')].map((s) => ({ id: s.id, value: s.value, visible: s.offsetParent !== null })),
    )
    console.log(submits)
  }
} else {
  console.log('\n[DRY RUN] Would attempt UI office save, then API PUT checklistType.')
}

await browser.close()

const afterUiSale = await fetchSale(session)
console.log(`\nAfter UI: officeGuid=${afterUiSale.officeGuid ?? 'null'} checklistType="${afterUiSale.checklistType}"`)

if (EXECUTE) {
  const put = await tryPutTemplate(session)
  console.log(`PUT checklistTypeId=${TEMPLATE_ID}: HTTP ${put.status}`)
  console.log(put.body.slice(0, 400))
  const afterPut = await fetchSale(session)
  console.log(`After PUT: officeGuid=${afterPut.officeGuid ?? 'null'} checklistType="${afterPut.checklistType}" activities=${afterPut.checklist?.activities?.length ?? 0}`)
}
