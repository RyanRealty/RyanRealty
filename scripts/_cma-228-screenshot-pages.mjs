#!/usr/bin/env node
/** Capture screenshots of all 17 CMA pages for visual review. */
import puppeteer from 'puppeteer-core'
import { promises as fs, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
loadEnv({ path: join(REPO_ROOT, '.env.local') })

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const HTML_PATH = resolve(REPO_ROOT, 'public/drafts/cma-228-soft-tail/cma.html')
const OUT_DIR = resolve(REPO_ROOT, 'out/cma-228-soft-tail/previews')
mkdirSync(OUT_DIR, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1024, height: 1320, deviceScaleFactor: 1 })
  await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2500))

  const sections = await page.$$('.page')
  console.log(`Found ${sections.length} pages, capturing each...`)
  for (let i = 0; i < sections.length; i++) {
    const out = resolve(OUT_DIR, `page-${String(i + 1).padStart(2, '0')}.png`)
    await sections[i].screenshot({ path: out })
    console.log(`  page ${i + 1}: ${out}`)
  }
} finally {
  await browser.close()
}
