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
import { publishSearchCount } from '@/lib/search/publish-search-count'
import {
  ALL_SEARCH_URL_PARAMS,
  SEARCH_FIELDS,
  SEARCH_FIELD_CATEGORIES,
  type SearchFieldDef,
} from '@/lib/search/field-registry'
import {
  PROPERTY_CLASS_LABELS,
  autoNarrowPropertyType,
  bestClassForValue,
  classesForPropertyType,
  loadClassPrevalence,
  propertyTypeDisplayLabel,
  propertyTypeValueForClass,
  type ClassPrevalenceArtifact,
  type PropertyClass,
} from '@/lib/search/class-prevalence'
import {
  conditionBoolean,
  conditionMultiOptions,
  zeroReasonLabel,
} from '@/components/search/class-conditioning'
import {
  buildFindIndex,
  fieldAnchorId,
  searchFindIndex,
  type FindFilterHit,
} from '@/components/search/find-a-filter'
import {
  culpritCandidates,
  draftWithoutCandidate,
  pickCulprit,
  type CulpritProbeResult,
} from '@/components/search/zero-culprit'
import { rangeParamPair } from '@/components/search/registry-filter-chrome'
import SubTypeControl from '@/components/search/SubTypeControl'
import { countSearchListings } from '@/app/actions/search'
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

// Re-export chrome so existing deep imports keep working; new call sites should
// import chrome from registry-filter-chrome so AllFiltersSheet can stay lazy.
export {
  rangeParamPair,
  activeRegistryFilters,
  RegistryFilterChip,
  useParsedSearchConfirm,
  ParsedSearchNotice,
  type ActiveRegistryFilter,
} from '@/components/search/registry-filter-chrome'

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
  artifact,
  classes,
  scopeLabel,
  onToggle,
  onSwitchClass,
}: {
  def: SearchFieldDef
  values: string[]
  disabled: boolean
  artifact: ClassPrevalenceArtifact | null
  classes: readonly PropertyClass[] | null
  scopeLabel: string | null
  onToggle: (option: string) => void
  onSwitchClass: (option: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  // Class conditioning (plan §5): live values first by count, zero-for-class
  // values visible but disabled, selected-but-invalid values suspended
  // (struck through, never silently dropped — §7.1 rule 2).
  const { options, suspended } = useMemo(
    () => conditionMultiOptions(def, artifact, classes, values),
    [def, artifact, classes, values],
  )
  const visible = useMemo(() => {
    if (expanded || options.length <= 8) return options
    const head = options.slice(0, 8)
    const headSet = new Set(head.map((o) => o.value))
    // Keep already-selected values visible even when collapsed.
    const selectedTail = options.filter((o) => o.selected && !headSet.has(o.value))
    return [...head, ...selectedTail]
  }, [expanded, options])

  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">{def.label}</p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={option.selected ? 'default' : 'outline'}
            aria-pressed={option.selected}
            disabled={disabled || (option.count === 0 && !option.selected)}
            aria-label={
              option.count === 0
                ? `${option.value}, ${zeroReasonLabel(scopeLabel)}`
                : undefined
            }
            onClick={() => onToggle(option.value)}
            className={cn(
              'h-auto rounded-full px-2.5 py-1 text-xs tabular-nums',
              option.suspended && 'line-through decoration-2 opacity-80',
            )}
          >
            {option.value}
            {option.count !== null && (
              <span
                className={cn(
                  'ml-1',
                  option.selected ? 'text-primary-foreground/70' : 'text-muted-foreground',
                )}
              >
                {option.count.toLocaleString()}
              </span>
            )}
          </Button>
        ))}
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
      {suspended.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1">
          {suspended.map((option) => {
            const best = artifact ? bestClassForValue(artifact, def.key, option.value) : null
            const offerSwitch = best !== null && (!classes || !classes.includes(best))
            return (
              <div
                key={option.value}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground"
              >
                <span>
                  {option.value}: {zeroReasonLabel(scopeLabel)}.
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggle(option.value)}
                  className="h-auto px-1.5 py-0.5 text-xs underline-offset-2 hover:underline"
                >
                  Remove
                </Button>
                {offerSwitch && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSwitchClass(option.value)}
                    className="h-auto px-1.5 py-0.5 text-xs underline-offset-2 hover:underline"
                  >
                    Search {PROPERTY_CLASS_LABELS[best as PropertyClass]}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
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

// Non-registry URL params the sheet also drafts. propertyType drives class
// conditioning (plan §5): the sheet reads it on open, auto-narrows it when a
// class-exclusive sub type is picked, and writes it back on Apply. Both
// mounting surfaces apply arbitrary keys to the URL, so the extra key rides
// the same onApply map.
const EXTRA_SHEET_PARAMS = ['propertyType'] as const
const SHEET_PARAM_SET = new Set<string>([...ALL_SEARCH_URL_PARAMS, ...EXTRA_SHEET_PARAMS])

function csvValues(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((v) => v.trim()).filter(Boolean)
}

/** Two propertyType values are equivalent when they constrain the same classes. */
function samePropertyTypeScope(a: string | undefined, b: string | undefined): boolean {
  if ((a ?? '') === (b ?? '')) return true
  const ca = classesForPropertyType(a)
  const cb = classesForPropertyType(b)
  if (ca === null || cb === null) return ca === cb && (a ?? '') === (b ?? '')
  return ca.length === cb.length && ca.every((cls) => cb.includes(cls))
}

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
  // Class-prevalence census (plan §5) — ~120 KB, loaded lazily on first open.
  const [artifact, setArtifact] = useState<ClassPrevalenceArtifact | null>(null)
  // Find-a-filter (plan §7.1 rule 1)
  const [findQuery, setFindQuery] = useState('')
  // Auto-narrow undo affordance (plan §4.5.3)
  const [narrowNotice, setNarrowNotice] = useState<{ prev: string; label: string } | null>(null)
  // Zero-result culprit (plan §7.1 rule 3)
  const [culprit, setCulprit] = useState<{ label: string; params: readonly string[]; recovered: number } | null>(null)
  const applyLock = useRef(false)

  // Re-seed the draft from the URL each time the sheet opens.
  useEffect(() => {
    if (!open) return
    const next: Record<string, string> = {}
    for (const param of [...ALL_SEARCH_URL_PARAMS, ...EXTRA_SHEET_PARAMS]) {
      const v = searchParams?.get(param)
      if (v) next[param] = v
    }
    setDraft(next)
    setCount(null)
    setFindQuery('')
    setNarrowNotice(null)
    setCulprit(null)
    applyLock.current = false
    // Seed on open only — while editing, the draft is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Load the census once the sheet first opens.
  useEffect(() => {
    if (!open || artifact) return
    let cancelled = false
    loadClassPrevalence()
      .then((a) => {
        if (!cancelled) setArtifact(a)
      })
      .catch(() => {
        // Census unavailable — the sheet renders unconditioned (no counts).
      })
    return () => {
      cancelled = true
    }
  }, [open, artifact])

  // The property-class scope the draft constrains (null = unconditioned).
  const classes = useMemo(
    () => classesForPropertyType(draft.propertyType),
    [draft.propertyType],
  )
  const scopeLabel = useMemo(
    () => (classes ? propertyTypeDisplayLabel(draft.propertyType) : null),
    [classes, draft.propertyType],
  )

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

  // Sub-type toggle with class auto-narrow (plan §4.5.3): the class filter
  // moves to the narrowest propertyType covering every selected sub type —
  // picking Duplex narrows to multi-family, picking across classes widens —
  // and the change carries a one-tap undo.
  const toggleSubType = useCallback(
    (option: string) => {
      const values = csvValues(draft.propertySubTypes)
      const nextValues = values.includes(option)
        ? values.filter((v) => v !== option)
        : [...values, option]
      const next = { ...draft }
      if (nextValues.length === 0) delete next.propertySubTypes
      else next.propertySubTypes = nextValues.join(',')
      const target = autoNarrowPropertyType(nextValues)
      if (target !== null && !samePropertyTypeScope(target, draft.propertyType)) {
        if (target === '') delete next.propertyType
        else next.propertyType = target
        setNarrowNotice({
          prev: draft.propertyType ?? '',
          label: target === '' ? 'All types' : (propertyTypeDisplayLabel(target) ?? target),
        })
      }
      setDraft(next)
    },
    [draft],
  )

  const undoNarrow = useCallback(() => {
    if (!narrowNotice) return
    setParam('propertyType', narrowNotice.prev || undefined)
    setNarrowNotice(null)
  }, [narrowNotice, setParam])

  // Suspended-value resolution 2 (plan §7.1 rule 2): switch the class to the
  // one where the value actually lives.
  const switchClassForValue = useCallback(
    (fieldKey: string, value: string) => {
      if (!artifact) return
      const best = bestClassForValue(artifact, fieldKey, value)
      if (!best) return
      setNarrowNotice(null)
      setParam('propertyType', propertyTypeValueForClass(best))
    },
    [artifact, setParam],
  )

  // Find-a-filter (plan §7.1 rule 1): value hits apply directly; range/text
  // hits scroll their control into view.
  const applyFindHit = useCallback(
    (hit: FindFilterHit) => {
      if (hit.kind === 'field') {
        document.getElementById(fieldAnchorId(hit.fieldKey))?.scrollIntoView({ block: 'center' })
        return
      }
      if (hit.kind === 'boolean') setParam(hit.fieldKey, '1')
      else if (hit.kind === 'zoning') setParam('zoning', hit.value)
      else if (hit.fieldKey === 'propertySubTypes') {
        if (!csvValues(draft.propertySubTypes).includes(hit.value)) toggleSubType(hit.value)
      } else if (!csvValues(draft[hit.fieldKey]).includes(hit.value)) {
        toggleMultiValue(hit.fieldKey, hit.value)
      }
      setFindQuery('')
    },
    [draft, setParam, toggleMultiValue, toggleSubType],
  )

  const findIndex = useMemo(() => buildFindIndex(artifact), [artifact])
  const findHits = useMemo(
    () => searchFindIndex(findIndex, artifact, findQuery, classes),
    [findIndex, artifact, findQuery, classes],
  )

  const removeCulprit = useCallback(() => {
    if (!culprit) return
    setDraft((d) => {
      const next = { ...d }
      for (const param of culprit.params) delete next[param]
      return next
    })
    setCulprit(null)
  }, [culprit])

  // Full count-endpoint param map for a given draft: context defaults under
  // the URL's non-sheet params under the draft. Shared by the live count and
  // the zero-culprit leave-one-out probes so the two can never disagree.
  const buildCountParams = useCallback(
    (d: Record<string, string>): Record<string, string> => {
      const merged: Record<string, string> = {}
      for (const [k, v] of Object.entries(contextDefaults ?? {})) {
        if (v.trim() !== '') merged[k] = v
      }
      searchParams?.forEach((value, key) => {
        if (!SHEET_PARAM_SET.has(key)) merged[key] = value
      })
      for (const [k, v] of Object.entries(d)) merged[k] = v
      delete merged.page
      return merged
    },
    [contextDefaults, searchParams],
  )

  // Live match count, debounced 400 ms behind draft edits.
  const draftKey = JSON.stringify(draft)
  useEffect(() => {
    if (!open || closedScope || !enableCount) return
    let cancelled = false
    const timer = setTimeout(() => {
      countSearchListings(buildCountParams(draft))
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

  // Zero-result culprit (plan §7.1 rule 3): when the live count is 0, probe
  // leave-one-out counts (capped candidates, debounced) and name the filter
  // whose removal recovers the most matches. A suggestion that itself yields
  // 0 is never made (pickCulprit drops it).
  useEffect(() => {
    if (!open || closedScope || !enableCount) return
    if (count !== 0) {
      setCulprit(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const candidates = culpritCandidates(draft)
      if (candidates.length === 0) return
      const results: CulpritProbeResult[] = await Promise.all(
        candidates.map(async (candidate) => {
          try {
            const n = await countSearchListings(buildCountParams(draftWithoutCandidate(draft, candidate)))
            return { candidate, count: n }
          } catch {
            return { candidate, count: null }
          }
        }),
      )
      if (cancelled) return
      const winner = pickCulprit(results)
      setCulprit(
        winner
          ? { label: winner.candidate.label, params: winner.candidate.params, recovered: winner.recovered }
          : null,
      )
    }, 700)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // draftKey stands in for the draft object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, draftKey, open, closedScope, enableCount])

  const fieldDisabled = useCallback(
    (def: SearchFieldDef) => closedScope && !CLOSED_SCOPE_KEYS.has(def.key),
    [closedScope]
  )

  function handleApply() {
    if (applyLock.current) return
    applyLock.current = true
    const updates: Record<string, string | undefined> = {}
    for (const param of ALL_SEARCH_URL_PARAMS) updates[param] = draft[param] || undefined
    for (const param of EXTRA_SHEET_PARAMS) updates[param] = draft[param] || undefined
    onApply(updates)
    onOpenChange(false)
  }

  const applyPublished = publishSearchCount({ value: count, grain: 'filter-match' })
  const applyLabel =
    !closedScope && enableCount && applyPublished
      ? `Show ${applyPublished.phrase}`
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

        {/* Find-a-filter (plan §7.1 rule 1) — pinned above the scroll pane.
            Matches field labels AND values (zoning codes included), ranked by
            live count. Client-side over the registry + census, no fetch. */}
        <div className="border-b border-border px-4 pb-3 pt-2">
          <Input
            type="search"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="Find a filter, like duplex or MUA10"
            aria-label="Find a filter by name or value"
          />
          {findQuery.trim().length >= 2 && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border">
              {findHits.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No filter or value matches that.
                </p>
              ) : (
                findHits.map((hit) => (
                  <Button
                    key={`${hit.kind}:${hit.fieldKey}:${hit.value}`}
                    type="button"
                    variant="ghost"
                    onClick={() => applyFindHit(hit)}
                    className="flex h-auto w-full items-center justify-between gap-2 rounded-none px-3 py-2 text-left font-normal"
                  >
                    <span className="min-w-0 text-sm">
                      <span className="block truncate">
                        {hit.valueLabel}
                        {hit.kind === 'multi-value' || hit.kind === 'zoning' ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">{hit.fieldLabel}</span>
                        ) : null}
                      </span>
                      {/* Zoning definition layer (plan §6.3): plain English
                          when exactly one jurisdiction defines the code; the
                          jurisdiction list when the code collides — never a
                          silent pick. */}
                      {hit.definition ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {hit.definition.plainEnglish ??
                            `Defined by ${hit.definition.jurisdictions.join(' and ')}`}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {hit.count !== null ? hit.count.toLocaleString() : hit.kind === 'field' ? 'Go to' : ''}
                    </span>
                  </Button>
                ))
              )}
            </div>
          )}
          {classes && scopeLabel && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Counts shown for {scopeLabel.toLowerCase()} listings.</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNarrowNotice(null)
                  setParam('propertyType', undefined)
                }}
                className="h-auto px-1 py-0 text-xs underline-offset-2 hover:underline"
              >
                All types
              </Button>
            </div>
          )}
        </div>

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
                      <div key={def.key} id={fieldAnchorId(def.key)}>
                        <RangeFieldRow
                          def={def}
                          draft={draft}
                          disabled={fieldDisabled(def)}
                          setParam={setParam}
                        />
                      </div>
                    ))}
                    {booleans.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {booleans.map((def) => {
                          const meta = conditionBoolean(def.key, artifact, classes, draft[def.key] === '1')
                          const zeroDisabled = meta.count === 0 && !meta.selected
                          return (
                            <Label
                              key={def.key}
                              className={cn(
                                'flex items-center gap-2',
                                fieldDisabled(def) || zeroDisabled
                                  ? 'cursor-not-allowed opacity-50'
                                  : 'cursor-pointer'
                              )}
                            >
                              <Checkbox
                                checked={meta.selected}
                                disabled={fieldDisabled(def) || zeroDisabled}
                                onCheckedChange={(v) => setParam(def.key, v === true ? '1' : undefined)}
                                aria-label={
                                  meta.count === 0
                                    ? `${def.label}, ${zeroReasonLabel(scopeLabel)}`
                                    : def.label
                                }
                              />
                              <span
                                className={cn(
                                  'text-sm text-foreground',
                                  meta.suspended && 'line-through decoration-2'
                                )}
                              >
                                {def.label}
                              </span>
                              {meta.count === 0 && (
                                <span className="text-xs tabular-nums text-muted-foreground">0</span>
                              )}
                            </Label>
                          )
                        })}
                      </div>
                    )}
                    {multis.map((def) =>
                      def.key === 'propertySubTypes' ? (
                        <div key={def.key} id={fieldAnchorId(def.key)}>
                          <SubTypeControl
                            def={def}
                            artifact={artifact}
                            classes={classes}
                            values={csvValues(draft[def.key])}
                            disabled={fieldDisabled(def)}
                            onToggle={toggleSubType}
                          />
                          {narrowNotice && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>Property type set to {narrowNotice.label}.</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={undoNarrow}
                                className="h-auto px-1.5 py-0.5 text-xs underline-offset-2 hover:underline"
                              >
                                Undo
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <MultiFieldChips
                          key={def.key}
                          def={def}
                          values={csvValues(draft[def.key])}
                          disabled={fieldDisabled(def)}
                          artifact={artifact}
                          classes={classes}
                          scopeLabel={scopeLabel}
                          onToggle={(option) => toggleMultiValue(def.key, option)}
                          onSwitchClass={(option) => switchClassForValue(def.key, option)}
                        />
                      )
                    )}
                    {texts.map((def) => (
                      <div key={def.key} id={fieldAnchorId(def.key)}>
                        <TextFieldRow
                          def={def}
                          value={draft[def.key] ?? ''}
                          disabled={fieldDisabled(def)}
                          setParam={setParam}
                        />
                      </div>
                    ))}
                  </section>
                </Fragment>
              )
            })}
          </div>
        </ScrollArea>

        {/* Zero-result culprit (plan §7.1 rule 3) — names the filter whose
            removal recovers the most matches, with a one-tap fix. */}
        {count === 0 && culprit && (
          <div aria-live="polite" className="border-t border-border px-4 py-3">
            <p className="text-sm text-foreground">
              No homes match all of these filters. Removing {culprit.label} shows{' '}
              <span className="tabular-nums">{culprit.recovered.toLocaleString()}</span>{' '}
              {culprit.recovered === 1 ? 'home' : 'homes'}.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={removeCulprit} className="mt-2">
              Remove {culprit.label}
            </Button>
          </div>
        )}

        <SheetFooter className="gap-2 px-4 pb-4">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => {
              setDraft({})
              setNarrowNotice(null)
              setCulprit(null)
            }}
          >
            Reset
          </Button>
          <Button
            type="button"
            className="flex-1"
            onPointerDown={handleApply}
            onClick={handleApply}
          >
            {applyLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
