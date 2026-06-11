#!/usr/bin/env node
/**
 * Add the 4 listing-side activities to template 1784213 ("Residential
 * Sale — Legacy"). Rename + 3 deletes were already done in a prior run.
 *
 * Usage:
 *   node scripts/_skyslope-template-legacy-add-only.mjs --execute
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUTDIR = path.join(process.cwd(), 'tmp/template-legacy-add-only')
await fs.mkdir(OUTDIR, { recursive: true })

const EXECUTE = process.argv.includes('--execute')
const TEMPLATE_ID = 1784213
const TEMPLATE_NAME = 'Residential Sale — Legacy'
const OFFICE_ID = 28920

const ACTIVITIES = [
  { activityName: 'Listing Agreement', activityType: 'Sales Documentation', helpText: 'OREF 015 Exclusive Right to Sell or equivalent listing agreement.' },
  { activityName: 'MLSCO Listing Contract', activityType: 'Sales Documentation', helpText: 'Regional MLS listing contract (Multiple Listing Service of Central Oregon).' },
  { activityName: 'Oregon DataShare Property Data Form', activityType: 'Disclosures', helpText: 'MLS input form / Oregon DataShare residential property data.' },
  { activityName: 'Disclosed Limited Agency Agreement for Sellers', activityType: 'Disclosures', helpText: 'OREF 040 Disclosed Limited Agency Agreement for Sellers. Distinct from the generic Disclosed Limited Agency activity.' },
]

function b64(n) { return Buffer.from(String(n)).toString('base64') }

console.log(`MODE: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
console.log(`Template ${TEMPLATE_ID} "${TEMPLATE_NAME}", adding ${ACTIVITIES.length} activities\n`)

const browser = await chromium.launch({ headless: true, slowMo: 100 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()
let snapIdx = 0
async function snap(label) {
  await page.screenshot({ path: path.join(OUTDIR, `${String(snapIdx++).padStart(2, '0')}-${label}.png`) })
}

const listUrl = `https://app.skyslope.com/BrokerCheckListActivityListTransaction.aspx?${new URLSearchParams({
  PropertyTypeId: b64(TEMPLATE_ID),
  CheckListType: '1',
  officeid: String(OFFICE_ID),
  CheckListName: TEMPLATE_NAME,
  ParentID: '0',
  checkSingleOfficeAuditor: 'No',
})}`

try {
  console.log(`1. Open edit page`)
  await page.goto(listUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await snap('edit-open')

  console.log(`2. Click Add Items`)
  const addItemsLink = page.getByRole('link', { name: /^Add Items$/i }).first()
  await addItemsLink.waitFor({ state: 'visible', timeout: 5000 })
  if (EXECUTE) {
    await addItemsLink.click()
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
  } else {
    console.log('   [DRY] would click Add Items')
  }
  await snap('add-items-form')

  if (EXECUTE) {
    console.log(`3. Fill ${ACTIVITIES.length} rows`)
    for (let i = 0; i < ACTIVITIES.length; i++) {
      const a = ACTIVITIES[i]
      console.log(`   Row ${i + 1}: "${a.activityName}" (${a.activityType})`)
      const result = await page.evaluate(({ index, def }) => {
        const nameInputs = [...document.querySelectorAll('input[type="text"]')].filter((e) =>
          /activityname/i.test((e.name || '') + ' ' + (e.id || '')) && e.offsetParent !== null,
        )
        if (!nameInputs[index]) return { ok: false, reason: 'no name input at index', count: nameInputs.length }
        const nameInput = nameInputs[index]
        nameInput.focus()
        nameInput.value = def.activityName
        nameInput.dispatchEvent(new Event('input', { bubbles: true }))
        nameInput.dispatchEvent(new Event('change', { bubbles: true }))

        const row = nameInput.closest('tr')
        const typeSelect = row?.querySelector('select')
        if (typeSelect) {
          const option = [...typeSelect.options].find((o) => o.text.trim() === def.activityType)
          if (option) {
            typeSelect.value = option.value
            typeSelect.dispatchEvent(new Event('change', { bubbles: true }))
          } else {
            return { ok: false, reason: `type "${def.activityType}" not in options`, options: [...typeSelect.options].map((o) => o.text) }
          }
        }

        const helpInput = row?.querySelector(
          'input[type="text"][id*="HelpText" i], input[type="text"][name*="HelpText" i], textarea[id*="HelpText" i], textarea[name*="HelpText" i]',
        )
        if (helpInput && def.helpText) {
          helpInput.value = def.helpText
          helpInput.dispatchEvent(new Event('input', { bubbles: true }))
          helpInput.dispatchEvent(new Event('change', { bubbles: true }))
        }
        return { ok: true, id: nameInput.id }
      }, { index: i, def: a })
      console.log(`     ${JSON.stringify(result)}`)
      if (!result.ok) throw new Error(`Failed to fill row ${i + 1}: ${result.reason}`)
      await page.waitForTimeout(800)
    }
    await snap('rows-filled')

    console.log(`4. Click Save (broad selector — covers <a> + <input> + <button>)`)
    const saveProbe = await page.evaluate(() => {
      const els = [...document.querySelectorAll('a, button, input[type="submit"], input[type="button"]')]
      return els
        .filter((e) => e.offsetParent !== null)
        .filter((e) => /save|submit/i.test((e.innerText || e.value || e.id || '').trim()))
        .map((e) => ({
          tag: e.tagName.toLowerCase(),
          text: (e.innerText || e.value || '').trim().slice(0, 40),
          id: e.id || '',
          onclick: (e.getAttribute('onclick') || '').slice(0, 80),
        }))
    })
    console.log(`   Save candidates: ${JSON.stringify(saveProbe)}`)
    const saveSelectors = [
      'a#ContentPlaceHolder1_imgbtnSave',
      'a:has-text("Save")',
      'input[type="submit"][value="Save"]',
      'button:has-text("Save")',
    ]
    let clicked = false
    for (const sel of saveSelectors) {
      const loc = page.locator(sel).first()
      if ((await loc.count().catch(() => 0)) === 0) continue
      if (!(await loc.isVisible().catch(() => false))) continue
      console.log(`   Save hit: ${sel}`)
      await loc.click()
      clicked = true
      break
    }
    if (!clicked) throw new Error('No Save button found')
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(3000)
    await snap('after-save')
  }

  console.log(`5. Verify`)
  await page.goto(listUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const finalActs = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').replace(/\*$/, '').trim()
    const rows = [...document.querySelectorAll('table tr')]
    return rows
      .map((r) => {
        if (!r.querySelector('a[onclick*="DeleteConfirmation"]')) return null
        return [...(r.cells || [])].map((c) => norm(c.innerText))
      })
      .filter(Boolean)
  })
  console.log(`   Final activity count: ${finalActs.length}`)
  const containsNew = ACTIVITIES.map((a) => ({
    name: a.activityName,
    present: finalActs.some((row) => row.some((c) => c === a.activityName)),
  }))
  for (const c of containsNew) console.log(`     ${c.present ? '✓' : '✗'} "${c.name}"`)
  await snap('final')
} catch (err) {
  console.error(`ERROR: ${err.message}`)
  await snap('error-state')
  process.exitCode = 1
} finally {
  await browser.close()
  console.log(`Output: ${path.relative(process.cwd(), OUTDIR)}/`)
}
