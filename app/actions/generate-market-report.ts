'use server'

import { createClient } from '@supabase/supabase-js'
import { cityEntityKey } from '../../lib/slug'
import { getMarketReportData, type MarketReportByCity } from './market-reports'
import {
  getMarketReportData as getVerifiedCityBlocks,
  type MarketReportAreaBlock,
} from '@/lib/data/crm/getMarketReportData'
import {
  verdictLabel,
  meaningLine,
  formatCurrencyRounded,
  formatYoy,
  formatMonths,
  formatDays,
} from '@/lib/crm/market-report-email'
import { sendMarketStatAlertEmail } from '@/lib/market-stat-alert'

const BUCKET = 'banners'
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

/**
 * City slugs the CRM report engine serves verified verdict blocks for
 * (lib/data/crm/getMarketReportData CITY_SLUGS — the §0-traced cache path).
 */
const VERDICT_CITY_SLUGS = ['bend', 'redmond', 'sisters', 'sunriver', 'tumalo', 'la-pine', 'terrebonne']

/**
 * Cities with a live /housing-market/<slug> report page (the catch-all's
 * generateStaticParams set). City headings link here — the report-framed
 * surface — never to the buyer search (conversion-audit 2026-07-15 #13).
 * Cities outside this set keep the /search link (a /housing-market URL for a
 * city with no pulse row 404s).
 */
const HOUSING_MARKET_PAGES = new Set([
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'la-pine',
  'tumalo',
  'prineville',
  'terrebonne',
  'black-butte-ranch',
  'eagle-crest',
  'crooked-river-ranch',
])

/** Last week: Sunday 00:00 through Saturday 23:59 (UTC). Returns { start, end } as Date. */
function getLastWeekRange(): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getUTCDay()
  const lastSaturday = new Date(now)
  lastSaturday.setUTCDate(now.getUTCDate() - day - 1)
  const lastSunday = new Date(lastSaturday)
  lastSunday.setUTCDate(lastSaturday.getUTCDate() - 6)
  lastSunday.setUTCHours(0, 0, 0, 0)
  lastSaturday.setUTCHours(23, 59, 59, 999)
  return { start: lastSunday, end: lastSaturday }
}

function formatDate(d: Date): string {
  // Pin to UTC: the report window is computed in UTC, and a local-timezone
  // format shifts the start date back a day on any non-UTC runtime (a PDT
  // machine titled the Jul 5..11 report "July 4 to July 11" — §0 date drift).
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })
}

/**
 * One verdict sentence per city from the verified block (conversion-audit #13:
 * the report body was a raw closed-price dump with no narrative). Reuses the
 * email renderer's pure formatters + meaningLine so the weekly report and the
 * subscription email can never tell two different stories about one market.
 * Built only from fields the cache actually carries — a null field is omitted,
 * never filled in.
 */
function verdictHtml(block: MarketReportAreaBlock): string {
  const parts: string[] = []
  const verdict = verdictLabel(block.marketVerdict)
  if (block.marketVerdict != null && block.monthsOfSupply != null) {
    parts.push(`${verdict} with ${formatMonths(block.monthsOfSupply)} of supply.`)
  }
  if (block.medianPrice != null) {
    const yoy = block.yoyPct != null ? ` (${formatYoy(block.yoyPct)})` : ''
    parts.push(`Median sale price ${formatCurrencyRounded(block.medianPrice)} over the trailing 12 months${yoy}.`)
  }
  if (block.domMedian != null) {
    parts.push(`Median ${formatDays(block.domMedian)} on market.`)
  }
  const meaning = meaningLine(block.marketVerdict)
  if (parts.length === 0 && !meaning) return ''
  return `
        <p class="report-verdict mt-2 text-sm font-medium text-foreground">${escapeHtml(parts.join(' '))}</p>
        ${meaning ? `<p class="report-meaning mt-1 text-sm text-muted-foreground">${escapeHtml(meaning)}</p>` : ''}
  `
}

function buildReportHtml(
  data: MarketReportByCity[],
  blocksBySlug: Map<string, MarketReportAreaBlock>,
  periodStart: Date,
  periodEnd: Date,
): string {
  const startStr = formatDate(periodStart)
  const endStr = formatDate(periodEnd)
  let html = `
    <div class="market-report">
      <p class="report-dates text-muted-foreground text-sm">${startStr} to ${endStr}</p>
      <p class="report-intro text-muted-foreground mt-2">Here’s what happened in the Central Oregon real estate market last week, by city.</p>
  `
  for (const { city, pending, closed } of data) {
    const totalPending = pending.length
    const totalClosed = closed.length
    if (totalPending === 0 && totalClosed === 0) continue
    const citySlug = cityEntityKey(city)
    // Report-framed destination: the city's market page when it exists,
    // the search surface otherwise (conversion-audit #13).
    const cityHref = HOUSING_MARKET_PAGES.has(citySlug) ? `/housing-market/${citySlug}` : `/search/${citySlug}`
    const block = blocksBySlug.get(citySlug)
    html += `
      <section class="mt-8">
        <h2 class="text-xl font-semibold text-foreground"><a href="${cityHref}" class="text-emerald-700 hover:text-emerald-800 hover:underline">${escapeHtml(city)}</a></h2>
        ${block ? verdictHtml(block) : ''}
        <div class="mt-2 grid gap-4 sm:grid-cols-2">
    `
    if (totalPending > 0) {
      html += `
          <div class="rounded-xl border border-border bg-amber-50/50 p-4">
            <h3 class="font-medium text-amber-900">Went pending (${totalPending})</h3>
            <ul class="mt-2 list-inside list-disc text-sm text-muted-foreground">
      `
      for (const item of pending.slice(0, 15)) {
        const price = item.price != null ? `$${Number(item.price).toLocaleString()}` : ''
        const desc = (item.description ?? '').slice(0, 80)
        html += `<li>${escapeHtml(price || desc || item.listing_key)}</li>`
      }
      if (pending.length > 15) html += `<li>… and ${pending.length - 15} more</li>`
      html += `</ul></div>`
    }
    if (totalClosed > 0) {
      html += `
          <div class="rounded-xl border border-border bg-emerald-50/50 p-4">
            <h3 class="font-medium text-emerald-900">Closed (${totalClosed})</h3>
            <ul class="mt-2 list-inside list-disc text-sm text-muted-foreground">
      `
      for (const item of closed.slice(0, 15)) {
        const price = item.price != null ? `$${Number(item.price).toLocaleString()}` : ''
        const desc = (item.description ?? '').slice(0, 80)
        html += `<li>${escapeHtml(price || desc || item.listing_key)}</li>`
      }
      if (closed.length > 15) html += `<li>… and ${closed.length - 15} more</li>`
      html += `</ul></div>`
    }
    html += `</div></section>`
  }
  html += `</div>`
  return html
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Banner = the satori-rendered region median-price chart from our own
 * /api/email/market-chart route — real data, drawn by code, cached 6h.
 * Replaces the grok-imagine AI image whose hallucinated chart labels
 * ("Ratas Rales", "Housig Inventorr") violated the ANTI_SLOP manifesto on a
 * page whose entire job is numeric credibility (conversion-audit #4).
 * Returns null on any failure — the report page renders fine without a
 * banner, and a missing banner beats a fabricated one.
 */
async function fetchBannerPng(): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `${SITE_URL}/api/email/market-chart?geo=region&slug=central-oregon&metric=median_price&months=12`,
      { signal: AbortSignal.timeout(30_000) },
    )
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('image/png')) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

/** Fire the ops alarm (reuses the allowlisted market-stat alert sender). */
async function alertGeneratorFailure(reason: string): Promise<void> {
  try {
    await sendMarketStatAlertEmail({
      failures: [reason],
      subject: '[Data] Weekly market report did not generate',
      heading: 'The weekly market report did not generate',
      intro:
        'The weekly generator (/api/cron/market-report) hit a condition that would have published a blank or broken report, so it refused and alerted instead of failing silently (conversion-audit 2026-07-15 #6).',
      context:
        'Generator: app/actions/generate-market-report.ts. Data: getMarketReportData (listing_tile_mv + listing_history). Rerun: GET /api/cron/market-report with the cron bearer.',
    })
  } catch (e) {
    console.error('[generateWeeklyMarketReport] alert send failed:', e)
  }
}

/**
 * Generate the weekly market report: fetch data, build HTML (with per-city
 * verdict lines from the verified cache), render the real-data banner, save to
 * Storage and market_reports. Called by cron (Sunday morning — a Saturday
 * firing covers a week that ended seven days earlier, the staleness the
 * 2026-07-15 audit flagged) or admin. Fails LOUD: empty data or a write error
 * emails the ops alarm instead of publishing a blank report.
 */
export async function generateWeeklyMarketReport(): Promise<
  { ok: true; slug: string; url: string } | { ok: false; error: string }
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return { ok: false, error: 'Supabase not configured.' }
  }

  const { start, end } = getLastWeekRange()

  let data: MarketReportByCity[]
  try {
    data = await getMarketReportData(start, end)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await alertGeneratorFailure(
      `getMarketReportData threw for ${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)}: ${msg}`,
    )
    return { ok: false, error: `Weekly data fetch failed: ${msg}` }
  }

  // Refuse to publish a blank report. Zero activity across every Central
  // Oregon city in a full week is not a market fact, it is a broken source
  // (the 2026-07 incident: listing_tile_mv sat 8 days stale and this
  // generator silently produced an intro-only page).
  const totalActivity = data.reduce((n, c) => n + c.pending.length + c.closed.length, 0)
  if (totalActivity === 0) {
    await alertGeneratorFailure(
      `Zero pending + zero closed across all cities for ${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)} — the data source is almost certainly stale (check listing_tile_mv freshness). No report was published.`,
    )
    return { ok: false, error: 'Empty week data — refused to publish a blank report (alert sent).' }
  }

  // Verified verdict blocks for the narrative lines (§0: same cache-backed
  // DAL the subscription email renders from; a city missing from the cache
  // simply gets no verdict line, never an invented one).
  let blocksBySlug = new Map<string, MarketReportAreaBlock>()
  try {
    const blocks = await getVerifiedCityBlocks(VERDICT_CITY_SLUGS)
    blocksBySlug = new Map(blocks.map((b) => [b.slug, b]))
  } catch (e) {
    // Narrative enrichment is additive — the raw report still publishes.
    console.error('[generateWeeklyMarketReport] verdict blocks failed:', e)
  }

  const slug = `weekly-${start.toISOString().slice(0, 10)}`
  const title = `Central Oregon Market Report: ${formatDate(start)} to ${formatDate(end)}`
  const contentHtml = buildReportHtml(data, blocksBySlug, start, end)

  let imagePath: string | null = null
  const banner = await fetchBannerPng()
  if (banner) {
    imagePath = `reports/${slug}.png`
    try {
      const supabase = createClient(supabaseUrl, serviceKey)
      const { data: buckets } = await supabase.storage.listBuckets()
      if (!buckets?.some((b) => b.name === BUCKET)) {
        await supabase.storage.createBucket(BUCKET, { public: true })
      }
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(imagePath, banner, {
        contentType: 'image/png',
        upsert: true,
      })
      if (uploadErr) imagePath = null
    } catch {
      imagePath = null
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const { error: insertErr } = await supabase.from('market_reports').upsert(
    {
      slug,
      period_type: 'weekly',
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      title,
      image_storage_path: imagePath,
      content_html: contentHtml,
    },
    { onConflict: 'slug' }
  )
  if (insertErr) {
    await alertGeneratorFailure(`market_reports upsert failed for ${slug}: ${insertErr.message}`)
    return { ok: false, error: insertErr.message }
  }

  return { ok: true, slug, url: `${SITE_URL}/housing-market/reports/${slug}` }
}
