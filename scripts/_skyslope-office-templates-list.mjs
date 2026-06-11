#!/usr/bin/env node
/**
 * List ALL templates currently in Ryan Realty LLC office (28920),
 * Transaction type. Diagnostic only.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

await page.goto('https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=28920&Type=MQ==', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const rows = await page.evaluate(() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('table tr')]
  return rows.map((r) => {
    const cells = [...(r.cells || [])].map((c) => norm(c.innerText || ''))
    const links = [...r.querySelectorAll('a[href]')].map((a) => ({
      text: norm(a.innerText),
      href: (a.getAttribute('href') || '').slice(0, 200),
    }))
    return { cells, links }
  })
})

// Probe how rows encode the template id (onclick, data-*, etc.)
const rawRows = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tr')]
  return rows.slice(15, 19).map((r) => ({
    cellsText: [...(r.cells || [])].map((c) => c.innerText.trim()),
    onclick: r.getAttribute('onclick') || '',
    onclick2: r.cells?.[1]?.getAttribute('onclick') || '',
    cellHtml: r.cells?.[1]?.innerHTML.slice(0, 400) || '',
    allAttrs: r.attributes ? [...r.attributes].map((a) => `${a.name}=${a.value.slice(0, 50)}`) : [],
    linkHrefs: [...r.querySelectorAll('a')].map((a) => `[${a.innerText.trim().slice(0, 20)}] ${a.getAttribute('href')?.slice(0, 150)}`),
    linkOnclicks: [...r.querySelectorAll('a')].map((a) => `[${a.innerText.trim().slice(0, 20)}] ${a.getAttribute('onclick')?.slice(0, 150)}`),
  }))
})
for (const r of rawRows) {
  console.log(`\n--- Row ${JSON.stringify(r.cellsText.slice(1, 2))} ---`)
  console.log(`  onclick (row): ${r.onclick}`)
  console.log(`  onclick (cell): ${r.onclick2}`)
  console.log(`  attrs: ${JSON.stringify(r.allAttrs)}`)
  console.log(`  link hrefs:`)
  for (const h of r.linkHrefs) console.log(`    ${h}`)
  console.log(`  link onclicks:`)
  for (const h of r.linkOnclicks) console.log(`    ${h}`)
  console.log(`  cell HTML: ${r.cellHtml.slice(0, 200)}`)
}

let i = 0
for (const r of rows) {
  if (!r.cells.length) continue
  let id = null
  for (const l of r.links) {
    const m = l.href.match(/PropertyTypeId=([A-Za-z0-9+/=]+)/)
    if (m) { try { id = atob(decodeURIComponent(m[1])) } catch {}; if (id) break }
  }
  console.log(`row=${i++} id=${(id ?? '?').toString().padStart(10)}  cells=${JSON.stringify(r.cells)}`)
}

await fs.mkdir('tmp/office-templates-list', { recursive: true })
await page.screenshot({ path: 'tmp/office-templates-list/ryan-realty-templates.png', fullPage: true })
await browser.close()
