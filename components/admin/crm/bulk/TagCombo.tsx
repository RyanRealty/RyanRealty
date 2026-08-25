'use client'

/**
 * Tag field for the bulk add/remove-tag actions: pick a configured tag, or type
 * a new one.
 *
 * It was a plain <select> over the configured tag list, so the only tags an
 * operator could apply in bulk were the eight already in crm settings — even
 * though the worker (lib/crm/bulk-handlers/add-tag.ts) accepts any tag up to 80
 * characters, and both actions' own validate() already read "Pick or type a
 * tag". Grouping a fresh cohort meant leaving the People list, creating the tag
 * in settings, coming back, and re-selecting the rows. A datalist keeps the
 * configured tags one keystroke away and lets a new one through.
 *
 * Compliance tags are refused here as well as in the worker, so the operator is
 * told before a job is enqueued that would skip every contact in it.
 */

import { useId } from 'react'
import { TextField } from '@/components/admin/v2'
import { isProtectedComplianceTag } from '@/lib/crm/bulk-handlers/protected-tags'
import type { BulkPickerOption } from './types'

/** Normalized the same way the worker normalizes it: trimmed, lower-cased. */
export function normalizeBulkTag(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Why this tag cannot be applied, or null when it can. Mirrors the worker's
 * refusals (empty, over 80 chars, protected) so the dialog never enqueues a job
 * whose every row comes back skipped.
 */
export function bulkTagError(raw: string): string | null {
  const tag = normalizeBulkTag(raw)
  if (!tag) return 'Pick or type a tag'
  if (tag.length > 80) return 'A tag is at most 80 characters'
  if (isProtectedComplianceTag(tag)) {
    return `${tag} controls who we are allowed to contact and is never set in bulk. Change it on the contact.`
  }
  return null
}

export function TagCombo({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: BulkPickerOption[]
}) {
  const listId = useId()
  const normalized = normalizeBulkTag(value)
  const known = options.some((o) => o.key.toLowerCase() === normalized)
  const error = value.trim() ? bulkTagError(value) : null

  return (
    <>
      <TextField
        label="Tag"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder="Pick a tag, or type a new one"
        autoComplete="off"
        spellCheck={false}
        error={error ?? undefined}
        hint={!error && normalized && !known ? `New tag \u2014 it will be created as ${normalized}.` : undefined}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.key} value={o.key} label={o.label} />
        ))}
      </datalist>
    </>
  )
}

export default TagCombo
