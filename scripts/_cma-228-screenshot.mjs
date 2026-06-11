#!/usr/bin/env node
/** Capture cover page screenshot of the 228 SE Soft Tail CMA */
import puppeteer from 'puppeteer-core'
import { promises as fs } from 'node:fs'
import { resolve, dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
loadEnv({ path: join(REPO_ROOT, '.env.local') })

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const HTML_PATH = resolve(REPO_ROOT, 'public/drafts/cma-228-soft-tail/cma.html')
const OUT = resolve(REPO_ROOT, 'out/cma-228-soft-tail/preview-cover.png')

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 1700, deviceScaleFactor: 1 })
  await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle0', timeout: 30000 })
  // wait extra for fonts + images
  await new Promise(r => setTimeout(r, 2000))
  // screenshot just the first page
  const firstPage = await page.$('.page')
  await firstPage.screenshot({ path: OUT })
  console.log(`✓ Screenshot saved: ${OUT}`)
} finally {
  await browser.close()
}
