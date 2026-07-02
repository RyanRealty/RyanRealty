/**
 * getContactActivityFeed — the unified, chronological communications + activity
 * feed for the Contact-360 view (CONTACT360 Phase 2.1).
 *
 * This is the centerpiece: every interaction a contact has had — texts, emails
 * (sent / opened / clicked), calls, voicemails, notes, stage changes, home-value
 * requests, system events — merged into one time-ordered stream off crm_timeline,
 * each row classified into a category + direction + a human label the UI renders
 * with the right icon and styling.
 *
 * Scope: reads the timeline for a single crm_people.id (the canonical per-person
 * stream). Merging sibling records (the same human across multiple crm_people
 * rows that share an email) is a follow-up that rides on the Phase 1.1 bridge.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export type ActivityCategory = 'message' | 'email' | 'call' | 'note' | 'system' | 'milestone' | 'web' | 'other'

export type ActivityFeedItem = {
  id: number
  ts: string
  kind: string
  category: ActivityCategory
  direction: 'in' | 'out' | null
  label: string
  snippet: string | null
  broker: string | null
  source: string
  /** Twilio recording for a call/voicemail — drives the inline <audio> player. */
  recordingSid: string | null
  recordingDurationSec: number | null
  /** True when the row is a FUB-imported message whose body FUB redacted at the
   *  API ([CONTENT HIDDEN]). The event is correctly associated to the lead, but
   *  the content is unavailable until the FUB integration is registered for
   *  content access (see scripts/crm-import-fub-comms.mjs). The UI labels these
   *  rather than rendering a blank, so a redacted message never reads as empty. */
  contentHidden: boolean
}

type KindMeta = { category: ActivityCategory; direction: 'in' | 'out' | null; label: string }

const KIND_MAP: Record<string, KindMeta> = {
  sms_in: { category: 'message', direction: 'in', label: 'Text received' },
  sms_out: { category: 'message', direction: 'out', label: 'Text sent' },
  email_out: { category: 'email', direction: 'out', label: 'Email sent' },
  // email_in was missing — inbound FUB/Gmail emails fell through to 'other' and
  // mis-rendered as "Email in". Classify it as an inbound email. (no-drop-off fix)
  email_in: { category: 'email', direction: 'in', label: 'Email received' },
  email: { category: 'email', direction: null, label: 'Email' },
  email_open: { category: 'email', direction: 'in', label: 'Email opened' },
  email_click: { category: 'email', direction: 'in', label: 'Email link clicked' },
  call: { category: 'call', direction: null, label: 'Call' },
  voicemail: { category: 'call', direction: 'in', label: 'Voicemail' },
  note: { category: 'note', direction: null, label: 'Note' },
  system: { category: 'system', direction: null, label: 'System update' },
  stage_change: { category: 'milestone', direction: null, label: 'Stage changed' },
  // lead_created — the "New lead" activity event (FUB-parity). Backfilled for
  // every contact from fub_created_at/created_at and written going forward when a
  // lead is first captured, so the global Activity feed has a uniform new-lead row.
  lead_created: { category: 'milestone', direction: 'in', label: 'New lead' },
  home_valuation: { category: 'milestone', direction: null, label: 'Home valuation requested' },
  subscribe_report: { category: 'milestone', direction: null, label: 'Subscribed to a market report' },
  parsed_intent: { category: 'web', direction: null, label: 'Website intent detected' },
  // web_event was missing — the 14.8K FUB site-activity rows fell through to
  // 'other' and mis-rendered as "Web event". Classify as website activity. (fix)
  web_event: { category: 'web', direction: null, label: 'Website activity' },
}

function humanizeKind(kind: string): string {
  const words = kind.replace(/[_-]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Activity'
}

/** Pure: classify a timeline kind into a category + direction + human label. */
export function classifyTimelineKind(kind: string): KindMeta {
  return KIND_MAP[kind] ?? { category: 'other', direction: null, label: humanizeKind(kind) }
}

/** Pure: decode the entities email bodies carry so previews never show raw
 *  "&amp;" / "&#39;" (2026-07-02 mobile audit — inbox rows read
 *  "Owner &amp; Principal Broker"). Tags are stripped only when the body
 *  looks like HTML, so an SMS like "offers < 500k" survives untouched. */
function toPlainPreview(s: string): string {
  const stripped = /<([a-z][a-z0-9]*)\b[^>]*>/i.test(s) ? s.replace(/<[^>]+>/g, ' ') : s
  return stripped
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** Pure: a short preview for a feed item, from its title/body/payload. */
export function buildSnippet(row: { title?: string | null; body?: string | null; payload?: unknown }): string | null {
  const body = typeof row.body === 'string' ? toPlainPreview(row.body) : ''
  if (body) return body.length > 200 ? body.slice(0, 197) + '...' : body
  const title = typeof row.title === 'string' ? row.title.trim() : ''
  if (title) return title
  return null
}

/** Pure: map a raw crm_timeline row to a typed feed item. */
export function toFeedItem(row: Record<string, unknown>): ActivityFeedItem {
  const kind = String(row.kind ?? '')
  const meta = classifyTimelineKind(kind)
  const payload = (row.payload ?? {}) as Record<string, unknown>
  const recRaw = typeof payload.recordingSid === 'string' ? payload.recordingSid : null
  const recordingSid = recRaw && /^RE[a-f0-9]{32}$/.test(recRaw) ? recRaw : null
  const durRaw = payload.recordingDurationSec
  const recordingDurationSec = typeof durRaw === 'number' && Number.isFinite(durRaw) ? durRaw : null
  const contentHidden = payload.contentHidden === true
  return {
    id: Number(row.id),
    ts: String(row.ts ?? ''),
    kind,
    category: meta.category,
    direction: meta.direction,
    label: meta.label,
    snippet: buildSnippet({
      title: row.title as string | null,
      body: row.body as string | null,
      payload: row.payload,
    }),
    broker: (row.broker as string | null) ?? null,
    source: String(row.source ?? 'app'),
    recordingSid,
    recordingDurationSec,
    contentHidden,
  }
}

export async function getContactActivityFeed(crmPersonId: number, limit = 100): Promise<ActivityFeedItem[]> {
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return []
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_timeline')
    .select('id,ts,kind,title,body,payload,broker,source')
    .eq('person_id', crmPersonId)
    .order('ts', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500))
  if (!data) return []
  return data.map((r) => toFeedItem(r as Record<string, unknown>))
}
