/**
 * Daily analytics digest email.
 *
 * Once per day, pulls yesterday's visitor activity, paid spend, qualified
 * leads, and top LPs into one email so the broker can consume yesterday's
 * numbers without logging in to the dashboard.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 * Cadence: 14:30 UTC daily (7:30 am Pacific in summer, 6:30 am in winter)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const RESEND_API_URL = 'https://api.resend.com/emails'

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function classifySocial(source: string | null | undefined): string | null {
  if (!source) return null
  const s = source.toLowerCase()
  if (/(^|[/_.\s-])(facebook|fb)([/_.\s-]|$)/.test(s) || s === 'fb' || s === 'facebook') return 'Facebook'
  if (/instagram/.test(s)) return 'Instagram'
  if (/tiktok/.test(s)) return 'TikTok'
  if (/youtube/.test(s)) return 'YouTube'
  if (/linkedin/.test(s)) return 'LinkedIn'
  if (/\b(x|twitter|t\.co)\b/.test(s)) return 'X / Twitter'
  if (/pinterest/.test(s)) return 'Pinterest'
  return null
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}
function fmtInt(n: number): string { return new Intl.NumberFormat('en-US').format(n) }
function fmtPct(num: number, den: number): string {
  if (den === 0) return '—'
  return `${((num / den) * 100).toFixed(1)}%`
}

function lpVariantFromPath(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  let p = pathOrUrl
  try { p = new URL(pathOrUrl).pathname } catch {}
  p = p.toLowerCase().replace(/\/+$/, '')
  if (p === '/home-valuation') return 'seller-home-value'
  const m = p.match(/^\/lp\/([a-z0-9-]+)/)
  return m ? m[1] : null
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 500 })
  }

  // Date windows: "yesterday" in UTC; we send around 7am PT = 14:00-15:00 UTC.
  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterdayUtc = new Date(todayUtc.getTime() - 24 * 60 * 60 * 1000)
  const dayBeforeUtc = new Date(yesterdayUtc.getTime() - 24 * 60 * 60 * 1000)
  const yStart = yesterdayUtc.toISOString()
  const yEnd = todayUtc.toISOString()
  const yDate = yesterdayUtc.toISOString().slice(0, 10)
  const yLabel = yesterdayUtc.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric' })

  const [{ data: ySess }, dSessCount, { data: ySpend }, { data: yQual }, { data: yEvents }] = await Promise.all([
    supabase.from('visitor_sessions')
      .select('session_id, utm_source, utm_medium, utm_campaign, ip_city, identified_at, hot_lead_fired_at, landing_page, engagement_score, first_seen_at')
      .gte('first_seen_at', yStart).lt('first_seen_at', yEnd)
      .limit(5000),
    supabase.from('visitor_sessions')
      .select('session_id', { count: 'exact', head: true })
      .gte('first_seen_at', dayBeforeUtc.toISOString()).lt('first_seen_at', yStart),
    supabase.from('marketing_channel_daily')
      .select('scope_id, value, metadata')
      .eq('channel', 'meta_ads').eq('scope', 'campaign').eq('metric', 'spend').eq('date', yDate),
    supabase.from('marketing_channel_daily')
      .select('value')
      .eq('channel', 'fub').eq('scope', 'account').eq('metric', 'qualified_seller_leads').eq('date', yDate),
    supabase.from('visitor_events')
      .select('page_category')
      .gte('event_at', yStart).lt('event_at', yEnd)
      .limit(50000),
  ])

  const sessions = (ySess ?? []) as Array<{ utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; ip_city: string | null; identified_at: string | null; hot_lead_fired_at: string | null; landing_page: string | null; engagement_score: number }>
  const yesterdayCount = sessions.length
  const dayBeforeCount = dSessCount.count ?? 0
  const identifiedCount = sessions.filter((s) => s.identified_at).length
  const hotCount = sessions.filter((s) => s.hot_lead_fired_at).length
  const spendYesterday = (ySpend ?? []).reduce((acc, r) => acc + (Number((r as { value: number }).value) || 0), 0)
  const qualLeadsYesterday = (yQual ?? []).reduce((acc, r) => acc + (Number((r as { value: number }).value) || 0), 0)
  const cpl = qualLeadsYesterday > 0 ? spendYesterday / qualLeadsYesterday : null

  const bySource = new Map<string, { sessions: number; identified: number; hot: number; isSocial: boolean }>()
  for (const s of sessions) {
    const src = (s.utm_source || 'direct').toLowerCase()
    const b = bySource.get(src) ?? { sessions: 0, identified: 0, hot: 0, isSocial: classifySocial(src) !== null }
    b.sessions += 1
    if (s.identified_at) b.identified += 1
    if (s.hot_lead_fired_at) b.hot += 1
    bySource.set(src, b)
  }
  const topSources = Array.from(bySource.entries()).sort((a, b) => b[1].sessions - a[1].sessions).slice(0, 8)

  const byLp = new Map<string, { visits: number; identified: number; hot: number }>()
  for (const s of sessions) {
    const v = lpVariantFromPath(s.landing_page) || (s.landing_page ? '(non-LP)' : '(unknown)')
    const b = byLp.get(v) ?? { visits: 0, identified: 0, hot: 0 }
    b.visits += 1
    if (s.identified_at) b.identified += 1
    if (s.hot_lead_fired_at) b.hot += 1
    byLp.set(v, b)
  }
  const topLps = Array.from(byLp.entries()).sort((a, b) => b[1].visits - a[1].visits).slice(0, 6)

  const eventsByCategory = new Map<string, number>()
  for (const e of ((yEvents ?? []) as Array<{ page_category: string | null }>)) {
    const c = e.page_category || 'other'
    eventsByCategory.set(c, (eventsByCategory.get(c) ?? 0) + 1)
  }

  const anomalies: string[] = []
  for (const [src, b] of bySource) {
    if (!classifySocial(src)) continue
    if (b.sessions >= 5 && b.identified === 0) {
      anomalies.push(`${src} brought ${b.sessions} sessions but zero identified visitors. Worth checking the LP that traffic lands on.`)
    }
  }
  if (dayBeforeCount >= 10 && yesterdayCount < dayBeforeCount * 0.5) {
    anomalies.push(`Yesterday's total sessions (${yesterdayCount}) is less than half of the day before (${dayBeforeCount}). Check for tracking outages or campaign pauses.`)
  }
  if (cpl != null && cpl > 150) {
    anomalies.push(`Cost per qualified lead yesterday was ${fmtUsd(cpl)}, above the $150 healthy threshold. Consider tightening targeting or pausing the weakest ad set.`)
  }
  if (spendYesterday >= 20 && qualLeadsYesterday === 0) {
    anomalies.push(`Spent ${fmtUsd(spendYesterday)} on Meta yesterday with zero qualified seller leads. If this continues for 3 days, pause and rebuild.`)
  }

  const html = renderDigestHtml({ yLabel, yDate, yesterdayCount, dayBeforeCount, identifiedCount, hotCount, spendYesterday, qualLeadsYesterday, cpl, topSources, topLps, eventsByCategory, anomalies })

  const subject = `Ryan Realty analytics — ${yLabel}: ${yesterdayCount} visitors${hotCount > 0 ? `, ${hotCount} hot` : ''}${qualLeadsYesterday > 0 ? `, ${qualLeadsYesterday} qualified` : ''}`

  let sent = false
  let errorMsg: string | null = null
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    const from = (process.env.MATT_ALERT_FROM_EMAIL || 'alerts@mail.ryan-realty.com').trim()
    const to = (process.env.MATT_ALERT_EMAIL || 'matt@ryan-realty.com').trim()
    if (!apiKey) errorMsg = 'RESEND_API_KEY not configured'
    else {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to, subject, html }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        errorMsg = `Resend ${res.status}: ${body.slice(0, 200)}`
      } else sent = true
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({ ok: sent, sent, error: errorMsg, date: yDate, yesterdayCount, identifiedCount, hotCount, spendYesterday, qualLeadsYesterday, cpl, anomalyCount: anomalies.length, fetchedAt: new Date().toISOString() })
}

function renderDigestHtml(d: {
  yLabel: string; yDate: string; yesterdayCount: number; dayBeforeCount: number; identifiedCount: number; hotCount: number; spendYesterday: number; qualLeadsYesterday: number; cpl: number | null; topSources: Array<[string, { sessions: number; identified: number; hot: number; isSocial: boolean }]>; topLps: Array<[string, { visits: number; identified: number; hot: number }]>; eventsByCategory: Map<string, number>; anomalies: string[];
}): string {
  const trendArrow = d.dayBeforeCount > 0 ? (d.yesterdayCount > d.dayBeforeCount ? '↑' : d.yesterdayCount < d.dayBeforeCount ? '↓' : '→') : ''
  const trendPct = d.dayBeforeCount > 0 ? `${Math.abs(((d.yesterdayCount - d.dayBeforeCount) / d.dayBeforeCount) * 100).toFixed(0)}%` : ''
  const sourcesRows = d.topSources.map(([src, b]) =>
    `<tr><td style="padding:6px 10px;">${b.isSocial ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1877F2;margin-right:6px;"></span>' : ''}${src}</td><td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;">${fmtInt(b.sessions)}</td><td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;">${fmtInt(b.identified)}</td><td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;">${fmtPct(b.identified, b.sessions)}</td><td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;">${fmtInt(b.hot)}</td></tr>`
  ).join('')
  const lpRows = d.topLps.map(([lp, b]) =>
    `<tr><td style="padding:6px 10px;font-family:monospace;font-size:12px;">${lp}</td><td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;">${fmtInt(b.visits)}</td><td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;">${fmtInt(b.identified)}</td><td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;">${fmtPct(b.identified, b.visits)}</td><td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;">${fmtInt(b.hot)}</td></tr>`
  ).join('')
  const categoryList = Array.from(d.eventsByCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([cat, n]) => `<li style="margin:2px 0;">${cat}: <strong>${fmtInt(n)}</strong></li>`).join('')

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#102742;max-width:720px;margin:0 auto;padding:24px;background:#FAF8F4;">
<div style="background:#FFFFFF;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(16,39,66,0.08);">
<h1 style="margin:0 0 4px;color:#102742;font-size:22px;">Yesterday at Ryan Realty</h1>
<p style="margin:0 0 24px;color:#52606D;font-size:14px;">${d.yLabel} (${d.yDate})</p>

<table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
<tr>
<td style="padding:12px;background:#F2EBDD;border-radius:8px;width:25%;">
  <div style="font-size:11px;color:#52606D;text-transform:uppercase;letter-spacing:0.5px;">Visitors</div>
  <div style="font-size:24px;font-weight:600;margin-top:4px;font-variant-numeric:tabular-nums;">${fmtInt(d.yesterdayCount)}</div>
  <div style="font-size:11px;color:#52606D;margin-top:2px;">${trendArrow} ${trendPct} vs day before</div>
</td>
<td style="padding:12px;background:#F2EBDD;border-radius:8px;width:25%;">
  <div style="font-size:11px;color:#52606D;text-transform:uppercase;letter-spacing:0.5px;">Identified</div>
  <div style="font-size:24px;font-weight:600;margin-top:4px;font-variant-numeric:tabular-nums;">${fmtInt(d.identifiedCount)}</div>
  <div style="font-size:11px;color:#52606D;margin-top:2px;">${fmtPct(d.identifiedCount, d.yesterdayCount)} of visitors</div>
</td>
<td style="padding:12px;background:#F2EBDD;border-radius:8px;width:25%;">
  <div style="font-size:11px;color:#52606D;text-transform:uppercase;letter-spacing:0.5px;">Hot leads</div>
  <div style="font-size:24px;font-weight:600;margin-top:4px;font-variant-numeric:tabular-nums;color:${d.hotCount > 0 ? '#B22222' : '#102742'};">${fmtInt(d.hotCount)}</div>
  <div style="font-size:11px;color:#52606D;margin-top:2px;">score over 100</div>
</td>
<td style="padding:12px;background:#F2EBDD;border-radius:8px;width:25%;">
  <div style="font-size:11px;color:#52606D;text-transform:uppercase;letter-spacing:0.5px;">Qualified sellers</div>
  <div style="font-size:24px;font-weight:600;margin-top:4px;font-variant-numeric:tabular-nums;">${fmtInt(d.qualLeadsYesterday)}</div>
  <div style="font-size:11px;color:#52606D;margin-top:2px;">FUB tagged seller</div>
</td>
</tr>
</table>

<table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
<tr>
<td style="padding:12px;background:#FAF8F4;border-radius:8px;width:50%;">
  <div style="font-size:11px;color:#52606D;text-transform:uppercase;letter-spacing:0.5px;">Meta spend yesterday</div>
  <div style="font-size:20px;font-weight:600;margin-top:4px;font-variant-numeric:tabular-nums;">${fmtUsd(d.spendYesterday)}</div>
</td>
<td style="padding:12px;background:#FAF8F4;border-radius:8px;width:50%;">
  <div style="font-size:11px;color:#52606D;text-transform:uppercase;letter-spacing:0.5px;">Cost per qualified lead</div>
  <div style="font-size:20px;font-weight:600;margin-top:4px;font-variant-numeric:tabular-nums;color:${d.cpl == null ? '#52606D' : d.cpl < 75 ? '#0F8A4B' : d.cpl < 150 ? '#102742' : '#B22222'};">${d.cpl == null ? '—' : fmtUsd(d.cpl)}</div>
</td>
</tr>
</table>

${d.anomalies.length > 0 ? `
<div style="background:#FFF4E5;border-left:4px solid #C8841F;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
  <div style="font-weight:600;color:#C8841F;margin-bottom:6px;">Things to look at</div>
  <ul style="margin:0;padding-left:20px;font-size:13px;color:#52606D;">
    ${d.anomalies.map((a) => `<li style="margin:4px 0;">${a}</li>`).join('')}
  </ul>
</div>` : ''}

<h2 style="font-size:15px;margin:24px 0 8px;color:#102742;">Top traffic sources</h2>
<table style="border-collapse:collapse;width:100%;font-size:13px;border:1px solid #E5E2D9;border-radius:6px;overflow:hidden;">
<thead><tr style="background:#F2EBDD;"><th style="padding:8px 10px;text-align:left;font-weight:600;">Source</th><th style="padding:8px 10px;text-align:right;font-weight:600;">Sessions</th><th style="padding:8px 10px;text-align:right;font-weight:600;">Identified</th><th style="padding:8px 10px;text-align:right;font-weight:600;">ID rate</th><th style="padding:8px 10px;text-align:right;font-weight:600;">Hot</th></tr></thead>
<tbody>${sourcesRows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#52606D;">No source data</td></tr>'}</tbody>
</table>

<h2 style="font-size:15px;margin:24px 0 8px;color:#102742;">Top landing pages</h2>
<table style="border-collapse:collapse;width:100%;font-size:13px;border:1px solid #E5E2D9;border-radius:6px;overflow:hidden;">
<thead><tr style="background:#F2EBDD;"><th style="padding:8px 10px;text-align:left;font-weight:600;">LP / page</th><th style="padding:8px 10px;text-align:right;font-weight:600;">Visits</th><th style="padding:8px 10px;text-align:right;font-weight:600;">Identified</th><th style="padding:8px 10px;text-align:right;font-weight:600;">ID rate</th><th style="padding:8px 10px;text-align:right;font-weight:600;">Hot</th></tr></thead>
<tbody>${lpRows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#52606D;">No LP data</td></tr>'}</tbody>
</table>

<h2 style="font-size:15px;margin:24px 0 8px;color:#102742;">Event mix</h2>
<ul style="margin:0;padding-left:20px;font-size:13px;color:#52606D;">${categoryList || '<li>No event data</li>'}</ul>

<p style="margin:24px 0 0;font-size:12px;color:#9AA0A6;border-top:1px solid #E5E2D9;padding-top:12px;">
Full dashboards: <a href="https://ryanrealty.vercel.app/admin/analytics" style="color:#102742;">analytics</a> · <a href="https://ryanrealty.vercel.app/admin/visitors/live" style="color:#102742;">live visitors</a> · <a href="https://ryanrealty.vercel.app/admin/analytics/social" style="color:#102742;">social channels</a> · <a href="https://ryanrealty.vercel.app/admin/analytics/cost-per-lead" style="color:#102742;">cost per lead</a> · <a href="https://ryanrealty.vercel.app/admin/analytics/lp-leaderboard" style="color:#102742;">LP leaderboard</a>
</p>
</div>
</body></html>`
}
