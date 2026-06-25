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
  /** Count of live sequence steps that reference this template's key. */
  usage: number
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

/** Map a raw row + its usage count to the admin shape. */
export function mapTemplateRow(row: RawTemplateRow, usage: number): CrmTemplateAdmin {
  return {
    id: Number(row.id),
    key: row.key,
    channel: normalizeChannel(row.channel),
    name: row.name,
    subject: row.subject ?? null,
    body: row.body ?? '',
    category: row.category ?? null,
    isActive: row.is_active !== false,
    usage,
  }
}

export const getCrmTemplatesAdmin = unstable_cache(
  async (): Promise<CrmTemplateAdmin[]> => {
    const sb = createServiceClient()

    const { data: rows, error } = await sb
      .from('crm_templates')
      .select('id,key,channel,name,subject,body,category,is_active')
      .order('is_active', { ascending: false })
      .order('channel', { ascending: true })
      .order('name', { ascending: true })
    if (error || !rows) {
      if (error) console.error('[getCrmTemplatesAdmin]', error.message)
      return []
    }

    // One read of all sequences to derive usage, instead of N per-template reads.
    const { data: seqRows } = await sb.from('crm_sequences').select('steps')
    const sequences = (seqRows ?? []) as Array<{ steps: unknown }>

    const typedRows = rows as RawTemplateRow[]
    const usage = tallyTemplateUsage(
      typedRows.map((r) => r.key),
      sequences,
    )

    return typedRows.map((r) => mapTemplateRow(r, usage[r.key] ?? 0))
  },
  ['crm-templates-admin-v1'],
  { revalidate: 300, tags: [CRM_TEMPLATES_ADMIN_TAG] },
)
