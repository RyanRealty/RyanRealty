#!/usr/bin/env node
/**
 * Add 43 activities to master template 1784578 ("Residential Sale —
 * Legacy (Master)") in batches of 10 (the Add Items form maxes out at
 * 10 rows per save). After each batch, the script saves, re-clicks Add
 * Items, and continues from where it left off.
 *
 * Resumable: queries existing activities on the template at start, skips
 * any already present (matched by name).
 *
 * Usage:
 *   node scripts/_712-add-master-activities-batched.mjs --execute
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUTDIR = path.join(process.cwd(), 'tmp/712-add-master-activities-batched')
await fs.mkdir(OUTDIR, { recursive: true })

const EXECUTE = process.argv.includes('--execute')
const TEMPLATE_ID = 1784578
const TEMPLATE_NAME = 'Residential Sale — Legacy (Master)'
const BATCH_SIZE = 9  // form maxes at 10; cap at 9 to be safe

const ACTIVITIES = [
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
  { name: 'Notice to Buyer | Seller', type: 'Sales Documentation', ifApplicable: true, help: 'OREF 091 / 109 / 110' },
  { name: 'Termination of Contract', type: 'Sales Documentation', ifApplicable: true, help: 'OREF 057' },
  { name: 'Listing Agreement', type: 'Sales Documentation', ifApplicable: false, help: 'OREF 015 Exclusive Right to Sell.' },
  { name: 'MLSCO Listing Contract', type: 'Sales Documentation', ifApplicable: true, help: 'Regional MLS listing contract.' },
  { name: 'Documentation of Repairs or Maintenance', type: 'Miscellaneous Documentation', ifApplicable: true, help: '' },
  { name: 'Transaction Timeline', type: 'Miscellaneous Documentation', ifApplicable: false, help: '' },
  { name: 'Broker Notes', type: 'Miscellaneous Documentation', ifApplicable: false, help: 'Transaction summary PDF uploaded here by audit pipeline.' },
  { name: 'Sellers Property Disclosures', type: 'Disclosures', ifApplicable: false, help: 'OREF 020 / 028 addendum.' },
  { name: 'Lead Based Paint Disclosure', type: 'Disclosures', ifApplicable: true, help: 'OREF 021 — required for pre-1978 homes.' },
  { name: 'Electronic Funds Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'Real Estate Compensation Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'FIRPTA Advisory', type: 'Disclosures', ifApplicable: true, help: 'IRC 1445 — only when seller is non-US.' },
  { name: 'Real Estate Forms Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'Smoke Alarms Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'Association Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'Lead Based Paint Advisory', type: 'Disclosures', ifApplicable: true, help: '' },
  { name: 'Oregon DataShare Property Data Form', type: 'Disclosures', ifApplicable: true, help: 'MLS input form / DataShare residential property data.' },
  { name: 'Disclosed Limited Agency Agreement for Sellers', type: 'Disclosures', ifApplicable: true, help: 'OREF 040 — seller-side. Distinct from generic Disclosed Limited Agency.' },
  { name: 'CCRs', type: 'Reports', ifApplicable: true, help: '' },
  { name: 'Association Documents', type: 'Reports', ifApplicable: true, help: '' },
  { name: 'Appraisal', type: 'Reports', ifApplicable: true, help: '' },
  { name: 'Home Inspection', type: 'Reports', ifApplicable: true, help: '' },
  { name: 'Broker Commission Demand from Title', type: 'Closing Documents', ifApplicable: true, help: 'OREF 091 satisfies.' },
  { name: 'Earnest Money Receipt', type: 'Closing Documents', ifApplicable: false, help: '' },
  { name: 'Preliminary Title Report', type: 'Closing Documents', ifApplicable: false, help: '' },
  { name: 'Final HUD', type: 'Closing Documents', ifApplicable: false, help: 'Final Settlement Statement / ALTA / CD.' },
  { name: 'Initial Agency Disclosure (042 | 10.4)', type: 'Closing Documents', ifApplicable: true, help: 'ORS 696.820 = delivery only.' },
  { name: 'Disclosed Limited Agency', type: 'Buyer Agreement Documentation', ifApplicable: true, help: 'OREF 041 buyer-side.' },
]

console.log(`MODE: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
console.log(`Template id ${TEMPLATE_ID}, ${ACTIVITIES.length} activities in batches of ${BATCH_SIZE}`)

function b64(n) { return Buffer.from(String(n)).toString('base64') }

// Helper: query template current activity names via UI scrape
async function currentActivities(page) {
  return await page.evaluate(() => {
    return [...document.querySelectorAll('span[id*="lblActivity"]')]
      .filter((e) => e.offsetParent !== null)
      .map((e) => e.innerText?.trim())
      .filter(Boolean)
  })
}

const browser = await chromium.launch({ headless: true, slowMo: 60 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1600, height: 1200 } })
const page = await context.newPage()
let snapIdx = 0
async function snap(label) {
  await page.screenshot({ path: path.join(OUTDIR, `${String(snapIdx++).padStart(2, '0')}-${label}.png`) })
}

const manifest = { templateId: TEMPLATE_ID, total: ACTIVITIES.length, batches: [] }
const listUrl = `https://app.skyslope.com/BrokerCheckListActivityListTransaction.aspx?${new URLSearchParams({
  PropertyTypeId: b64(TEMPLATE_ID),
  CheckListType: '1',
  officeid: '-1',
  CheckListName: TEMPLATE_NAME,
  ParentID: '0',
  checkSingleOfficeAuditor: 'No',
})}`

try {
  console.log(`1. Open template editor`)
  await page.goto(listUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (/LoginIntegrated/i.test(page.url())) throw new Error('Session expired')
  await snap('initial-editor')

  // Determine which activities are already present (resume from where we left off)
  const existing = await currentActivities(page)
  console.log(`   Already present (${existing.length}): ${existing.slice(0, 5).join(', ')}${existing.length > 5 ? '...' : ''}`)
  const existingSet = new Set(existing.map((n) => n.toLowerCase().trim()))
  const remaining = ACTIVITIES.filter((a) => !existingSet.has(a.name.toLowerCase().trim()))
  console.log(`   Remaining to add: ${remaining.length}`)

  if (remaining.length === 0) {
    console.log('Nothing to do — all activities already present.')
    manifest.completed = true
    await fs.writeFile(path.join(OUTDIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
    await browser.close()
    process.exit(0)
  }

  if (!EXECUTE) {
    console.log(`[DRY] Would add ${remaining.length} in ${Math.ceil(remaining.length / BATCH_SIZE)} batches`)
    process.exit(0)
  }

  // Batch loop
  for (let b = 0; b < Math.ceil(remaining.length / BATCH_SIZE); b++) {
    const batch = remaining.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE)
    console.log(`\n--- BATCH ${b + 1} of ${Math.ceil(remaining.length / BATCH_SIZE)} (${batch.length} activities) ---`)

    // Click Add Items
    const addBtn = page.getByRole('link', { name: /^Add Items$/i }).first()
    await addBtn.waitFor({ state: 'visible', timeout: 5000 })
    await addBtn.click()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    await snap(`b${b+1}-add-items-form`)

    // Fill rows
    for (let i = 0; i < batch.length; i++) {
      const a = batch[i]
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
            return { ok: false, reason: 'type not in options', want: def.type, have: [...sel.options].map((o) => o.text) }
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
        console.log(`     Row ${i+1} FAILED: ${JSON.stringify(res).substring(0, 300)}`)
        await snap(`b${b+1}-error-row-${i+1}`)
        throw new Error(`Batch ${b+1} row ${i+1} fill failed: ${res.reason}`)
      }
      await page.waitForTimeout(300)
    }
    await snap(`b${b+1}-rows-filled`)

    // Save the batch
    const saveBtn = page.locator('a:has-text("Save"), input[type="submit"][value="Save"]').first()
    await saveBtn.click()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(4000)
    await snap(`b${b+1}-after-save`)

    // Verify post-batch
    const after = await currentActivities(page)
    console.log(`   After batch ${b+1}: ${after.length} total activities on template`)
    manifest.batches.push({ batch: b + 1, addedCount: batch.length, totalAfter: after.length })

    // Make sure we're back on the editor page for the next batch
    if (!page.url().includes('BrokerCheckListActivityListTransaction')) {
      await page.goto(listUrl, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
    }
  }

  const finalCount = (await currentActivities(page)).length
  console.log(`\nFINAL: ${finalCount} activities on template 1784578`)
  manifest.finalCount = finalCount
  manifest.completed = true
} catch (e) {
  console.error(`ERROR: ${e.message}`)
  manifest.error = e.message
  await snap('error')
}

await fs.writeFile(path.join(OUTDIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`Manifest: ${path.relative(process.cwd(), path.join(OUTDIR, 'manifest.json'))}`)
await browser.close()
