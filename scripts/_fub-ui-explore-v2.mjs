#!/usr/bin/env node
/**
 * Multi-step FUB 2.0 UI explorer.
 *   Step 1: navigate to list 131
 *   Step 2: screenshot + dump
 *   Step 3: click "Filters" button
 *   Step 4: screenshot expanded panel + dump
 *   Step 5: click "Add filter" or similar
 *   Step 6: screenshot field picker + dump
 *
 * All outputs to tmp/fub-explore-v2/<step>-<ts>.{png,html,json}
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/fub-session.json'
const OUT_DIR = 'tmp/fub-explore-v2'

await fs.mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 1000 } })
const page = await context.newPage()

async function dump(stepName) {
  const ts = Date.now()
  const base = path.join(OUT_DIR, `${stepName}-${ts}`)
  await page.screenshot({ path: base + '.png', fullPage: false })
  const html = await page.content()
  await fs.writeFile(base + '.html', html)
  const affordances = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('button, [role="button"], input, select, [role="combobox"], [role="option"], [role="menuitem"]')) {
      const text = (el.textContent || '').trim().slice(0, 100)
      const aria = el.getAttribute('aria-label') || ''
      const ph = el.getAttribute('placeholder') || ''
      const role = el.getAttribute('role') || ''
      const tt = el.getAttribute('data-testid') || ''
      const cn = (el.getAttribute('class') || '').slice(0, 100)
      out.push({ tag: el.tagName.toLowerCase(), text, aria, ph, role, tt, cn })
    }
    return out.filter((a) => a.text || a.aria || a.ph || a.role || a.tt)
  })
  await fs.writeFile(base + '.json', JSON.stringify(affordances, null, 2))
  console.log(`[${stepName}] dumped to ${base}.{png,html,json} (${affordances.length} affordances)`)
  return { base, affordances }
}

try {
  // Step 1
  console.log('[step 1] navigating to list 131')
  await page.goto('https://ryan-realty.followupboss.com/2/people?smartListId=131', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  console.log('[step 1] url:', page.url())
  await dump('1-list-loaded')

  // Step 2: click Filters
  console.log('[step 2] clicking Filters button')
  try {
    await page.locator('button:has-text("Filters")').first().click({ timeout: 6000 })
    await page.waitForTimeout(2000)
    await dump('2-filters-clicked')
  } catch (e) {
    console.log('[step 2] click failed:', e.message)
    await dump('2-filters-click-failed')
  }

  // Step 3: try clicking "Add filter" / "+" / similar
  console.log('[step 3] looking for add-filter affordance')
  const addSelectors = [
    'button:has-text("Add filter")',
    'button:has-text("Add a filter")',
    'button:has-text("+ filter")',
    'button:has-text("New filter")',
    '[aria-label*="add filter" i]',
    'button:has(svg)+input',
  ]
  let added = false
  for (const sel of addSelectors) {
    try {
      const loc = page.locator(sel).first()
      if (await loc.count() > 0) {
        console.log('[step 3] trying selector:', sel)
        await loc.click({ timeout: 4000 })
        await page.waitForTimeout(1500)
        added = true
        break
      }
    } catch {}
  }
  if (added) await dump('3-add-filter-clicked')
  else {
    console.log('[step 3] no add-filter selector matched — just dumping current state')
    await dump('3-no-add-clicked')
  }

  console.log('\nDONE. Browser stays open 30s for visual inspection.')
  await page.waitForTimeout(30000)
} finally {
  await browser.close()
}
