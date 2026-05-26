#!/usr/bin/env node
/**
 * Toggle "If Applicable" (Optional) on 35 of 43 activities of master
 * template 1784578 ("Residential Sale — Legacy (Master)").
 *
 * Keep these 8 as Required (no If Applicable toggle):
 *   Residential Sale Agreement, Sellers Property Disclosures,
 *   Disclosed Limited Agency Agreement for Sellers, Listing Agreement,
 *   Broker Notes, Earnest Money Receipt, Preliminary Title Report,
 *   Final HUD.
 *
 * Drives the activity-edit UI per activityId. Each edit:
 *   1. Navigate to BrokerCheckListActivity.aspx?id=<b64(activityId)>
 *   2. Check "If Applicable" checkbox if not already checked
 *   3. Click Save
 *
 * Usage:
 *   node scripts/_712-master-template-toggle-optional.mjs              # dry-run
 *   node scripts/_712-master-template-toggle-optional.mjs --execute    # apply
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUTDIR = 'tmp/712-master-template-toggle'
await fs.mkdir(OUTDIR, { recursive: true })

const EXECUTE = process.argv.includes('--execute')
const TEMPLATE_ID = 1784578
const TEMPLATE_NAME = 'Residential Sale — Legacy (Master)'

// 8 activity names to KEEP Required (don't toggle).
const KEEP_REQUIRED = new Set([
  'Residential Sale Agreement',
  'Sellers Property Disclosures',
  'Disclosed Limited Agency Agreement for Sellers',
  'Listing Agreement',
  'Broker Notes',
  'Earnest Money Receipt',
  'Preliminary Title Report',
  'Final HUD',
])

function b64(n) { return Buffer.from(String(n)).toString('base64') }

async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim()).update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
  const r = await fetch('https://api-latest.skyslope.com/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}

// Pull activity IDs by reading 712's current sale detail (it's on this template right now)
const session = await login()
const hdrs = { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
const fr = await fetch('https://api-latest.skyslope.com/api/files/sales/f50fe2a6-226c-4f81-8a59-9fc9a46ea5df', { headers: hdrs })
const sale = (await fr.json()).value?.sale
const activities = sale?.checklist?.activities || []
if (sale?.checklistType !== TEMPLATE_NAME) {
  console.error(`712 is not on ${TEMPLATE_NAME} — it's on "${sale?.checklistType}". Switch back first.`)
  process.exit(1)
}
console.log(`MODE: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
console.log(`Template ${TEMPLATE_ID} (${TEMPLATE_NAME}) has ${activities.length} activities`)

const targets = activities.filter((a) => {
  const n = (a.activityName || '').trim()
  return !KEEP_REQUIRED.has(n) && a.status === 'Required'
})
console.log(`Toggle target: ${targets.length} activities (those not in keep-required + currently Required)\n`)
for (const a of targets) {
  console.log(`  ${a.activityId} "${(a.activityName||'').trim()}"`)
}
if (!EXECUTE) {
  console.log(`\n[DRY RUN] Re-run with --execute to apply.`)
  process.exit(0)
}

const browser = await chromium.launch({ headless: true, slowMo: 60 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()
let snapIdx = 0
async function snap(label) {
  await page.screenshot({ path: path.join(OUTDIR, `${String(snapIdx++).padStart(2, '0')}-${label}.png`) })
}

const manifest = { templateId: TEMPLATE_ID, total: targets.length, results: [] }

let okCount = 0
let failCount = 0
for (let i = 0; i < targets.length; i++) {
  const a = targets[i]
  const name = (a.activityName || '').trim()
  const url = `https://app.skyslope.com/BrokerCheckListActivity.aspx?${new URLSearchParams({
    id: b64(a.activityId),
    CLID: 'MQ==', // Type=1 (Transaction)
    ALID: b64(a.typeName || 'Sales Documentation'),
    PTId: String(TEMPLATE_ID),
    CheckListType: '1',
    checkSingleOfficeAuditor: 'No',
    officeid: '0',
    CheckListName: TEMPLATE_NAME,
    ParentID: '0',
  })}`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  if (/LoginIntegrated/i.test(page.url())) throw new Error('Session expired')

  // Tick If Applicable + click Save
  const res = await page.evaluate(() => {
    const cbs = [...document.querySelectorAll('input[type="checkbox"]')].filter((e) => e.offsetParent !== null)
    const ifApp = cbs.find((c) =>
      /ifapplicable/i.test((c.name || '') + ' ' + (c.id || '')) ||
      /if[\s_-]?applicable/i.test((c.parentElement?.innerText || '')),
    )
    if (!ifApp) return { ok: false, reason: 'no if-applicable checkbox', candidates: cbs.map((c) => ({ id: c.id, name: c.name })) }
    const was = ifApp.checked
    if (!ifApp.checked) {
      ifApp.checked = true
      ifApp.dispatchEvent(new Event('change', { bubbles: true }))
      ifApp.dispatchEvent(new Event('click', { bubbles: true }))
    }
    // Save button
    const save = [...document.querySelectorAll('a, input[type="submit"], button')].find((e) =>
      e.offsetParent !== null && /^save$/i.test((e.innerText || e.value || '').trim()),
    )
    if (!save) return { ok: false, reason: 'no save button', wasChecked: was }
    save.click()
    return { ok: true, wasChecked: was, nowChecked: ifApp.checked }
  })

  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1500)

  if (res.ok) {
    okCount++
    if ((i + 1) % 5 === 0 || i === targets.length - 1) {
      console.log(`  [${i+1}/${targets.length}] ${a.activityId} "${name}" — was=${res.wasChecked} now=${res.nowChecked}`)
    }
  } else {
    failCount++
    console.log(`  [${i+1}/${targets.length}] ${a.activityId} "${name}" FAIL: ${res.reason}`)
    await snap(`fail-${a.activityId}`)
  }
  manifest.results.push({ activityId: a.activityId, name, ...res })
}

console.log(`\n=== SUMMARY ===`)
console.log(`OK: ${okCount}/${targets.length}`)
console.log(`Failed: ${failCount}`)

await fs.writeFile(path.join(OUTDIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
await browser.close()
