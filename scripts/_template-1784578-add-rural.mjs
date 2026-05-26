#!/usr/bin/env node
/**
 * Add 5 rural-specific activities to master template 1784578
 * ("Residential Sale — Legacy (Master)") so it covers listing-side
 * rural / on-site-utility properties as well as city-utility ones.
 *
 * Matches the rural activities Matt added to template 1635389
 * (Residential — On-Site Utilities) during the May 2026 cleanup.
 *
 * Usage:
 *   node scripts/_template-1784578-add-rural.mjs              # dry-run
 *   node scripts/_template-1784578-add-rural.mjs --execute    # apply
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUTDIR = 'tmp/template-1784578-add-rural'
await fs.mkdir(OUTDIR, { recursive: true })

const EXECUTE = process.argv.includes('--execute')
const TEMPLATE_ID = 1784578
const TEMPLATE_NAME = 'Residential Sale — Legacy (Master)'

const ACTIVITIES = [
  { name: 'Private Well Addendum', type: 'Disclosures', ifApplicable: true, help: 'REQUIRED for properties on private well per ORS 448.271. Cannot be waived.' },
  { name: 'Water Quality Results', type: 'Reports', ifApplicable: true, help: 'REQUIRED per ORS 448.271. Arsenic, nitrates, coliform test cannot be waived for private well properties.' },
  { name: 'Septic Addendum', type: 'Disclosures', ifApplicable: true, help: 'REQUIRED when property has on-site septic per OAR 340-071-0155.' },
  { name: 'Septic Inspection', type: 'Reports', ifApplicable: true, help: 'Often required by lender for on-site septic properties.' },
  { name: 'Well Inspection', type: 'Reports', ifApplicable: true, help: 'Often required by lender for private well properties. Flow rate + pressure + pump test.' },
]

function b64(n) { return Buffer.from(String(n)).toString('base64') }

console.log(`MODE: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
console.log(`Template ${TEMPLATE_ID} (${TEMPLATE_NAME})`)
console.log(`Adding ${ACTIVITIES.length} rural activities`)

if (!EXECUTE) {
  for (const a of ACTIVITIES) console.log(`  ${a.type.padEnd(20)} "${a.name}"`)
  process.exit(0)
}

const browser = await chromium.launch({ headless: true, slowMo: 60 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1600, height: 1200 } })
const page = await context.newPage()
let snapIdx = 0
async function snap(label) {
  try { await page.screenshot({ path: path.join(OUTDIR, `${String(snapIdx++).padStart(2, '0')}-${label}.png`), timeout: 8000, fullPage: false }) } catch (e) { console.log(`  [snap ${label}] timeout (page may be heavy); continuing`) }
}

try {
  const listUrl = `https://app.skyslope.com/BrokerCheckListActivityListTransaction.aspx?${new URLSearchParams({
    PropertyTypeId: b64(TEMPLATE_ID),
    CheckListType: '1',
    officeid: '-1',
    CheckListName: TEMPLATE_NAME,
    ParentID: '0',
    checkSingleOfficeAuditor: 'No',
  })}`
  console.log('1. Open template editor')
  await page.goto(listUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (/LoginIntegrated/i.test(page.url())) throw new Error('Session expired — refresh via _skyslope-login-capture.mjs')
  await snap('editor')

  console.log('2. Click Add Items via Playwright locator')
  const addLocator = page.locator('#ContentPlaceHolder1_ibtnCreateCheckList')
  await addLocator.waitFor({ state: 'visible', timeout: 10000 })
  await addLocator.click({ timeout: 15000 })
  await page.waitForTimeout(5000)
  await snap('add-form')

  console.log(`3. Fill ${ACTIVITIES.length} rows`)
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
          return { ok: false, reason: 'type not in options', have: [...sel.options].map(o => o.text) }
        }
      }
      const help = row?.querySelector('input[type="text"][id*="HelpText" i], textarea[id*="HelpText" i]')
      if (help && def.help) {
        help.value = def.help
        help.dispatchEvent(new Event('input', { bubbles: true }))
        help.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const ifApp = row?.querySelector('input[type="checkbox"][id*="IfApplicable" i]')
      if (ifApp) {
        ifApp.checked = !!def.ifApplicable
        ifApp.dispatchEvent(new Event('change', { bubbles: true }))
      }
      return { ok: true }
    }, { index: i, def: a })
    if (!res.ok) {
      console.log(`     Row ${i+1} FAILED: ${JSON.stringify(res)}`)
      await snap(`fail-row-${i+1}`)
      throw new Error(`Row ${i+1} failed`)
    }
    console.log(`   row ${i+1}/${ACTIVITIES.length} "${a.name}"`)
    await page.waitForTimeout(300)
  }
  await snap('rows-filled')

  console.log('4. Save')
  await page.locator('a:has-text("Save"), input[type="submit"][value="Save"]').first().click()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(4000)
  await snap('saved')

  console.log('Done.')
} catch (e) {
  console.error(`ERROR: ${e.message}`)
  await snap('error')
}
await browser.close()
