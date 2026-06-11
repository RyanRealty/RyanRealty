#!/usr/bin/env node
/**
 * Search ManageTransactions.aspx for ALL rows containing "Nordic" and
 * dump every related link/data attribute to find the Closed Nordic
 * integer transaction ID.
 */
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'

const browser = await chromium.launch({ headless: false, slowMo: 100 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

await page.goto('https://app.skyslope.com/ManageTransactions.aspx', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const hits = await page.evaluate(() => {
  const results = []
  for (const tr of document.querySelectorAll('tr')) {
    const text = (tr.textContent || '').slice(0, 800)
    if (!/Nordic/i.test(text)) continue
    const dataUrl = tr.getAttribute('data-url')
    const allAnchors = [...tr.querySelectorAll('a')].map((a) => ({
      href: a.href,
      onclick: a.getAttribute('onclick'),
      text: (a.textContent || '').trim().slice(0, 30),
    }))
    const onclick = tr.getAttribute('onclick')
    const innerHtml = tr.outerHTML.slice(0, 2500)
    results.push({
      id: tr.id || null,
      class: tr.className.slice(0, 60),
      dataUrl,
      onclick,
      anchors: allAnchors,
      innerHtml,
      sample: text.replace(/\s+/g, ' ').slice(0, 250),
    })
  }
  return results
})
console.log(`Found ${hits.length} rows mentioning Nordic:`)
for (const h of hits) {
  console.log(`\n  id=${h.id}  class=${h.class}`)
  console.log(`  dataUrl: ${h.dataUrl}`)
  console.log(`  onclick: ${h.onclick}`)
  console.log(`  anchors:`)
  for (const a of h.anchors) console.log(`    "${a.text}" href=${(a.href||'').slice(0,80)} onclick=${(a.onclick||'').slice(0,80)}`)
  console.log(`  sample: ${h.sample.slice(0, 150)}`)
  console.log(`  --- HTML ---`)
  console.log(h.innerHtml.slice(0, 1200))
}

function tryDecode(b64Param) { try { return atob(decodeURIComponent(b64Param)) } catch { return null } }
const decoded = new Set()
for (const h of hits) {
  const urls = [h.dataUrl, ...h.anchors.map((a) => a.href)].filter(Boolean)
  for (const u of urls) {
    const m = u.match(/TransactionID=([A-Za-z0-9%=]+)/)
    if (m) {
      const integer = tryDecode(m[1])
      if (integer) decoded.add(integer)
    }
  }
}
console.log(`\nDecoded integers: ${[...decoded].join(', ')}`)

await page.waitForTimeout(1000)
await browser.close()
