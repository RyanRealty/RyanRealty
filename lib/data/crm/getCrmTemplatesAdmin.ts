import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { countStepReferences } from '@/lib/crm/templateReferences'

/**
 * getCrmTemplatesAdmin — the cached reader for the templates ADMIN list (§13).
 *
 * Distinct from the lightweight pickers getCrmEmailTemplates /
 * getCrmSmsTemplates in app/actions/crm.ts (which return only what the composer
 * needs to send). This reader returns the full editable shape the §13 templates
 * surface renders: identity + folder (category) + sharing + ownership + the
 * §13.1.2 email engagement metrics (from email_events 'tpl:' rows), the
 * §13.2.2 text send counts (from crm_timeline sms_out rows whose payload
 * carries the templateKey the sequence engine stamps), and the automations
 * that reference each template (name list for the eye popover + delete guard).
 *
 * DAL boundary (G1): the raw .from() reads live here in lib/data/. The CRUD
 * actions (app/actions/crm-templates.ts) revalidate CRM_TEMPLATES_ADMIN_TAG on
 * every write. Templates change rarely, so a 5-minute cache is generous.
 *
 * Fails SOFT (empty array) on an unreadable table so the admin degrades to "no
 * templates" rather than crashing.
 */

/**
 * Per-template email performance derived from email_events rows whose
 * email_key starts with 'tpl:<key>:'. Only populated for email templates
 * once the send path stamps tpl: keys. Null-safe — shows '—' in the UI
 * until data accumulates.
 */
export type CrmTemplatePerf = {
  /** Distinct email_events 'sent' rows with this template prefix. */
  sent: number
  /** Open rate 0–100 (%), null when sent=0. */
  openPct: number | null
  /** Click rate 0–100 (%), null when sent=0. */
  clickPct: number | null
}

/** §13.1.2 raw engagement counts for the email template table. Every count is a
 *  distinct-send tally from email_events 'tpl:<key>:' rows — real data only. */
export type CrmTemplateEmailMetrics = {
  sent: number
  opens: number
  clicks: number
  replies: number
  unsubscribed: number
  bounces: number
}

/** §13.2.2 text send counts, derived from crm_timeline sms_out rows whose
 *  payload.templateKey matches (the sequence engine stamps it on every send). */
export type CrmTemplateTextMetrics = {
  /** Sends in the trailing 30 days. */
  sent30d: number
  /** All-time recorded sends. */
  sentTotal: number
}

/** A template as the admin CRUD list consumes it. */
export type CrmTemplateAdmin = {
  id: number
  key: string
  channel: 'email' | 'sms'
  name: string
  subject: string | null
  /** Email-only inbox preview text (§13.1.3). */
  previewText: string | null
  body: string
  category: string | null
  isActive: boolean
  /** When true, visible and usable by all brokers on the team. */
  isShared: boolean
  /** Broker slug who owns this template (null for legacy/seeded templates). */
  ownerBroker: string | null
  /** Text-only "Feature" flag (§13.2.3) — prominent in the quick-text picker. */
  featured: boolean
  /** Creation timestamp — null for FUB-seeded rows (never fabricated). */
  createdAt: string | null
  /** Count of live sequence steps that reference this template's key. */
  usage: number
  /** Names of the automations (crm_sequences) referencing this template. */
  usedBy: string[]
  /** Per-template email performance rates (null for SMS templates). */
  perf: CrmTemplatePerf | null
  /** §13.1.2 raw engagement counts (null for SMS templates). */
  emailMetrics: CrmTemplateEmailMetrics | null
  /** §13.2.2 text send counts (null for email templates). */
  textMetrics: CrmTemplateTextMetrics | null
}

/** Cache tag the CRUD actions revalidate on every write. */
export const CRM_TEMPLATES_ADMIN_TAG = 'crm-templates-admin' as const

type RawTemplateRow = {
  id: number
  key: string
  channel: string
  name: string
  subject: string | null
  preview_text?: string | null
  body: string
  category: string | null
  is_active: boolean
  is_shared: boolean
  owner_broker: string | null
  featured?: boolean | null
  created_at?: string | null
}

/** Normalize a raw channel to the two supported values (defaults to email). */
function normalizeChannel(value: string): 'email' | 'sms' {
  return value === 'sms' ? 'sms' : 'email'
}

/**
 * Tally how many sequence steps reference each template key across all
 * sequences. Pure given the loaded sequence rows; the counting itself is the
 * unit-tested countStepReferences helper.
 */
export function tallyTemplateUsage(
  keys: string[],
  sequences: Array<{ steps: unknown }>,
): Record<string, number> {
  const usage: Record<string, number> = {}
  for (const key of keys) {
    usage[key] = sequences.reduce((n, seq) => n + countStepReferences(seq.steps, key), 0)
  }
  return usage
}

/** The names of the sequences that reference a template key. Pure. */
export function tallyTemplateUsedBy(
  key: string,
  sequences: Array<{ name?: unknown; steps: unknown }>,
): string[] {
  const names: string[] = []
  for (const seq of sequences) {
    if (countStepReferences(seq.steps, key) > 0) {
      const n = String(seq.name ?? '').trim()
      if (n) names.push(n)
    }
  }
  return names
}

type EventPerfRow = { email_key: string | null; event: string }

/**
 * Compute §13.1.2 engagement counts from a flat list of email_events rows.
 * Distinct email_key per event type = one send/open/click/... SMS templates
 * return null (their metrics come from crm_timeline). Pure — testable no-DB.
 */
export function computeEmailMetrics(
  key: string,
  channel: string,
  eventRows: EventPerfRow[],
): CrmTemplateEmailMetrics | null {
  if (channel === 'sms') return null
  const prefix = `tpl:${key}:`
  const sets: Record<keyof CrmTemplateEmailMetrics, Set<string>> = {
    sent: new Set(),
    opens: new Set(),
    clicks: new Set(),
    replies: new Set(),
    unsubscribed: new Set(),
    bounces: new Set(),
  }
  const eventField: Record<string, keyof CrmTemplateEmailMetrics> = {
    sent: 'sent',
    open: 'opens',
    click: 'clicks',
    reply: 'replies',
    unsubscribe: 'unsubscribed',
    bounce: 'bounces',
  }
  for (const r of eventRows) {
    const ek = r.email_key ?? ''
    if (!ek.startsWith(prefix)) continue
    const field = eventField[r.event]
    if (field) sets[field].add(ek)
  }
  return {
    sent: sets.sent.size,
    opens: sets.opens.size,
    clicks: sets.clicks.size,
    replies: sets.replies.size,
    unsubscribed: sets.unsubscribed.size,
    bounces: sets.bounces.size,
  }
}

/** Derive the legacy rate shape from the counts (kept for existing consumers). */
export function computeTemplatePerf(
  key: string,
  channel: string,
  eventRows: EventPerfRow[],
): CrmTemplatePerf | null {
  const m = computeEmailMetrics(key, channel, eventRows)
  if (!m) return null
  return {
    sent: m.sent,
    openPct: m.sent > 0 ? Math.round((m.opens / m.sent) * 100) : null,
    clickPct: m.sent > 0 ? Math.round((m.clicks / m.sent) * 100) : null,
  }
}

type SmsSendRow = { ts: string; templateKey: string | null }

/** Compute §13.2.2 text send counts from sms_out timeline rows. Pure. */
export function computeTextMetrics(
  key: string,
  channel: string,
  smsRows: SmsSendRow[],
  now: Date = new Date(),
): CrmTemplateTextMetrics | null {
  if (channel !== 'sms') return null
  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000
  let sent30d = 0
  let sentTotal = 0
  for (const r of smsRows) {
    if (r.templateKey !== key) continue
    sentTotal++
    const t = Date.parse(r.ts)
    if (Number.isFinite(t) && t >= cutoff) sent30d++
  }
  return { sent30d, sentTotal }
}

/** Map a raw row + derived tallies to the admin shape. */
export function mapTemplateRow(
  row: RawTemplateRow,
  usage: number,
  perf: CrmTemplatePerf | null,
  extras?: {
    usedBy?: string[]
    emailMetrics?: CrmTemplateEmailMetrics | null
    textMetrics?: CrmTemplateTextMetrics | null
  },
): CrmTemplateAdmin {
  return {
    id: Number(row.id),
    key: row.key,
    channel: normalizeChannel(row.channel),
    name: row.name,
    subject: row.subject ?? null,
    previewText: row.preview_text ?? null,
    body: row.body ?? '',
    category: row.category ?? null,
    isActive: row.is_active !== false,
    isShared: row.is_shared === true,
    ownerBroker: row.owner_broker ?? null,
    featured: row.featured === true,
    createdAt: row.created_at ?? null,
    usage,
    usedBy: extras?.usedBy ?? [],
    perf,
    emailMetrics: extras?.emailMetrics ?? null,
    textMetrics: extras?.textMetrics ?? null,
  }
}

/** Page through sms_out timeline rows that carry a templateKey (sequence sends
 *  stamp it). Bounded paging — never rows.length-limited by the 1000 cap. */
async function fetchSmsSendRows(sb: ReturnType<typeof createServiceClient>): Promise<SmsSendRow[]> {
  const out: SmsSendRow[] = []
  const PAGE = 1000
  for (let page = 0; page < 20; page++) {
    const { data, error } = await sb
      .from('crm_timeline')
      .select('ts,payload')
      .eq('kind', 'sms_out')
      .not('payload->>templateKey', 'is', null)
      .order('ts', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error || !data) {
      if (error) console.error('[getCrmTemplatesAdmin] sms rows', error.message)
      break
    }
    for (const r of data as Array<{ ts: string; payload: Record<string, unknown> | null }>) {
      const tk = r.payload?.templateKey
      out.push({ ts: r.ts, templateKey: tk == null ? null : String(tk) })
    }
    if (data.length < PAGE) break
  }
  return out
}

export const getCrmTemplatesAdmin = unstable_cache(
  async (): Promise<CrmTemplateAdmin[]> => {
    const sb = createServiceClient()

    const { data: rows, error } = await sb
      .from('crm_templates')
      .select('id,key,channel,name,subject,preview_text,body,category,is_active,is_shared,owner_broker,featured,created_at')
      .order('is_active', { ascending: false })
      .order('channel', { ascending: true })
      .order('name', { ascending: true })
    if (error || !rows) {
      if (error) console.error('[getCrmTemplatesAdmin]', error.message)
      return []
    }

    const typedRows = rows as RawTemplateRow[]

    // Fetch sequences (with names for usedBy), email events, and sms sends in parallel.
    const [seqResult, evResult, smsRows] = await Promise.all([
      sb.from('crm_sequences').select('name,steps'),
      // Only fetch events whose email_key starts with 'tpl:' — these are the
      // template-send events stamped by sendCrmEmailAction. Fetching ALL events
      // would be too broad; 'tpl:%' is the correct prefix filter.
      sb
        .from('email_events')
        .select('email_key,event')
        .like('email_key', 'tpl:%'),
      fetchSmsSendRows(sb),
    ])

    const sequences = (seqResult.data ?? []) as Array<{ name?: unknown; steps: unknown }>
    const eventRows = (evResult.data ?? []) as EventPerfRow[]

    const usage = tallyTemplateUsage(
      typedRows.map((r) => r.key),
      sequences,
    )

    return typedRows.map((r) =>
      mapTemplateRow(r, usage[r.key] ?? 0, computeTemplatePerf(r.key, r.channel, eventRows), {
        usedBy: tallyTemplateUsedBy(r.key, sequences),
        emailMetrics: computeEmailMetrics(r.key, r.channel, eventRows),
        textMetrics: computeTextMetrics(r.key, r.channel, smsRows),
      }),
    )
  },
  ['crm-templates-admin-v2'],
  { revalidate: 300, tags: [CRM_TEMPLATES_ADMIN_TAG] },
)
