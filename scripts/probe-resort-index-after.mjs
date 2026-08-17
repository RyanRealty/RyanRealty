#!/usr/bin/env node
/**
 * After-READY accept: homepage, /communities, /communities/tetherow
 * must share the alias-aware Tetherow pair (35 / $1,499,000).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'after_v6_'
mkdirSync(ART, { recursive: true })

const PAGES = [
  { id: 'home', url: 'https://ryan-realty.com/', find: 'tetherow' },
  { id: 'communities', url: 'https://ryan-realty.com/communities', find: 'tetherow' },
  { id: 'tetherow', url: 'https://ryan-realty.com/communities/tetherow', find: null },
]

function bits(text) {
  const tetherowHits = (text.match(/Tetherow[^.]{0,160}/gi) ?? []).map((s) => s.replace(/\s+/g, ' ').trim()).slice(0, 8)
  return {
    count35: /\b35\b/.test(text),
    count12: /Tetherow[^.]{0,80}\b12\b/.test(text),
    count19: /Tetherow[^.]{0,80}\b19\b/.test(text),
    median1499: /\$1,499,000/.test(text),
    median225: /\$2,250,000/.test(text),
    heroCount: text.match(/(\d+)\s+homes? for sale/i)?.[1] ?? null,
    tetherowHits,
  }
}

async function dismissLead(page) {
  const btn = page.getByRole('button', { name: /close|dismiss|not now|no thanks/i }).first()
  if (await btn.count()) {
    await btn.click({ timeout: 1500 }).catch(() => {})
  }
  await page.keyboard.press('Escape').catch(() => {})
}

async function runViewport(browser, width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  const rows = {}
  for (const c of PAGES) {
    const rec = { id: c.id, url: c.url, width }
    try {
      const res = await page.goto(c.url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      rec.status = res?.status() ?? null
      rec.cache = res?.headers()?.['x-vercel-cache'] ?? null
      await page.waitForTimeout(2000)
      await dismissLead(page)
      if (c.find) {
        await page.evaluate((needle) => {
          const el = [...document.querySelectorAll('a, article, li, div, h3')].find((n) =>
            new RegExp(needle, 'i').test(n.textContent ?? ''),
          )
          el?.scrollIntoView({ block: 'center' })
        }, c.find)
        await page.waitForTimeout(400)
      }
      rec.text = (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 1600)
      rec.bits = bits(rec.text)
      rec.shot = `${ART}/${PREFIX}${c.id}_${width}.png`
      await page.screenshot({ path: rec.shot, fullPage: false })
    } catch (err) {
      rec.error = err instanceof Error ? err.message : String(err)
    }
    rows[c.id] = rec
    console.log(JSON.stringify({ w: width, id: c.id, status: rec.status, cache: rec.cache, bits: rec.bits, error: rec.error }))
  }
  await page.close()
  return rows
}

const browser = await chromium.launch({ headless: true })
const out = { fetchedAt: new Date().toISOString(), sha: '875eef447', viewports: {} }
for (const [w, h] of [
  [390, 844],
  [1280, 800],
]) {
  out.viewports[String(w)] = await runViewport(browser, w, h)
}
await browser.close()
writeFileSync(`${ART}/${PREFIX}resort_index_accept.json`, JSON.stringify(out, null, 2))
console.log('wrote', `${ART}/${PREFIX}resort_index_accept.json`)
