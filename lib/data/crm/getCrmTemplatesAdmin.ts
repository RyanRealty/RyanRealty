import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { countStepReferences } from '@/lib/crm/templateReferences'

/**
 * getCrmTemplatesAdmin — the cached reader for the templates ADMIN list.
 *
 * Distinct from the lightweight pickers getCrmEmailTemplates /
 * getCrmSmsTemplates in app/actions/crm.ts (which return only what the composer
 * needs to send). This reader returns the full editable shape the admin CRUD
 * surface renders: id, name, channel, subject, body, category, is_active, and a
 * derived `usage` count (how many live sequence steps reference the template
 * key). The usage count doubles as the delete-guard signal in the UI.
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

/** A template as the admin CRUD list consumes it. */
export type CrmTemplateAdmin = {
  id: number
  key: string
  channel: 'email' | 'sms'
  name: string
  subject: string | null
  body: string
  category: string | null
  isActive: boolean
  /** When true, visible and usable by all brokers on the team. */
  isShared: boolean
  /** Broker slug who owns this template (null for legacy/seeded templates). */
  ownerBroker: string | null
  /** Count of live sequence steps that reference this template's key. */
  usage: number
  /** Per-template email performance (null for SMS templates). */
  perf: CrmTemplatePerf | null
}

/** Cache tag the CRUD actions revalidate on every write. */
export const CRM_TEMPLATES_ADMIN_TAG = 'crm-templates-admin' as const

type RawTemplateRow = {
  id: number
  key: string
  channel: string
  name: string
  subject: string | null
  body: string
  category: string | null
  is_active: boolean
  is_shared: boolean
  owner_broker: string | null
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

/**
 * Compute per-template performance from a flat list of email_events rows.
 * Only email templates accumulate tpl: keys; SMS templates return null.
 * Pure — testable without DB.
 */
export function computeTemplatePerf(
  key: string,
  channel: string,
  eventRows: Array<{ email_key: string | null; event: string }>,
): CrmTemplatePerf | null {
  if (channel === 'sms') return null
  const prefix = `tpl:${key}:`
  const mine = eventRows.filter((r) => (r.email_key ?? '').startsWith(prefix))
  if (mine.length === 0) return { sent: 0, openPct: null, clickPct: null }
  // Group by email_key to count distinct sends, opens, clicks.
  const sends = new Set<string>()
  const opens = new Set<string>()
  const clicks = new Set<string>()
  for (const r of mine) {
    const ek = r.email_key ?? ''
    if (r.event === 'sent') sends.add(ek)
    if (r.event === 'open') opens.add(ek)
    if (r.event === 'click') clicks.add(ek)
  }
  const s = sends.size
  return {
    sent: s,
    openPct: s > 0 ? Math.round((opens.size / s) * 100) : null,
    clickPct: s > 0 ? Math.round((clicks.size / s) * 100) : null,
  }
}

/** Map a raw row + its usage count + perf to the admin shape. */
export function mapTemplateRow(
  row: RawTemplateRow,
  usage: number,
  perf: CrmTemplatePerf | null,
): CrmTemplateAdmin {
  return {
    id: Number(row.id),
    key: row.key,
    channel: normalizeChannel(row.channel),
    name: row.name,
    subject: row.subject ?? null,
    body: row.body ?? '',
    category: row.category ?? null,
    isActive: row.is_active !== false,
    isShared: row.is_shared === true,
    ownerBroker: row.owner_broker ?? null,
    usage,
    perf,
  }
}

type EventPerfRow = { email_key: string | null; event: string }

export const getCrmTemplatesAdmin = unstable_cache(
  async (): Promise<CrmTemplateAdmin[]> => {
    const sb = createServiceClient()

    const { data: rows, error } = await sb
      .from('crm_templates')
      .select('id,key,channel,name,subject,body,category,is_active,is_shared,owner_broker')
      .order('is_active', { ascending: false })
      .order('channel', { ascending: true })
      .order('name', { ascending: true })
    if (error || !rows) {
      if (error) console.error('[getCrmTemplatesAdmin]', error.message)
      return []
    }

    const typedRows = rows as RawTemplateRow[]

    // Fetch sequences and email_events in parallel.
    const [seqResult, evResult] = await Promise.all([
      sb.from('crm_sequences').select('steps'),
      // Only fetch events whose email_key starts with 'tpl:' — these are the
      // template-send events stamped by sendCrmEmailAction. Fetching ALL events
      // would be too broad; 'tpl:%' is the correct prefix filter.
      sb
        .from('email_events')
        .select('email_key,event')
        .like('email_key', 'tpl:%'),
    ])

    const sequences = (seqResult.data ?? []) as Array<{ steps: unknown }>
    const eventRows = (evResult.data ?? []) as EventPerfRow[]

    const usage = tallyTemplateUsage(
      typedRows.map((r) => r.key),
      sequences,
    )

    return typedRows.map((r) =>
      mapTemplateRow(
        r,
        usage[r.key] ?? 0,
        computeTemplatePerf(r.key, r.channel, eventRows),
      ),
    )
  },
  ['crm-templates-admin-v1'],
  { revalidate: 300, tags: [CRM_TEMPLATES_ADMIN_TAG] },
)
