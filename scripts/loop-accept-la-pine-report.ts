/**
 * Accept fleet 75370225805bb52d38b151ced2dab5c1 after production READY.
 *
 * Re-queries market_pulse_live, fetches hyphenated city reports with a
 * browser UA, asserts they are not the Next 404 fallback, and writes
 * 1280 + 390 screenshots to /opt/cursor/artifacts.
 *
 *   npx tsx scripts/loop-accept-la-pine-report.ts
 */
import { mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { chromium } from 'playwright'
import { formatPrice } from '../lib/format/money'
import { canonicalCityCacheSlug, cityUrlSlug } from '../lib/market/city-cache-slug'

config({ path: '.env.local' })

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const CITIES = ['La Pine', 'Powell Butte', 'Black Butte Ranch', 'Camp Sherman'] as const
const ARTIFACTS = '/opt/cursor/artifacts'

type PulseRow = {
  geo_slug: string
  geo_label: string | null
  active_count: number | null
  median_list_price: number | null
  median_days_to_pending: number | null
  methodology_version: string | null
  updated_at: string | null
}

async function fetchPage(path: string) {
  const res = await fetch(`https://ryan-realty.com${path}`, {
    redirect: 'follow',
    headers: { 'user-agent': UA, accept: 'text/html' },
  })
  const html = await res.text()
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
  return {
    path,
    status: res.status,
    fallback404: /NEXT_HTTP_ERROR_FALLBACK;404|This page could not be found/i.test(html),
    title: (html.match(/<title>([^<]+)<\/title>/i) ?? [])[1] ?? null,
    text,
  }
}

function fail(msg: string): never {
  console.error(`ACCEPT FAIL: ${msg}`)
  process.exit(1)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const slugs = CITIES.flatMap((label) => [canonicalCityCacheSlug(label), cityUrlSlug(label)])
  const { data, error } = await sb
    .from('market_pulse_live')
    .select(
      'geo_type,geo_slug,geo_label,property_type,active_count,median_list_price,median_days_to_pending,updated_at,methodology_version',
    )
    .eq('geo_type', 'city')
    .eq('property_type', 'A')
    .in('geo_slug', slugs)
  if (error) throw new Error(error.message)

  const pulseBySlug = Object.fromEntries((data ?? []).map((r) => [r.geo_slug, r as PulseRow]))
  const traces: Record<string, unknown> = {}
  const pageResults: Record<string, unknown> = {}

  for (const label of CITIES) {
    const cacheSlug = canonicalCityCacheSlug(label)
    const urlSlug = cityUrlSlug(label)
    const pulse = pulseBySlug[cacheSlug]
    if (!pulse) fail(`no pulse row for ${cacheSlug}`)
    const active = Math.round(Number(pulse.active_count ?? 0))
    const price = formatPrice(Number(pulse.median_list_price))
    const days = pulse.median_days_to_pending
    traces[cacheSlug] = {
      source: 'market_pulse_live',
      filter: `geo_type=city property_type=A geo_slug='${cacheSlug}'`,
      methodology: pulse.methodology_version,
      updated_at: pulse.updated_at,
      active_count: active,
      median_list_price: pulse.median_list_price,
      displayed_price: price,
      median_days_to_pending: days,
      hyphen_row_present: Boolean(pulseBySlug[urlSlug]),
    }

    const report = await fetchPage(`/housing-market/${urlSlug}`)
    if (report.status !== 200) fail(`${report.path} status ${report.status}`)
    if (report.fallback404) fail(`${report.path} still NEXT_HTTP_ERROR_FALLBACK;404`)
    if (!new RegExp(label, 'i').test(report.text)) fail(`${report.path} missing label ${label}`)
    if (active > 0 && !report.text.includes(String(active))) {
      fail(`${report.path} missing live active_count ${active}`)
    }
    if (price !== '—' && !report.text.includes(price)) {
      fail(`${report.path} missing live median ${price}`)
    }
    pageResults[report.path] = {
      status: report.status,
      fallback404: report.fallback404,
      title: report.title,
      hasLabel: true,
      hasActive: active > 0,
      hasPrice: price !== '—',
    }
  }

  const browse = await fetchPage('/homes-for-sale/la-pine')
  if (browse.status !== 200) fail(`${browse.path} status ${browse.status}`)
  if (browse.fallback404) fail(`${browse.path} 404 fallback`)
  const laPine = pulseBySlug[canonicalCityCacheSlug('La Pine')]
  const laPineActive = Math.round(Number(laPine?.active_count ?? 0))
  const laPinePrice = formatPrice(Number(laPine?.median_list_price))
  const emptyWidget =
    /Active single-family homes/i.test(browse.text) &&
    /—/.test(browse.text) &&
    !browse.text.includes(String(laPineActive))
  if (emptyWidget) fail('/homes-for-sale/la-pine SFR widget still empty em-dashes')
  if (laPineActive > 0 && !browse.text.includes(String(laPineActive))) {
    fail(`/homes-for-sale/la-pine missing live active_count ${laPineActive}`)
  }
  if (laPinePrice !== '—' && !browse.text.includes(laPinePrice)) {
    fail(`/homes-for-sale/la-pine missing live median ${laPinePrice}`)
  }
  pageResults[browse.path] = {
    status: browse.status,
    fallback404: browse.fallback404,
    title: browse.title,
    hasActive: true,
    hasPrice: true,
  }

  mkdirSync(ARTIFACTS, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const shots: string[] = []
  const shotPairs: Array<{ name: string; path: string }> = [
    { name: 'la_pine_report', path: '/housing-market/la-pine' },
    { name: 'powell_butte_report', path: '/housing-market/powell-butte' },
    { name: 'black_butte_ranch_report', path: '/housing-market/black-butte-ranch' },
    { name: 'camp_sherman_report', path: '/housing-market/camp-sherman' },
    { name: 'la_pine_homes', path: '/homes-for-sale/la-pine' },
  ]
  try {
    for (const pair of shotPairs) {
      for (const [width, height, suffix] of [
        [1280, 900, '1280'],
        [390, 844, '390'],
      ] as const) {
        const context = await browser.newContext({
          viewport: { width, height },
          userAgent: UA,
        })
        const page = await context.newPage()
        await page.goto(`https://ryan-realty.com${pair.path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        })
        await page.waitForTimeout(2500)
        const body = await page.locator('body').innerText()
        if (/This page could not be found/i.test(body)) {
          await context.close()
          fail(`screenshot ${pair.path} @${width} still 404`)
        }
        const dest = `${ARTIFACTS}/${pair.name}_${suffix}.png`
        await page.screenshot({ path: dest, fullPage: false })
        shots.push(dest)
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        traces,
        production: pageResults,
        screenshots: shots,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
