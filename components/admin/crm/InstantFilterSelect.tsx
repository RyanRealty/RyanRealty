'use client'

/**
 * Instant URL-param filter for the contacts list — picking a value navigates
 * immediately (no "Apply" button). Preserves the other active filters passed in
 * `carry` and resets pagination. Uses useRouter (no Suspense boundary needed).
 */
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export default function InstantFilterSelect({
  paramName,
  current,
  options,
  carry,
  allLabel = 'All',
  allValue = 'all',
  basePath = '/admin/crm',
  className,
  'aria-label': ariaLabel,
}: {
  paramName: string
  /** Current value, or empty/allValue for "no filter". */
  current: string
  options: Array<{ value: string; label: string }>
  /** Other active filters to keep in the URL. */
  carry: Record<string, string | undefined>
  allLabel?: string
  allValue?: string
  basePath?: string
  className?: string
  'aria-label'?: string
}) {
  const router = useRouter()

  function onChange(v: string) {
    const params = new URLSearchParams()
    for (const [k, val] of Object.entries(carry)) if (val) params.set(k, val)
    if (v && v !== allValue) params.set(paramName, v)
    const qs = params.toString()
    router.push(`${basePath}${qs ? `?${qs}` : ''}`)
  }

  return (
    <Select value={current || allValue} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel} className={cn('h-10 w-full', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allValue}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
