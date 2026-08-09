'use client'

/**
 * TemplatePicker — searchable template selector.
 *
 * On selection it calls onSelect(key) — callers push the key into the page URL
 * (?tpl= or ?smsTpl=) so the server re-renders with the resolved template body,
 * exactly as the old <Select name="tpl"> + Load-button form did.
 *
 * The blank option ("Blank <channel>") always appears first, then every
 * template in category order (a blank/null category falls under
 * "Uncategorized", which sorts last).
 *
 * Props:
 *   templates   — flat list from getCrmEmailTemplates / getCrmSmsTemplates +
 *                 an optional `category` field (provided when the component is
 *                 used from the admin settings page; on the lead console the
 *                 picker receives the lightweight composer shape which may not
 *                 have category — everything then falls in one group)
 *   channel     — 'email' | 'sms' (used only for the "Blank" label)
 *   currentKey  — the currently selected key ('blank' or a template key)
 *   onSelect    — called with the chosen key
 *   className   — forwarded to the picker's container
 *
 * ── Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY: the exported name, every prop, the blank-first ordering,
 * the category sort and the onSelect contract are what they were.
 *
 * The cmdk Command palette inside a Popover became the barrel's Combobox, which
 * is the primitive built for exactly this ("a searchable single-select", and
 * its own docstring names a template picker as the case that motivated it). Two
 * consequences, both deliberate:
 *  - cmdk's <CommandGroup heading> rows are gone, because Combobox's option
 *    list is flat. The GROUPING is not: options are emitted in the same
 *    category order, and each option's hint line carries `subject · category`,
 *    so the category still reads on the row AND still matches the search the
 *    way cmdk's concatenated value did (name + subject + category).
 *  - the trigger button that displayed the loaded template is now the input's
 *    placeholder. One control replaces two, and the loaded template is what it
 *    shows; the old "Search N templates…" hint has no second slot to live in.
 */
import { Combobox, type ComboboxOption } from '@/components/admin/v2'

export type PickerTemplate = {
  key: string
  name: string
  subject?: string | null
  category?: string | null
}

const BLANK_KEY = 'blank'

function categoryOf(t: PickerTemplate): string {
  return (t.category ?? '').trim() || 'Uncategorized'
}

export function TemplatePicker({
  templates,
  channel,
  currentKey,
  onSelect,
  className,
}: {
  templates: PickerTemplate[]
  channel: 'email' | 'sms'
  currentKey: string | null | undefined
  onSelect: (key: string) => void
  className?: string
}) {
  const active =
    currentKey === BLANK_KEY || !currentKey
      ? null
      : templates.find((t) => t.key === currentKey) ?? null

  // Group templates by category, preserving insertion order within each group.
  const grouped = new Map<string, PickerTemplate[]>()
  for (const t of templates) {
    const cat = categoryOf(t)
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(t)
  }
  const categories = [...grouped.keys()].sort((a, b) =>
    a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b),
  )

  // Blank option always first, then the categories in order — the same
  // sequence the CommandGroups rendered in.
  const options: ComboboxOption[] = [
    { value: BLANK_KEY, label: `Blank ${channel}` },
    ...categories.flatMap((cat) =>
      (grouped.get(cat) ?? []).map((t) => ({
        value: t.key,
        label: t.name,
        // Fed to the local filter as well as shown — the cmdk filter matched on
        // name + subject + category, and so does this.
        hint: [(t.subject ?? '').trim(), cat].filter(Boolean).join(' · '),
      })),
    ),
  ]

  return (
    <div className={className}>
      <Combobox
        label="Template"
        options={options}
        value={currentKey ?? BLANK_KEY}
        onSelect={onSelect}
        placeholder={active ? active.name : `Blank ${channel}`}
        emptyText="No templates match."
        // Every template stays reachable; the old palette had no cap either.
        maxVisible={options.length}
      />
    </div>
  )
}
