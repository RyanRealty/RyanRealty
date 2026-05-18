'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ProducerStatus } from '@/lib/producer-catalog'

interface FilterSidebarProps {
  categories: string[]
  statuses: ProducerStatus[]
  outputTypes: string[]
  platforms: string[]
}

const STATUS_LABELS: Record<string, string> = {
  locked: 'Locked',
  draft: 'Draft',
  needs_tool: 'Needs Tool',
  needs_oauth: 'Needs OAuth',
}

export function ProducerFilterSidebar({
  categories,
  statuses,
  outputTypes,
  platforms,
}: FilterSidebarProps) {
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
    searchParams.getAll('status').length > 0 ||
    searchParams.getAll('type').length > 0 ||
    searchParams.getAll('platform').length > 0

  function clearAll() {
    router.push(pathname)
  }

  return (
    <aside className="w-56 shrink-0 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Filters</h2>
        {hasAnyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-auto px-2 py-0.5 text-xs text-muted-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Category
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

      <Separator />

      {/* Status */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Status
        </p>
        {statuses.map((st) => (
          <div key={st} className="flex items-center gap-2">
            <Checkbox
              id={`status-${st}`}
              checked={isChecked('status', st)}
              onCheckedChange={(v) => updateParam('status', st, Boolean(v))}
            />
            <Label htmlFor={`status-${st}`} className="cursor-pointer text-xs">
              {STATUS_LABELS[st] ?? st}
            </Label>
          </div>
        ))}
      </div>

      {outputTypes.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Output type
            </p>
            {outputTypes.map((ot) => (
              <div key={ot} className="flex items-center gap-2">
                <Checkbox
                  id={`type-${ot}`}
                  checked={isChecked('type', ot)}
                  onCheckedChange={(v) => updateParam('type', ot, Boolean(v))}
                />
                <Label htmlFor={`type-${ot}`} className="cursor-pointer text-xs">
                  {ot}
                </Label>
              </div>
            ))}
          </div>
        </>
      )}

      {platforms.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Platform
            </p>
            {platforms.map((pl) => (
              <div key={pl} className="flex items-center gap-2">
                <Checkbox
                  id={`platform-${pl}`}
                  checked={isChecked('platform', pl)}
                  onCheckedChange={(v) => updateParam('platform', pl, Boolean(v))}
                />
                <Label htmlFor={`platform-${pl}`} className="cursor-pointer text-xs">
                  <Badge variant="outline" className="text-xs">
                    {pl}
                  </Badge>
                </Label>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  )
}
