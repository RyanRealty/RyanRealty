'use client'

/**
 * AlertCriteriaEditor — a reusable, broker-friendly criteria editor for
 * listing-alert filters. Renders the criteria as a sentence
 * ("Email me [once a day] with [residential listings] in [Bend] priced
 * [under $800K] with [3+] beds and [2+] baths"), each bracket a compact
 * inline control, with the less-common filters (sqft, year built, lot size,
 * amenities) behind a "More filters" disclosure. Below the controls: the
 * canonical getFiltersSummary line and a live matching-listing count
 * (debounced 500 ms through the countMatchingListings server action, which
 * rides the same cached search path the site uses).
 *
 * Fully controlled: `value` is the saved-search filters JSON
 * (lib/search-filters model) and every edit calls `onChange` with a new
 * object. Keys this editor does not expose (keywords, polygon, statusFilter,
 * extra cities, ...) are preserved untouched — the sentence acknowledges them
 * as "plus N more filters". The parent owns persistence; this component never
 * writes anywhere.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getFiltersSummary,
  getSavedSearchHash,
  normalizeSavedSearchFilters,
  type SavedSearchFilters,
} from '@/lib/search-filters'
import { PROPERTY_TYPES } from '@/lib/property-type'
import { SERVICE_AREA_CITIES_PROPER } from '@/lib/data/listings/service-area'
import { countMatchingListings } from '@/app/actions/criteria-count'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  alertFrequencyPhrase,
  listNeighborhoodOptions,
  pricePhrase,
  type AlertFrequency,
  type GeoOption,
} from '@/components/admin/crm/criteria/criteria-sentence'

export type AlertCriteriaEditorProps = {
  /** The saved-search filters JSON (lib/search-filters model). */
  value: SavedSearchFilters
  /** Called with a fresh filters object on every edit. */
  onChange: (filters: SavedSearchFilters) => void
  /**
   * Optional alert cadence. When provided the sentence includes the
   * "[once a day]" bracket — a Select when onFrequencyChange is passed,
   * plain text otherwise. Omit both to leave cadence to the host dialog.
   */
  frequency?: AlertFrequency
  onFrequencyChange?: (frequency: AlertFrequency) => void
  /** Proper-case city names for the place picker. Defaults to the Central Oregon service area. */
  cityOptions?: readonly string[]
  /** Neighborhood/community options. Defaults to Bend districts + the resort community registry. */
  neighborhoodOptions?: readonly GeoOption[]
  disabled?: boolean
  className?: string
}

const FREQUENCY_OPTIONS: ReadonlyArray<{ value: AlertFrequency; label: string }> = [
  { value: 'instant', label: alertFrequencyPhrase('instant') },
  { value: 'daily', label: alertFrequencyPhrase('daily') },
  { value: 'weekly', label: alertFrequencyPhrase('weekly') },
]

const MIN_COUNT_OPTIONS = ['any', '1', '2', '3', '4', '5'] as const

/** Layout-only sizing so every inline control clears 44 px on touch screens. */
const TOUCH_TRIGGER = 'min-h-11 sm:min-h-8'

const AMENITY_TOGGLES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'hasPool', label: 'Pool' },
  { key: 'hasView', label: 'A view' },
  { key: 'hasWaterfront', label: 'Waterfront' },
  { key: 'hasFireplace', label: 'Fireplace' },
  { key: 'hasGolfCourse', label: 'On a golf course' },
  { key: 'hasOpenHouse', label: 'Open house scheduled' },
]

/** Keys the "More filters" section owns, for its active-count pill. */
const MORE_FILTER_KEYS = [
  'minSqFt', 'maxSqFt', 'yearBuiltMin', 'yearBuiltMax', 'lotAcresMin', 'lotAcresMax',
  ...AMENITY_TOGGLES.map((t) => t.key),
] as const

function numberInputValue(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

export function AlertCriteriaEditor({
  value,
  onChange,
  frequency,
  onFrequencyChange,
  cityOptions = SERVICE_AREA_CITIES_PROPER,
  neighborhoodOptions,
  disabled = false,
  className,
}: AlertCriteriaEditorProps) {
  const normalized = useMemo(() => normalizeSavedSearchFilters(value ?? {}), [value])
  const hash = getSavedSearchHash(value ?? {})
  const summary = getFiltersSummary(value ?? {})

  const neighborhoods = useMemo(
    () => neighborhoodOptions ?? listNeighborhoodOptions(),
    [neighborhoodOptions],
  )

  // ---- controlled-update helper: merge a patch over the raw value so every
  // key the editor does not touch survives the edit.
  function update(patch: Record<string, unknown>) {
    const next: SavedSearchFilters = { ...(value ?? {}) }
    for (const [key, patchValue] of Object.entries(patch)) {
      if (patchValue === undefined) delete next[key]
      else next[key] = patchValue
    }
    onChange(next)
  }

  // ---- place picker: one grouped select over cities + neighborhoods.
  const city = typeof normalized.city === 'string' ? normalized.city : ''
  const neighborhoodSlug = typeof normalized.neighborhoodSlug === 'string' ? normalized.neighborhoodSlug : ''
  const placeValue = neighborhoodSlug ? `nbhd:${neighborhoodSlug}` : city ? `city:${city}` : 'anywhere'
  const cityList = useMemo(() => {
    const list = [...cityOptions]
    if (city && !list.includes(city)) list.unshift(city)
    return list
  }, [cityOptions, city])
  const neighborhoodList = useMemo(() => {
    if (!neighborhoodSlug || neighborhoods.some((n) => n.slug === neighborhoodSlug)) return neighborhoods
    return [{ slug: neighborhoodSlug, label: neighborhoodSlug }, ...neighborhoods]
  }, [neighborhoods, neighborhoodSlug])

  function handlePlaceChange(next: string) {
    if (next === 'anywhere') {
      update({ city: undefined, neighborhoodSlug: undefined, subdivision: undefined })
      return
    }
    if (next.startsWith('city:')) {
      update({ city: next.slice('city:'.length), neighborhoodSlug: undefined, subdivision: undefined })
      return
    }
    if (next.startsWith('nbhd:')) {
      update({ neighborhoodSlug: next.slice('nbhd:'.length), city: undefined, subdivision: undefined })
    }
  }

  // ---- price
  const minPrice = typeof normalized.minPrice === 'number' ? normalized.minPrice : undefined
  const maxPrice = typeof normalized.maxPrice === 'number' ? normalized.maxPrice : undefined
  const priceLabel = pricePhrase(minPrice, maxPrice) ?? 'at any price'

  function handleNumberChange(key: string, raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) {
      update({ [key]: undefined })
      return
    }
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed) && parsed >= 0) update({ [key]: parsed })
  }

  // ---- beds / baths / property type
  const beds = typeof normalized.beds === 'number' && normalized.beds > 0 ? String(Math.floor(normalized.beds)) : 'any'
  const baths = typeof normalized.baths === 'number' && normalized.baths > 0 ? String(Math.floor(normalized.baths)) : 'any'
  const propertyType = typeof normalized.propertyType === 'string' && normalized.propertyType ? normalized.propertyType : 'all'

  // ---- more-filters disclosure
  const moreCount = MORE_FILTER_KEYS.filter((key) => normalized[key] !== undefined).length
  const [moreOpen, setMoreOpen] = useState(moreCount > 0)

  // ---- live count, debounced 500 ms on the normalized-filters hash. The ref
  // keeps the effect keyed on the hash alone so re-renders with an equivalent
  // object do not refetch. Results carry the hash they were computed for, so
  // "loading" is derived (current hash has no result yet) instead of set
  // synchronously in the effect.
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  })
  const [countResult, setCountResult] = useState<{ hash: string; count: number } | null>(null)
  const [countErrorHash, setCountErrorHash] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const res = await countMatchingListings(valueRef.current ?? {})
        if (cancelled) return
        if (!res.data) {
          setCountErrorHash(hash)
          return
        }
        setCountResult({ hash, count: res.data.count })
      })()
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [hash])
  const count = countResult?.hash === hash ? countResult.count : null
  const countState: 'loading' | 'ready' | 'error' =
    count !== null ? 'ready' : countErrorHash === hash ? 'error' : 'loading'

  return (
    <div className={cn('space-y-3', className)}>
      {/* The sentence */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm text-foreground">
        <span>Email me</span>

        {frequency !== undefined && onFrequencyChange ? (
          <Select
            value={frequency}
            onValueChange={(v) => onFrequencyChange(v as AlertFrequency)}
            disabled={disabled}
          >
            <SelectTrigger size="sm" className={TOUCH_TRIGGER} aria-label="How often to email">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : frequency !== undefined ? (
          <span className="font-medium">{alertFrequencyPhrase(frequency)}</span>
        ) : null}

        <span>with</span>

        <Select
          value={propertyType}
          onValueChange={(v) => update({ propertyType: v === 'all' ? undefined : v })}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className={TOUCH_TRIGGER} aria-label="Property type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map(({ value: optionValue, label }) => (
              <SelectItem key={optionValue || 'all'} value={optionValue || 'all'}>
                {optionValue ? `${label.toLowerCase()} listings` : 'new listings'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span>in</span>

        <Select value={placeValue} onValueChange={handlePlaceChange} disabled={disabled}>
          <SelectTrigger size="sm" className={TOUCH_TRIGGER} aria-label="Place">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anywhere">all of Central Oregon</SelectItem>
            <SelectGroup>
              <SelectLabel>Cities</SelectLabel>
              {cityList.map((name) => (
                <SelectItem key={`city:${name}`} value={`city:${name}`}>{name}</SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Neighborhoods and communities</SelectLabel>
              {neighborhoodList.map((option) => (
                <SelectItem key={`nbhd:${option.slug}`} value={`nbhd:${option.slug}`}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <span>priced</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" disabled={disabled} className={TOUCH_TRIGGER}>
              {priceLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="criteria-min-price">Min price</Label>
                <Input
                  id="criteria-min-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="No minimum"
                  value={numberInputValue(minPrice)}
                  onChange={(e) => handleNumberChange('minPrice', e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="criteria-max-price">Max price</Label>
                <Input
                  id="criteria-max-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="No maximum"
                  value={numberInputValue(maxPrice)}
                  onChange={(e) => handleNumberChange('maxPrice', e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <span>with</span>

        <Select
          value={beds}
          onValueChange={(v) => update({ beds: v === 'any' ? undefined : Number(v) })}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className={TOUCH_TRIGGER} aria-label="Minimum beds">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MIN_COUNT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === 'any' ? 'any' : `${option}+`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span>beds and</span>

        <Select
          value={baths}
          onValueChange={(v) => update({ baths: v === 'any' ? undefined : Number(v) })}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className={TOUCH_TRIGGER} aria-label="Minimum baths">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MIN_COUNT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === 'any' ? 'any' : `${option}+`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span>baths</span>
      </div>

      {/* More filters */}
      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" disabled={disabled}>
            {moreOpen ? 'Hide more filters' : 'More filters'}
            {moreCount > 0 ? (
              <span className="tabular-nums text-muted-foreground">({moreCount} set)</span>
            ) : null}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="criteria-min-sqft">Square feet, at least</Label>
              <Input
                id="criteria-min-sqft"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Any"
                value={numberInputValue(normalized.minSqFt)}
                onChange={(e) => handleNumberChange('minSqFt', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="criteria-max-sqft">Square feet, at most</Label>
              <Input
                id="criteria-max-sqft"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Any"
                value={numberInputValue(normalized.maxSqFt)}
                onChange={(e) => handleNumberChange('maxSqFt', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="criteria-year-min">Built after</Label>
              <Input
                id="criteria-year-min"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Any year"
                value={numberInputValue(normalized.yearBuiltMin)}
                onChange={(e) => handleNumberChange('yearBuiltMin', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="criteria-year-max">Built before</Label>
              <Input
                id="criteria-year-max"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Any year"
                value={numberInputValue(normalized.yearBuiltMax)}
                onChange={(e) => handleNumberChange('yearBuiltMax', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="criteria-lot-min">Lot size, at least (acres)</Label>
              <Input
                id="criteria-lot-min"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                placeholder="Any"
                value={numberInputValue(normalized.lotAcresMin)}
                onChange={(e) => handleNumberChange('lotAcresMin', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="criteria-lot-max">Lot size, at most (acres)</Label>
              <Input
                id="criteria-lot-max"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                placeholder="Any"
                value={numberInputValue(normalized.lotAcresMax)}
                onChange={(e) => handleNumberChange('lotAcresMax', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <p className="text-sm font-medium text-foreground">Must have</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {AMENITY_TOGGLES.map(({ key, label }) => (
                  <Label
                    key={key}
                    className="flex min-h-11 cursor-pointer items-center gap-2 font-normal"
                  >
                    <Checkbox
                      checked={normalized[key] === true}
                      onCheckedChange={(checked) => update({ [key]: checked === true ? true : undefined })}
                      disabled={disabled}
                      aria-label={label}
                    />
                    {label}
                  </Label>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Live summary + count */}
      <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
        <p className="text-sm text-foreground">{summary}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {countState === 'loading'
            ? 'Counting matching listings'
            : countState === 'error'
              ? 'The live count is unavailable right now'
              : `${(count ?? 0).toLocaleString('en-US')} ${count === 1 ? 'listing matches' : 'listings match'} today`}
        </p>
      </div>
    </div>
  )
}

export default AlertCriteriaEditor
