#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_place_'
const CASES = [
  { id: 'awbrey', url: 'https://ryan-realty.com/cities/bend/awbrey-butte' },
  { id: 'nbhd_index', url: 'https://ryan-realty.com/neighborhoods', extra: 'awbrey-card' },
  { id: 'ridge', url: 'https://ryan-realty.com/subdivisions/ridge-at-eagle-crest' },
  { id: 'sub_index', url: 'https://ryan-realty.com/subdivisions', extra: 'ridge-card' },
  { id: 'housing', url: 'https://ryan-realty.com/housing-market', extra: 'source' },
  { id: 'nbhd_awbrey', url: 'https://ryan-realty.com/neighborhoods/awbrey-butte' },
  { id: 'river', url: 'https://ryan-realty.com/subdivisions/river-meadows', extra: 'peers' },
  { id: 'tetherow', url: 'https://ryan-realty.com/communities/tetherow', extra: 'sell' },
  { id: 'housing_co', url: 'https://ryan-realty.com/housing-market/central-oregon', extra: 'source' },
  { id: 'pronghorn', url: 'https://ryan-realty.com/communities/pronghorn', extra: 'sell' },
]

mkdirSync(ART, { recursive: true })

async function runViewport(browser, width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  const rows = {}
  for (const c of CASES) {
    const rec = { id: c.id, url: c.url }
    try {
      const res = await page.goto(c.url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      rec.status = res?.status() ?? null
      rec.finalUrl = page.url()
      await page.waitForTimeout(1600)
      rec.shot = `${ART}/${PREFIX}${c.id}_${width}_top.png`
      await page.screenshot({ path: rec.shot, fullPage: false })
      rec.metrics = await page.evaluate(() => {
        const body = document.body.innerText.replace(/\s+/g, ' ')
        return {
          heroCount: body.match(/(\d[\d,]*)\s+homes? for sale/i)?.[1] ?? null,
          awbreyActive: body.match(/Awbrey Butte[\s\S]{0,240}?(\d[\d,]*)\s+Active/i)?.[1] ?? null,
          ridgeActive: body.match(/Ridge At Eagle Crest[\s\S]{0,240}?(\d[\d,]*)\s+Active/i)?.[1] ?? null,
          ridgeMedian: body.match(/Ridge At Eagle Crest[\s\S]{0,280}?(\$[\d,]+)/i)?.[1] ?? null,
          regionalMedian: /Regional median/i.test(body),
          closedCte: /closed_cte|service_area_v1|ILIKE %Closed%/i.test(body),
          mlsCodes: [...body.matchAll(/\b(Oww|DrrhTrs|Drrh Trs|OWW2|Bbr|StoneTH|Crr 1)\b/g)].map((m) => m[1]),
          pendingOnCard: /Pending\s+\d|Under contract/i.test(body),
          closed30: body.match(/(\d+)\s+Closed · 30 days/i)?.[1] ?? null,
          medianToPending: body.match(/(\d+)\s+days\s+Median to pending/i)?.[1] ?? null,
          h1: document.querySelector('h1')?.textContent?.trim() ?? null,
        }
      })
      if (c.extra === 'awbrey-card' || c.extra === 'ridge-card') {
        const needle = c.extra === 'awbrey-card' ? /Awbrey Butte/i : /Ridge At Eagle Crest/i
        await page.evaluate((reSrc) => {
          const re = new RegExp(reSrc, 'i')
          const el = [...document.querySelectorAll('a, article')].find((n) => re.test(n.textContent ?? ''))
          el?.scrollIntoView({ block: 'center' })
        }, needle.source)
        await page.waitForTimeout(400)
        rec.shotCard = `${ART}/${PREFIX}${c.id}_${width}_card.png`
        await page.screenshot({ path: rec.shotCard, fullPage: false })
      }
      if (c.extra === 'peers' || c.extra === 'sell' || c.extra === 'source') {
        await page.evaluate((kind) => {
          const el =
            kind === 'peers'
              ? [...document.querySelectorAll('section, h2, a')].find((n) => /More areas/i.test(n.textContent ?? ''))
              : kind === 'sell'
                ? [...document.querySelectorAll('section, h2')].find((n) =>
                    /worth|Median to pending|Closed · 30/i.test(n.textContent ?? ''),
                  )
                : [...document.querySelectorAll('p, section')].find((n) =>
                    /Oregon Data Share|closed sales|composition/i.test(n.textContent ?? ''),
                  )
          el?.scrollIntoView({ block: 'center' })
        }, c.extra)
        await page.waitForTimeout(400)
        rec.shotExtra = `${ART}/${PREFIX}${c.id}_${width}_${c.extra}.png`
        await page.screenshot({ path: rec.shotExtra, fullPage: false })
      }
    } catch (err) {
      rec.error = err instanceof Error ? err.message : String(err)
    }
    rows[c.id] = rec
    console.log(JSON.stringify({ w: width, id: c.id, status: rec.status, finalUrl: rec.finalUrl, metrics: rec.metrics, error: rec.error }))
  }
  await page.close()
  return rows
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const out = { fetchedAt: new Date().toISOString(), viewports: {} }
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    out.viewports[String(w)] = await runViewport(browser, w, h)
  }
  await browser.close()
  writeFileSync(`${ART}/${PREFIX}place_pages_punch_shots.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/${PREFIX}place_pages_punch_shots.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
