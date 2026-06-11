#!/usr/bin/env node
/**
 * Probe the "Copy" template flow on BrokerMasterChecklist.aspx.
 * Navigates to officeid=-1 (Master) to find Residential — Standard, then
 * clicks Copy and screenshots whatever happens (modal, redirect, form).
 *
 * Does NOT click any final Save — pure investigation.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUTDIR = path.join(process.cwd(), 'tmp/template-copy-probe')
await fs.mkdir(OUTDIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

const masterUrl = 'https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=-1&Type=MQ=='
console.log(`Navigating to ${masterUrl}`)
await page.goto(masterUrl, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

if (/LoginIntegrated|Account\/Login/i.test(page.url())) {
  console.error('SESSION EXPIRED')
  process.exit(2)
}

await page.screenshot({ path: path.join(OUTDIR, '01-master-officeid-neg1.png'), fullPage: true })
await fs.writeFile(path.join(OUTDIR, '01-master-officeid-neg1.html'), await page.content())

// Find Residential — Standard row and select its radio/checkbox
const templates = await page.$$eval('table tr', (rows) =>
  rows
    .map((row) => {
      const txt = row.innerText?.trim() || ''
      const inputs = [...row.querySelectorAll('input')].map((i) => ({ type: i.type, name: i.name, id: i.id, value: i.value }))
      const links = [...row.querySelectorAll('a[href]')].map((a) => ({ text: a.innerText?.trim(), href: a.getAttribute('href') }))
      const onclick = row.getAttribute('onclick') || ''
      return { txt, inputs, links, onclick }
    })
    .filter((r) => r.txt && (/Residential|Vacant|Traditional|Sale|Standard/i.test(r.txt))),
)
console.log(`Found ${templates.length} matching template rows`)
for (const t of templates) {
  const firstLine = t.txt.split('\n')[0].slice(0, 60)
  console.log(`  ${firstLine}`)
  console.log(`     inputs: ${JSON.stringify(t.inputs)}`)
}

// Save full template inventory
await fs.writeFile(path.join(OUTDIR, 'templates-officeid-neg1.json'), JSON.stringify(templates, null, 2))

// Look for Copy button and any radio/select-source mechanism
const copyBtn = page.locator('#ContentPlaceHolder1_imgbtnCopy')
console.log(`Copy button: count=${await copyBtn.count()}`)

// Check if rows have radio buttons (typical "select source for copy" pattern)
const radios = await page.locator('input[type="radio"]').count()
const checkboxes = await page.locator('input[type="checkbox"]').count()
console.log(`Radios: ${radios}, checkboxes: ${checkboxes}`)

// If radios exist, snapshot what their values are
if (radios > 0) {
  const radInfo = await page.$$eval('input[type="radio"]', (els) =>
    els.map((e) => ({ name: e.name, value: e.value, id: e.id })),
  )
  console.log(`Radio names: ${[...new Set(radInfo.map((r) => r.name))].slice(0, 5).join(', ')}`)
}

// Try clicking Copy without selecting anything to see what happens
console.log('\nClicking Copy (no source selected) to see modal...')
await copyBtn.click().catch(() => {})
await page.waitForTimeout(2500)
await page.screenshot({ path: path.join(OUTDIR, '02-after-copy-click.png'), fullPage: true })
await fs.writeFile(path.join(OUTDIR, '02-after-copy-click.html'), await page.content())

// Check if a modal appeared
const modalText = await page.locator('div[role="dialog"], .modal, #copyChecklistModal, #checklistCopyModal').first()
const modalCount = await modalText.count()
console.log(`Modal count: ${modalCount}`)

if (modalCount > 0) {
  const modalContent = await modalText.innerText().catch(() => '')
  console.log(`Modal text: ${modalContent.slice(0, 500)}`)
}

// Look for alerts
const alertBox = page.locator('.alert, .error, [class*="alert"]').first()
if (await alertBox.count()) {
  console.log(`Alert: ${await alertBox.innerText().catch(() => '')}`)
}

console.log(`\nDone. Outputs in ${path.relative(process.cwd(), OUTDIR)}/`)
await browser.close()
