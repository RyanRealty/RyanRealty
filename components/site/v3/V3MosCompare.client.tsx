'use client'

/**
 * Region months-of-supply on a labeled threshold scale, with a searchable
 * city overlay (SITE-69).
 *
 * Adapted from beui:combobox (searchable select that reveals more data) and
 * beautifului:insight-cards (one figure compared against another). House paint
 * only: navy on cream. Geometry reuses answerScaleGeometry so the mark and the
 * bands never disagree.
 *
 * MOS stays two named bars upstream (V3Drawing). This is the scale that shows
 * where that ratio sits versus seller ≤4 / balanced 4–6 / buyer ≥6.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { cn } from '@/lib/utils'
import { answerScaleGeometry, type V3AnswerScale } from './V3Answers.marks'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3MosCompare.css'

export const V3_MOS_COMPARE_MAX = 12

export type V3MosCompareCity = {
  slug: string
  name: string
  mos: number | null
  mosLabel: string | null
  verdictLabel: string | null
  activeLabel: string | null
}

export type V3MosCompareProps = {
  regionLabel: string
  regionMos: number
  regionMosLabel: string
  regionVerdict: string
  cities: readonly V3MosCompareCity[]
  source: string
  id?: string
  className?: string
}

function clampMos(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.min(value, V3_MOS_COMPARE_MAX)
}

function scaleFor(at: number, context?: { at: number; label: string }): V3AnswerScale {
  return {
    kind: 'scale',
    min: 0,
    max: V3_MOS_COMPARE_MAX,
    at: clampMos(at),
    minLabel: '0',
    maxLabel: `${V3_MOS_COMPARE_MAX}+`,
    bands: [
      { to: 4, label: "Seller's ≤4" },
      { to: 6, label: 'Balanced 4–6' },
      { to: V3_MOS_COMPARE_MAX, label: "Buyer's ≥6" },
    ],
    ...(context ? { context } : {}),
    subjectLabel: 'Region',
    format: (n) => `${n.toFixed(1)} mo`,
  }
}

export function V3MosCompare({
  regionLabel,
  regionMos,
  regionMosLabel,
  regionVerdict,
  cities,
  source,
  id = 'cities-mos-compare',
  className,
}: V3MosCompareProps) {
  const uid = useId()
  const listId = `${uid}-list`
  const inputId = `${uid}-input`
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const overlayable = useMemo(
    () => cities.filter((c) => c.mos != null && c.mos > 0 && c.mosLabel && c.verdictLabel),
    [cities],
  )

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const selected = useMemo(
    () => (selectedSlug ? overlayable.find((c) => c.slug === selectedSlug) ?? null : null),
    [overlayable, selectedSlug],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return overlayable
    return overlayable.filter((c) => {
      const hay = `${c.name} ${c.mosLabel ?? ''} ${c.verdictLabel ?? ''}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [overlayable, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    const onKey = (event: Event) => {
      const ke = event as unknown as KeyboardEvent
      if (ke.key === 'Escape') {
        setOpen(false)
        setQuery('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const geometry = useMemo(() => {
    const context =
      selected?.mos != null && selected.mosLabel
        ? { at: clampMos(selected.mos), label: selected.name }
        : undefined
    return answerScaleGeometry(scaleFor(regionMos, context))
  }, [regionMos, selected])

  const selectCity = useCallback((slug: string) => {
    setSelectedSlug(slug)
    setOpen(false)
    setQuery('')
  }, [])

  const clearCity = useCallback(() => {
    setSelectedSlug(null)
    setQuery('')
    setOpen(false)
  }, [])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (!open) {
          setOpen(true)
          return
        }
        setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (!open) {
          setOpen(true)
          return
        }
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const hit = filtered[activeIndex]
        if (open && hit) selectCity(hit.slug)
        else setOpen(true)
      } else if (event.key === 'Escape' && open) {
        event.preventDefault()
        setOpen(false)
        setQuery('')
      }
    },
    [activeIndex, filtered, open, selectCity],
  )

  if (!geometry || !Number.isFinite(regionMos) || regionMos <= 0) return null

  const activeBand = geometry.bands.find((b) => b.active)?.label ?? regionVerdict
  const idleRead =
    selected && selected.mosLabel && selected.verdictLabel
      ? `${selected.name} at ${selected.mosLabel} mo (${selected.verdictLabel}) · ${regionLabel} at ${regionMosLabel}`
      : `${regionVerdict} at ${regionMosLabel} months · ${activeBand}`

  return (
    <figure
      id={id}
      ref={rootRef}
      className={cn(V3_ROOT_CLASS, 'v3-mos-compare', className)}
      aria-labelledby={`${uid}-caption`}
    >
      <p className="v3-mos-compare__plain" id={`${uid}-caption`}>
        Seller ≤4 · balanced 4–6 · buyer ≥6
      </p>

      <div
        className="v3-mos-compare__field"
        role="img"
        aria-label={`${regionLabel} months of supply ${regionMosLabel}, ${regionVerdict}. Scale from 0 to ${V3_MOS_COMPARE_MAX} months with thresholds at 4 and 6.${
          selected?.mosLabel ? ` Overlay: ${selected.name} at ${selected.mosLabel} months.` : ''
        }`}
      >
        <div className="v3-mos-compare__bands" aria-hidden="true">
          {geometry.bands.map((band) => (
            <span
              key={band.label}
              className={cn('v3-mos-compare__band', band.active && 'v3-mos-compare__band--is')}
              style={{ left: `${band.fromPct}%`, width: `${band.widthPct}%` }}
            >
              <span className="v3-mos-compare__band-label">{band.label}</span>
            </span>
          ))}
        </div>
        <div className="v3-mos-compare__rule" aria-hidden="true">
          <span className="v3-mos-compare__tick" style={{ left: '33.333%' }} data-label="4" />
          <span className="v3-mos-compare__tick" style={{ left: '50%' }} data-label="6" />
          <span
            className="v3-mos-compare__at v3-mos-compare__at--region"
            style={{ left: `${geometry.atPct}%` }}
            title={`${regionLabel} ${regionMosLabel}`}
          />
          {geometry.contextPct != null && selected ? (
            <span
              className="v3-mos-compare__at v3-mos-compare__at--city"
              style={{ left: `${geometry.contextPct}%` }}
              title={`${selected.name} ${selected.mosLabel}`}
            />
          ) : null}
        </div>
        <div className="v3-mos-compare__ends" aria-hidden="true">
          <span>0</span>
          <span>{V3_MOS_COMPARE_MAX}+</span>
        </div>
      </div>

      <p className="v3-mos-compare__readout" aria-live="polite">
        {idleRead}
      </p>

      {overlayable.length > 0 ? (
        <div className="v3-mos-compare__combo">
          <label htmlFor={inputId} className="v3-mos-compare__label">
            Overlay a city against the region
          </label>
          <div className={cn('v3-mos-compare__trigger', open && 'is-open')} data-state={open ? 'open' : 'closed'}>
            <input
              ref={inputRef}
              id={inputId}
              role="combobox"
              type="search"
              className="v3-mos-compare__input"
              placeholder={selected ? selected.name : 'Search a city with a published reading…'}
              value={open ? query : selected?.name ?? ''}
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                open && filtered[activeIndex] ? `${uid}-opt-${filtered[activeIndex]!.slug}` : undefined
              }
              autoComplete="off"
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onChange={(event) => {
                setOpen(true)
                setQuery(event.target.value)
              }}
              onKeyDown={onKeyDown}
            />
            {selected ? (
              <button type="button" className="v3-mos-compare__clear" onClick={clearCity}>
                Clear
              </button>
            ) : null}
          </div>
          {open ? (
            <ul id={listId} role="listbox" className="v3-mos-compare__list" aria-label="Cities with months of supply">
              {filtered.length === 0 ? (
                <li className="v3-mos-compare__empty" role="presentation">
                  No published reading matches that name.
                </li>
              ) : (
                filtered.map((city, index) => (
                  <li key={city.slug} role="presentation">
                    <button
                      type="button"
                      role="option"
                      id={`${uid}-opt-${city.slug}`}
                      aria-selected={selectedSlug === city.slug}
                      className={cn(
                        'v3-mos-compare__option',
                        index === activeIndex && 'is-active',
                        selectedSlug === city.slug && 'is-selected',
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectCity(city.slug)}
                    >
                      <span className="v3-mos-compare__option-name">{city.name}</span>
                      <span className="v3-mos-compare__option-meta">
                        {city.mosLabel} mo · {city.verdictLabel}
                        {city.activeLabel ? ` · ${city.activeLabel}` : ''}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}

      <span className="sr-only">{source}</span>
    </figure>
  )
}
