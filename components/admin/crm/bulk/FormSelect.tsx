'use client'

/** A small labeled select used by most action forms. Verbatim move from
 *  BulkActions.tsx (was a private, unexported function there). */

import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
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
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 md:h-9">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__none" disabled>None available</SelectItem>
          ) : (
            options.map((o) => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

export default FormSelect
