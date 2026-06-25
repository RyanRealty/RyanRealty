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

    // hideIfEmpty drops fields with no usable value. A field that is NOT
    // hideIfEmpty but still has no value renders an em-dash placeholder so the
    // card shows the field exists.
    if (display === null && def.hideIfEmpty) continue

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

  // null group always renders last regardless of when it was first seen.
  const sortedOrder = [...order].sort((a, b) => {
    if (a === b) return 0
    if (a === null) return 1
    if (b === null) return -1
    return 0
  })

  return sortedOrder
    .map((group) => ({ group, rows: buckets.get(group) ?? [] }))
    .filter((g) => g.rows.length > 0)
}
