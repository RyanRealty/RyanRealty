'use client'

/**
 * Lightweight registry filter chrome shared by SearchFilters + SearchFilterBar.
 *
 * Kept OUT of AllFiltersSheet so the heavy sheet can be dynamically imported
 * without pulling ~1k LOC of field widgets into the cold search chunk (SEARCH_UX_WAVE3 P6).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { SEARCH_FIELDS, type SearchFieldDef } from '@/lib/search/field-registry'
import { propertySubTypeDisplayLabel } from '@/lib/property-type'
import { describeParsedSearch } from '@/lib/parse-search-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'

type ParamReader = { get(name: string): string | null }

/** Resolve the URL param names a range field reads (either side may be absent). */
export function rangeParamPair(def: SearchFieldDef): { min?: string; max?: string } {
  if (def.kind !== 'range') return {}
  if (def.legacyParams) return { min: def.legacyParams.min, max: def.legacyParams.max }
  return { min: `${def.key}Min`, max: `${def.key}Max` }
}

function formatUsdShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function formatRangeValue(def: SearchFieldDef, raw: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  if (def.unit === 'usd' || def.unit === 'usdMonth') return formatUsdShort(n)
  return n.toLocaleString()
}

const RANGE_CHIP_SUFFIX: Record<string, string> = {
  sqft: ' sq ft',
  acres: ' acres',
  days: ' days',
}

export type ActiveRegistryFilter = { key: string; label: string; params: string[] }

/**
 * Enumerate every registry field active in the given params, with a
 * human-readable chip label and the URL params to clear on remove.
 */
export function activeRegistryFilters(source: ParamReader | null | undefined): ActiveRegistryFilter[] {
  if (!source) return []
  const out: ActiveRegistryFilter[] = []
  for (const def of SEARCH_FIELDS) {
    if (def.kind === 'boolean') {
      if (source.get(def.key) === '1') out.push({ key: def.key, label: def.label, params: [def.key] })
      continue
    }
    if (def.kind === 'multi') {
      const raw = source.get(def.key)
      if (!raw) continue
      const values = raw.split(',').map((v) => v.trim()).filter(Boolean)
      if (values.length === 0) continue
      const extra = values.length > 1 ? ` +${values.length - 1}` : ''
      const first =
        def.key === 'propertySubTypes' ? propertySubTypeDisplayLabel(values[0]) : values[0]
      out.push({ key: def.key, label: `${def.label}: ${first}${extra}`, params: [def.key] })
      continue
    }
    if (def.kind === 'text') {
      const raw = source.get(def.key)?.trim()
      if (!raw) continue
      out.push({
        key: def.key,
        label: def.key === 'keywords' ? `"${raw}"` : `${def.label}: ${raw}`,
        params: [def.key],
      })
      continue
    }
    const { min, max } = rangeParamPair(def)
    const minRaw = min ? source.get(min) : null
    const maxRaw = max ? source.get(max) : null
    if (!minRaw && !maxRaw) continue
    const suffix = RANGE_CHIP_SUFFIX[def.unit ?? ''] ?? ''
    let label: string
    if (minRaw && maxRaw) {
      label = `${def.label}: ${formatRangeValue(def, minRaw)} to ${formatRangeValue(def, maxRaw)}${suffix}`
    } else if (minRaw) {
      label = `${def.label}: ${formatRangeValue(def, minRaw)}+${suffix}`
    } else {
      label = `${def.label}: up to ${formatRangeValue(def, maxRaw as string)}${suffix}`
    }
    out.push({ key: def.key, label, params: [min, max].filter((p): p is string => Boolean(p)) })
  }
  return out
}

/** Removable active-filter chip, shared by both filter bars. */
export function RegistryFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="default" className="inline-flex h-auto items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums">
      {label}
      {/* size-6 (24px) hit target per WCAG 2.5.8; negative margin keeps the
          chip's visual height unchanged (W-UI a11y finding 2026-07-30). */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove filter: ${label}`}
        onClick={onRemove}
        className="-my-1.5 -mr-1 ml-0.5 size-6 rounded-full p-0 text-primary-foreground/70 hover:bg-transparent hover:text-primary-foreground"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3" aria-hidden />
      </Button>
    </Badge>
  )
}

/** Show-then-auto-dismiss state for the parsed-search confirmation chips. */
export function useParsedSearchConfirm(): {
  chips: string[] | null
  show: (parsed: Record<string, string>) => void
} {
  const [chips, setChips] = useState<string[] | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])
  const show = useCallback((parsed: Record<string, string>) => {
    const next = describeParsedSearch(parsed)
    setChips(next.length > 0 ? next : null)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setChips(null), 4000)
  }, [])
  return { chips, show }
}

export function ParsedSearchNotice({ chips, className }: { chips: string[] | null; className?: string }) {
  return (
    <div aria-live="polite" className={className}>
      {chips && chips.length > 0 && (
        <Card className="max-w-full flex-row flex-wrap items-center gap-1 border border-border px-2.5 py-1.5 shadow-lg ring-0">
          <span className="text-xs text-muted-foreground">Searching</span>
          {chips.map((chip) => (
            <Badge key={chip} variant="secondary" className="text-xs font-normal">
              {chip}
            </Badge>
          ))}
        </Card>
      )}
    </div>
  )
}
