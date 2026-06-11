#!/usr/bin/env node
/**
 * Explore SkySlope admin UI to:
 *   1. Land on the master checklist page (Transaction type, Ryan Realty office).
 *   2. Capture the page HTML + DOM dump so we know:
 *      - Which control creates a new template (button / link / form).
 *      - The list of all existing templates (id + name).
 *      - The Activity Type dropdown options on the activity editor.
 *   3. Save screenshots for review.
 *
 * Output: tmp/template-create-explore/
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUTDIR = path.join(process.cwd(), 'tmp/template-create-explore')
await fs.mkdir(OUTDIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  storageState: STATE_PATH,
  viewport: { width: 1600, height: 1000 },
})
const page = await context.newPage()

const masterUrl = 'https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=28920&Type=MQ=='
console.log(`Navigating to ${masterUrl}`)
await page.goto(masterUrl, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

if (/LoginIntegrated|Account\/Login/i.test(page.url())) {
  console.error('SESSION EXPIRED — re-run scripts/_skyslope-login-capture.mjs')
  process.exit(2)
}

await page.screenshot({ path: path.join(OUTDIR, '01-master-list.png'), fullPage: true })

const html = await page.content()
await fs.writeFile(path.join(OUTDIR, '01-master-list.html'), html)

// Capture all template rows (id + name) - common SkySlope pattern is rows with
// onclick handlers carrying PropertyTypeId in base64.
const templates = await page.$$eval('table tr', (rows) =>
  rows
    .map((row) => {
      const txt = row.innerText?.trim() || ''
      const onclick = row.getAttribute('onclick') || ''
      const dataUrl = row.getAttribute('data-url') || ''
      const links = [...row.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') || '')
      return { txt, onclick, dataUrl, links }
    })
    .filter((r) => r.txt && (r.onclick.includes('PropertyTypeId') || r.links.some((h) => h.includes('PropertyTypeId')))),
)
console.log(`\nFound ${templates.length} template rows`)
for (const t of templates) {
  const firstLine = t.txt.split('\n')[0].slice(0, 80)
  const hrefBlob = (t.onclick + ' ' + t.links.join(' ')).match(/PropertyTypeId=([A-Za-z0-9+/=]+)/)
  let id = null
  if (hrefBlob) {
    try { id = Buffer.from(decodeURIComponent(hrefBlob[1]), 'base64').toString('utf8') } catch {}
  }
  console.log(`  id=${id ?? '?'.padEnd(8)}  "${firstLine}"`)
}
await fs.writeFile(path.join(OUTDIR, 'templates.json'), JSON.stringify(templates, null, 2))

// Look for any "Add Template" / "New Checklist" controls
console.log(`\nSearching for create/add controls on master list page...`)
const createControls = await page.$$eval(
  'a, button, input[type="button"], input[type="submit"]',
  (els) =>
    els
      .map((e) => ({
        tag: e.tagName.toLowerCase(),
        text: (e.innerText || e.value || '').trim(),
        href: e.getAttribute('href') || '',
        id: e.id || '',
        cls: e.className || '',
        onclick: e.getAttribute('onclick') || '',
      }))
      .filter(
        (c) =>
          /add|new|create|copy|duplicate|clone/i.test(c.text) ||
          /add|new|create|copy|duplicate|clone/i.test(c.id) ||
          /add|new|create|copy|duplicate|clone/i.test(c.href),
      ),
)
for (const c of createControls) {
  console.log(`  ${c.tag} "${c.text}" id=${c.id} href=${c.href.slice(0, 80)}`)
}

// Visit the Residential — Standard activity-list page to see existing
// activities + the "Add Items" + Activity Type dropdown.
console.log(`\nNavigating to Residential — Standard activity list (id 1639421)...`)
function b64(n) { return Buffer.from(String(n)).toString('base64') }
const listUrl = `https://app.skyslope.com/BrokerCheckListActivityListTransaction.aspx?${new URLSearchParams({
  PropertyTypeId: b64(1639421),
  CheckListType: '1',
  officeid: '-1',
  CheckListName: 'Residential — Standard',
  ParentID: '0',
  checkSingleOfficeAuditor: 'No',
}).toString()}`
await page.goto(listUrl, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
await page.screenshot({ path: path.join(OUTDIR, '02-residential-standard-activities.png'), fullPage: true })
await fs.writeFile(path.join(OUTDIR, '02-residential-standard-activities.html'), await page.content())

// Click Add Items and capture the activity-edit form structure (especially
// the Activity Type dropdown options).
console.log(`Clicking Add Items to inspect the activity editor...`)
const addLink = page.getByRole('link', { name: /^Add Items$/i }).first()
if (await addLink.count()) {
  await addLink.click()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: path.join(OUTDIR, '03-add-items-form.png'), fullPage: true })
  await fs.writeFile(path.join(OUTDIR, '03-add-items-form.html'), await page.content())
  // Capture the Activity Type dropdown's options
  const options = await page.$$eval('select', (sels) =>
    sels.map((s) => ({
      name: s.name || s.id,
      id: s.id,
      options: [...s.options].map((o) => o.text.trim()).filter(Boolean),
    })).filter((s) => /activitytype|category/i.test(s.name + ' ' + s.id) || s.options.length > 3),
  )
  console.log(`Activity Type dropdown options found (${options.length} selects):`)
  for (const sel of options) {
    console.log(`  select id=${sel.id} name=${sel.name}: ${sel.options.length} options`)
    for (const opt of sel.options.slice(0, 30)) console.log(`    - ${opt}`)
  }
  await fs.writeFile(path.join(OUTDIR, 'activity-type-options.json'), JSON.stringify(options, null, 2))
} else {
  console.log('  (no Add Items link found on this page)')
}

console.log(`\nDone. Output in ${path.relative(process.cwd(), OUTDIR)}/`)
await browser.close()
