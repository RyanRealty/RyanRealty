#!/usr/bin/env node
/**
 * Drive into the Closed Nordic Documents UI, expand the Trash folder,
 * capture what's inside, and for each doc shown, look at:
 *   - The Assigned column icon/tooltip
 *   - The doc's docKey (documentServiceKey)
 *   - Any inline expansion DOM nodes
 * Cross-reference with API checklist activities to find any actual
 * activity link.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/nordic-closed-trash-deep'
const TXN_ID_B64 = 'MjA1OTczMDA=' // 20597300
const SALE_GUID = 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d'
const DOCS_URL = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${TXN_ID_B64}&ListingID=MA==&checklistId=MA==`

await fs.mkdir(OUT_DIR, { recursive: true })

async function loadEnv() {
  const raw = await fs.readFile('.env.local', 'utf8').catch(() => '')
  for (const line of raw.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}
async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}
function apiHeaders(session) {
  return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
}

await loadEnv()
const session = await login()

// Build API view: every activity and what docs it links
const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}`, { headers: apiHeaders(session) })
const sale = (await fr.json()).value?.sale
const activities = sale?.checklist?.activities || []
const apiAssignments = new Map() // docId -> activities[]
for (const a of activities) {
  for (const cd of (a.checklistDocs || [])) {
    const docId = cd.id || cd.docId || cd.documentGuid
    if (!docId) continue
    if (!apiAssignments.has(docId)) apiAssignments.set(docId, [])
    apiAssignments.get(docId).push({ activityId: a.activityId, name: (a.activityName||'').trim(), status: a.status, typeName: a.typeName })
  }
}
console.log(`API: ${activities.length} activities, ${apiAssignments.size} docs with checklist links\n`)
if (apiAssignments.size > 0) {
  console.log('API assignments:')
  for (const [docId, acts] of apiAssignments) {
    console.log(`  ${docId.slice(0,8)} → ${acts.map((a) => `${a.name} (${a.status})`).join(', ')}`)
  }
}

const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/documents`, { headers: apiHeaders(session) })
const apiDocs = (await dr.json()).value?.documents || []
const keyToDoc = new Map()
for (const d of apiDocs) if (d.documentServiceKey) keyToDoc.set(d.documentServiceKey, d)

const browser = await chromium.launch({ headless: false, slowMo: 250 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

// Listen for popups in case clicking a folder opens new tab
const popupPromises = []
context.on('page', async (newPage) => {
  console.log(`>>> NEW PAGE: ${newPage.url()}`)
  popupPromises.push(newPage)
})

await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await page.screenshot({ path: path.join(OUT_DIR, '01-main.png'), fullPage: true })

// Try multiple click strategies on the Trash folder
console.log('\n=== Trying to expand/enter Trash folder ===')

// Strategy 1: click the + icon (a element with fa-plus inside) next to "Trash" label
const strategies = [
  {
    name: 'click + plus icon next to Trash',
    fn: async () => {
      const ok = await page.evaluate(() => {
        for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
          const lbl = tr.querySelector('span[id*="lblName"]')
          if (!lbl || (lbl.textContent || '').trim() !== 'Trash') continue
          const plusIcon = tr.querySelector('.fa-plus, .fa-plus-square, [class*="plus"]')
          if (plusIcon) {
            // Try clicking the parent anchor or the icon itself
            const target = plusIcon.closest('a') || plusIcon
            const r = target.getBoundingClientRect()
            return { found: true, x: r.x + r.width/2, y: r.y + r.height/2, html: target.outerHTML.slice(0, 300) }
          }
          return { found: false, reason: 'no plus icon' }
        }
        return { found: false, reason: 'no trash row' }
      })
      console.log(`  ${JSON.stringify(ok)}`)
      if (ok.found) {
        await page.mouse.click(ok.x, ok.y)
        await page.waitForTimeout(2500)
        return true
      }
      return false
    },
  },
  {
    name: 'click Trash text directly',
    fn: async () => {
      try {
        await page.locator('#ContentPlaceHolder1_GVListingCheckList span').filter({ hasText: /^Trash$/ }).first().click({ force: true, timeout: 4000 })
        await page.waitForTimeout(2500)
        return true
      } catch (e) {
        console.log(`  click failed: ${e.message.slice(0, 100)}`)
        return false
      }
    },
  },
  {
    name: 'click Trash folder row anchor',
    fn: async () => {
      try {
        await page.locator('#ContentPlaceHolder1_GVListingCheckList a[onclick*="VHJhc2g="]').first().click({ force: true, timeout: 4000 })
        await page.waitForTimeout(2500)
        return true
      } catch (e) {
        console.log(`  click failed: ${e.message.slice(0, 100)}`)
        return false
      }
    },
  },
]

for (const s of strategies) {
  console.log(`Strategy: ${s.name}`)
  await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const ok = await s.fn()
  if (!ok) continue
  const safeName = s.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()
  await page.screenshot({ path: path.join(OUT_DIR, `strategy-${safeName}.png`), fullPage: true })
  const url = page.url()
  const popups = popupPromises.length
  console.log(`  url after: ${url}  popups: ${popups}`)

  // If a popup opened, screenshot it
  if (popups > 0) {
    for (let i = 0; i < popupPromises.length; i++) {
      const p = popupPromises[i]
      try {
        await p.waitForLoadState('domcontentloaded', { timeout: 8000 })
        await p.waitForTimeout(2000)
        await p.screenshot({ path: path.join(OUT_DIR, `strategy-${safeName}-popup-${i}.png`), fullPage: true })
        console.log(`  popup ${i} url: ${p.url()}`)
      } catch (e) {
        console.log(`  popup ${i} screenshot failed: ${e.message.slice(0, 100)}`)
      }
    }
    popupPromises.length = 0
    break // success — stop trying other strategies
  }

  // Also check if new rows appeared in DOM (inline expansion)
  const newRows = await page.evaluate(() => {
    const tracker = []
    for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
      const lbl = tr.querySelector('span[id*="lblName"]')
      if (!lbl) continue
      const text = (lbl.textContent || '').trim()
      const anchor = tr.querySelector('a[onclick*="opendoc"]')
      let docKey = null
      if (anchor) {
        const m = (anchor.getAttribute('onclick') || '').match(/opendoc\('DocumentView\.aspx\?k=([a-f0-9]+)/)
        if (m) docKey = m[1]
      }
      const assignedCellHtml = tr.querySelector('td:nth-child(2), td:nth-child(3)')?.innerHTML.slice(0, 200) || ''
      tracker.push({ text, docKey, assignedHtml: assignedCellHtml })
    }
    return tracker
  })
  console.log(`  Total visible rows now: ${newRows.length}`)
}

console.log(`\n=== Examine "Assigned" column visual indicators ===`)
await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
const assignedCol = await page.evaluate(() => {
  const out = []
  for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
    const lbl = tr.querySelector('span[id*="lblName"]')
    if (!lbl) continue
    const text = (lbl.textContent || '').trim()
    if (!text || /^(Admin|Trash|Incomplete|Archive)$/i.test(text)) continue
    // The Assigned column is typically the 2nd or 3rd cell after the checkbox/icon
    const cells = tr.querySelectorAll('td')
    const cellInfo = []
    for (let i = 0; i < Math.min(cells.length, 5); i++) {
      const c = cells[i]
      cellInfo.push({ idx: i, text: (c.textContent || '').trim().slice(0, 30), classes: c.className.slice(0, 50), hasIcon: !!c.querySelector('i, .fa') })
    }
    out.push({ text: text.slice(0, 60), cells: cellInfo })
  }
  return out
})
for (const r of assignedCol.slice(0, 8)) {
  console.log(`  "${r.text}"`)
  for (const c of r.cells) console.log(`    [${c.idx}] "${c.text}" classes="${c.classes}" hasIcon=${c.hasIcon}`)
}

await page.waitForTimeout(2000)
await browser.close()
