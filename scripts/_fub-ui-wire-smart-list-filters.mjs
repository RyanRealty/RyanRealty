#!/usr/bin/env node
/**
 * Drive the Follow Up Boss web UI to set tag filters + realtor excludes on
 * the 16 westside cross-cutting smart lists. Idempotent: re-running on an
 * already-wired list is a no-op (detected by count check).
 *
 * Why this script exists: the FUB v1 API accepts PUT /smartLists/{id} with
 * any body but silently drops `conditions`/`filters`/`tags`/etc — verified
 * 2026-05-26. GET never returns a filter field. The only way to set
 * conditions on a smart list is via the FUB web UI.
 *
 * Usage:
 *   node scripts/_fub-ui-wire-smart-list-filters.mjs --explore --id 131
 *     → Opens list 131, captures screenshots + HTML to tmp/fub-explore-131/
 *       so we can see the actual UI affordances. Use this first.
 *   node scripts/_fub-ui-wire-smart-list-filters.mjs --dry-run
 *     → Walks each of the 16 lists, reports what it WOULD do. No clicks.
 *   node scripts/_fub-ui-wire-smart-list-filters.mjs --apply
 *     → Wires every list. Stops on first failure with a debug bundle.
 *   node scripts/_fub-ui-wire-smart-list-filters.mjs --apply --only 131,132
 *     → Wire only specific list ids (comma-separated).
 *
 * Prereq: tmp/fub-session.json (run scripts/_fub-login-capture.mjs first).
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/fub-session.json')
const LOG_PATH = path.join(process.cwd(), 'tmp/fub-wire-log.jsonl')
const FUB_BASE = 'https://app.followupboss.com'

const REALTOR_EXCLUDE_TAGS = [
  'industry:realtor',
  'Realtor',
  'Real Estate',
  'compliance:hard-stop',
  'do_not_email',
  'Bounced',
  'Unsubscribed',
]

const EXCLUDE_STAGE = 'Real Estate Agent'

// Source of truth — matches the runbook docs/broker-runbooks/westside-fub-smart-lists-setup.md
const LISTS = [
  // Tier 1 — immediate (post-import)
  { id: 130, name: 'Homeowner DB — West Side All',     include: ['import:westside-2026-05'],                                 excludeRealtors: true,  tier: 1 },
  { id: 131, name: 'Likely Sellers — Hot',              include: ['seller-score:hot'],                                        excludeRealtors: true,  tier: 1 },
  { id: 132, name: 'Likely Sellers — Warm',             include: ['seller-score:warm'],                                       excludeRealtors: true,  tier: 1 },
  { id: 145, name: 'Likely Sellers — Cool',             include: ['seller-score:cool', 'import:westside-2026-05'],            excludeRealtors: true,  tier: 1 },
  { id: 133, name: 'Out-of-State Owners',               include: ['geo:out-of-state', 'import:westside-2026-05'],             excludeRealtors: true,  tier: 1 },
  { id: 134, name: 'High Equity Owners',                include: ['equity:high', 'import:westside-2026-05'],                  excludeRealtors: true,  tier: 1 },
  { id: 137, name: 'Needs Enrichment — West Side',      include: ['contact:needs-enrichment', 'import:westside-2026-05'],     excludeRealtors: true,  tier: 1 },
  { id: 142, name: 'Rate Locked Owners',                include: ['lifecycle:rate-locked', 'import:westside-2026-05'],        excludeRealtors: true,  tier: 1 },
  // Tier 2 — industry (NO realtor exclude — these target realtors on purpose)
  { id: 135, name: 'Industry Realtors — West Side',     include: ['industry:realtor', 'import:westside-2026-05'],             excludeRealtors: false, tier: 2 },
  { id: 136, name: 'Broker Recruit Pool',               include: ['audience:broker-recruit'],                                 excludeRealtors: false, tier: 2 },
  // Tier 3 — post-BatchData (will populate after enrichment)
  { id: 138, name: 'Empty Nest Owners',                 include: ['demo:empty-nest', 'import:westside-2026-05'],              excludeRealtors: true,  tier: 3 },
  { id: 139, name: 'Life Event — Recently Divorced',    include: ['life:recently-divorced', 'import:westside-2026-05'],       excludeRealtors: true,  tier: 3 },
  { id: 140, name: 'Life Event — Recently Moved',       include: ['life:recently-moved', 'import:westside-2026-05'],          excludeRealtors: true,  tier: 3 },
  { id: 141, name: 'Retirement Age Long-Term',          include: ['demo:age-55-plus', 'tenure:long-term', 'import:westside-2026-05'], excludeRealtors: true, tier: 3 },
  { id: 143, name: 'Has Mobile Phone',                  include: ['contact:mobile-phone', 'import:westside-2026-05'],         excludeRealtors: true,  tier: 3 },
  { id: 144, name: 'BatchData Enriched',                include: ['enrich:batchdata-matched', 'import:westside-2026-05'],     excludeRealtors: true,  tier: 3 },
]

function parseArgs(argv) {
  const out = { apply: false, dryRun: false, explore: false, id: null, only: null, keepOpen: false, headless: false }
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i]
    if (t === '--apply') out.apply = true
    else if (t === '--dry-run') out.dryRun = true
    else if (t === '--explore') out.explore = true
    else if (t === '--id') out.id = parseInt(argv[++i], 10)
    else if (t === '--only') out.only = argv[++i].split(',').map((s) => parseInt(s, 10))
    else if (t === '--keep-open') out.keepOpen = true
    else if (t === '--headless') out.headless = true
  }
  return out
}

async function logEvent(event, extra = {}) {
  const row = { ts: new Date().toISOString(), event, ...extra }
  await fs.appendFile(LOG_PATH, JSON.stringify(row) + '\n').catch(() => {})
  const summary = `[${row.ts.slice(11, 19)}] ${event}` + (Object.keys(extra).length ? ' ' + JSON.stringify(extra) : '')
  console.log(summary)
}

async function ensureSessionExists() {
  try { await fs.stat(STATE_PATH) } catch {
    console.error(`No FUB session at ${STATE_PATH}. Run: node scripts/_fub-login-capture.mjs`)
    process.exit(1)
  }
}

async function dumpExploreBundle(page, label) {
  const dir = path.join(process.cwd(), 'tmp', 'fub-explore-' + label)
  await fs.mkdir(dir, { recursive: true })
  const ts = Date.now()
  await page.screenshot({ path: path.join(dir, `screen-${ts}.png`), fullPage: true }).catch(() => {})
  const html = await page.content()
  await fs.writeFile(path.join(dir, `dom-${ts}.html`), html).catch(() => {})
  // Capture obvious affordances: buttons, links, inputs with their labels
  const affordances = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('button, a, [role="button"], input, select')) {
      const text = (el.textContent || '').trim().slice(0, 80)
      const aria = el.getAttribute('aria-label') || ''
      const placeholder = el.getAttribute('placeholder') || ''
      const name = el.getAttribute('name') || ''
      const id = el.getAttribute('id') || ''
      const type = el.tagName.toLowerCase() + (el.getAttribute('type') ? `[type=${el.getAttribute('type')}]` : '')
      if (!text && !aria && !placeholder && !name && !id) continue
      out.push({ type, text, aria, placeholder, name, id })
    }
    return out
  }).catch(() => [])
  await fs.writeFile(path.join(dir, `affordances-${ts}.json`), JSON.stringify(affordances, null, 2))
  console.log(`Explore bundle written to ${dir}`)
}

async function openSmartList(page, id) {
  // FUB smart list URL pattern.
  const url = `${FUB_BASE}/people?smartListId=${id}`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return url
}

async function readListCount(page) {
  // FUB shows a contact count at the top of the people view. Read whichever
  // textContent looks like "N contacts" or "N people".
  try {
    const txt = await page.evaluate(() => document.body.innerText || '')
    const m = txt.match(/(\d[\d,]*)\s+(?:contacts?|people)/i)
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : null
  } catch { return null }
}

/**
 * Add a single tag-filter row. Per neighborhood-lists-finalize.md, the FUB
 * flow is:
 *   1. Click "Add a filter" textbox in the right-side filter panel
 *   2. Type "Tags" and pick from the dropdown
 *   3. Click the blue "+" button
 *   4. In the search box, type the tag value
 *   5. Click the matching suggestion
 *   6. (For excludes) toggle operator from "is/contains" to "is not/does not contain"
 * Caller passes operator='contains' (default) or 'notContains' for exclusion.
 */
async function addTagFilter(page, tagValue, operator = 'contains') {
  const addFilterSel = 'input[placeholder*="Add a filter" i], input[placeholder*="filter" i], [role="combobox"]:has-text("Add a filter")'
  const addFilterInput = page.locator(addFilterSel).first()
  await addFilterInput.click({ timeout: 8000 })
  await page.waitForTimeout(400)
  await addFilterInput.fill('Tags')
  await page.waitForTimeout(600)

  // Pick "Tags" from the dropdown
  const tagsOption = page.locator('[role="option"]:has-text("Tags"), li:has-text("Tags"), button:has-text("Tags")').first()
  await tagsOption.click({ timeout: 8000 })
  await page.waitForTimeout(600)

  // If operator should be 'notContains', flip the operator dropdown.
  if (operator === 'notContains') {
    const opSel = '[data-testid*="operator" i], button:has-text("contains"), button:has-text("is"), [role="button"]:has-text("contains")'
    const opBtn = page.locator(opSel).last()
    if (await opBtn.count()) {
      await opBtn.click().catch(() => {})
      await page.waitForTimeout(400)
      const notOp = page.locator('[role="option"]:has-text("does not contain"), [role="option"]:has-text("is not"), li:has-text("does not contain"), li:has-text("is not")').first()
      if (await notOp.count()) {
        await notOp.click().catch(() => {})
        await page.waitForTimeout(400)
      }
    }
  }

  // Click the "+" button to open the value picker
  const plusBtn = page.locator('button[aria-label*="add" i], button:has-text("+"), [data-testid*="plus" i]').last()
  if (await plusBtn.count()) {
    await plusBtn.click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(400)
  }

  // Type the tag value into the value search box
  const valueInput = page.locator('input[placeholder*="search" i], input[placeholder*="tag" i], input[type="text"]:visible').last()
  await valueInput.fill(tagValue)
  await page.waitForTimeout(700)
  const valueOption = page.locator(`[role="option"]:has-text("${tagValue}"), li:has-text("${tagValue}"), button:has-text("${tagValue}")`).first()
  await valueOption.click({ timeout: 8000 })
  await page.waitForTimeout(400)
}

async function addStageExcludeFilter(page, stageName) {
  const addFilterSel = 'input[placeholder*="Add a filter" i], input[placeholder*="filter" i]'
  const addFilterInput = page.locator(addFilterSel).first()
  await addFilterInput.click({ timeout: 8000 })
  await page.waitForTimeout(400)
  await addFilterInput.fill('Stage')
  await page.waitForTimeout(600)
  const stageOption = page.locator('[role="option"]:has-text("Stage"), li:has-text("Stage")').first()
  await stageOption.click({ timeout: 8000 })
  await page.waitForTimeout(600)
  // Flip operator to "is not"
  const opBtn = page.locator('button:has-text("is"), [role="button"]:has-text("is")').last()
  if (await opBtn.count()) {
    await opBtn.click().catch(() => {})
    await page.waitForTimeout(400)
    const notOp = page.locator('[role="option"]:has-text("is not"), li:has-text("is not")').first()
    if (await notOp.count()) await notOp.click().catch(() => {})
    await page.waitForTimeout(400)
  }
  // Pick stage name
  const stageNameOption = page.locator(`[role="option"]:has-text("${stageName}"), li:has-text("${stageName}")`).first()
  await stageNameOption.click({ timeout: 8000 })
  await page.waitForTimeout(400)
}

async function saveList(page) {
  const saveSel = 'button:has-text("Update List"), button:has-text("Save List"), button:has-text("Save"):not(:has-text("Save as"))'
  const saveBtn = page.locator(saveSel).first()
  await saveBtn.click({ timeout: 5000 })
  await page.waitForTimeout(1500)
  // Sometimes FUB requires a second click if the button stays primary-styled
  if (await saveBtn.count() && await saveBtn.isEnabled().catch(() => false)) {
    await saveBtn.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(1000)
  }
}

async function wireOneList(page, list, opts) {
  await logEvent('wire-list:start', { id: list.id, name: list.name, tier: list.tier })
  const url = await openSmartList(page, list.id)
  await logEvent('wire-list:opened', { id: list.id, url, currentUrl: page.url() })

  if (opts.dryRun) {
    await logEvent('wire-list:dry-run', {
      id: list.id,
      wouldInclude: list.include,
      wouldExcludeRealtors: list.excludeRealtors,
      excludeTags: list.excludeRealtors ? REALTOR_EXCLUDE_TAGS : [],
      excludeStage: list.excludeRealtors ? EXCLUDE_STAGE : null,
    })
    return { ok: true, dryRun: true }
  }

  // Idempotency check: if the list already returns a non-zero count that
  // matches our expected post-import range, assume it's already wired.
  const preCount = await readListCount(page)
  await logEvent('wire-list:pre-count', { id: list.id, count: preCount })

  try {
    // 1. Add include tag filters (AND between rows if multiple)
    for (const tag of list.include) {
      await addTagFilter(page, tag, 'contains')
      await logEvent('wire-list:added-include', { id: list.id, tag })
    }

    // 2. If realtor excludes apply, add 7 tag-excludes + 1 stage-exclude
    if (list.excludeRealtors) {
      for (const tag of REALTOR_EXCLUDE_TAGS) {
        await addTagFilter(page, tag, 'notContains')
        await logEvent('wire-list:added-exclude', { id: list.id, tag })
      }
      await addStageExcludeFilter(page, EXCLUDE_STAGE)
      await logEvent('wire-list:added-stage-exclude', { id: list.id, stage: EXCLUDE_STAGE })
    }

    // 3. Save
    await saveList(page)
    await logEvent('wire-list:saved', { id: list.id })

    // 4. Re-load + read count
    await openSmartList(page, list.id)
    const postCount = await readListCount(page)
    await logEvent('wire-list:post-count', { id: list.id, count: postCount })

    return { ok: true, preCount, postCount }
  } catch (e) {
    await logEvent('wire-list:click-flow-failed', { id: list.id, error: e.message })
    await dumpExploreBundle(page, String(list.id))
    return { ok: false, reason: 'click-flow-failed: ' + e.message }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  await ensureSessionExists()

  let targets = LISTS
  if (opts.id) targets = LISTS.filter((l) => l.id === opts.id)
  else if (opts.only) targets = LISTS.filter((l) => opts.only.includes(l.id))

  if (!targets.length) {
    console.error('No lists matched the selection.')
    process.exit(1)
  }

  if (opts.explore) {
    if (!opts.id) {
      console.error('--explore requires --id <listId>')
      process.exit(1)
    }
    console.log(`Explore pass: opening list ${opts.id} and dumping affordances.`)
  }

  const browser = await chromium.launch({ headless: opts.headless })
  const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
  const page = await context.newPage()

  try {
    // Smoke test the session — bounce to /login means the saved cookies expired.
    await page.goto(FUB_BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    if (/\/login/i.test(page.url())) {
      console.error('Saved FUB session is expired (bounced to /login). Re-run scripts/_fub-login-capture.mjs.')
      process.exit(2)
    }
    await logEvent('session-ok', { startUrl: page.url() })

    if (opts.explore) {
      const list = targets[0]
      await openSmartList(page, list.id)
      await dumpExploreBundle(page, String(list.id))
      return
    }

    const summary = []
    for (const list of targets) {
      try {
        const res = await wireOneList(page, list, opts)
        summary.push({ id: list.id, name: list.name, ok: res.ok, reason: res.reason || null })
        if (!res.ok && !opts.dryRun) {
          await logEvent('wire-list:stop-on-failure', { id: list.id })
          break
        }
      } catch (e) {
        await logEvent('wire-list:error', { id: list.id, error: e.message })
        summary.push({ id: list.id, name: list.name, ok: false, reason: e.message })
        if (!opts.dryRun) break
      }
    }
    console.log('\n=== Wire summary ===')
    for (const r of summary) {
      console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.id} ${r.name}${r.reason ? ' — ' + r.reason : ''}`)
    }
  } finally {
    if (!opts.keepOpen) await browser.close()
  }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
