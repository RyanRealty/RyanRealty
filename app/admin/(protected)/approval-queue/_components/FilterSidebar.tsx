'use client'

/**
 * FilterSidebar — the approval queue's URL-backed filter set.
 *
 * 11F: off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — the URL params, the
 * append/remove logic in updateParam, the checked test and clearAll are
 * carried over verbatim, and every visible string is unchanged.
 *
 * Mapping: Checkbox + Label -> ToolbarCheck (the primitive's own <label> wraps
 * its <input>, so the control keeps a real accessible name without a separate
 * htmlFor); Separator -> a 1px var(--a-border) rule; Button -> the v2 Button in
 * the quiet variant, which carries the hover the shadcn ghost had.
 *
 * The Button's size overrides are INLINE, not Tailwind classes: admin-v2.css is
 * un-layered, so `.av2-btn { padding:0 14px; min-height:36px }` outranks the
 * whole Tailwind utilities layer and a `px-2 py-0.5` would have rendered as
 * nothing at all.
 *
 * The per-option `id`s are kept even though the wrapping label no longer needs
 * them: an id is a handle, and dropping one costs nothing to keep.
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Button, ToolbarCheck } from '@/components/admin/v2'

interface FilterSidebarProps {
  categories: string[]
  actionTypePrefixes: string[]
}

const URGENCY_OPTIONS = [
  { value: 'high', label: 'High priority (80+)' },
  { value: 'medium', label: 'Medium (40-79)' },
  { value: 'low', label: 'Low (0-39)' },
]

/** Section caption above each filter group. */
const GROUP_LABEL_STYLE = {
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--a-text-2)',
} as const

function Rule() {
  return <div aria-hidden style={{ height: 1, background: 'var(--a-border)' }} />
}

export function FilterSidebar({ categories, actionTypePrefixes }: FilterSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string, checked: boolean) => {
      const params = new URLSearchParams(searchParams.toString())
      const current = params.getAll(key)
      if (checked) {
        if (!current.includes(value)) params.append(key, value)
      } else {
        const next = current.filter((v) => v !== value)
        params.delete(key)
        next.forEach((v) => params.append(key, v))
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const isChecked = (key: string, value: string) => searchParams.getAll(key).includes(value)

  const hasAnyFilter =
    searchParams.getAll('cat').length > 0 ||
    searchParams.getAll('prefix').length > 0 ||
    searchParams.getAll('urgency').length > 0

  function clearAll() {
    router.push(pathname)
  }

  return (
    <aside className="w-52 shrink-0 space-y-5">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' }}>
          Filters
        </h2>
        {hasAnyFilter && (
          <Button
            variant="quiet"
            onClick={clearAll}
            style={{ minHeight: 0, padding: '2px 8px', fontSize: 'var(--a-text-xs)' }}
          >
            Clear
          </Button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="space-y-2">
          <p style={GROUP_LABEL_STYLE}>Producer category</p>
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <ToolbarCheck
                id={`cat-${cat}`}
                label={cat}
                checked={isChecked('cat', cat)}
                onChange={(e) => updateParam('cat', cat, e.target.checked)}
              />
            </div>
          ))}
        </div>
      )}

      <Rule />

      <div className="space-y-2">
        <p style={GROUP_LABEL_STYLE}>Action type</p>
        {actionTypePrefixes.map((prefix) => (
          <div key={prefix} className="flex items-center gap-2">
            <ToolbarCheck
              id={`prefix-${prefix}`}
              label={`${prefix}:*`}
              checked={isChecked('prefix', prefix)}
              onChange={(e) => updateParam('prefix', prefix, e.target.checked)}
            />
          </div>
        ))}
      </div>

      <Rule />

      <div className="space-y-2">
        <p style={GROUP_LABEL_STYLE}>Urgency</p>
        {URGENCY_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-2">
            <ToolbarCheck
              id={`urgency-${opt.value}`}
              label={opt.label}
              checked={isChecked('urgency', opt.value)}
              onChange={(e) => updateParam('urgency', opt.value, e.target.checked)}
            />
          </div>
        ))}
      </div>
    </aside>
  )
}
