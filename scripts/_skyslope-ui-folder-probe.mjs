#!/usr/bin/env node
/**
 * Drive the SkySlope UI via Playwright to inspect the Canceled Nordic
 * (Canceled-B, sale GUID 0ec95d31) Documents view. Walks every folder
 * tab visible and captures:
 *   - Tab labels seen in the UI
 *   - Document filenames per tab
 *   - Screenshots
 *   - Full DOM snapshot
 *
 * If no saved login state exists at tmp/skyslope-session.json, opens a
 * headed window and waits up to 30 minutes for Matt to complete login,
 * then saves the state and proceeds. Re-runs with existing state skip
 * login.
 *
 * Output:
 *   tmp/skyslope-ui-probe/probe-report.json
 *   tmp/skyslope-ui-probe/*.png (one per page/folder)
 *   tmp/skyslope-ui-probe/*.html (DOM snapshot)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/skyslope-ui-probe'
const LOGIN_URL = 'https://app.skyslope.com/LoginIntegrated.aspx'
const POST_LOGIN_URL = 'https://app.skyslope.com/ManageTransactions.aspx'
const TARGET_GUID = '0ec95d31-1fed-4519-a114-e967513eac33'
const TARGET_LABEL = 'Canceled-B Nordic'
const MAX_LOGIN_WAIT_MS = 30 * 60 * 1000

await fs.mkdir(OUT_DIR, { recursive: true })

const report = {
  generatedAt: new Date().toISOString(),
  targetGuid: TARGET_GUID,
  targetLabel: TARGET_LABEL,
  steps: [],
  folders: [],
}

function step(name, data = {}) {
  const e = { ts: new Date().toISOString(), name, ...data }
  report.steps.push(e)
  console.log(`[${e.ts.slice(11, 19)}] ${name}` + (Object.keys(data).length ? ' ' + JSON.stringify(data).slice(0, 200) : ''))
}

const haveState = await fs.stat(STATE_PATH).then(() => true).catch(() => false)
step('start', { haveSavedState: haveState })

const browser = await chromium.launch({ headless: false, slowMo: 100 })
const context = haveState
  ? await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1400, height: 900 } })
  : await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await context.newPage()

try {
  if (!haveState) {
    step('navigate-login')
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })
    console.log(`\nPlease complete the SkySlope login in the open window. Script will detect redirect and continue automatically. Max wait: 30 min.\n`)
    const startWait = Date.now()
    while (Date.now() - startWait < MAX_LOGIN_WAIT_MS) {
      await page.waitForTimeout(2000)
      const u = page.url()
      if (!/LoginIntegrated\.aspx/i.test(u) && /app\.skyslope\.com/i.test(u)) {
        step('login-detected', { url: u })
        await page.waitForTimeout(2000)
        break
      }
    }
    if (/LoginIntegrated\.aspx/i.test(page.url())) throw new Error('Login wait timed out')
    await context.storageState({ path: STATE_PATH })
    step('saved-state')
  }

  // Step 1: Land on Manage Transactions
  step('navigate-manage-transactions')
  await page.goto(POST_LOGIN_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (/LoginIntegrated\.aspx/i.test(page.url())) throw new Error('Session expired; delete tmp/skyslope-session.json and rerun')
  await page.screenshot({ path: path.join(OUT_DIR, '01-manage-transactions.png'), fullPage: true })

  // Step 2: Find a way into Canceled-B. The page lists transactions but we
  // need to click into the specific Nordic Canceled one. Strategy: try to
  // click through the status filter to "Canceled", then locate Nordic by
  // address text. If that fails, try the search box.
  step('searching-for-nordic')

  // Try clicking any "Canceled" tab/filter to narrow the list
  const canceledTab = page.locator('a:has-text("Canceled"), button:has-text("Canceled"), :text("Canceled")').first()
  if (await canceledTab.count()) {
    try { await canceledTab.click({ timeout: 3000 }); await page.waitForTimeout(1500) } catch {}
  }
  await page.screenshot({ path: path.join(OUT_DIR, '02-after-canceled-filter.png'), fullPage: true })

  // Look for "Nordic" rows in the page
  const nordicRows = await page.locator(':text-matches("Nordic", "i")').all()
  step('nordic-row-count', { count: nordicRows.length })

  // Search box fallback
  const searchBox = page.locator('input[type="search"], input[placeholder*="Search" i], input[name*="Search" i]').first()
  if (await searchBox.count()) {
    try {
      await searchBox.fill('Nordic')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(2000)
      step('searched-nordic-via-box')
    } catch {}
  }
  await page.screenshot({ path: path.join(OUT_DIR, '03-after-search.png'), fullPage: true })

  // Dump links containing Nordic for inspection
  const links = await page.locator('a').evaluateAll((els) =>
    els.map((a) => ({ href: a.href, text: a.textContent?.trim().slice(0, 120) || '' }))
      .filter((x) => /nordic/i.test(x.text) || /nordic/i.test(x.href || ''))
  )
  step('nordic-links-found', { count: links.length, sample: links.slice(0, 10) })

  // If we have nordic links, pick one that looks like Canceled-B. We don't
  // know the integer TransactionID off-hand, but we can click each candidate
  // and check if the loaded transaction page contains our GUID. For
  // efficiency, click the first nordic link and pivot from there.
  let landedOnTransaction = false
  for (const lnk of links.slice(0, 5)) {
    if (!lnk.href || !lnk.href.includes('CreateTransaction.aspx')) continue
    step('clicking-nordic-link', { href: lnk.href, text: lnk.text })
    await page.goto(lnk.href, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const html = await page.content()
    if (html.includes(TARGET_GUID) || html.includes('Canceled')) {
      step('landed-on-nordic-page', { url: page.url() })
      landedOnTransaction = true
      break
    }
  }

  if (!landedOnTransaction) {
    // Last resort: use the API integer TransactionID lookup if we can find it
    // by hovering over rows. Skip for now and capture what we have.
    step('warning-no-transaction-landed', { instruction: 'Manually click into Canceled-B Nordic now if browser is still visible; script will continue capture in 30s' })
    await page.waitForTimeout(30000)
  }

  await page.screenshot({ path: path.join(OUT_DIR, '04-transaction-page.png'), fullPage: true })

  // Step 3: Navigate to Documents tab
  step('navigate-to-documents-tab')
  const docsTab = page.locator('a:has-text("Documents"), :text("Documents")').first()
  if (await docsTab.count()) {
    try { await docsTab.click({ timeout: 5000 }); await page.waitForTimeout(2500) } catch {}
  }
  await page.screenshot({ path: path.join(OUT_DIR, '05-documents-tab.png'), fullPage: true })

  // Step 4: Find folder tabs / subnav. We expect labels like Admin / Trash /
  // Incomplete / (default). Capture every tab-like element and its document
  // count if visible.
  step('discovering-folder-tabs')
  const tabCandidates = await page.evaluate(() => {
    const out = []
    const isVisible = (el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    for (const sel of ['a', 'button', 'li', 'span', 'div']) {
      for (const el of document.querySelectorAll(sel)) {
        const t = (el.textContent || '').trim()
        if (!t || t.length > 40) continue
        if (/^(Admin|Trash|Incomplete|All Documents|Documents|Working|Submitted|Complete)\b/i.test(t)) {
          if (isVisible(el)) {
            out.push({
              tag: el.tagName.toLowerCase(),
              text: t.slice(0, 60),
              classes: el.className,
              href: el.tagName === 'A' ? el.href : null,
              role: el.getAttribute('role'),
              boundingRect: el.getBoundingClientRect().toJSON(),
            })
          }
        }
      }
    }
    return out
  })
  step('folder-tab-candidates', { count: tabCandidates.length })
  console.log(`  Found ${tabCandidates.length} tab candidates:`)
  for (const t of tabCandidates.slice(0, 30)) {
    console.log(`    [${t.tag}] "${t.text}"  href=${t.href ? t.href.slice(0, 60) : ''}`)
  }

  // Save full DOM + visible text for offline analysis
  const docTabHtml = await page.content()
  await fs.writeFile(path.join(OUT_DIR, '05-documents-tab.html'), docTabHtml)
  const visibleText = await page.locator('body').innerText()
  await fs.writeFile(path.join(OUT_DIR, '05-documents-tab.txt'), visibleText)
  step('saved-dom-and-text')

  // Step 5: For each unique tab text, click and capture
  const uniqueTabs = []
  const seen = new Set()
  for (const t of tabCandidates) {
    const key = t.text.toLowerCase()
    if (!seen.has(key) && /^(admin|trash|incomplete|all documents|documents)$/i.test(t.text.trim().split(/[\s(]/)[0])) {
      seen.add(key); uniqueTabs.push(t)
    }
  }
  step('unique-folder-tabs-to-walk', { tabs: uniqueTabs.map((t) => t.text) })

  for (const tab of uniqueTabs) {
    const labelSafe = tab.text.replace(/[^a-z0-9]+/gi, '_').toLowerCase()
    step('clicking-tab', { label: tab.text })
    try {
      // Click by exact text and tag
      const target = page.locator(`${tab.tag}:has-text("${tab.text.split(' ')[0]}")`).first()
      await target.click({ timeout: 4000 })
      await page.waitForTimeout(2000)
    } catch (e) {
      step('click-failed', { label: tab.text, err: e.message })
      continue
    }
    const shot = path.join(OUT_DIR, `06-folder-${labelSafe}.png`)
    await page.screenshot({ path: shot, fullPage: true })
    const text = await page.locator('body').innerText()
    await fs.writeFile(path.join(OUT_DIR, `06-folder-${labelSafe}.txt`), text)

    // Try to extract filenames from the visible page (rows with .pdf etc)
    const visibleFiles = text.split('\n').map((l) => l.trim()).filter((l) => /\.(pdf|jpe?g|png|docx?|zip)$/i.test(l))
    report.folders.push({
      label: tab.text,
      docCount: visibleFiles.length,
      sampleFiles: visibleFiles.slice(0, 25),
      screenshot: shot,
    })
    step('captured-folder', { label: tab.text, docCount: visibleFiles.length, sample: visibleFiles.slice(0, 5) })
  }

  step('done')
} catch (e) {
  step('error', { msg: e.message, stack: e.stack?.split('\n').slice(0, 5).join(' | ') })
  console.error(e)
  try { await page.screenshot({ path: path.join(OUT_DIR, 'ERROR.png'), fullPage: true }) } catch {}
}

await fs.writeFile(path.join(OUT_DIR, 'probe-report.json'), JSON.stringify(report, null, 2))
console.log(`\nReport → ${path.join(OUT_DIR, 'probe-report.json')}`)
console.log(`Screenshots → ${OUT_DIR}/*.png`)

await page.waitForTimeout(2000)
await browser.close()
