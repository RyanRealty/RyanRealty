'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'

interface FilterSidebarProps {
  categories: string[]
  actionTypePrefixes: string[]
}

const URGENCY_OPTIONS = [
  { value: 'high', label: 'High priority (80+)' },
  { value: 'medium', label: 'Medium (40-79)' },
  { value: 'low', label: 'Low (0-39)' },
]

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
        <h2 className="text-sm font-semibold text-foreground">Filters</h2>
        {hasAnyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-auto px-2 py-0.5 text-xs text-muted-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Producer category
          </p>
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${cat}`}
                checked={isChecked('cat', cat)}
                onCheckedChange={(v) => updateParam('cat', cat, Boolean(v))}
              />
              <Label htmlFor={`cat-${cat}`} className="cursor-pointer text-xs">
                {cat}
              </Label>
            </div>
          ))}
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Action type
        </p>
        {actionTypePrefixes.map((prefix) => (
          <div key={prefix} className="flex items-center gap-2">
            <Checkbox
              id={`prefix-${prefix}`}
              checked={isChecked('prefix', prefix)}
              onCheckedChange={(v) => updateParam('prefix', prefix, Boolean(v))}
            />
            <Label htmlFor={`prefix-${prefix}`} className="cursor-pointer text-xs">
              {prefix}:*
            </Label>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Urgency
        </p>
        {URGENCY_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-2">
            <Checkbox
              id={`urgency-${opt.value}`}
              checked={isChecked('urgency', opt.value)}
              onCheckedChange={(v) => updateParam('urgency', opt.value, Boolean(v))}
            />
            <Label htmlFor={`urgency-${opt.value}`} className="cursor-pointer text-xs">
              {opt.label}
            </Label>
          </div>
        ))}
      </div>
    </aside>
  )
}
