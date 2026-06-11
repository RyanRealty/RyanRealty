#!/usr/bin/env node
/**
 * Rename + edit the newly-copied template 1784213.
 *
 * Steps:
 *   1. Navigate to the template's activity-list edit page.
 *   2. Rename from "Residential — Standard" to "Residential Sale — Legacy".
 *   3. Delete the 3 buyer-only activities:
 *      - Buyers Rep Agreement
 *      - Record of Properties Shown
 *      - CMA or Comparables
 *   4. Add 4 listing-side activities:
 *      - Listing Agreement (Sales Documentation)
 *      - MLSCO Listing Contract (Sales Documentation)
 *      - Oregon DataShare Property Data Form (Disclosures)
 *      - Disclosed Limited Agency Agreement for Sellers (Disclosures)
 *
 * Usage:
 *   node scripts/_skyslope-template-legacy-rename-edit.mjs              # dry-run
 *   node scripts/_skyslope-template-legacy-rename-edit.mjs --execute    # apply
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUTDIR = path.join(process.cwd(), 'tmp/template-legacy-rename-edit')
await fs.mkdir(OUTDIR, { recursive: true })

const EXECUTE = process.argv.includes('--execute')

const TEMPLATE_ID = 1784213
const OLD_NAME = 'Residential — Standard'
const NEW_NAME = 'Residential Sale — Legacy'
const TARGET_OFFICE_ID = 28920

const ACTIVITIES_TO_DELETE = [
  'Buyers Rep Agreement',
  'Record of Properties Shown',
  'CMA or Comparables',
]

const ACTIVITIES_TO_ADD = [
  { activityName: 'Listing Agreement', activityType: 'Sales Documentation', ifApplicable: false, helpText: 'OREF 015 Exclusive Right to Sell or equivalent listing agreement.' },
  { activityName: 'MLSCO Listing Contract', activityType: 'Sales Documentation', ifApplicable: false, helpText: 'Regional MLS listing contract (Multiple Listing Service of Central Oregon).' },
  { activityName: 'Oregon DataShare Property Data Form', activityType: 'Disclosures', ifApplicable: false, helpText: 'MLS input form / Oregon DataShare residential property data.' },
  { activityName: 'Disclosed Limited Agency Agreement for Sellers', activityType: 'Disclosures', ifApplicable: false, helpText: 'OREF 040 Disclosed Limited Agency Agreement for Sellers. Distinct from the generic Disclosed Limited Agency activity.' },
]

function b64(n) { return Buffer.from(String(n)).toString('base64') }

function listPageUrl(id, name) {
  const params = new URLSearchParams({
    PropertyTypeId: b64(id),
    CheckListType: '1',
    officeid: String(TARGET_OFFICE_ID),
    CheckListName: name,
    ParentID: '0',
    checkSingleOfficeAuditor: 'No',
  })
  return `https://app.skyslope.com/BrokerCheckListActivityListTransaction.aspx?${params}`
}

console.log(`MODE: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
console.log(`Template id: ${TEMPLATE_ID}`)
console.log(`Rename: "${OLD_NAME}" → "${NEW_NAME}"`)
console.log(`Delete activities (${ACTIVITIES_TO_DELETE.length}): ${ACTIVITIES_TO_DELETE.join(', ')}`)
console.log(`Add activities (${ACTIVITIES_TO_ADD.length}):`)
for (const a of ACTIVITIES_TO_ADD) console.log(`  + "${a.activityName}" (${a.activityType})`)
console.log()

const browser = await chromium.launch({ headless: true, slowMo: 100 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()
const manifest = { steps: [], deleted: [], added: [], renamed: false }
let snapIdx = 0
async function snap(label) {
  await page.screenshot({ path: path.join(OUTDIR, `${String(snapIdx++).padStart(2, '0')}-${label}.png`) })
  manifest.steps.push({ label, url: page.url() })
}

let exitCode = 0
try {
  console.log(`1. Open template edit page`)
  await page.goto(listPageUrl(TEMPLATE_ID, OLD_NAME), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (/LoginIntegrated/i.test(page.url())) throw new Error('Session expired')
  await snap('edit-page-open')

  console.log(`2. Click Rename button`)
  const renameBtn = page.locator('input[type="submit"][value="Rename"], button:has-text("Rename"), a:has-text("Rename")').first()
  await renameBtn.waitFor({ state: 'visible', timeout: 5000 })
  if (EXECUTE) {
    await renameBtn.click()
    await page.waitForTimeout(1500)
  } else {
    console.log('   [DRY] would click Rename')
  }
  await snap('rename-clicked')

  if (EXECUTE) {
    console.log(`3. Find name input (currently holding "${OLD_NAME}") and set to "${NEW_NAME}"`)
    const fillResult = await page.evaluate(({ oldName, newName }) => {
      const inputs = [...document.querySelectorAll('input[type="text"]')].filter((i) => i.offsetParent !== null)
      for (const inp of inputs) {
        if (inp.value === oldName) {
          inp.focus()
          inp.value = newName
          inp.dispatchEvent(new Event('input', { bubbles: true }))
          inp.dispatchEvent(new Event('change', { bubbles: true }))
          inp.dispatchEvent(new Event('blur', { bubbles: true }))
          return { ok: true, id: inp.id, name: inp.name }
        }
      }
      const candidates = inputs.map((i) => ({ id: i.id, name: i.name, value: i.value.slice(0, 40) }))
      return { ok: false, candidates }
    }, { oldName: OLD_NAME, newName: NEW_NAME })
    console.log(`   Fill: ${JSON.stringify(fillResult)}`)
    await snap('name-typed')

    console.log(`4. Click Save to commit rename`)
    await snap('before-save-click-probe')
    // The Rename button TRANSFORMS into a Save button. Probe what's visible.
    const saveProbe = await page.evaluate(() => {
      const els = [...document.querySelectorAll('a, button, input[type="submit"], input[type="button"]')]
      return els
        .filter((e) => e.offsetParent !== null)
        .map((e) => ({
          tag: e.tagName.toLowerCase(),
          type: e.type || '',
          text: (e.innerText || e.value || '').trim().slice(0, 30),
          id: e.id || '',
          onclick: (e.getAttribute('onclick') || '').slice(0, 100),
        }))
        .filter((e) => /save|update|submit/i.test(e.text + ' ' + e.id))
    })
    console.log(`   Save candidates: ${JSON.stringify(saveProbe)}`)
    // Try multiple selectors
    const saveSelectors = [
      'input[type="submit"][value="Save"]',
      'button:has-text("Save")',
      'a:has-text("Save")',
      'input[type="button"][value="Save"]',
      '[id*="Save" i][onclick]',
    ]
    let savedClick = false
    for (const sel of saveSelectors) {
      const loc = page.locator(sel).first()
      if ((await loc.count().catch(() => 0)) === 0) continue
      const visible = await loc.isVisible().catch(() => false)
      if (!visible) continue
      console.log(`   Save selector hit: ${sel}`)
      await loc.click()
      savedClick = true
      break
    }
    if (!savedClick) throw new Error('No visible Save button after Rename')
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2500)
    await snap('after-rename-save')
    manifest.renamed = true
  }

  // Re-navigate to make sure we're on the (now renamed) template edit page
  const refreshUrl = listPageUrl(TEMPLATE_ID, EXECUTE ? NEW_NAME : OLD_NAME)
  console.log(`5. Refresh edit page`)
  await page.goto(refreshUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await snap('after-refresh')

  // === Delete activities ===
  console.log(`6. Delete ${ACTIVITIES_TO_DELETE.length} activities`)
  for (const actName of ACTIVITIES_TO_DELETE) {
    // Find activity row by name and locate its delete link (lnkDelete with onclick DeleteConfirmation)
    const found = await page.evaluate((name) => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').replace(/\*$/, '').trim().toLowerCase()
      const target = norm(name)
      const rows = [...document.querySelectorAll('table tr')]
      for (const r of rows) {
        const cellTexts = [...(r.cells || [])].map((c) => c.innerText.trim())
        if (cellTexts.some((t) => norm(t) === target)) {
          const delLink = r.querySelector('a[onclick*="DeleteConfirmation"]')
          const onclick = delLink?.getAttribute('onclick') || ''
          const idMatch = onclick.match(/DeleteConfirmation\('(\d+)'/)
          return { ok: true, cellTexts, activityId: idMatch?.[1] ?? null, delLinkId: delLink?.id ?? null }
        }
      }
      return { ok: false }
    }, actName)
    if (!found.ok) {
      console.log(`   ⊘ "${actName}" not found — skip`)
      continue
    }
    console.log(`   • "${actName}" activityId=${found.activityId} delLinkId=${found.delLinkId}`)
    if (EXECUTE && found.delLinkId) {
      // Override bootbox.confirm to auto-confirm
      await page.evaluate(() => {
        if (window.bootbox && typeof window.bootbox.confirm === 'function') {
          window.bootbox.confirm = function (opts) {
            if (opts && typeof opts.callback === 'function') setTimeout(() => opts.callback(true), 50)
          }
        }
      })
      await page.locator(`#${found.delLinkId}`).click()
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(1500)
      manifest.deleted.push({ name: actName, activityId: found.activityId })
    } else if (EXECUTE) {
      console.log(`   (delete link id missing — skipping)`)
    }
  }
  await snap('after-deletes')

  // === Add activities ===
  console.log(`7. Add ${ACTIVITIES_TO_ADD.length} activities`)
  if (ACTIVITIES_TO_ADD.length > 0) {
    console.log(`   Click Add Items`)
    const addItemsLink = page.getByRole('link', { name: /^Add Items$/i }).first()
    await addItemsLink.waitFor({ state: 'visible', timeout: 5000 })
    if (EXECUTE) {
      await addItemsLink.click()
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(1500)
      await snap('add-items-form-open')

      // Fill each activity into successive rows
      for (let i = 0; i < ACTIVITIES_TO_ADD.length; i++) {
        const a = ACTIVITIES_TO_ADD[i]
        console.log(`   Row ${i + 1}: "${a.activityName}" (${a.activityType})`)
        const filled = await page.evaluate(({ index, def }) => {
          const nameInputs = [...document.querySelectorAll('input[type="text"]')].filter((e) =>
            /activityname/i.test((e.name || '') + ' ' + (e.id || '')) && e.offsetParent !== null,
          )
          if (!nameInputs[index]) return { ok: false, reason: `no nameInput at index ${index}`, count: nameInputs.length }
          const nameInput = nameInputs[index]
          nameInput.focus()
          nameInput.value = def.activityName
          nameInput.dispatchEvent(new Event('input', { bubbles: true }))
          nameInput.dispatchEvent(new Event('change', { bubbles: true }))

          // Activity Type dropdown in the same row
          const row = nameInput.closest('tr')
          const typeSelect = row?.querySelector('select')
          if (typeSelect) {
            const option = [...typeSelect.options].find((o) => o.text.trim() === def.activityType)
            if (option) {
              typeSelect.value = option.value
              typeSelect.dispatchEvent(new Event('change', { bubbles: true }))
            } else {
              return { ok: false, reason: `Activity type "${def.activityType}" not in dropdown`, options: [...typeSelect.options].map((o) => o.text) }
            }
          }

          // Help Text in the same row
          const helpInput = row?.querySelector(
            'input[type="text"][id*="HelpText" i], input[type="text"][name*="HelpText" i], textarea[id*="HelpText" i], textarea[name*="HelpText" i]',
          )
          if (helpInput && def.helpText) {
            helpInput.value = def.helpText
            helpInput.dispatchEvent(new Event('input', { bubbles: true }))
            helpInput.dispatchEvent(new Event('change', { bubbles: true }))
          }

          // If Applicable checkbox
          const ifApp = row?.querySelector('input[type="checkbox"][id*="Applicable" i], input[type="checkbox"][name*="Applicable" i]')
          if (ifApp) {
            ifApp.checked = !!def.ifApplicable
            ifApp.dispatchEvent(new Event('change', { bubbles: true }))
          }

          return { ok: true, nameInputId: nameInput.id }
        }, { index: i, def: a })
        console.log(`     ${JSON.stringify(filled)}`)
        // After filling, SkySlope auto-appends another empty row. Brief pause.
        await page.waitForTimeout(800)
      }
      await snap('all-rows-filled')

      console.log(`   Click Save for all rows`)
      const saveAllBtn = page.locator('input[type="submit"][value="Save"], button:has-text("Save")').first()
      await saveAllBtn.waitFor({ state: 'visible', timeout: 5000 })
      await saveAllBtn.click()
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(3000)
      await snap('after-add-save')
      manifest.added = ACTIVITIES_TO_ADD.map((a) => a.activityName)
    } else {
      console.log(`   [DRY] would click Add Items + fill ${ACTIVITIES_TO_ADD.length} rows + Save`)
    }
  }

  // === Verify ===
  console.log(`8. Verify final state`)
  await page.goto(refreshUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const finalActivities = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').replace(/\*$/, '').trim()
    const rows = [...document.querySelectorAll('table tr')]
    return rows
      .map((r) => {
        const cellTexts = [...(r.cells || [])].map((c) => norm(c.innerText))
        // activity rows have the activity name in some cell. Look for rows
        // that have a delete link.
        const hasDel = !!r.querySelector('a[onclick*="DeleteConfirmation"]')
        return hasDel ? cellTexts : null
      })
      .filter(Boolean)
  })
  console.log(`   Final activity rows: ${finalActivities.length}`)
  for (const a of finalActivities.slice(0, 60)) console.log(`     ${JSON.stringify(a)}`)
  manifest.finalActivityCount = finalActivities.length
  await snap('final-state')
} catch (err) {
  console.error(`\nERROR: ${err.message}`)
  exitCode = 1
  manifest.error = err.message
  await snap('error-state')
} finally {
  await fs.writeFile(path.join(OUTDIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\nManifest + screenshots: ${path.relative(process.cwd(), OUTDIR)}/`)
  await browser.close()
}
process.exit(exitCode)
