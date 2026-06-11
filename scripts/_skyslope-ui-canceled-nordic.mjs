#!/usr/bin/env node
/**
 * Focused inspection: navigate directly into both Canceled Nordic
 * transactions via their TransactionChecklist URLs, find the Documents
 * tab/subview, capture the folder structure (Admin / Trash / Incomplete /
 * Default) and the visible documents per folder.
 *
 * Two Canceled/App Nordic transactions discovered via DocumentsWaiting:
 *   - TransactionID=MjAxNzY4MTM=  (integer 20176813)
 *   - TransactionID=MjAxNzY4NTM=  (integer 20176853)
 * Mapping to API GUIDs (6be4810f Canceled-A vs 0ec95d31 Canceled-B) is
 * unknown — script visits both and captures with the integer in the name.
 *
 * Output: tmp/skyslope-ui-canceled-nordic/<txnId>/{step}-{tab}.{png,txt,html}
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_ROOT = 'tmp/skyslope-ui-canceled-nordic'
const TRANSACTIONS = [
  { txnId: '20176813', listingId: '0' },
  { txnId: '20176853', listingId: '0' },
]

const haveState = await fs.stat(STATE_PATH).then(() => true).catch(() => false)
if (!haveState) {
  console.error(`No saved session at ${STATE_PATH}. Run _skyslope-login-capture.mjs first.`)
  process.exit(1)
}

await fs.mkdir(OUT_ROOT, { recursive: true })

const browser = await chromium.launch({ headless: false, slowMo: 250 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

function b64(s) { return Buffer.from(String(s)).toString('base64') }

const finalReport = { generatedAt: new Date().toISOString(), transactions: [] }

try {
  for (const t of TRANSACTIONS) {
    const txnId = t.txnId
    const dir = path.join(OUT_ROOT, txnId)
    await fs.mkdir(dir, { recursive: true })
    const txnReport = { txnId, steps: [], folders: [], headerText: null }
    function log(name, data = {}) {
      const e = { ts: new Date().toISOString().slice(11, 19), name, ...data }
      txnReport.steps.push(e)
      console.log(`[${txnId} ${e.ts}] ${name}` + (Object.keys(data).length ? ' ' + JSON.stringify(data).slice(0, 200) : ''))
    }

    const url = `https://app.skyslope.com/TransactionChecklist.aspx?TransactionID=${b64(txnId)}&ListingID=${b64(t.listingId)}`
    log('navigate', { url })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    if (/LoginIntegrated\.aspx/i.test(page.url())) {
      log('session-expired')
      console.error('Session expired. Delete tmp/skyslope-session.json and rerun login capture.')
      process.exit(2)
    }
    await page.screenshot({ path: path.join(dir, '01-checklist-landing.png'), fullPage: true })

    // Capture header / title text (address, status, ID)
    const heading = await page.locator('h1, h2, .page-title, .file-title, [class*="title"]').first().innerText().catch(() => '')
    txnReport.headerText = heading.slice(0, 200)
    log('heading', { heading: heading.slice(0, 80) })

    // Find the Documents subnav. From the prior probe + UI layout, the
    // tabs are typically: Checklist | Documents | Contacts | etc. Click
    // "Documents" within this transaction's left-side or top tab strip.
    const possibleDocsLinks = await page.locator('a:has-text("Documents"), li:has-text("Documents") a, .nav-link:has-text("Documents")').all()
    log('docs-link-candidates', { count: possibleDocsLinks.length })
    let clickedDocs = false
    for (const lnk of possibleDocsLinks) {
      const href = await lnk.getAttribute('href').catch(() => '')
      const text = (await lnk.innerText().catch(() => '')).trim()
      // Skip the global "DOCUMENTS TO REVIEW" / "WORKING DOCUMENTS"
      if (/DOCUMENTS TO REVIEW|WORKING DOCUMENTS/i.test(text)) continue
      // Look for ViewDocuments.aspx or per-transaction documents URL
      if (href && (/ViewDocuments|TransactionDocuments|Documents\.aspx/i.test(href) || /TransactionID/.test(href))) {
        log('click-docs-link', { href, text })
        try {
          await Promise.all([
            page.waitForLoadState('domcontentloaded', { timeout: 8000 }),
            lnk.click({ timeout: 5000 }),
          ])
          clickedDocs = true
          break
        } catch (e) { log('click-failed', { err: e.message }) }
      }
    }
    if (!clickedDocs) {
      // Try clicking by text only
      const byText = page.locator('a:text-is("Documents"), button:text-is("Documents")').first()
      if (await byText.count()) {
        try {
          await byText.click({ timeout: 5000 })
          clickedDocs = true
          log('clicked-docs-by-text')
        } catch (e) { log('text-click-failed', { err: e.message }) }
      }
    }
    await page.waitForTimeout(2500)
    await page.screenshot({ path: path.join(dir, '02-documents-tab.png'), fullPage: true })
    const docsHtml = await page.content()
    await fs.writeFile(path.join(dir, '02-documents-tab.html'), docsHtml)
    log('docs-tab-url', { url: page.url() })

    // Now find folder tabs/buttons within the Documents view. Look for the
    // labels Matt sees: Admin, Trash, Incomplete, plus probably a default.
    const folderCandidates = await page.evaluate(() => {
      const seen = []
      const isVisible = (el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }
      const re = /^(Admin|Trash|Incomplete|All Documents|All|Default|Working|Submitted|Documents)$/i
      for (const el of document.querySelectorAll('a, button, li, span, div, [role="tab"]')) {
        const t = (el.textContent || '').trim()
        if (!t) continue
        // Match the bare label or label with count suffix like "Admin (3)"
        const first = t.split(/\s*\(/)[0].trim()
        if (re.test(first) && isVisible(el)) {
          const r = el.getBoundingClientRect()
          seen.push({
            tag: el.tagName.toLowerCase(),
            text: t.slice(0, 60),
            classes: el.className.slice(0, 80),
            href: el.tagName === 'A' ? el.href : null,
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            role: el.getAttribute('role'),
          })
        }
      }
      return seen
    })
    log('folder-candidates', { count: folderCandidates.length })
    for (const c of folderCandidates) console.log(`  [${c.tag}] "${c.text}" rect=${c.rect.x},${c.rect.y} ${c.rect.w}x${c.rect.h} role=${c.role}`)

    // Dedupe by text; keep the smallest visible (most likely the tab/link itself)
    const byText = new Map()
    for (const c of folderCandidates) {
      const key = c.text.toLowerCase()
      if (!byText.has(key)) byText.set(key, c)
    }
    const tabs = [...byText.values()].filter((c) => /^(admin|trash|incomplete|all|default|working|documents)$/i.test(c.text.split(/\s*\(/)[0].trim()))
    log('unique-tabs', { tabs: tabs.map((t) => t.text) })

    for (const tab of tabs) {
      const safe = tab.text.replace(/[^a-z0-9]+/gi, '_').toLowerCase()
      log('click-tab', { label: tab.text })
      let ok = true
      try {
        const sel = `${tab.tag}:has-text("${tab.text.split(/\s*\(/)[0]}")`
        const elt = page.locator(sel).first()
        await elt.click({ timeout: 5000 })
        await page.waitForTimeout(2500)
      } catch (e) {
        log('tab-click-failed', { err: e.message })
        ok = false
      }
      const shot = path.join(dir, `03-folder-${safe}.png`)
      await page.screenshot({ path: shot, fullPage: true })
      const txt = await page.locator('body').innerText().catch(() => '')
      await fs.writeFile(path.join(dir, `03-folder-${safe}.txt`), txt)
      const files = txt.split('\n').map((l) => l.trim()).filter((l) => /\.(pdf|jpe?g|png|docx?|zip)$/i.test(l) || /^ARCHIVE/i.test(l))
      txnReport.folders.push({
        label: tab.text,
        clickedOk: ok,
        screenshot: shot,
        visibleFiles: files.slice(0, 40),
        visibleFileCount: files.length,
      })
      log('folder-captured', { label: tab.text, files: files.length, sample: files.slice(0, 3) })
    }

    finalReport.transactions.push(txnReport)
  }
} catch (e) {
  console.error('FATAL', e)
} finally {
  await fs.writeFile(path.join(OUT_ROOT, 'final-report.json'), JSON.stringify(finalReport, null, 2))
  console.log(`\nFinal report → ${path.join(OUT_ROOT, 'final-report.json')}`)
  console.log(`Per-transaction artifacts → ${OUT_ROOT}/<txnId>/`)
  await page.waitForTimeout(1500)
  await browser.close()
}
