'use client'

/**
 * FUB-style inline editable Select. Lives inside a server-action <form>; picking
 * a value submits the form immediately (change = saved), so the row needs no
 * explicit "Save" button — matching the Follow Up Boss inline-edit pattern. The
 * shadcn Select renders a hidden native input from `name`, so the submitted
 * FormData carries the chosen value; we defer requestSubmit() one tick so that
 * hidden input has committed the new value first.
 */
import { useRef } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export default function AutoSubmitSelect({
  name,
  defaultValue,
  placeholder,
  options,
  className,
  'aria-label': ariaLabel,
}: {
  name: string
  defaultValue?: string
  placeholder?: string
  options: Array<{ value: string; label: string }>
  className?: string
  'aria-label'?: string
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  function submit() {
    const form = triggerRef.current?.closest('form')
    if (form) setTimeout(() => form.requestSubmit(), 0)
  }

  return (
    <Select
      name={name}
      defaultValue={defaultValue}
      onValueChange={(v) => {
        if (v !== defaultValue) submit()
      }}
    >
      <SelectTrigger
        ref={triggerRef}
        aria-label={ariaLabel}
        className={cn('h-8 w-auto gap-1 border-0 bg-transparent px-1 text-sm font-medium text-foreground shadow-none focus:ring-0', className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
