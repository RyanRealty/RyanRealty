import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * CRM custom-field registry reader (the schema layer over crm_people.custom).
 *
 * crm_people.custom is a free-form jsonb bag (carried from FUB). This reader
 * returns the typed definitions that tell the contact card + the saved-view
 * AST custom-condition builder how to render, label, order, and coerce each
 * value pulled off that bag. The raw .from() read lives here per the DAL
 * boundary (G1); UI/actions consume getCrmFieldDefinitions(), never the table.
 *
 * Cached on the crm-field-definitions tag (24h window — the registry changes
 * only when an admin edits it; the CRUD action revalidates the tag on write).
 */

/** The value types the registry supports for a custom field. */
export const CRM_FIELD_TYPES = ['text', 'number', 'date', 'select'] as const
export type CrmFieldType = (typeof CRM_FIELD_TYPES)[number]

/** One option for a select-typed field. */
export type CrmFieldOption = { value: string; label: string }

/** A single typed custom-field definition as the UI consumes it. */
export type CrmFieldDefinition = {
  id: number
  key: string
  label: string
  type: CrmFieldType
  options: CrmFieldOption[]
  position: number
  hideIfEmpty: boolean
  readOnly: boolean
  fieldGroup: string | null
  isProtected: boolean
}

/** The cache tag for the registry. The CRUD action revalidates this on write. */
export const CRM_FIELD_DEFINITIONS_TAG = 'crm-field-definitions' as const

/** Coerce an arbitrary stored type value to a valid CrmFieldType (default text). */
export function normalizeFieldType(value: unknown): CrmFieldType {
  return value === 'text' || value === 'number' || value === 'date' || value === 'select'
    ? value
    : 'text'
}

/**
 * Coerce a raw options jsonb value to a clean CrmFieldOption[]. Drops anything
 * that is not a { value, label } pair of strings. Pure — exported for the test.
 */
export function normalizeFieldOptions(value: unknown): CrmFieldOption[] {
  if (!Array.isArray(value)) return []
  const out: CrmFieldOption[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as { value?: unknown; label?: unknown }
    if (typeof o.value !== 'string') continue
    const label = typeof o.label === 'string' && o.label.length > 0 ? o.label : o.value
    out.push({ value: o.value, label })
  }
  return out
}

/**
 * Map a DB row to the typed definition shape. Pure — exported so the mapping is
 * unit-tested without touching the DB.
 */
export function mapFieldDefinitionRow(row: {
  id?: unknown
  key?: unknown
  label?: unknown
  type?: unknown
  options?: unknown
  position?: unknown
  hide_if_empty?: unknown
  read_only?: unknown
  field_group?: unknown
  is_protected?: unknown
}): CrmFieldDefinition {
  return {
    id: Number(row.id),
    key: typeof row.key === 'string' ? row.key : '',
    label: typeof row.label === 'string' ? row.label : '',
    type: normalizeFieldType(row.type),
    options: normalizeFieldOptions(row.options),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : 0,
    hideIfEmpty: row.hide_if_empty === true,
    readOnly: row.read_only === true,
    fieldGroup: typeof row.field_group === 'string' ? row.field_group : null,
    isProtected: row.is_protected === true,
  }
}

/**
 * Coerce a raw value read off a crm_people.custom jsonb bag into the shape the
 * registry's type prescribes. Pure — the single source of truth for how a stored
 * custom value is interpreted, so the card render and the saved-view filter agree.
 *
 *   - number → finite number, or null when the stored value is not numeric
 *   - date   → an ISO date string (YYYY-MM-DD) when parseable, else null
 *   - select → the stored value as a string IF it matches a defined option,
 *              else null (a stale option is never rendered as a live value)
 *   - text   → the stored value coerced to a trimmed string, or null when empty
 *
 * null means "no usable value" — the card treats it as empty (and hideIfEmpty
 * can drop the row). Never throws.
 */
export function getCrmFieldValue(
  custom: Record<string, unknown> | null | undefined,
  def: Pick<CrmFieldDefinition, 'key' | 'type' | 'options'>,
): string | number | null {
  if (!custom || typeof custom !== 'object') return null
  const raw = (custom as Record<string, unknown>)[def.key]
  if (raw === null || raw === undefined) return null

  switch (def.type) {
    case 'number': {
      if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
      // Guard empty/whitespace-only strings: Number('') is 0, not NaN, which
      // would render a phantom zero for a field the contact never had.
      const s = String(raw).trim()
      if (!s) return null
      const n = Number(s)
      return Number.isFinite(n) ? n : null
    }
    case 'date': {
      const s = String(raw).trim()
      if (!s) return null
      const t = Date.parse(s)
      if (Number.isNaN(t)) return null
      // Normalize to YYYY-MM-DD (date-only). Build from UTC parts so the day is
      // stable regardless of the server timezone.
      const d = new Date(t)
      const yyyy = d.getUTCFullYear()
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(d.getUTCDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    case 'select': {
      const s = String(raw).trim()
      if (!s) return null
      const allowed = def.options.some((o) => o.value === s)
      return allowed ? s : null
    }
    case 'text':
    default: {
      const s = String(raw).trim()
      return s.length > 0 ? s : null
    }
  }
}

/**
 * Every custom-field definition, ordered by position then label. Cached.
 * The contact card Details section and the saved-view AST custom-condition
 * builder render from this.
 */
export const getCrmFieldDefinitions = unstable_cache(
  async (): Promise<CrmFieldDefinition[]> => {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_field_definitions')
      .select('id,key,label,type,options,position,hide_if_empty,read_only,field_group,is_protected')
      .order('position', { ascending: true })
      .order('label', { ascending: true })
    if (error) {
      console.error('[getCrmFieldDefinitions]', error.message)
      return []
    }
    return (data ?? []).map(mapFieldDefinitionRow)
  },
  ['crm-field-definitions'],
  { tags: [CRM_FIELD_DEFINITIONS_TAG], revalidate: 86400 },
)
