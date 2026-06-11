#!/usr/bin/env node
/**
 * UI move smoke test: pick the FIRST ARCHIVE-prefixed doc in Canceled-B
 * (NOT 751df22e, which is our prior API-smoke doc), check its checkbox,
 * call RaiseDropDownPostBack with Matt's Archive folder value
 * (20176853Z33096-1), wait for postback, then re-fetch the page and
 * verify the doc count dropped by 1 and the moved doc no longer appears.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/skyslope-ui-move-smoke'
const TXN_ID_B64 = 'MjAxNzY4NTM=' // Canceled-B
const DOCS_URL = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${TXN_ID_B64}&ListingID=MA==&checklistId=MA==`
const ARCHIVE_VALUE = '20176853Z33096-1'
const SKIP_DOC_ID = '751df22e-5661-44a8-8746-049be6383e08' // prior API-smoke doc

await fs.mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: false, slowMo: 250 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

try {
  console.log(`Navigating to Canceled-B docs page...`)
  await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // Find the first ARCHIVE-prefixed doc that isn't the API-smoke doc.
  const candidate = await page.evaluate((skipDocId) => {
    const labels = document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList span[id*="lblName"]')
    for (const lbl of labels) {
      const text = (lbl.textContent || '').trim()
      if (!/^ARCHIVE\s/i.test(text)) continue
      // Walk up to the row, find the doc ID (k= in onclick) and the checkbox name
      const tr = lbl.closest('tr')
      if (!tr) continue
      const checkbox = tr.querySelector('input[type="checkbox"][id*="chkdoc"]')
      const opendocAnchor = tr.querySelector('a[onclick*="opendoc"]')
      let docKey = null
      if (opendocAnchor) {
        const m = (opendocAnchor.getAttribute('onclick') || '').match(/k=([a-f0-9]+)'/)
        if (m) docKey = m[1]
      }
      // Skip docs whose name suggests the prior API-smoke doc filename
      if (/042_Initial Agency Disclosure Pamphlet/.test(text)) continue
      if (checkbox && checkbox.name) {
        return {
          name: text,
          docKey,
          checkboxName: checkbox.name,
          checkboxId: checkbox.id,
        }
      }
    }
    return null
  }, SKIP_DOC_ID)

  if (!candidate) throw new Error('No suitable candidate doc found')
  console.log(`Candidate doc:`)
  console.log(`  name:        ${candidate.name}`)
  console.log(`  docKey:      ${candidate.docKey}`)
  console.log(`  checkbox:    ${candidate.checkboxName}`)

  // Count ARCHIVE-prefixed docs visible BEFORE the move
  const countBefore = await page.evaluate(() => {
    const labels = document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList span[id*="lblName"]')
    let n = 0
    for (const l of labels) if (/^ARCHIVE\s/i.test((l.textContent || '').trim())) n++
    return n
  })
  console.log(`ARCHIVE-prefixed docs visible BEFORE move: ${countBefore}`)
  await page.screenshot({ path: path.join(OUT_DIR, '01-before.png'), fullPage: true })

  // Check the candidate's checkbox. Important: RaiseDropDownPostBack
  // requires the checkbox to live under the `.bg1` selector. Verify
  // the candidate's checkbox satisfies that before submitting.
  console.log(`Checking checkbox + verifying it's under .bg1...`)
  const checkResult = await page.evaluate((checkboxId) => {
    const el = document.getElementById(checkboxId)
    if (!el) return { ok: false, reason: 'no-element' }
    const underBg1 = !!el.closest('.bg1')
    if (!el.checked) {
      el.checked = true
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.dispatchEvent(new Event('click', { bubbles: true }))
    }
    return { ok: true, checked: el.checked, underBg1, classList: [...el.classList] }
  }, candidate.checkboxId)
  console.log(`  ${JSON.stringify(checkResult)}`)
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(OUT_DIR, '02-checked.png'), fullPage: true })

  // Count actually-checked checkboxes under .bg1 (what the postback handler measures)
  const checkedCount = await page.evaluate(() => document.querySelectorAll('.bg1 input[type=checkbox]:checked').length)
  console.log(`Total .bg1 checkboxes checked: ${checkedCount}`)
  if (checkedCount === 0) {
    console.error(`No .bg1 checkboxes checked — postback will short-circuit. Aborting smoke.`)
    process.exit(1)
  }

  // Call __doPostBack directly with the same args RaiseDropDownPostBack would
  console.log(`Invoking __doPostBack('divdrpDownMoveButton', '${ARCHIVE_VALUE}:Archive')...`)
  await page.evaluate((value) => {
    if (typeof __doPostBack === 'function') {
      __doPostBack('divdrpDownMoveButton', value + ':Archive')
    }
  }, ARCHIVE_VALUE)

  // Wait for the postback round-trip
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await page.screenshot({ path: path.join(OUT_DIR, '03-after-move.png'), fullPage: true })

  // Re-count ARCHIVE-prefixed docs visible AFTER
  const countAfter = await page.evaluate(() => {
    const labels = document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList span[id*="lblName"]')
    let n = 0
    for (const l of labels) if (/^ARCHIVE\s/i.test((l.textContent || '').trim())) n++
    return n
  })
  console.log(`ARCHIVE-prefixed docs visible AFTER move: ${countAfter}`)

  // Check that the candidate name is no longer visible
  const stillVisible = await page.evaluate((name) => {
    const labels = document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList span[id*="lblName"]')
    for (const l of labels) if ((l.textContent || '').trim() === name) return true
    return false
  }, candidate.name)
  console.log(`Candidate "${candidate.name}" still in main view: ${stillVisible}`)

  // Inspect the move dropdown menu for any change in counts/folder structure
  const menuAfter = await page.evaluate(() => {
    const items = document.querySelectorAll('#divdrpDownMoveButton ol li, #divdrpDownMoveButton ul li')
    return [...items].map((li) => ({ text: (li.textContent || '').trim(), value: li.getAttribute('value') }))
  })
  console.log(`Move menu after:`)
  for (const m of menuAfter) console.log(`  ${m.value}  "${m.text}"`)

  if (countAfter === countBefore - 1 && !stillVisible) {
    console.log(`\n✓ SMOKE PASSED — doc moved out of main view (count ${countBefore} → ${countAfter}).`)
  } else {
    console.log(`\n? UNCLEAR — expected count ${countBefore-1}, got ${countAfter}. stillVisible=${stillVisible}.`)
    console.log(`Inspect screenshots in ${OUT_DIR} to see what happened.`)
  }
} finally {
  await page.waitForTimeout(2000)
  await browser.close()
}
