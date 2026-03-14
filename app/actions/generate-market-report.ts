'use server'

import { createClient } from '@supabase/supabase-js'
import { cityEntityKey } from '../../lib/slug'
import { generateBannerImage } from '../../lib/grok-image'
import { getMarketReportData, type MarketReportByCity } from './market-reports'

const BUCKET = 'banners'
const REPORT_IMAGE_ASPECT = '2:1' as const

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
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function buildReportHtml(data: MarketReportByCity[], periodStart: Date, periodEnd: Date): string {
  const startStr = formatDate(periodStart)
  const endStr = formatDate(periodEnd)
  let html = `
    <div class="market-report">
      <p class="report-dates text-muted-foreground text-sm">${startStr} – ${endStr}</p>
      <p class="report-intro text-muted-foreground mt-2">Here’s what happened in the Central Oregon real estate market last week, by city.</p>
  `
  for (const { city, pending, closed } of data) {
    const totalPending = pending.length
    const totalClosed = closed.length
    if (totalPending === 0 && totalClosed === 0) continue
    const citySlug = cityEntityKey(city)
    html += `
      <section class="mt-8">
        <h2 class="text-xl font-semibold text-foreground"><a href="/search/${citySlug}" class="text-emerald-700 hover:text-emerald-800 hover:underline">${escapeHtml(city)}</a></h2>
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
 * Generate the weekly market report: fetch data, build HTML, generate image, save to Storage and market_reports.
 * Call from cron (e.g. Saturday morning) or admin.
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
  const data = await getMarketReportData(start, end)
  const totalPending = data.reduce((s, d) => s + d.pending.length, 0)
  const totalClosed = data.reduce((s, d) => s + d.closed.length, 0)

  const slug = `weekly-${start.toISOString().slice(0, 10)}`
  const title = `Central Oregon Market Report: ${formatDate(start)} – ${formatDate(end)}`
  const contentHtml = buildReportHtml(data, start, end)

  const imagePrompt = `Professional real estate market report header image for Central Oregon. Week of ${formatDate(start)}. Clean, modern, infographic style. No text, no people. Wide landscape.`
  let imagePath: string | null = null
  try {
    const buffer = await generateBannerImage({ prompt: imagePrompt, aspect_ratio: REPORT_IMAGE_ASPECT })
    imagePath = `reports/${slug}.jpg`
    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true })
    }
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(imagePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })
    if (uploadErr) imagePath = null
  } catch {
    imagePath = null
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
    return { ok: false, error: insertErr.message }
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')
  return { ok: true, slug, url: `${baseUrl}/reports/${slug}` }
}
