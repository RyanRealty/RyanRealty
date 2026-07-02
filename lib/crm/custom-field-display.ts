/**
 * Custom-field display helper (the FUB person-record custom-field section).
 *
 * Turns the contact's free-form `crm_people.custom` jsonb bag plus the typed
 * field registry (getCrmFieldDefinitions) into the grouped, ordered, formatted
 * rows the CustomFieldsPanel renders. Pure — no DB, no React — so the grouping
 * + per-type formatting is unit-tested in isolation and the card just maps the
 * result.
 *
 * Rules honored here (parity with the FUB person record):
 *   - hideIfEmpty: a field with no usable value is omitted.
 *   - position order: fields render in registry position, then label.
 *   - field_group: rows are bucketed by group; ungrouped fields fall into a
 *     single trailing bucket.
 *   - per-type formatting: number -> tabular string, date -> formatDate,
 *     select -> the option LABEL (not the stored value), text -> trimmed text.
 *
 * The value coercion itself lives in getCrmFieldValue (the single source of
 * truth shared with the saved-view filter); this helper only formats the
 * already-coerced value for display.
 */
import { formatDate } from '@/lib/format/date'
import {
  getCrmFieldValue,
  type CrmFieldDefinition,
} from '@/lib/data/crm/getCrmFieldDefinitions'

/** A single field ready to render: its label + the display string for its value. */
export type CustomFieldDisplayRow = {
  key: string
  label: string
  type: CrmFieldDefinition['type']
  /** Pre-formatted display string for the value (never empty — empties are dropped). */
  display: string
  /** Whether the value column should carry tabular numerals (number/date). */
  tabular: boolean
}

/** A named bucket of fields. `group` is null for ungrouped fields. */
export type CustomFieldGroup = {
  group: string | null
  rows: CustomFieldDisplayRow[]
}

/**
 * Humanize a raw custom-bag key into a display label when no definition
 * supplies one. Strips the FUB `custom` prefix and splits camelCase / snake_case
 * into Title Case words: `customSellerPropertyAddress` → "Seller Property
 * Address", `customYearBuilt` → "Year Built". Pure — exported for the test.
 *
 * This is the SAME transform the mobile Info tab already applied, lifted here so
 * desktop + mobile humanize undefined keys identically.
 */
export function humanizeCustomKey(key: string): string {
  const stripped = key.replace(/^custom/, '')
  const spaced = stripped
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
  if (!spaced) return key
  return spaced
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

/**
 * Format an arbitrary raw value (a key with NO definition) for display. Numbers
 * render locale-grouped, everything else is coerced to a trimmed string. Returns
 * null for empty / unusable values so they can be dropped. Pure.
 */
function formatUndefinedValue(raw: unknown): { display: string; tabular: boolean } | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { display: raw.toLocaleString('en-US'), tabular: true } : null
  }
  if (typeof raw === 'boolean') return { display: raw ? 'Yes' : 'No', tabular: false }
  if (typeof raw === 'object') {
    try {
      const s = JSON.stringify(raw)
      return s && s !== '{}' && s !== '[]' ? { display: s, tabular: false } : null
    } catch {
      return null
    }
  }
  const s = String(raw).trim()
  return s.length > 0 ? { display: s, tabular: false } : null
}

/** Trailing group name for populated custom keys that have no typed definition. */
export const UNDEFINED_FIELD_GROUP = 'Enrichment data' as const

/** Sort key the display order uses: position ascending, then label A→Z. */
function comparePosition(a: CrmFieldDefinition, b: CrmFieldDefinition): number {
  if (a.position !== b.position) return a.position - b.position
  return a.label.localeCompare(b.label)
}

/**
 * Format a coerced custom value for display, by field type.
 *   - number -> locale-grouped string (the card adds tabular-nums)
 *   - date   -> formatDate (brand timezone, "Jun 22, 2026")
 *   - select -> the matching option label, falling back to the raw value
 *   - text   -> the value as-is
 * Returns null when there is nothing to show (so hideIfEmpty can drop the row).
 * Pure — exported for the test.
 */
export function formatCustomFieldDisplay(
  def: CrmFieldDefinition,
  value: string | number | null,
): string | null {
  if (value === null) return null

  switch (def.type) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return null
      return value.toLocaleString('en-US')
    }
    case 'date': {
      // getCrmFieldValue hands us a date-only YYYY-MM-DD string. Render it in
      // UTC so the brand-timezone offset never shifts the day backward (a PT
      // render of UTC-midnight would show the prior calendar day).
      const s = formatDate(value, { timeZone: 'UTC' })
      // formatDate returns the em-dash placeholder for unparseable input; treat
      // that as "no value" rather than rendering a lone dash as a real value.
      return s === '—' ? null : s
    }
    case 'select': {
      const s = String(value)
      const opt = def.options.find((o) => o.value === s)
      return opt ? opt.label : s
    }
    case 'text':
    default: {
      const s = String(value).trim()
      return s.length > 0 ? s : null
    }
  }
}

/**
 * Group + format the contact's custom fields for the record card.
 *
 * Walks the definitions in display order, coerces each value off the custom bag,
 * formats it by type, drops hideIfEmpty fields with no value, and buckets the
 * survivors by field_group (preserving first-seen group order, ungrouped last).
 * Pure — exported and unit-tested.
 */
export function groupAndFormat(
  custom: Record<string, unknown> | null | undefined,
  defs: CrmFieldDefinition[],
): CustomFieldGroup[] {
  const ordered = [...defs].sort(comparePosition)

  // Preserve first-seen group order; ungrouped (null) collects at the end.
  const order: (string | null)[] = []
  const buckets = new Map<string | null, CustomFieldDisplayRow[]>()

  for (const def of ordered) {
    const raw = getCrmFieldValue(custom, def)
    const display = formatCustomFieldDisplay(def, raw)

    // A person's custom-field card shows POPULATED fields only (FUB parity):
    // a typed field with no value for this contact is omitted, never rendered
    // as an em-dash placeholder. The registry has ~40 typed definitions the
    // FUB import never populated (their keys are unprefixed while the imported
    // data is `custom`-prefixed), so rendering blanks buried the real values
    // under a wall of dashes. The field still exists in the registry / editor
    // — it just doesn't clutter a contact who has no value for it.
    if (display === null) continue

    const group = def.fieldGroup
    if (!buckets.has(group)) {
      buckets.set(group, [])
      order.push(group)
    }
    buckets.get(group)!.push({
      key: def.key,
      label: def.label,
      type: def.type,
      display: display ?? '—',
      tabular: def.type === 'number' || def.type === 'date',
    })
  }

  // ── Fallback: populated custom keys with NO typed definition ────────────────
  // The FUB-imported enrichment bag uses `custom`-prefixed keys
  // (customYearBuilt, customSubdivision, customSellerPropertyAddress, …) that
  // the definition registry never declared. Walking definitions alone drops
  // ALL of that data (the display regression Matt hit — a contact showed "just
  // names"). Render every remaining populated key as a humanized text row in a
  // trailing "Enrichment data" bucket so nothing is silently invisible.
  const definedKeys = new Set(defs.map((d) => d.key))
  if (custom && typeof custom === 'object') {
    const undefinedRows: CustomFieldDisplayRow[] = []
    for (const key of Object.keys(custom)) {
      if (definedKeys.has(key)) continue
      const formatted = formatUndefinedValue((custom as Record<string, unknown>)[key])
      if (!formatted) continue
      undefinedRows.push({
        key,
        label: humanizeCustomKey(key),
        type: 'text',
        display: formatted.display,
        tabular: formatted.tabular,
      })
    }
    if (undefinedRows.length > 0) {
      undefinedRows.sort((a, b) => a.label.localeCompare(b.label))
      if (!buckets.has(UNDEFINED_FIELD_GROUP)) {
        buckets.set(UNDEFINED_FIELD_GROUP, [])
        order.push(UNDEFINED_FIELD_GROUP)
      }
      buckets.get(UNDEFINED_FIELD_GROUP)!.push(...undefinedRows)
    }
  }

  // null group always renders last; the Enrichment-data bucket renders just
  // before it (after every typed group).
  const sortedOrder = [...order].sort((a, b) => {
    if (a === b) return 0
    if (a === null) return 1
    if (b === null) return -1
    if (a === UNDEFINED_FIELD_GROUP) return 1
    if (b === UNDEFINED_FIELD_GROUP) return -1
    return 0
  })

  return sortedOrder
    .map((group) => ({ group, rows: buckets.get(group) ?? [] }))
    .filter((g) => g.rows.length > 0)
}
