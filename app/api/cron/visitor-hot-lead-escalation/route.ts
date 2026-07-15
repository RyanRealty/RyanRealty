/**
 * Visitor hot-lead escalation cron.
 *
 * Runs every 15 minutes. Finds visitor_sessions whose engagement_score has
 * crossed the hot threshold (default 100) and hot_lead_fired_at is still
 * NULL. For each match:
 *
 *   - IDENTIFIED session (resolves to a crm_people row via crm_person_id,
 *     or fub_person_id → crm_people.fub_legacy_id for legacy sessions):
 *       1. Create a 5-minute native call task on the person (crm_tasks via
 *          createNativeTask — the in-house replacement for the dead FUB
 *          createRealtimeTask, FUB decommissioned 2026-06-24).
 *       2. Send an alert email to MATT_ALERT_EMAIL with the journey
 *          summary (top pages, listings viewed, score, source) linking to
 *          the native CRM person page (/admin/crm/<personId>).
 *       3. Set hot_lead_fired_at so we never fire twice for the same session.
 *
 *   - ANONYMOUS session (no CRM person):
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
import { createNativeTask } from '@/lib/data/crm/ensureNativeLead'
import { CRM_BROKERS, type CrmBrokerSlug } from '@/lib/crm/constants'
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
  crm_person_id: number | null
  identified_email: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  ip_city: string | null
  ip_region: string | null
  ip_country: string | null
}

type NativePerson = { personId: number; assignedBroker: CrmBrokerSlug | null }

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
    .select('session_id, source_domain, first_seen_at, last_seen_at, engagement_score, peak_score, intent_tags, fub_person_id, crm_person_id, identified_email, utm_source, utm_medium, utm_campaign, ip_city, ip_region, ip_country')
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

/** Most-recent events per session, bounded PER SESSION. A single global
 *  `.in('session_id', ids)` query silently caps at PostgREST's 1000-row limit,
 *  so busy sessions could show 0/partial events depending on global event_at
 *  ordering — query each session with its own limit instead. */
const EVENTS_PER_SESSION = 60

async function fetchTopEventsForSessions(sessionIds: string[]): Promise<Map<string, TopEvent[]>> {
  const map = new Map<string, TopEvent[]>()
  if (sessionIds.length === 0) return map
  const supabase = getServiceSupabase()
  if (!supabase) return map
  const results = await Promise.all(
    sessionIds.map(async (id) => {
      const { data, error } = await supabase
        .from('visitor_events')
        .select('session_id, event_type, page_url, page_category, listing_mls, listing_city, listing_price, event_at')
        .eq('session_id', id)
        .order('event_at', { ascending: false })
        .limit(EVENTS_PER_SESSION)
      return error ? [] : ((data ?? []) as TopEvent[])
    }),
  )
  for (const events of results) {
    if (events.length > 0) map.set(events[0].session_id, events)
  }
  return map
}

/**
 * Resolve each hot session to its native crm_people row: prefer the session's
 * crm_person_id; fall back to fub_person_id → crm_people.fub_legacy_id for
 * sessions identified before the FUB cutover. Returns session_id → person.
 */
async function resolveNativePersons(sessions: HotSession[]): Promise<Map<string, NativePerson>> {
  const map = new Map<string, NativePerson>()
  const supabase = getServiceSupabase()
  if (!supabase) return map

  const coerceBroker = (slug: unknown): CrmBrokerSlug | null =>
    typeof slug === 'string' && (CRM_BROKERS as readonly string[]).includes(slug) ? (slug as CrmBrokerSlug) : null

  const crmIds = [...new Set(sessions.map((s) => s.crm_person_id).filter((n): n is number => Number.isFinite(n as number)))]
  const fubIds = [
    ...new Set(
      sessions
        .filter((s) => s.crm_person_id == null && s.fub_person_id != null)
        .map((s) => s.fub_person_id as number),
    ),
  ]

  const byId = new Map<number, NativePerson>()
  const byFubId = new Map<number, NativePerson>()
  if (crmIds.length > 0) {
    const { data } = await supabase.from('crm_people').select('id, assigned_broker').in('id', crmIds)
    for (const row of data ?? []) {
      byId.set(Number(row.id), { personId: Number(row.id), assignedBroker: coerceBroker(row.assigned_broker) })
    }
  }
  if (fubIds.length > 0) {
    const { data } = await supabase.from('crm_people').select('id, assigned_broker, fub_legacy_id').in('fub_legacy_id', fubIds)
    for (const row of data ?? []) {
      if (row.fub_legacy_id == null) continue
      byFubId.set(Number(row.fub_legacy_id), { personId: Number(row.id), assignedBroker: coerceBroker(row.assigned_broker) })
    }
  }

  for (const s of sessions) {
    const person =
      (s.crm_person_id != null ? byId.get(s.crm_person_id) : undefined) ??
      (s.fub_person_id != null ? byFubId.get(s.fub_person_id) : undefined)
    if (person) map.set(s.session_id, person)
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

function buildAlertEmailHtml(session: HotSession, events: TopEvent[], summary: ReturnType<typeof summarizeJourney>, person: NativePerson | null): string {
  const isIdentified = !!person
  const who = session.identified_email ?? `Anonymous visitor ${session.session_id.slice(0, 8)}`
  const crmLink = person ? `https://ryan-realty.com/admin/crm/${person.personId}` : null
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

${crmLink ? `<p style="margin:0 0 4px;"><a href="${crmLink}" style="color:#102742;font-weight:600;text-decoration:underline;">Open in CRM</a></p>` : '<p style="margin:0 0 4px;color:#777;font-style:italic;">Anonymous visitor — no CRM record yet. Add to remarketing audience or wait for sign-in.</p>'}

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

  const [eventsBySession, personBySession] = await Promise.all([
    fetchTopEventsForSessions(sessions.map((s) => s.session_id)),
    resolveNativePersons(sessions),
  ])
  const firedSessionIds: string[] = []
  let tasksCreated = 0
  let emailsSent = 0
  const errors: string[] = []

  for (const session of sessions) {
    const events = eventsBySession.get(session.session_id) ?? []
    const summary = summarizeJourney(events)
    const person = personBySession.get(session.session_id) ?? null
    const isIdentified = !!person

    // 1. Native 5-minute call task for identified sessions (crm_tasks)
    if (person) {
      const who = session.identified_email ?? `Contact #${person.personId}`
      const intentLabel = session.intent_tags.includes('seller_intent') ? 'seller intent' :
                          session.intent_tags.includes('buyer_intent')  ? 'buyer intent' : 'high engagement'
      try {
        await createNativeTask({
          personId: person.personId,
          name: `Hot ${intentLabel} lead, score ${session.engagement_score}: ${who}. Call within 5 min.`,
          type: 'Call',
          dueInMinutes: 5,
          assignedBroker: person.assignedBroker ?? undefined,
        })
        tasksCreated += 1
      } catch (e) {
        errors.push(`CRM task for ${session.session_id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // 2. Alert email to Matt for every hot session (identified or not)
    const subjectPrefix = isIdentified ? 'Hot lead' : 'Hot anonymous visitor'
    const subject = `${subjectPrefix} (score ${session.engagement_score}) — ${formatSource(session)} from ${formatGeo(session)}`
    const html = buildAlertEmailHtml(session, events, summary, person)
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
    tasksCreated,
    emailsSent,
    errors,
    fetchedAt: new Date().toISOString(),
  })
}
