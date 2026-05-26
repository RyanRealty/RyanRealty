#!/usr/bin/env node
/**
 * Create a MASTER-LEVEL "Residential Sale — Legacy (Master)" template
 * by clicking "Create Checklist" on the master template list page
 * (officeid=-1), naming it, saving, and capturing the new template ID.
 *
 * Activities are NOT added by this script — see the follow-up
 * _skyslope-template-master-add-activities.mjs after capturing the ID.
 *
 * Why master scope: SkySlope rejects PUT checklistTypeId for sales with
 * null officeGuid against any office-scoped template (HTTP 422
 * "ChecklistTypeId is invalid"). Closed sales like 712 cannot have
 * officeGuid set (validation: "Brokers cannot update the office if they
 * are the agent on the file"). The only working path is a master-scoped
 * template.
 *
 * Usage:
 *   node scripts/_skyslope-template-master-create.mjs             # dry-run
 *   node scripts/_skyslope-template-master-create.mjs --execute   # actually create
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUTDIR = path.join(process.cwd(), 'tmp/template-master-create')
await fs.mkdir(OUTDIR, { recursive: true })

const EXECUTE = process.argv.includes('--execute')
const NEW_NAME = 'Residential Sale — Legacy (Master)'

console.log(`MODE: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
console.log(`Target name: "${NEW_NAME}"`)
console.log(`Target scope: master (officeid=-1)\n`)

const browser = await chromium.launch({ headless: true, slowMo: 100 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()
let snapIdx = 0
async function snap(label) {
  await page.screenshot({ path: path.join(OUTDIR, `${String(snapIdx++).padStart(2, '0')}-${label}.png`) })
}

const manifest = { mode: EXECUTE ? 'EXECUTE' : 'DRY_RUN', newName: NEW_NAME }

try {
  const masterUrl = 'https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=-1&Type=MQ=='
  console.log('1. Open master checklist list')
  await page.goto(masterUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (/LoginIntegrated/i.test(page.url())) throw new Error('Session expired — refresh via _skyslope-login-capture.mjs')
  await snap('master-list')

  console.log('2. Find Create Checklist button + click')
  const createBtn = page.locator('a:has-text("Create Checklist"), input[type="submit"][value="Create Checklist"], button:has-text("Create Checklist")').first()
  await createBtn.waitFor({ state: 'visible', timeout: 5000 })
  if (!EXECUTE) {
    console.log('   [DRY] would click Create Checklist')
    await snap('create-button-located')
    manifest.completed = false
    await fs.writeFile(path.join(OUTDIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
    await browser.close()
    process.exit(0)
  }
  await createBtn.click()
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await snap('after-create-click')

  console.log('3. Inspect form on next page — what fields are required')
  const formInfo = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input[type="text"], select')]
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ tag: e.tagName, name: e.name, id: e.id, type: e.type, currentValue: e.value }))
    const buttons = [...document.querySelectorAll('input[type="submit"], button, a')]
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ tag: e.tagName, text: (e.innerText || e.value || '').trim().substring(0, 60), id: e.id }))
      .filter((b) => b.text && /save|create|submit|add/i.test(b.text))
    return { url: location.href, formFields: inputs, buttons }
  })
  console.log('   URL:', formInfo.url)
  console.log('   Form fields:')
  for (const f of formInfo.formFields) {
    console.log(`     ${f.tag}/${f.type} name="${f.name}" id="${f.id}" current="${f.currentValue?.substring(0,30)}"`)
  }
  console.log('   Buttons:')
  for (const b of formInfo.buttons) console.log(`     ${b.tag} "${b.text}" id="${b.id}"`)
  await snap('form-inspected')

  manifest.formInfo = formInfo
  await fs.writeFile(path.join(OUTDIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('\nForm fields captured. Manifest at:', path.relative(process.cwd(), path.join(OUTDIR, 'manifest.json')))
  console.log('Inspect to know what to fill, then re-run with form-filling logic.')
} catch (e) {
  console.error(`ERROR: ${e.message}`)
  manifest.error = e.message
  await snap('error')
  await fs.writeFile(path.join(OUTDIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  await browser.close()
  process.exit(1)
}
await browser.close()
