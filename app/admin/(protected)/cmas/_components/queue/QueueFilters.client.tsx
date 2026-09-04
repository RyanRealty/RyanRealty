'use client'

/**
 * The queue's two filter rows.
 *
 * These are the locked FilterChip primitive (a <button> with aria-pressed), not
 * links wearing the chip class — the pressed style keys off aria-pressed, and
 * that attribute is only valid on something with button semantics. Navigation
 * still goes through the URL, so a filtered queue stays shareable and survives
 * a refresh; the click just pushes the route instead of following an href.
 */

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { FilterChip } from '@/components/admin/v2'

export type QueueFilterOption = { value: string; label: string; count?: number }

export function QueueFilters({
  options,
  active,
  param,
  allLabel,
  basePath,
  otherParams,
}: {
  options: QueueFilterOption[]
  active: string | undefined
  param: 'state' | 'origin'
  allLabel: string
  basePath: string
  otherParams: Record<string, string | undefined>
}) {
  const router = useRouter()

  const go = useCallback(
    (value: string | undefined) => {
      const p = new URLSearchParams()
      for (const [k, v] of Object.entries(otherParams)) if (v) p.set(k, v)
      if (value) p.set(param, value)
      else p.delete(param)
      const q = p.toString()
      router.push(q ? `${basePath}?${q}` : basePath)
    },
    [basePath, otherParams, param, router],
  )

  const isAll = !active || active === 'all'

  return (
    <div className="av2-toolbar">
      <FilterChip pressed={isAll} onClick={() => go(undefined)}>
        {allLabel}
      </FilterChip>
      {options.map((o) => (
        <FilterChip key={o.value} pressed={active === o.value} onClick={() => go(o.value)}>
          {o.label}
          {o.count == null ? '' : ` ${o.count}`}
        </FilterChip>
      ))}
    </div>
  )
}
