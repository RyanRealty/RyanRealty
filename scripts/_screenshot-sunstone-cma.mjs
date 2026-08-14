#!/usr/bin/env node
/** Screenshot key pages of the Sunstone draft CMA. */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const HTML = resolve('out/cma-56628-sunstone/cma.html')
const OUT = resolve('out/cma-56628-sunstone/looks')
mkdirSync(OUT, { recursive: true })

const TARGETS = [
  { file: '00-cover.png', heading: /^$/ , index: 0 },
  { file: '07-comps.png', heading: /Comparable Closed Sales/ },
  { file: '12-market.png', heading: /The Caldera Springs market/ },
  { file: '14-use.png', heading: /What this property can do/ },
  { file: '15-pricing.png', heading: /How this home is priced/ },
]

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1100, height: 1500, deviceScaleFactor: 1 })
  await page.goto(`file://${HTML}`, { waitUntil: 'networkidle0', timeout: 60000 })
  await new Promise((r) => setTimeout(r, 1500))
  const pages = await page.$$('.page')
  console.log(`pages: ${pages.length}`)
  const headings = await page.$$eval('.page', (els) =>
    els.map((el, i) => ({
      i,
      h: el.querySelector('h2')?.textContent?.trim() ?? '',
      meta: el.querySelector('.pg-meta')?.textContent?.trim() ?? '',
    })),
  )
  for (const row of headings) console.log(`${String(row.i).padStart(2, '0')}  ${row.h}`)

  for (const t of TARGETS) {
    const hit =
      typeof t.index === 'number'
        ? headings[t.index]
        : headings.find((h) => t.heading.test(h.h))
    if (!hit) {
      console.warn(`miss: ${t.file}`)
      continue
    }
    const handle = pages[hit.i]
    if (!handle) continue
    const dest = resolve(OUT, t.file)
    await handle.screenshot({ path: dest })
    console.log(`✓ ${t.file} ← page ${hit.i} ${hit.h || hit.meta}`)
  }
} finally {
  await browser.close()
}
