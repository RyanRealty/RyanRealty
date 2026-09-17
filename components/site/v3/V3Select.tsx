/**
 * A labelled native select. The barrel already had V3Filter (text search) and
 * V3Sheet (one field per step). A filter bar needs every choice on screen at
 * once, and reaching into @/components/ui for Select is two registers on a
 * public page.
 *
 * Uncontrolled. The caller owns the name and the default so a native GET form
 * can submit without a client store.
 */
import { useId } from 'react'
import { cn } from '@/lib/utils'
import './tokens.css'
import './V3Select.css'

export type V3SelectOption = { value: string; label: string }

export type V3SelectProps = {
  name: string
  /** The field's accessible name. Visually hidden unless `showLabel`. */
  label: string
  options: readonly V3SelectOption[]
  defaultValue?: string
  required?: boolean
  /** Print the label above the field instead of hiding it. */
  showLabel?: boolean
  className?: string
  id?: string
}

export function V3Select({
  name,
  label,
  options,
  defaultValue,
  required,
  showLabel = true,
  className,
  id: idProp,
}: V3SelectProps) {
  const uid = useId()
  const id = idProp ?? uid
  return (
    <div className={cn('v3-select', className)}>
      <label htmlFor={id} className={showLabel ? 'v3-select__label' : 'v3-select__label--hidden'}>
        {label}
      </label>
      <div className="v3-select__wrap">
        <select
          id={id}
          name={name}
          required={required}
          defaultValue={defaultValue}
          className="v3-select__field"
        >
          {options.map((option) => (
            <option key={`${option.value}:${option.label}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
