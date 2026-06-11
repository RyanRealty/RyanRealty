#!/usr/bin/env node
/**
 * Copy the MASTER `Residential — Standard` template (id 1639421, 42 activities)
 * into a new Ryan Realty office-level template named "Residential Sale — Legacy".
 *
 * Flow:
 *   1. Navigate to BrokerMasterChecklist.aspx?officeid=-1&Type=MQ== (Master, Transaction)
 *   2. Check the chkItemCopy checkbox on the Residential — Standard row
 *   3. Click the global Copy button
 *   4. Handle whatever follows (name prompt, office selector, etc.)
 *   5. Screenshot each step
 *   6. Save resulting template ID + name to tmp/template-copy-exec.json
 *
 * Usage:
 *   node scripts/_skyslope-template-copy-exec.mjs            # dry-run with screenshots
 *   node scripts/_skyslope-template-copy-exec.mjs --execute  # actually save the new template
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUTDIR = path.join(process.cwd(), 'tmp/template-copy-exec')
await fs.mkdir(OUTDIR, { recursive: true })

const EXECUTE = process.argv.includes('--execute')
const SOURCE_TEMPLATE_NAME = 'Residential — Standard'
const NEW_NAME = 'Residential Sale — Legacy'
const TARGET_OFFICE_ID = '28920' // Ryan Realty LLC

console.log(`MODE: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
console.log(`Source: "${SOURCE_TEMPLATE_NAME}" (Master)`)
console.log(`Target: "${NEW_NAME}" → office ${TARGET_OFFICE_ID}\n`)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  storageState: STATE_PATH,
  viewport: { width: 1600, height: 1000 },
})
const page = await context.newPage()

const masterUrl = 'https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=-1&Type=MQ=='
console.log(`Step 1: Navigating to Master template list`)
await page.goto(masterUrl, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
if (/LoginIntegrated/i.test(page.url())) {
  console.error('SESSION EXPIRED — re-run login script')
  process.exit(2)
}
await page.screenshot({ path: path.join(OUTDIR, '01-master-list.png') })

console.log(`Step 2: Finding the "${SOURCE_TEMPLATE_NAME}" row`)
const rows = await page.$$eval('table tr', (rows) =>
  rows.map((row) => ({
    text: row.innerText?.trim() || '',
    checkboxes: [...row.querySelectorAll('input[type="checkbox"]')].map((c) => ({
      name: c.name,
      id: c.id,
    })),
  })),
)
const sourceRow = rows.find((r) => {
  const firstLine = r.text.split('\n')[0].trim()
  // Match the row whose first cell starts with the template name exactly
  // (avoid matching the LEGACY one)
  return firstLine === SOURCE_TEMPLATE_NAME || firstLine.startsWith(`${SOURCE_TEMPLATE_NAME}\t`)
})
if (!sourceRow) {
  console.error(`Source template "${SOURCE_TEMPLATE_NAME}" not found in row list:`)
  for (const r of rows.slice(0, 20)) {
    console.error(`  ${r.text.split('\n')[0].slice(0, 80)}`)
  }
  process.exit(3)
}
const itemCopyCheckbox = sourceRow.checkboxes.find((c) => /chkItemCopy/i.test(c.id))
if (!itemCopyCheckbox) {
  console.error(`No chkItemCopy checkbox in row for "${SOURCE_TEMPLATE_NAME}"`)
  process.exit(4)
}
console.log(`  Found chkItemCopy id=${itemCopyCheckbox.id}`)

console.log(`Step 3: Force-check the chkItemCopy checkbox (hidden in DOM — use JS)`)
const checkResult = await page.evaluate((id) => {
  const cb = document.getElementById(id)
  if (!cb) return { ok: false, reason: 'not found' }
  cb.checked = true
  cb.dispatchEvent(new Event('change', { bubbles: true }))
  cb.dispatchEvent(new Event('click', { bubbles: true }))
  return { ok: true, checked: cb.checked, name: cb.name }
}, itemCopyCheckbox.id)
console.log(`  Force-check result: ${JSON.stringify(checkResult)}`)
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(OUTDIR, '02-checkbox-checked.png') })

console.log(`Step 4: Click the Copy button`)
await page.locator('#ContentPlaceHolder1_imgbtnCopy').click()
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUTDIR, '03-after-copy-click.png') })
await fs.writeFile(path.join(OUTDIR, '03-after-copy-click.html'), await page.content())

// Inspect: is there a modal for name + office? Look for visible input fields
console.log(`Step 5: Inspecting post-Copy state`)
const visibleInputs = await page.$$eval('input:not([type="hidden"]), select', (els) =>
  els
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({
      tag: e.tagName.toLowerCase(),
      type: e.type || '',
      name: e.name || '',
      id: e.id || '',
      placeholder: e.placeholder || '',
      value: typeof e.value === 'string' ? e.value.slice(0, 40) : '',
      options: e.tagName === 'SELECT' ? [...e.options].map((o) => o.text.trim()).slice(0, 10) : null,
    })),
)
console.log(`  Visible inputs (${visibleInputs.length}):`)
for (const i of visibleInputs.slice(0, 30)) {
  const opts = i.options ? ` opts=[${i.options.join(', ')}]` : ''
  console.log(`    ${i.tag} type=${i.type} name=${i.name} id=${i.id} placeholder="${i.placeholder}" value="${i.value}"${opts}`)
}
await fs.writeFile(path.join(OUTDIR, 'inputs-post-copy.json'), JSON.stringify(visibleInputs, null, 2))

// Look for visible modal dialogs / pop-overs
const modals = await page.$$eval('div', (els) =>
  els
    .filter((e) => {
      const style = window.getComputedStyle(e)
      return e.offsetParent !== null && (style.position === 'fixed' || style.position === 'absolute') && /modal|dialog|popover|overlay/i.test(e.className + ' ' + e.id) && e.offsetHeight > 100
    })
    .map((e) => ({ id: e.id, className: e.className, text: e.innerText?.slice(0, 200) })),
)
console.log(`  Visible modals (${modals.length}):`)
for (const m of modals) console.log(`    id=${m.id} class="${m.className.slice(0, 60)}" text="${m.text.slice(0, 100)}"`)

// Dump buttons in the post-Copy state
const buttons = await page.$$eval(
  'button, input[type="submit"], input[type="button"], a[href*="WebForm_DoPostBack"]',
  (els) =>
    els
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({
        tag: e.tagName.toLowerCase(),
        type: e.type || '',
        text: (e.innerText || e.value || '').trim().slice(0, 50),
        id: e.id || '',
        href: (e.getAttribute('href') || '').slice(0, 100),
      })),
)
console.log(`\n  Visible buttons/postback links (${buttons.length}):`)
for (const b of buttons.slice(0, 50)) console.log(`    ${b.tag} type=${b.type} text="${b.text}" id=${b.id}`)

// Confirm chkItemCopy_12 (Residential — Standard, MASTER, 42 activities)
// is still checked
const stillChecked = await page.evaluate(() => {
  const cb = document.getElementById('ContentPlaceHolder1_gvBrokerCheckList_chkItemCopy_12')
  return cb ? { checked: cb.checked, hidden: cb.offsetParent === null } : null
})
console.log(`\n  chkItemCopy_12 (Residential — Standard) state: ${JSON.stringify(stillChecked)}`)

// Look for the "Save" / submit on the modal
const saveCandidates = await page.$$eval(
  'input[type="submit"], button, a[href*="WebForm_DoPostBack"]',
  (els) =>
    els
      .filter((e) => /save|copy|submit|apply|ok|proceed/i.test((e.innerText || e.value || e.id || '').trim()))
      .map((e) => ({
        tag: e.tagName.toLowerCase(),
        type: e.type || '',
        text: (e.innerText || e.value || '').trim().slice(0, 50),
        id: e.id || '',
      })),
)
console.log(`\n  Save/Copy candidates: ${saveCandidates.length}`)
for (const s of saveCandidates) console.log(`    ${s.tag} text="${s.text}" id=${s.id}`)

if (!EXECUTE) {
  console.log('\n[DRY RUN] Stopping before any naming / save. Re-run with --execute to proceed.')
  console.log(`Screenshots + HTML in ${path.relative(process.cwd(), OUTDIR)}/`)
  await browser.close()
  process.exit(0)
}

console.log('\nStep 6: TODO — fill in name + office in whatever post-Copy form appears, then save.')
console.log('  Need DRY RUN inspection first to know what selectors to target.')
await browser.close()
