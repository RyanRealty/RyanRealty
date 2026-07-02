/**
 * Visitor hot-lead escalation cron.
 *
 * Runs every 15 minutes. Finds visitor_sessions whose engagement_score has
 * crossed the hot threshold (default 100) and hot_lead_fired_at is still
 * NULL. For each match:
 *
 *   - IDENTIFIED session (fub_person_id present):
 *       1. Create a 5-minute FUB realtime call task on the person.
 *       2. Send an alert email to MATT_ALERT_EMAIL with the journey
 *          summary (top pages, listings viewed, score, source).
 *       3. Set hot_lead_fired_at so we never fire twice for the same session.
 *
 *   - ANONYMOUS session (no fub_person_id):
 *       1. Send an alert email to MATT_ALERT_EMAIL labeled "anonymous hot
 *          visitor" with the journey summary + a remarketing audience hint.
 *       2. Set hot_lead_fired_at.
 *
 * The threshold is environment-configurable so we can tune it without a
 * deploy (set VISITOR_HOT_LEAD_THRESHOLD in Vercel env).
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 * Cadence: every 15 min (cron expression registered in vercel.json)
 *
 * Data: public.visitor_sessions + public.visitor_events. Scoring lives in
 * the DB trigger so this cron only reads, never recomputes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRealtimeTask } from '@/lib/followupboss'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const RESEND_API_URL = 'https://api.resend.com/emails'

function readThreshold(): number {
  const raw = process.env.VISITOR_HOT_LEAD_THRESHOLD?.trim()
  const n = raw ? Number(raw) : 100
  return Number.isFinite(n) && n > 0 ? n : 100
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

type HotSession = {
  session_id: string
  source_domain: string
  first_seen_at: string
  last_seen_at: string
  engagement_score: number
  peak_score: number
  intent_tags: string[]
  fub_person_id: number | null
  identified_email: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  ip_city: string | null
  ip_region: string | null
  ip_country: string | null
}

type TopEvent = {
  session_id: string
  event_type: string
  page_url: string
  page_category: string | null
  listing_mls: string | null
  listing_city: string | null
  listing_price: number | null
  event_at: string
}

async function fetchHotSessions(threshold: number): Promise<HotSession[]> {
  const supabase = getServiceSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('session_id, source_domain, first_seen_at, last_seen_at, engagement_score, peak_score, intent_tags, fub_person_id, identified_email, utm_source, utm_medium, utm_campaign, ip_city, ip_region, ip_country')
    .gte('engagement_score', threshold)
    .is('hot_lead_fired_at', null)
    .order('engagement_score', { ascending: false })
    .limit(50)
  if (error) {
    console.warn('[hot-lead-cron] fetch failed:', error.message)
    return []
  }
  return (data ?? []) as HotSession[]
}

async function fetchTopEventsForSessions(sessionIds: string[]): Promise<Map<string, TopEvent[]>> {
  const map = new Map<string, TopEvent[]>()
  if (sessionIds.length === 0) return map
  const supabase = getServiceSupabase()
  if (!supabase) return map
  const { data, error } = await supabase
    .from('visitor_events')
    .select('session_id, event_type, page_url, page_category, listing_mls, listing_city, listing_price, event_at')
    .in('session_id', sessionIds)
    .order('event_at', { ascending: false })
  if (error || !data) return map
  for (const row of data as TopEvent[]) {
    const list = map.get(row.session_id) ?? []
    list.push(row)
    map.set(row.session_id, list)
  }
  return map
}

function formatSource(s: { utm_source: string | null; utm_medium: string | null }): string {
  if (!s.utm_source) return 'direct'
  if (s.utm_medium && s.utm_medium !== 'none') return `${s.utm_source} / ${s.utm_medium}`
  return s.utm_source
}

function formatGeo(s: { ip_city: string | null; ip_region: string | null; ip_country: string | null }): string {
  const parts: string[] = []
  if (s.ip_city) parts.push(s.ip_city)
  if (s.ip_region && s.ip_region !== s.ip_city) parts.push(s.ip_region)
  if (s.ip_country && parts.length === 0) parts.push(s.ip_country)
  return parts.join(', ') || 'unknown location'
}

function summarizeJourney(events: TopEvent[]): { listings: string[]; pages: string[]; eventCount: number } {
  const listings: string[] = []
  const pages: string[] = []
  for (const e of events) {
    if (e.listing_mls) {
      const tag = e.listing_city ? `MLS ${e.listing_mls} (${e.listing_city})` : `MLS ${e.listing_mls}`
      if (!listings.includes(tag)) listings.push(tag)
    } else if (e.page_category && e.page_category !== 'home' && e.page_category !== 'other') {
      let path = e.page_url
      try { path = new URL(e.page_url).pathname } catch {}
      const tag = `${e.page_category}: ${path}`
      if (!pages.includes(tag)) pages.push(tag)
    }
  }
  return { listings: listings.slice(0, 10), pages: pages.slice(0, 8), eventCount: events.length }
}

function buildAlertEmailHtml(session: HotSession, events: TopEvent[], summary: ReturnType<typeof summarizeJourney>): string {
  const isIdentified = !!session.fub_person_id
  const who = session.identified_email ?? `Anonymous visitor ${session.session_id.slice(0, 8)}`
  const fubLink = isIdentified
    ? `https://app.followupboss.com/2/people/view/${session.fub_person_id}`
    : null
  const minutesActive = Math.max(1, Math.round((new Date(session.last_seen_at).getTime() - new Date(session.first_seen_at).getTime()) / 60000))
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.45;color:#102742;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="margin:0 0 8px;color:#102742;font-size:20px;">Hot ${isIdentified ? 'lead' : 'anonymous visitor'}: score ${session.engagement_score}</h2>
<p style="margin:0 0 16px;color:#555;">${who} · ${formatGeo(session)} · active for ${minutesActive} min</p>

<table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
  <tr><td style="padding:4px 8px;color:#666;">Source</td><td style="padding:4px 8px;font-weight:600;">${formatSource(session)}${session.utm_campaign ? ` (${session.utm_campaign})` : ''}</td></tr>
  <tr><td style="padding:4px 8px;color:#666;">Engagement score</td><td style="padding:4px 8px;font-weight:600;">${session.engagement_score} (peak ${session.peak_score})</td></tr>
  <tr><td style="padding:4px 8px;color:#666;">Intent signals</td><td style="padding:4px 8px;">${session.intent_tags.length ? session.intent_tags.join(', ') : '—'}</td></tr>
  <tr><td style="padding:4px 8px;color:#666;">Events</td><td style="padding:4px 8px;">${summary.eventCount} total</td></tr>
</table>

${summary.listings.length ? `<p style="margin:0 0 4px;color:#666;font-weight:600;">Listings viewed</p><ul style="margin:0 0 16px;padding-left:20px;">${summary.listings.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}

${summary.pages.length ? `<p style="margin:0 0 4px;color:#666;font-weight:600;">High-intent pages</p><ul style="margin:0 0 16px;padding-left:20px;">${summary.pages.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}

${fubLink ? `<p style="margin:0 0 4px;"><a href="${fubLink}" style="color:#102742;font-weight:600;text-decoration:underline;">Open in FUB</a></p>` : '<p style="margin:0 0 4px;color:#777;font-style:italic;">Anonymous visitor — no FUB record yet. Add to remarketing audience or wait for sign-in.</p>'}

<p style="margin:16px 0 0;font-size:12px;color:#999;">Fired by visitor-hot-lead-escalation cron · session ${session.session_id}</p>
</body></html>`
}

async function sendAlertEmail(html: string, subject: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = (process.env.MATT_ALERT_FROM_EMAIL || 'alerts@mail.ryan-realty.com').trim()
  const to   = (process.env.MATT_ALERT_EMAIL || 'matt@ryan-realty.com').trim()
  if (!apiKey) {
    console.warn('[hot-lead-cron] RESEND_API_KEY missing, skipping email')
    return false
  }
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[hot-lead-cron] Resend ${res.status}: ${body.slice(0, 200)}`)
      return false
    }
    return true
  } catch (e) {
    console.warn('[hot-lead-cron] Resend failed:', e instanceof Error ? e.message : String(e))
    return false
  }
}

async function markFired(sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return
  const supabase = getServiceSupabase()
  if (!supabase) return
  const { error } = await supabase
    .from('visitor_sessions')
    .update({ hot_lead_fired_at: new Date().toISOString() })
    .in('session_id', sessionIds)
  if (error) console.warn('[hot-lead-cron] mark fired failed:', error.message)
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const threshold = readThreshold()
  const sessions = await fetchHotSessions(threshold)
  if (sessions.length === 0) {
    return NextResponse.json({ ok: true, threshold, escalated: 0, message: 'no hot sessions' })
  }

  const eventsBySession = await fetchTopEventsForSessions(sessions.map((s) => s.session_id))
  const firedSessionIds: string[] = []
  let fubTasksCreated = 0
  let emailsSent = 0
  const errors: string[] = []

  for (const session of sessions) {
    const events = eventsBySession.get(session.session_id) ?? []
    const summary = summarizeJourney(events)
    const isIdentified = !!session.fub_person_id

    // 1. FUB realtime call task for identified sessions
    if (isIdentified && session.fub_person_id) {
      const who = session.identified_email ?? `FUB #${session.fub_person_id}`
      const intentLabel = session.intent_tags.includes('seller_intent') ? 'seller intent' :
                          session.intent_tags.includes('buyer_intent')  ? 'buyer intent' : 'high engagement'
      try {
        const ok = await createRealtimeTask({
          personId: session.fub_person_id,
          taskName: `Hot ${intentLabel} lead, score ${session.engagement_score}: ${who}. Call within 5 min.`,
          taskType: 'Call',
          dueInMinutes: 5,
        })
        if (ok) fubTasksCreated += 1
      } catch (e) {
        errors.push(`FUB task for ${session.session_id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // 2. Alert email to Matt for every hot session (identified or not)
    const subjectPrefix = isIdentified ? 'Hot lead' : 'Hot anonymous visitor'
    const subject = `${subjectPrefix} (score ${session.engagement_score}) — ${formatSource(session)} from ${formatGeo(session)}`
    const html = buildAlertEmailHtml(session, events, summary)
    const sent = await sendAlertEmail(html, subject)
    if (sent) emailsSent += 1

    firedSessionIds.push(session.session_id)
  }

  // 3. Mark fired so we never double-escalate
  await markFired(firedSessionIds)

  return NextResponse.json({
    ok: true,
    threshold,
    escalated: firedSessionIds.length,
    fubTasksCreated,
    emailsSent,
    errors,
    fetchedAt: new Date().toISOString(),
  })
}
