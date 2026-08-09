'use client'

/** A small labeled select used by most action forms. Verbatim move from
 *  BulkActions.tsx (was a private, unexported function there). */

import { SelectField } from '@/components/admin/v2'
import type { BulkPickerOption } from './types'

export function FormSelect({
  label, value, onChange, placeholder, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: BulkPickerOption[]
}) {
  return (
    <SelectField label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {/* The placeholder was shadcn's SelectValue fallback, which is not an
          option. A native select needs a real one to render an unset value, so
          it is here and DISABLED — same words, still unpickable. */}
      <option value="" disabled>{placeholder}</option>
      {options.length === 0 ? (
        <option value="__none" disabled>None available</option>
      ) : (
        options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))
      )}
    </SelectField>
  )
}

export default FormSelect
