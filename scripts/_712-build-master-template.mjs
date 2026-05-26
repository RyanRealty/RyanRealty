#!/usr/bin/env node
/**
 * Build a master-level "Residential Sale — Legacy (Master)" template via
 * SkySlope UI (Playwright). Steps:
 *   1. Master template list page (officeid=-1)
 *   2. Click "Create Checklist" — opens blank editor
 *   3. Type name "Residential Sale — Legacy (Master)"
 *   4. Click Save — creates template, redirects with real PropertyTypeId
 *   5. Capture new id from URL
 *   6. Click "Add Items" — opens add-items form
 *   7. Loop: fill 43 rows (39 Standard-keep + 4 listing-side)
 *   8. Click Save — bulk-add
 *   9. Verify count via API
 *
 * Why master scope: SkySlope rejects PUT checklistTypeId for null-officeGuid
 * sales against office-scoped templates (HTTP 422 "ChecklistTypeId is invalid").
 * Closed sales like 712 can't have office set ("Brokers cannot update the
 * office if they are the agent on the file"). Master template is the only path.
 *
 * Usage:
 *   node scripts/_712-build-master-template.mjs              # dry-run
 *   node scripts/_712-build-master-template.mjs --execute    # actually create
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUTDIR = path.join(process.cwd(), 'tmp/712-build-master-template')
await fs.mkdir(OUTDIR, { recursive: true })

const EXECUTE = process.argv.includes('--execute')
const NEW_NAME = 'Residential Sale — Legacy (Master)'

// 39 Standard-keep activities + 4 listing-side = 43 total
const ACTIVITIES = [
  // Sales Documentation (17)
  { name: 'Residential Sale Agreement', type: 'Sales Documentation', ifApplicable: false, help: '' },
  { name: 'Pre Approval Letter or Proof of Funds', type: 'Sales Documentation', ifApplicable: true, help: '' },
  { name: 'Counter Offers', type: 'Sales Documentation', ifApplicable: true, help: '' },
  { name: 'Sale Addendums', type: 'Sales Documentation', ifApplicable: true, help: '' },
  { name: 'Professional Inspection Addendum', type: 'Sales Documentation', ifApplicable: true, help: '' },
  { name: 'Repair Addendums', type: 'Sales Documentation', ifApplicable: true, help: '' },
  { name: 'Delivery Addendum', type: 'Sales Documentation', ifApplicable: true, help: '' },
  { name: 'Owner Association Addendum', type: 'Sales Documentation', ifApplicable: true, help: 'OREF 024' },
  { name: 'Solar Panel Addendum', type: 'Sales Documentation', ifApplicable: true, help: '' },
  { name: 'Wood Stove Fireplace Insert Addendum', type: 'Sales Documentation', ifApplicable: true, help: 'OREF 046' },
  { name: 'Contingency Removal Addendum', type: 'Sales Documentation', ifApplicable: true, help: 'OREF 059 or 060' },
  { name: 'Agreement to Occupy', type: 'Sales Documentation', ifApplicable: true, help: 'OREF 053' },
  { name: 'Bill Of Sale', type: 'Sales Documentation', ifApplicable: true, help: '' },
  { name: 'VA/FHA Ammendatory Clause', type: 'Sales Documentation', ifApplicable: true, help: '' },
  { name: 'Contingent Right To Purchase', type: 'Sales Documentation', ifApplicable: true, help: 'OREF 083' },
  { name: 'Notice to Buyer | Seller', type: 'Sales Documentation', ifApplicable: true, help: 'OREF 091 / 109 / 110 family' },
  { name: 'Termination of Contract', type: 'Sales Documentation', ifApplicable: true, help: 'OREF 057' },

  // Miscellaneous Documentation (3)
  { name: 'Documentation of Repairs or Maintenance', type: 'Miscellaneous Documentation', ifApplicable: true, help: '' },
  { name: 'Transaction Timeline', type: 'Miscellaneous Documentation', ifApplicable: false, help: '' },
  { name: 'Broker Notes', type: 'Miscellaneous Documentation', ifApplicable: false, help: 'Transaction summary PDF uploaded here by audit pipeline.' },

  // Disclosures (9 + 2 listing-side = 11)
  { name: 'Sellers Property Disclosures', type: 'Disclosures', ifApplicable: false, help: 'OREF 020 / OREF 028 addendum.' },
  { name: 'Lead Based Paint Disclosure', type: 'Disclosures', ifApplicable: true, help: 'OREF 021 — required for pre-1978 homes.' },
  { name: 'Electronic Funds Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'Real Estate Compensation Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'FIRPTA Advisory', type: 'Disclosures', ifApplicable: true, help: 'IRC §1445 — only required when seller is non-US.' },
  { name: 'Real Estate Forms Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'Smoke Alarms Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'Association Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'Lead Based Paint Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'Oregon DataShare Property Data Form', type: 'Disclosures', ifApplicable: true, help: 'MLS input form / Oregon DataShare residential property data.' },
  { name: 'Disclosed Limited Agency Agreement for Sellers', type: 'Disclosures', ifApplicable: true, help: 'OREF 040 — distinct from the generic Disclosed Limited Agency activity.' },

  // Reports (4)
  { name: 'CCRs', type: 'Reports', ifApplicable: true, help: '' },
  { name: 'Association Documents', type: 'Reports', ifApplicable: true, help: '' },
  { name: 'Appraisal', type: 'Reports', ifApplicable: true, help: '' },
  { name: 'Home Inspection', type: 'Reports', ifApplicable: true, help: '' },

  // Closing Documents (5)
  { name: 'Broker Commission Demand from Title', type: 'Closing Documents', ifApplicable: true, help: 'OREF 091 satisfies; standalone demand often unnecessary.' },
  { name: 'Earnest Money Receipt', type: 'Closing Documents', ifApplicable: false, help: '' },
  { name: 'Preliminary Title Report', type: 'Closing Documents', ifApplicable: false, help: '' },
  { name: 'Final HUD', type: 'Closing Documents', ifApplicable: false, help: 'Final Settlement Statement / ALTA / CD.' },
  { name: 'Initial Agency Disclosure (042 | 10.4)', type: 'Closing Documents', ifApplicable: true, help: 'ORS 696.820 = delivery only (signature link in email signature suffices).' },

  // Buyer Agreement Documentation (1 generic DLA — kept for buyer-side DLA if mixed file)
  { name: 'Disclosed Limited Agency', type: 'Buyer Agreement Documentation', ifApplicable: true, help: 'OREF 041 — buyer-side. Distinct from "Disclosed Limited Agency Agreement for Sellers".' },

  // Sales Documentation — listing-side additions (2)
  { name: 'Listing Agreement', type: 'Sales Documentation', ifApplicable: false, help: 'OREF 015 Exclusive Right to Sell or equivalent.' },
  { name: 'MLSCO Listing Contract', type: 'Sales Documentation', ifApplicable: true, help: 'Regional MLS listing contract (Multiple Listing Service of Central Oregon).' },
]

console.log(`MODE: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
console.log(`Target name: "${NEW_NAME}"`)
console.log(`Activities to add: ${ACTIVITIES.length}\n`)

if (!EXECUTE) {
  console.log('[DRY RUN] Activities to be added:')
  for (let i = 0; i < ACTIVITIES.length; i++) {
    const a = ACTIVITIES[i]
    console.log(`  ${(i+1).toString().padStart(2)}. ${a.type.padEnd(30)} ${a.name}  ${a.ifApplicable ? '(Optional)' : '(Required)'}`)
  }
  console.log(`\nRe-run with --execute to create.`)
  process.exit(0)
}

const browser = await chromium.launch({ headless: true, slowMo: 80 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1600, height: 1200 } })
const page = await context.newPage()
let snapIdx = 0
async function snap(label) {
  await page.screenshot({ path: path.join(OUTDIR, `${String(snapIdx++).padStart(2, '0')}-${label}.png`) })
}

const manifest = { newName: NEW_NAME, activities: ACTIVITIES.length }

try {
  console.log('1. Open master template list')
  await page.goto('https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=-1&Type=MQ==', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (/LoginIntegrated/i.test(page.url())) throw new Error('Session expired')
  await snap('master-list')

  console.log('2. Click Create Checklist')
  const createBtn = page.locator('a:has-text("Create Checklist")').first()
  await createBtn.click()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1500)
  await snap('blank-editor')

  console.log('3. Type checklist name')
  const nameInput = page.locator('#ContentPlaceHolder1_txtChecklistName')
  await nameInput.fill(NEW_NAME)
  await snap('name-typed')

  console.log('4. Click Save to create')
  const saveBtn = page.locator('#ContentPlaceHolder1_imgbtnSave').first()
  await saveBtn.click()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2500)
  await snap('after-save')

  // Capture new template ID from URL
  const url = new URL(page.url())
  const ptIdRaw = url.searchParams.get('PropertyTypeId')
  let newId = null
  if (ptIdRaw) {
    try { newId = Buffer.from(decodeURIComponent(ptIdRaw), 'base64').toString('utf8') } catch {}
  }
  console.log(`   New template id: ${newId} (url ${url.pathname}?...PropertyTypeId=${ptIdRaw})`)
  manifest.newId = newId
  if (!newId || !/^\d+$/.test(newId)) {
    await snap('id-capture-failure')
    throw new Error(`Could not capture new template id (got "${newId}")`)
  }

  console.log(`5. Click Add Items to start activity-add form`)
  const addBtn = page.getByRole('link', { name: /^Add Items$/i }).first()
  await addBtn.waitFor({ state: 'visible', timeout: 5000 })
  await addBtn.click()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2000)
  await snap('add-items-form')

  console.log(`6. Fill ${ACTIVITIES.length} rows`)
  for (let i = 0; i < ACTIVITIES.length; i++) {
    const a = ACTIVITIES[i]
    const res = await page.evaluate(({ index, def }) => {
      const nameInputs = [...document.querySelectorAll('input[type="text"]')].filter((e) =>
        /activityname/i.test((e.name || '') + ' ' + (e.id || '')) && e.offsetParent !== null,
      )
      if (!nameInputs[index]) return { ok: false, reason: 'no row at index', count: nameInputs.length }
      const ni = nameInputs[index]
      ni.focus()
      ni.value = def.name
      ni.dispatchEvent(new Event('input', { bubbles: true }))
      ni.dispatchEvent(new Event('change', { bubbles: true }))
      const row = ni.closest('tr')
      const sel = row?.querySelector('select')
      if (sel) {
        const opt = [...sel.options].find((o) => o.text.trim() === def.type)
        if (opt) {
          sel.value = opt.value
          sel.dispatchEvent(new Event('change', { bubbles: true }))
        } else {
          return { ok: false, reason: 'type not in options', want: def.type, have: [...sel.options].map(o => o.text) }
        }
      }
      const help = row?.querySelector('input[type="text"][id*="HelpText" i], input[type="text"][name*="HelpText" i], textarea[id*="HelpText" i], textarea[name*="HelpText" i]')
      if (help && def.help) {
        help.value = def.help
        help.dispatchEvent(new Event('input', { bubbles: true }))
        help.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const ifApp = row?.querySelector('input[type="checkbox"][id*="IfApplicable" i], input[type="checkbox"][name*="IfApplicable" i]')
      if (ifApp) {
        ifApp.checked = !!def.ifApplicable
        ifApp.dispatchEvent(new Event('change', { bubbles: true }))
      }
      return { ok: true }
    }, { index: i, def: a })
    if (!res.ok) {
      console.log(`     Row ${i+1} FAILED: ${JSON.stringify(res)}`)
      throw new Error(`Row ${i+1} fill failed`)
    }
    if (i % 10 === 0) console.log(`   filled row ${i+1}/${ACTIVITIES.length} "${a.name}"`)
    // Wait for SkySlope to render the next empty row (form expands after each fill)
    await page.waitForTimeout(300)
  }
  await snap('all-rows-filled')

  console.log(`7. Click Save to bulk-create activities`)
  const saveAll = page.locator('a:has-text("Save"), input[type="submit"][value="Save"]').first()
  await saveAll.click()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(4000)
  await snap('after-bulk-save')

  console.log(`8. Verify via API`)
  // Re-login the SkySlope API and check master list
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

  // Reading .env.local from disk because Playwright doesn't share envs
  const envFile = await fs.readFile('.env.local', 'utf8')
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?(.+?)"?$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
  const session = await login()
  const hdrs = { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
  const lr = await fetch('https://api-latest.skyslope.com/api/checklistTypes?TransactionType=Sale', { headers: hdrs })
  const masterList = await lr.json()
  const items = masterList.value?.checklistTypes || masterList.value || []
  const found = items.find((t) => Number(t.id || t.checklistTypeId) === Number(newId))
  console.log(`   Master list contains new template id=${newId}: ${found ? 'YES — ' + (found.name || found.checklistTypeName) : 'NO'}`)
  manifest.verified = !!found

  console.log(`\nDONE. New master template id=${newId} name="${NEW_NAME}" activities=${ACTIVITIES.length}`)
} catch (e) {
  console.error(`ERROR: ${e.message}`)
  manifest.error = e.message
  await snap('error')
}

await fs.writeFile(path.join(OUTDIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`Manifest: ${path.relative(process.cwd(), path.join(OUTDIR, 'manifest.json'))}`)
await browser.close()
