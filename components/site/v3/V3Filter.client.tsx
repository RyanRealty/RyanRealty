'use client'
/**
 * A labelled text filter over a list already on the page.
 *
 * WHY IT IS AN ATOM. Nothing search-shaped left the barrel: V3Sheet and V3Ask
 * own fields but only as a step in a form, and the Atlas search is an internal
 * wrapper around its own input. So the index pages reached into
 * @/components/ui for shadcn's Input and Label, which is two registers on one
 * public page — the defect §3 exists to end. This is the pressure valve the
 * barrel header describes: the set was missing a control, so the control is
 * here.
 *
 * Controlled. The caller owns the query, because the caller owns what the query
 * filters and has to keep that state when the view around it changes.
 */
import { useId } from 'react'
import { cn } from '@/lib/utils'
import './tokens.css'
import './V3Filter.css'

export type V3FilterProps = {
  /** The field's accessible name. Visually hidden unless `showLabel`. */
  label: string
  /** Shown inside the field before the visitor types. */
  placeholder?: string
  value: string
  onValueChange: (value: string) => void
  /** Print the label above the field instead of hiding it. */
  showLabel?: boolean
  className?: string
}

export function V3Filter({
  label,
  placeholder,
  value,
  onValueChange,
  showLabel = false,
  className,
}: V3FilterProps) {
  const id = useId()
  return (
    <div className={cn('v3-filter', className)}>
      <label htmlFor={id} className={showLabel ? 'v3-filter__label' : 'v3-filter__label--hidden'}>
        {label}
      </label>
      <input
        id={id}
        // type=search so a phone keyboard offers the right return key and the
        // browser draws its own clear affordance.
        type="search"
        className="v3-filter__field"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  )
}
