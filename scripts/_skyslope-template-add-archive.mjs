#!/usr/bin/env node
/**
 * Adds an "Archive" optional activity (Miscellaneous Documentation
 * category) to two SkySlope checklist templates via the legacy admin UI:
 *
 *   - 1639421  Residential — Standard         (current default)
 *   - 1635390  Residential — Standard (LEGACY) (snapshot used by Canceled folders)
 *
 * The SkySlope JSON API does not expose template-activity CRUD, so this
 * script drives the BrokerCheckListActivity admin pages with Playwright
 * using the saved storage state from _skyslope-login-capture.mjs.
 *
 * Usage:
 *   node scripts/_skyslope-template-add-archive.mjs              # dry-run (no save click)
 *   node scripts/_skyslope-template-add-archive.mjs --execute    # actually save
 *   node scripts/_skyslope-template-add-archive.mjs --explore    # opens 1st template list page, no actions, leaves browser open 5 min
 *
 * Output:
 *   tmp/skyslope-template-add-archive.json — { [templateId]: { existed: bool, activityId?: string } }
 *
 * Re-runs are idempotent: if an "Archive" activity already exists in a
 * template, the script skips the add for that template and just records
 * the existing activityId.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUT_PATH = path.join(process.cwd(), 'tmp/skyslope-template-add-archive.json')
const DRY = !process.argv.includes('--execute')
const EXPLORE = process.argv.includes('--explore')

const TEMPLATES = [
  { id: 1639421, name: 'Residential — Standard' },
  { id: 1635390, name: 'Residential — Standard (LEGACY)' },
]

const ARCHIVE_DEF = {
  activityName: 'Archive',
  activityType: 'Miscellaneous Documentation',
  ifApplicable: true,
  helpText:
    'Bucket for non-canonical docs — duplicates, not_executed mutual instruments, superseded versions. The file list keeps the ARCHIVE prefix for visual triage.',
  isActive: true,
}

function b64(n) { return Buffer.from(String(n)).toString('base64') }

function listPageUrl(template) {
  const params = new URLSearchParams({
    PropertyTypeId: b64(template.id),
    CheckListType: '1',
    officeid: '-1',
    CheckListName: template.name,
    ParentID: '0',
    checkSingleOfficeAuditor: 'No',
  })
  return `https://app.skyslope.com/BrokerCheckListActivityListTransaction.aspx?${params.toString()}`
}

async function loadOut() {
  try { return JSON.parse(await fs.readFile(OUT_PATH, 'utf8')) } catch { return {} }
}

async function saveOut(state) {
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, JSON.stringify(state, null, 2))
}

async function findExistingArchive(page) {
  // The list page renders rows under columns: Activity / Activity Type /
  // Checklist Type / Flag / Inbox / Update / Delete. We look for a row
  // whose first cell text trims to 'Archive' (or 'Archive *' if Optional).
  const handles = await page.locator('table tr').all()
  for (const row of handles) {
    const txt = (await row.innerText().catch(() => '')).trim()
    const firstCell = txt.split(/\t|\n/)[0]?.trim() || ''
    if (firstCell === 'Archive' || firstCell === 'Archive *') {
      // Find an edit/update link in this row; its href contains id=<base64>
      const updateLink = row.locator('a[href*="BrokerCheckListActivity.aspx?id="]').first()
      const href = await updateLink.getAttribute('href').catch(() => null)
      let activityId = null
      if (href) {
        const m = href.match(/[?&]id=([^&]+)/)
        if (m) {
          try { activityId = Buffer.from(decodeURIComponent(m[1]), 'base64').toString('utf8') } catch {}
        }
      }
      return { found: true, activityId, raw: firstCell }
    }
  }
  return { found: false }
}

async function clickAddItems(page) {
  // The "Add Items" control may be a link or a button. Try by accessible role first.
  const byRole = page.getByRole('link', { name: /^Add Items$/i })
  if (await byRole.count()) {
    await byRole.first().click()
    return
  }
  const byText = page.locator('a:has-text("Add Items"), input[value="Add Items"], button:has-text("Add Items")').first()
  await byText.waitFor({ state: 'visible', timeout: 5000 })
  await byText.click()
}

/**
 * Fill in the first empty row on BrokerCheckListActivity.aspx. The page
 * renders a repeating row pattern; the empty row at the top has empty
 * Activity Name and Activity Type fields.
 */
async function fillFirstRow(page) {
  // Wait for at least one Activity Name input.
  const nameInputs = page.locator('input[type="text"][id*="ActivityName" i], input[type="text"][name*="ActivityName" i]')
  await nameInputs.first().waitFor({ state: 'visible', timeout: 10000 }).catch(async () => {
    // Fallback: any text input inside the form's row table
    await page.waitForSelector('table input[type="text"]', { timeout: 10000 })
  })

  const nameLocators = await page.locator('input[type="text"]').all()
  let nameInput = null
  for (const el of nameLocators) {
    const val = await el.inputValue().catch(() => '')
    const name = (await el.getAttribute('name').catch(() => '')) || ''
    const id = (await el.getAttribute('id').catch(() => '')) || ''
    if (val === '' && /activityname/i.test(name + ' ' + id)) {
      nameInput = el
      break
    }
  }
  if (!nameInput) {
    // Looser fallback: first empty text input on the page
    for (const el of nameLocators) {
      const val = await el.inputValue().catch(() => '')
      if (val === '') { nameInput = el; break }
    }
  }
  if (!nameInput) throw new Error('Could not find an empty Activity Name input')

  await nameInput.fill(ARCHIVE_DEF.activityName)

  // The Activity Type dropdown for the same row is the nearest <select>
  // after the name input within the same table row.
  const row = nameInput.locator('xpath=ancestor::tr[1]')
  const typeSelect = row.locator('select').first()
  await typeSelect.waitFor({ state: 'visible', timeout: 5000 })
  await typeSelect.selectOption({ label: ARCHIVE_DEF.activityType })

  // If Applicable checkbox in same row
  const ifApplicable = row.locator('input[type="checkbox"][id*="Applicable" i], input[type="checkbox"][name*="Applicable" i]').first()
  if (await ifApplicable.count()) {
    const checked = await ifApplicable.isChecked().catch(() => false)
    if (ARCHIVE_DEF.ifApplicable && !checked) await ifApplicable.check()
    if (!ARCHIVE_DEF.ifApplicable && checked) await ifApplicable.uncheck()
  }

  // Help Text input in same row
  const helpInput = row.locator('input[type="text"][id*="HelpText" i], input[type="text"][name*="HelpText" i], textarea[id*="HelpText" i], textarea[name*="HelpText" i]').first()
  if (await helpInput.count()) {
    await helpInput.fill(ARCHIVE_DEF.helpText)
  }

  // Is Active checkbox (defaults to checked on new rows in SkySlope, but
  // be defensive)
  const activeChk = row.locator('input[type="checkbox"][id*="Active" i], input[type="checkbox"][name*="Active" i]').first()
  if (await activeChk.count()) {
    const checked = await activeChk.isChecked().catch(() => false)
    if (ARCHIVE_DEF.isActive && !checked) await activeChk.check()
  }
}

async function clickSave(page) {
  const candidates = [
    page.getByRole('button', { name: /^Save$/i }),
    page.locator('input[type="submit"][value="Save"]'),
    page.locator('input[type="button"][value="Save"]'),
    page.locator('button:has-text("Save")'),
  ]
  for (const c of candidates) {
    if (await c.count()) { await c.first().click(); return }
  }
  throw new Error('Could not find Save button')
}

const state = await loadOut()

const browser = await chromium.launch({ headless: false, slowMo: 150 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1400, height: 900 } })
const page = await context.newPage()

let exitCode = 0

try {
  for (const tpl of TEMPLATES) {
    const url = listPageUrl(tpl)
    console.log(`\n=== Template ${tpl.id} (${tpl.name}) ===`)
    console.log(`Navigating to ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)

    if (/LoginIntegrated\.aspx/i.test(page.url())) {
      throw new Error('Session expired — re-run scripts/_skyslope-login-capture.mjs')
    }

    if (EXPLORE) {
      console.log('Explore mode — leaving browser open for 5 minutes. Inspect the DOM.')
      await page.waitForTimeout(5 * 60 * 1000)
      continue
    }

    const existing = await findExistingArchive(page)
    if (existing.found) {
      console.log(`Archive already exists in template ${tpl.id} (activityId=${existing.activityId ?? '?'})`)
      state[tpl.id] = { existed: true, activityId: existing.activityId, templateName: tpl.name }
      await saveOut(state)
      continue
    }

    console.log('Archive not present — clicking Add Items')
    await clickAddItems(page)
    await page.waitForTimeout(1500)

    console.log('Filling first row...')
    await fillFirstRow(page)
    await page.waitForTimeout(500)

    if (DRY) {
      console.log('[DRY] Skipping Save. Re-run with --execute to commit.')
      // Take a screenshot for review
      const shot = `tmp/skyslope-template-${tpl.id}-dry.png`
      await page.screenshot({ path: shot, fullPage: true })
      console.log(`Screenshot saved → ${shot}`)
      state[tpl.id] = { existed: false, activityId: null, dryRun: true, templateName: tpl.name }
      await saveOut(state)
      continue
    }

    console.log('Clicking Save...')
    await clickSave(page)
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(2000)

    console.log('Re-navigating to list page to verify + capture activityId')
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)

    const after = await findExistingArchive(page)
    if (!after.found) throw new Error(`Archive not visible after save on template ${tpl.id}`)
    console.log(`Created. activityId=${after.activityId ?? '?'}`)
    state[tpl.id] = { existed: false, activityId: after.activityId, templateName: tpl.name }
    await saveOut(state)
  }
} catch (err) {
  console.error(`FAILED: ${err.message}`)
  console.error(err.stack)
  const shot = `tmp/skyslope-template-error-${Date.now()}.png`
  try { await page.screenshot({ path: shot, fullPage: true }) } catch {}
  console.error(`Screenshot saved → ${shot}`)
  exitCode = 1
}

await browser.close()
console.log(`\nState written to ${OUT_PATH}`)
process.exit(exitCode)
