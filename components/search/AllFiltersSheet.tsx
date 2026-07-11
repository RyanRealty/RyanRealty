'use client'

/**
 * AllFiltersSheet — registry-driven All-filters panel.
 *
 * Renders every consumer search field from lib/search/field-registry.ts,
 * grouped by SEARCH_FIELD_CATEGORIES. Both search surfaces (SearchFilters on
 * /homes-for-sale and SearchFilterBar on the SEO browse pages) mount this same
 * sheet, so screen and voice expose the identical field set (CONTRACT —
 * search-field-exposure). The sheet edits a local draft keyed by URL param and
 * hands the parent a full param-update map on Apply.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  ALL_SEARCH_URL_PARAMS,
  SEARCH_FIELDS,
  SEARCH_FIELD_CATEGORIES,
  type SearchFieldDef,
} from '@/lib/search/field-registry'
import { countSearchListings } from '@/app/actions/search'
import { describeParsedSearch } from '@/lib/parse-search-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'

// ---------------------------------------------------------------------------
// Registry helpers (shared with the chip rows in both filter bars)
// ---------------------------------------------------------------------------

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
      out.push({ key: def.key, label: `${def.label}: ${values[0]}${extra}`, params: [def.key] })
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
    <Badge variant="secondary" className="inline-flex h-auto items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
      {label}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove filter: ${label}`}
        onClick={onRemove}
        className="ml-0.5 size-3.5 rounded-full p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3" aria-hidden />
      </Button>
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Parsed-search confirmation chips (voice + typed natural-language queries)
// ---------------------------------------------------------------------------

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
        <div className="flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 shadow-lg">
          <span className="text-xs text-muted-foreground">Searching</span>
          {chips.map((chip) => (
            <Badge key={chip} variant="secondary" className="text-xs font-normal">
              {chip}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field widgets
// ---------------------------------------------------------------------------

// Fields the legacy closed/sold query path already supports. Everything else
// runs on the on-market MV only and disables under a sold/closed scope.
const CLOSED_SCOPE_KEYS = new Set([
  'price', 'sqft', 'lotAcres', 'yearBuilt', 'beds', 'baths', 'garage', 'dom',
  'hasPool', 'hasView', 'hasWaterfront', 'hasFireplace', 'hasGolfCourse', 'keywords',
])

const UNIT_LABEL: Record<string, string> = {
  usd: '$',
  usdMonth: '$',
  sqft: 'sq ft',
  acres: 'acres',
  days: 'days',
  spaces: 'spaces',
}

type SetParam = (param: string, value: string | undefined) => void

const EMPTY_OPTIONS: readonly string[] = []

function RangeFieldRow({
  def,
  draft,
  disabled,
  setParam,
}: {
  def: SearchFieldDef
  draft: Record<string, string>
  disabled: boolean
  setParam: SetParam
}) {
  const { min, max } = rangeParamPair(def)
  const unit = def.unit ? UNIT_LABEL[def.unit] : undefined

  if (def.presets && def.presets.length > 0) {
    const param = max ?? min
    if (!param) return null
    return (
      <Label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{def.label}</span>
        <Select
          value={draft[param] || 'any'}
          disabled={disabled}
          onValueChange={(v) => setParam(param, v === 'any' ? undefined : v)}
        >
          <SelectTrigger className="tabular-nums" aria-label={def.label}>
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            {def.presets.map((p) => (
              <SelectItem key={p} value={String(p)}>
                {max ? `Under ${p}${unit ? ` ${unit}` : ''}` : `${p}${unit ? ` ${unit}` : ''}+`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {def.coverageNote && <span className="text-xs text-muted-foreground">{def.coverageNote}</span>}
      </Label>
    )
  }

  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">
        {unit ? `${def.label} (${unit})` : def.label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {min && (
          <Input
            type="number"
            inputMode="numeric"
            placeholder="No min"
            value={draft[min] ?? ''}
            disabled={disabled}
            onChange={(e) => setParam(min, e.target.value || undefined)}
            className="tabular-nums"
            aria-label={`${def.label} minimum`}
          />
        )}
        {max && (
          <Input
            type="number"
            inputMode="numeric"
            placeholder="No max"
            value={draft[max] ?? ''}
            disabled={disabled}
            onChange={(e) => setParam(max, e.target.value || undefined)}
            className="tabular-nums"
            aria-label={`${def.label} maximum`}
          />
        )}
      </div>
      {def.coverageNote && <p className="mt-1 text-xs text-muted-foreground">{def.coverageNote}</p>}
    </div>
  )
}

function MultiFieldChips({
  def,
  values,
  disabled,
  onToggle,
}: {
  def: SearchFieldDef
  values: string[]
  disabled: boolean
  onToggle: (option: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const options = def.options ?? EMPTY_OPTIONS
  const visible = useMemo(() => {
    if (expanded || options.length <= 8) return options
    const head = options.slice(0, 8)
    // Keep already-selected values visible even when collapsed.
    const selectedTail = options.filter((o) => values.includes(o) && !head.includes(o))
    return [...head, ...selectedTail]
  }, [expanded, options, values])

  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">{def.label}</p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((option) => {
          const selected = values.includes(option)
          return (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={selected ? 'default' : 'outline'}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onToggle(option)}
              className="h-auto rounded-full px-2.5 py-1 text-xs"
            >
              {option}
            </Button>
          )
        })}
        {options.length > 8 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => setExpanded((e) => !e)}
            className="h-auto px-2 py-1 text-xs text-muted-foreground"
          >
            {expanded ? 'Show fewer' : `Show all ${options.length}`}
          </Button>
        )}
      </div>
      {def.coverageNote && <p className="mt-1 text-xs text-muted-foreground">{def.coverageNote}</p>}
    </div>
  )
}

function TextFieldRow({
  def,
  value,
  disabled,
  setParam,
}: {
  def: SearchFieldDef
  value: string
  disabled: boolean
  setParam: SetParam
}) {
  const listId = def.options && def.options.length > 0 ? `all-filters-${def.key}-options` : undefined
  return (
    <Label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{def.label}</span>
      <Input
        type={def.key === 'keywords' ? 'search' : 'text'}
        value={value}
        disabled={disabled}
        placeholder={def.key === 'keywords' ? 'e.g. mountain view, RV parking' : def.label}
        list={listId}
        onChange={(e) => setParam(def.key, e.target.value || undefined)}
      />
      {listId && (
        <datalist id={listId}>
          {(def.options ?? []).map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
      {def.coverageNote && <span className="text-xs text-muted-foreground">{def.coverageNote}</span>}
    </Label>
  )
}

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

const REGISTRY_PARAM_SET = new Set<string>(ALL_SEARCH_URL_PARAMS)

export type AllFiltersSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Receives every registry URL param (value, or undefined to clear) on Apply. */
  onApply: (updates: Record<string, string | undefined>) => void
  /** Sold/closed scope: fields beyond the legacy closed path disable. */
  closedScope?: boolean
  /**
   * Live match count reads the location scope from the query string. Disable
   * on surfaces where the scope lives in the path (SEO browse pages) so the
   * button never shows a count for the wrong geography.
   */
  enableCount?: boolean
  /**
   * Scope the page applies without putting it in the URL (the split view's
   * default city, the default Active status). Merged under the URL params so
   * the count previews the same result set Apply produces — without these the
   * default /homes-for-sale count spanned every city and every status.
   */
  contextDefaults?: Record<string, string>
}

export default function AllFiltersSheet({
  open,
  onOpenChange,
  onApply,
  closedScope = false,
  enableCount = true,
  contextDefaults,
}: AllFiltersSheetProps) {
  const searchParams = useSearchParams()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [count, setCount] = useState<number | null>(null)

  // Re-seed the draft from the URL each time the sheet opens.
  useEffect(() => {
    if (!open) return
    const next: Record<string, string> = {}
    for (const param of ALL_SEARCH_URL_PARAMS) {
      const v = searchParams?.get(param)
      if (v) next[param] = v
    }
    setDraft(next)
    setCount(null)
    // Seed on open only — while editing, the draft is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const setParam = useCallback<SetParam>((param, value) => {
    setDraft((d) => {
      const next = { ...d }
      if (value === undefined || value === '') delete next[param]
      else next[param] = value
      return next
    })
  }, [])

  const toggleMultiValue = useCallback((param: string, option: string) => {
    setDraft((d) => {
      const values = (d[param] ?? '').split(',').map((v) => v.trim()).filter(Boolean)
      const nextValues = values.includes(option)
        ? values.filter((v) => v !== option)
        : [...values, option]
      const next = { ...d }
      if (nextValues.length === 0) delete next[param]
      else next[param] = nextValues.join(',')
      return next
    })
  }, [])

  // Live match count, debounced 400 ms behind draft edits.
  const draftKey = JSON.stringify(draft)
  useEffect(() => {
    if (!open || closedScope || !enableCount) return
    let cancelled = false
    const timer = setTimeout(() => {
      const merged: Record<string, string> = {}
      for (const [k, v] of Object.entries(contextDefaults ?? {})) {
        if (v.trim() !== '') merged[k] = v
      }
      searchParams?.forEach((value, key) => {
        if (!REGISTRY_PARAM_SET.has(key)) merged[key] = value
      })
      for (const [k, v] of Object.entries(draft)) merged[k] = v
      delete merged.page
      countSearchListings(merged)
        .then((n) => {
          if (!cancelled) setCount(n)
        })
        .catch(() => {
          if (!cancelled) setCount(null)
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // draftKey stands in for the draft object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, open, closedScope, enableCount])

  const fieldDisabled = useCallback(
    (def: SearchFieldDef) => closedScope && !CLOSED_SCOPE_KEYS.has(def.key),
    [closedScope]
  )

  function handleApply() {
    const updates: Record<string, string | undefined> = {}
    for (const param of ALL_SEARCH_URL_PARAMS) updates[param] = draft[param] || undefined
    onApply(updates)
    onOpenChange(false)
  }

  const applyLabel =
    !closedScope && enableCount && count != null
      ? `Show ${count.toLocaleString()} ${count === 1 ? 'home' : 'homes'}`
      : 'Apply filters'

  const visibleCategories = SEARCH_FIELD_CATEGORIES.map(({ id, label }) => ({
    id,
    label,
    fields: SEARCH_FIELDS.filter(
      (f) => f.category === id && !(f.kind === 'multi' && (f.options?.length ?? 0) === 0)
    ),
  })).filter((c) => c.fields.length > 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle>All filters</SheetTitle>
          {closedScope && (
            <p className="text-xs text-muted-foreground">These filters apply to on-market listings.</p>
          )}
        </SheetHeader>

        {/* min-h-0 is load-bearing: without it this flex child sizes to its
            ~7,000px content, nothing scrolls, and the Apply footer lands off
            screen (the 2026-07-11 audit hit the same defect in the old sheet). */}
        <ScrollArea className="min-h-0 flex-1 px-4 py-4">
          <div className="flex flex-col gap-5">
            {visibleCategories.map(({ id, label, fields }, index) => {
              const ranges = fields.filter((f) => f.kind === 'range')
              const booleans = fields.filter((f) => f.kind === 'boolean')
              const multis = fields.filter((f) => f.kind === 'multi')
              const texts = fields.filter((f) => f.kind === 'text')
              return (
                <Fragment key={id}>
                  {index > 0 && <Separator />}
                  <section className="flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </p>
                    {ranges.map((def) => (
                      <RangeFieldRow
                        key={def.key}
                        def={def}
                        draft={draft}
                        disabled={fieldDisabled(def)}
                        setParam={setParam}
                      />
                    ))}
                    {booleans.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {booleans.map((def) => (
                          <Label
                            key={def.key}
                            className={cn(
                              'flex items-center gap-2',
                              fieldDisabled(def) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                            )}
                          >
                            <Checkbox
                              checked={draft[def.key] === '1'}
                              disabled={fieldDisabled(def)}
                              onCheckedChange={(v) => setParam(def.key, v === true ? '1' : undefined)}
                              aria-label={def.label}
                            />
                            <span className="text-sm text-foreground">{def.label}</span>
                          </Label>
                        ))}
                      </div>
                    )}
                    {multis.map((def) => (
                      <MultiFieldChips
                        key={def.key}
                        def={def}
                        values={(draft[def.key] ?? '').split(',').map((v) => v.trim()).filter(Boolean)}
                        disabled={fieldDisabled(def)}
                        onToggle={(option) => toggleMultiValue(def.key, option)}
                      />
                    ))}
                    {texts.map((def) => (
                      <TextFieldRow
                        key={def.key}
                        def={def}
                        value={draft[def.key] ?? ''}
                        disabled={fieldDisabled(def)}
                        setParam={setParam}
                      />
                    ))}
                  </section>
                </Fragment>
              )
            })}
          </div>
        </ScrollArea>

        <SheetFooter className="gap-2 px-4 pb-4">
          <Button type="button" variant="ghost" className="flex-1" onClick={() => setDraft({})}>
            Reset
          </Button>
          <Button type="button" className="flex-1" onClick={handleApply}>
            {applyLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
