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
 *
 * Admin v2 (11F): off shadcn and onto the locked admin language. Each Select
 * -> ToolbarSelect (a native select with its groups as <optgroup>, which the
 * platform makes accessible for free); each Input+Label pair -> TextField,
 * whose own label element carries the htmlFor association the explicit ids
 * used to; each Checkbox -> ToolbarCheck, which owns the wrapping label; the two
 * disclosures (the price Popover, the "More filters" Collapsible) -> native
 * <details>, the shape the locked language uses wherever a panel hangs off a
 * trigger. Triggers wear the av2-btn CLASSES rather than an inline background
 * so their :hover and [aria-expanded] states still fire.
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
import { TextField, ToolbarCheck, ToolbarSelect } from '@/components/admin/v2'
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

/**
 * Layout-only sizing so every inline control clears 44 px on touch screens. An
 * inline style rather than a `min-h-11` class: admin-v2.css is UNLAYERED, so
 * .av2-input--bar's 32px min-height outranks any Tailwind utility no matter its
 * specificity (the @layer lesson recorded in admin-v2.css itself).
 */
const TOUCH_TRIGGER = { minHeight: 'var(--a-touch)' } as const

/** A panel hanging off a <details> summary (was PopoverContent). */
const DISCLOSURE_PANEL = {
  position: 'absolute',
  left: 0,
  top: '100%',
  marginTop: 4,
  zIndex: 30,
  width: 288,
  maxWidth: '90vw',
  background: 'var(--a-bg)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-md)',
  boxShadow: 'var(--a-shadow-overlay)',
  padding: 'var(--a-s3)',
} as const

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

  // A disabled disclosure cannot be a disabled <summary> — the element takes no
  // such attribute — so it stops taking pointer events and dims, which is what
  // .av2-btn:disabled does for a real button.
  const disclosureDisabled = disabled ? { pointerEvents: 'none' as const, opacity: 0.5 } : null

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
      <div
        className="flex flex-wrap items-center gap-x-1.5 gap-y-2"
        style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}
      >
        <span>Email me</span>

        {frequency !== undefined && onFrequencyChange ? (
          <ToolbarSelect
            aria-label="How often to email"
            value={frequency}
            onChange={(e) => onFrequencyChange(e.target.value as AlertFrequency)}
            disabled={disabled}
            style={TOUCH_TRIGGER}
          >
            {FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </ToolbarSelect>
        ) : frequency !== undefined ? (
          <span style={{ fontWeight: 500 }}>{alertFrequencyPhrase(frequency)}</span>
        ) : null}

        <span>with</span>

        <ToolbarSelect
          aria-label="Property type"
          value={propertyType}
          onChange={(e) => update({ propertyType: e.target.value === 'all' ? undefined : e.target.value })}
          disabled={disabled}
          style={TOUCH_TRIGGER}
        >
          {PROPERTY_TYPES.map(({ value: optionValue, label }) => (
            <option key={optionValue || 'all'} value={optionValue || 'all'}>
              {optionValue ? `${label.toLowerCase()} listings` : 'new listings'}
            </option>
          ))}
        </ToolbarSelect>

        <span>in</span>

        <ToolbarSelect
          aria-label="Place"
          value={placeValue}
          onChange={(e) => handlePlaceChange(e.target.value)}
          disabled={disabled}
          style={TOUCH_TRIGGER}
        >
          <option value="anywhere">all of Central Oregon</option>
          <optgroup label="Cities">
            {cityList.map((name) => (
              <option key={`city:${name}`} value={`city:${name}`}>{name}</option>
            ))}
          </optgroup>
          <optgroup label="Neighborhoods and communities">
            {neighborhoodList.map((option) => (
              <option key={`nbhd:${option.slug}`} value={`nbhd:${option.slug}`}>
                {option.label}
              </option>
            ))}
          </optgroup>
        </ToolbarSelect>

        <span>priced</span>

        <details style={{ position: 'relative' }}>
          <summary
            className="av2-btn av2-btn--quiet"
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : undefined}
            style={{ ...TOUCH_TRIGGER, ...disclosureDisabled }}
          >
            {priceLabel}
          </summary>
          <div style={DISCLOSURE_PANEL}>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Min price"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="No minimum"
                value={numberInputValue(minPrice)}
                onChange={(e) => handleNumberChange('minPrice', e.target.value)}
                disabled={disabled}
              />
              <TextField
                label="Max price"
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
        </details>

        <span>with</span>

        <ToolbarSelect
          aria-label="Minimum beds"
          value={beds}
          onChange={(e) => update({ beds: e.target.value === 'any' ? undefined : Number(e.target.value) })}
          disabled={disabled}
          style={TOUCH_TRIGGER}
        >
          {MIN_COUNT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === 'any' ? 'any' : `${option}+`}
            </option>
          ))}
        </ToolbarSelect>

        <span>beds and</span>

        <ToolbarSelect
          aria-label="Minimum baths"
          value={baths}
          onChange={(e) => update({ baths: e.target.value === 'any' ? undefined : Number(e.target.value) })}
          disabled={disabled}
          style={TOUCH_TRIGGER}
        >
          {MIN_COUNT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === 'any' ? 'any' : `${option}+`}
            </option>
          ))}
        </ToolbarSelect>

        <span>baths</span>
      </div>

      {/* More filters */}
      <details open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
        <summary
          className="av2-btn av2-btn--quiet"
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : undefined}
          style={{ ...TOUCH_TRIGGER, ...disclosureDisabled }}
        >
          {moreOpen ? 'Hide more filters' : 'More filters'}
          {moreCount > 0 ? (
            <span className="tabular-nums" style={{ color: 'var(--a-text-2)' }}>({moreCount} set)</span>
          ) : null}
        </summary>
        <div
          className="mt-2 grid gap-4 sm:grid-cols-2"
          style={{
            border: '1px solid var(--a-border)',
            borderRadius: 'var(--a-r-lg)',
            padding: 'var(--a-s3)',
          }}
        >
          <TextField
            label="Square feet, at least"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Any"
            value={numberInputValue(normalized.minSqFt)}
            onChange={(e) => handleNumberChange('minSqFt', e.target.value)}
            disabled={disabled}
          />
          <TextField
            label="Square feet, at most"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Any"
            value={numberInputValue(normalized.maxSqFt)}
            onChange={(e) => handleNumberChange('maxSqFt', e.target.value)}
            disabled={disabled}
          />
          <TextField
            label="Built after"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Any year"
            value={numberInputValue(normalized.yearBuiltMin)}
            onChange={(e) => handleNumberChange('yearBuiltMin', e.target.value)}
            disabled={disabled}
          />
          <TextField
            label="Built before"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Any year"
            value={numberInputValue(normalized.yearBuiltMax)}
            onChange={(e) => handleNumberChange('yearBuiltMax', e.target.value)}
            disabled={disabled}
          />
          <TextField
            label="Lot size, at least (acres)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            placeholder="Any"
            value={numberInputValue(normalized.lotAcresMin)}
            onChange={(e) => handleNumberChange('lotAcresMin', e.target.value)}
            disabled={disabled}
          />
          <TextField
            label="Lot size, at most (acres)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            placeholder="Any"
            value={numberInputValue(normalized.lotAcresMax)}
            onChange={(e) => handleNumberChange('lotAcresMax', e.target.value)}
            disabled={disabled}
          />
          <div className="grid gap-2 sm:col-span-2">
            <p style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>Must have</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {AMENITY_TOGGLES.map(({ key, label }) => (
                <ToolbarCheck
                  key={key}
                  label={label}
                  checked={normalized[key] === true}
                  onChange={(e) => update({ [key]: e.target.checked ? true : undefined })}
                  disabled={disabled}
                  aria-label={label}
                  labelStyle={{ minHeight: 'var(--a-touch)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </details>

      {/* Live summary + count */}
      <div
        style={{
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-md)',
          background: 'var(--a-inset)',
          padding: '8px var(--a-s3)',
        }}
      >
        <p style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>{summary}</p>
        <p
          className="mt-0.5 tabular-nums"
          style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
          aria-live="polite"
        >
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
