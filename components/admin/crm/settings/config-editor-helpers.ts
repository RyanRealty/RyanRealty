/**
 * Pure helpers for the CRM settings editor islands (Wave 2).
 *
 * Extracted out of the 'use client' components so they are unit-testable in
 * isolation (vitest scans lib + components for *.test.ts) and shared across the
 * generic ConfigTableEditor, the TagTaxonomyEditor, and the CustomFieldEditor.
 * No React, no DOM — just data transforms.
 */

export type ConfigEditorOption = { value: string; label: string }

/**
 * Move one id one step in an ordered list, producing the new full order. Returns
 * null when the move is a no-op (the id is absent or already at the edge in that
 * direction). The reorder action takes the returned full ordered id list.
 */
export function moveInList(ids: number[], id: number, dir: -1 | 1): number[] | null {
  const idx = ids.indexOf(id)
  if (idx < 0) return null
  const swap = idx + dir
  if (swap < 0 || swap >= ids.length) return null
  const next = [...ids]
  ;[next[idx], next[swap]] = [next[swap], next[idx]]
  return next
}

/**
 * Parse the custom-field options textarea (one "value" or "value|Label" per line)
 * into a clean option list. Blank lines and value-less lines are dropped; the
 * label defaults to the value. Matches the server's option-normalization contract
 * (a select field needs at least one option, validated server-side too).
 */
export function parseOptions(text: string): ConfigEditorOption[] {
  const out: ConfigEditorOption[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const [value, ...rest] = line.split('|')
    const v = value.trim()
    if (!v) continue
    const label = rest.join('|').trim() || v
    out.push({ value: v, label })
  }
  return out
}

/**
 * Render an option list back to the textarea form (one "value|Label" per line, or
 * just "value" when the label matches the value). Round-trips with parseOptions.
 */
export function serializeOptions(options: ConfigEditorOption[]): string {
  return options.map((o) => (o.label && o.label !== o.value ? `${o.value}|${o.label}` : o.value)).join('\n')
}

/** Capitalize the first letter of a noun for inline copy. */
export function capitalizeNoun(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s
}
