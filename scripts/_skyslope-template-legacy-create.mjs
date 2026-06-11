#!/usr/bin/env node
/**
 * Create the "Residential Sale — Legacy" template by copying the
 * Master `Residential — Standard` (42 activities) into the Ryan Realty
 * LLC office (28920), then renaming it.
 *
 * Flow (proven via _skyslope-template-copy-exec.mjs probe):
 *   1. Navigate to BrokerMasterChecklist.aspx?officeid=-1&Type=MQ==
 *   2. Force-check chkItemCopy on the "Residential — Standard" row
 *      (NOT the LEGACY one — match the 42-activity exact name)
 *   3. Click Copy. The page reveals checkboxes for selection.
 *   4. Force-check the target office checkbox
 *      (ddlCopyMultiOffice_chkList_0, value=28920 = Ryan Realty LLC)
 *   5. Click Copy a second time to execute.
 *   6. Navigate to Ryan Realty office page (officeid=28920) to find
 *      the new copy (likely named "Residential — Standard").
 *   7. Open its activity-list edit page, click Rename, set to
 *      "Residential Sale — Legacy", save.
 *   8. Capture + report the new template's id.
 *
 * Usage:
 *   node scripts/_skyslope-template-legacy-create.mjs              # dry-run
 *   node scripts/_skyslope-template-legacy-create.mjs --execute    # actually copy + rename
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUTDIR = path.join(process.cwd(), 'tmp/template-legacy-create')
await fs.mkdir(OUTDIR, { recursive: true })

const EXECUTE = process.argv.includes('--execute')
const SOURCE_NAME = 'Residential — Standard'
const NEW_NAME = 'Residential Sale — Legacy'
const TARGET_OFFICE_VALUE = '28920' // Ryan Realty LLC

function b64(n) { return Buffer.from(String(n)).toString('base64') }

console.log(`MODE: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
console.log(`Source (MASTER): "${SOURCE_NAME}"`)
console.log(`Target (office ${TARGET_OFFICE_VALUE}): "${NEW_NAME}"\n`)

const browser = await chromium.launch({ headless: true, slowMo: 100 })
const context = await browser.newContext({
  storageState: STATE_PATH,
  viewport: { width: 1600, height: 1000 },
})
const page = await context.newPage()
let exitCode = 0
const outManifest = { steps: [] }

async function snap(label) {
  const fname = `${String(outManifest.steps.length).padStart(2, '0')}-${label}.png`
  await page.screenshot({ path: path.join(OUTDIR, fname) })
  outManifest.steps.push({ label, screenshot: fname, url: page.url() })
}

try {
  const masterUrl = 'https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=-1&Type=MQ=='
  console.log(`1. Open master template list (officeid=-1)`)
  await page.goto(masterUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (/LoginIntegrated/i.test(page.url())) throw new Error('Session expired')
  await snap('master-open')

  console.log(`2. Find source row by name-cell (index 1) match "${SOURCE_NAME}"`)
  const sourceLookup = await page.evaluate((name) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').replace(/[–—-]/g, '-').trim().toLowerCase()
    const target = norm(name)
    const rows = [...document.querySelectorAll('table tr')]
    const candidates = []
    for (const r of rows) {
      const nameCell = r.cells?.[1] // template name lives in column index 1; column 0 is the chkItemCopy checkbox
      if (!nameCell) continue
      const t = nameCell.innerText?.trim() ?? ''
      const tNorm = norm(t)
      if (tNorm === target) {
        const cb = r.querySelector('input[id*="chkItemCopy"]')
        return { found: true, rowText: t, checkboxId: cb?.id ?? null }
      }
      if (tNorm.includes(target)) {
        candidates.push({ rowText: t, normalized: tNorm })
      }
    }
    return { found: false, candidates }
  }, SOURCE_NAME)
  console.log(`   Lookup result: ${JSON.stringify(sourceLookup).slice(0, 500)}`)
  if (!sourceLookup.found || !sourceLookup.checkboxId) {
    // Diagnostic dump
    const allRows = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('table tr')]
      return rows.slice(0, 40).map((r) => ({
        cellCount: r.cells?.length ?? 0,
        firstCellText: r.cells?.[0]?.innerText?.trim().slice(0, 60) ?? '(no cell 0)',
        secondCellText: r.cells?.[1]?.innerText?.trim().slice(0, 60) ?? '',
        hasChkItemCopy: !!r.querySelector('input[id*="chkItemCopy"]'),
      }))
    })
    console.log(`   Diagnostic — all table.tr first cells (top 40):`)
    for (const r of allRows) {
      console.log(`     cells=${r.cellCount} chkItemCopy=${r.hasChkItemCopy ? 'Y' : 'N'} "${r.firstCellText}" | "${r.secondCellText}"`)
    }
    throw new Error(`Could not find row for "${SOURCE_NAME}"`)
  }
  const sourceCheckboxId = sourceLookup.checkboxId
  console.log(`   Source chkItemCopy id: ${sourceCheckboxId}  (row: "${sourceLookup.rowText}")`)

  console.log(`3. Force-check source via JS`)
  const checked1 = await page.evaluate((id) => {
    const cb = document.getElementById(id)
    if (!cb) return { ok: false }
    cb.checked = true
    cb.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true, checked: cb.checked }
  }, sourceCheckboxId)
  console.log(`   ${JSON.stringify(checked1)}`)
  await snap('source-checked')

  console.log(`4. Click Copy (first time — reveals selection panel + target office checkboxes)`)
  await page.locator('#ContentPlaceHolder1_imgbtnCopy').click()
  await page.waitForTimeout(2500)
  await snap('after-first-copy-click')

  // Make sure source checkbox is STILL checked after postback
  const recheck = await page.evaluate((id) => {
    const cb = document.getElementById(id)
    if (!cb) return { exists: false }
    if (!cb.checked) cb.checked = true
    cb.dispatchEvent(new Event('change', { bubbles: true }))
    return { checked: cb.checked }
  }, sourceCheckboxId)
  console.log(`   Source checkbox recheck after postback: ${JSON.stringify(recheck)}`)

  console.log(`5. Force-check target-office checkbox (Ryan Realty LLC, value=${TARGET_OFFICE_VALUE})`)
  const targetChecked = await page.evaluate((val) => {
    // Find a checkbox whose value matches the target office
    const cbs = [...document.querySelectorAll('input[type="checkbox"][id*="ddlCopyMultiOffice_chkList"]')]
    const cb = cbs.find((c) => c.value === val)
    if (!cb) return { ok: false, candidates: cbs.map((c) => ({ id: c.id, value: c.value })) }
    cb.checked = true
    cb.dispatchEvent(new Event('change', { bubbles: true }))
    cb.dispatchEvent(new Event('click', { bubbles: true }))
    return { ok: true, id: cb.id, checked: cb.checked }
  }, TARGET_OFFICE_VALUE)
  console.log(`   ${JSON.stringify(targetChecked)}`)
  if (!targetChecked.ok) throw new Error(`Could not find target office checkbox for value=${TARGET_OFFICE_VALUE}`)
  await snap('target-checked')

  if (!EXECUTE) {
    console.log(`\n[DRY RUN] Would now click Copy again to execute. Skipping.`)
    await snap('dryrun-ready-to-submit')
    outManifest.completed = false
    await fs.writeFile(path.join(OUTDIR, 'manifest.json'), JSON.stringify(outManifest, null, 2))
    console.log(`Manifest + screenshots: ${path.relative(process.cwd(), OUTDIR)}/`)
    await browser.close()
    process.exit(0)
  }

  console.log(`6. Click Copy a second time to execute`)
  await page.locator('#ContentPlaceHolder1_imgbtnCopy').click()
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(3000)
  await snap('after-second-copy-click')

  // Check for any alert / success indicator
  const alertText = await page.locator('.alert, .toast, [class*="message"]').first().innerText().catch(() => '')
  if (alertText) console.log(`   Alert/toast: "${alertText.slice(0, 200)}"`)

  console.log(`7. Navigate to Ryan Realty LLC office templates (officeid=${TARGET_OFFICE_VALUE}) to find new copy`)
  const officeUrl = `https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=${TARGET_OFFICE_VALUE}&Type=MQ==`
  await page.goto(officeUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await snap('office-list-after-copy')

  // Find the new template row (likely also named "Residential — Standard")
  // The new one will have 42 activities matching the source.
  const officeTemplates = await page.$$eval('table tr', (rows) =>
    rows
      .map((row) => {
        const text = row.innerText?.trim() || ''
        const links = [...row.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') || '')
        return { text, links }
      })
      .filter((r) => r.text && r.links.some((h) => h.includes('PropertyTypeId'))),
  )
  console.log(`   ${officeTemplates.length} templates now in Ryan Realty office:`)
  for (const t of officeTemplates) {
    const firstLine = t.text.split('\n')[0].slice(0, 80)
    const m = t.links.join(' ').match(/PropertyTypeId=([A-Za-z0-9+/=]+)/)
    let id = null
    if (m) { try { id = Buffer.from(decodeURIComponent(m[1]), 'base64').toString('utf8') } catch {} }
    console.log(`     id=${id ?? '?'}  ${firstLine}`)
  }

  // The newly copied template likely has the same name as the source.
  // Find the row whose name cell (index 1) matches AND template id is in office scope.
  const newTemplateInfo = await page.evaluate((srcName) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').replace(/[–—-]/g, '-').trim().toLowerCase()
    const target = norm(srcName)
    const rows = [...document.querySelectorAll('table tr')]
    for (const r of rows) {
      const nameCell = r.cells?.[1]
      if (!nameCell) continue
      const t = nameCell.innerText?.trim() ?? ''
      if (norm(t) !== target) continue
      const link = r.querySelector('a[href*="PropertyTypeId"]')
      const href = link?.getAttribute('href') ?? ''
      const m = href.match(/PropertyTypeId=([A-Za-z0-9+/=]+)/)
      let id = null
      if (m) { try { id = atob(decodeURIComponent(m[1])) } catch {} }
      return { found: true, id, rowText: t, href }
    }
    return { found: false }
  }, SOURCE_NAME)
  console.log(`   New template lookup: ${JSON.stringify(newTemplateInfo)}`)

  if (!newTemplateInfo.found || !newTemplateInfo.id) {
    throw new Error('New template not found in Ryan Realty office after Copy')
  }
  const newTemplateId = newTemplateInfo.id
  outManifest.newTemplateId = newTemplateId

  console.log(`8. Open new template's edit page to rename`)
  const listUrl = `https://app.skyslope.com/BrokerCheckListActivityListTransaction.aspx?${new URLSearchParams({
    PropertyTypeId: b64(newTemplateId),
    CheckListType: '1',
    officeid: TARGET_OFFICE_VALUE,
    CheckListName: SOURCE_NAME,
    ParentID: '0',
    checkSingleOfficeAuditor: 'No',
  })}`
  await page.goto(listUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await snap('new-template-edit-page')

  console.log(`9. Click Rename to switch to edit-name mode`)
  // Find a "Rename" button — common selectors
  const renameBtn = page.locator(
    'input[type="submit"][value="Rename"], button:has-text("Rename"), a:has-text("Rename")',
  ).first()
  await renameBtn.waitFor({ state: 'visible', timeout: 5000 })
  await renameBtn.click()
  await page.waitForTimeout(1500)
  await snap('rename-mode-active')

  // After Rename, an input field appears for the name. Typically the
  // checklist name text box becomes editable.
  console.log(`10. Find name input and set new name`)
  const nameInput = await page.evaluate((srcName, newName) => {
    const inputs = [...document.querySelectorAll('input[type="text"]')]
    const candidates = inputs.filter((i) => i.offsetParent !== null)
    // The active rename field has the current name as its value
    for (const inp of candidates) {
      if (inp.value === srcName || inp.value === srcName.replace(/—/g, '-')) {
        inp.focus()
        inp.value = newName
        inp.dispatchEvent(new Event('input', { bubbles: true }))
        inp.dispatchEvent(new Event('change', { bubbles: true }))
        return { ok: true, id: inp.id, name: inp.name }
      }
    }
    return { ok: false, candidates: candidates.map((c) => ({ id: c.id, name: c.name, value: c.value.slice(0, 40) })) }
  }, SOURCE_NAME, NEW_NAME)
  console.log(`   ${JSON.stringify(nameInput)}`)
  await snap('name-typed')

  console.log(`11. Click Save (the Rename button transforms to Save)`)
  const saveBtn = page.locator(
    'input[type="submit"][value="Save"], button:has-text("Save")',
  ).first()
  await saveBtn.waitFor({ state: 'visible', timeout: 5000 })
  await saveBtn.click()
  await page.waitForTimeout(3000)
  await snap('after-save')

  console.log(`12. Verify rename took effect`)
  await page.goto(officeUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const verifyText = await page.evaluate(() => document.body.innerText)
  const hasNewName = verifyText.includes(NEW_NAME)
  const hasOldName = verifyText.includes(SOURCE_NAME)
  console.log(`   Office page contains "${NEW_NAME}": ${hasNewName}`)
  console.log(`   Office page contains source name "${SOURCE_NAME}": ${hasOldName}`)
  outManifest.verified = hasNewName

  console.log(`\nDone. New template id=${newTemplateId} name="${NEW_NAME}"`)
  outManifest.completed = true
} catch (err) {
  console.error(`\nERROR: ${err.message}`)
  exitCode = 1
  await snap('error-state')
  outManifest.error = err.message
} finally {
  await fs.writeFile(path.join(OUTDIR, 'manifest.json'), JSON.stringify(outManifest, null, 2))
  console.log(`Manifest + screenshots: ${path.relative(process.cwd(), OUTDIR)}/`)
  await browser.close()
}
process.exit(exitCode)
