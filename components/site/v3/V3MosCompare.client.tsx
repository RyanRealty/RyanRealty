'use client'

/**
 * Region months-of-supply on a labeled threshold scale, with a searchable
 * city overlay (SITE-69 / SITE-92).
 *
 * The overlay IS the installed beui-combobox (`components/motion/combobox`):
 * ComboboxTrigger + ComboboxList, restyled navy on cream. House paint only.
 * Geometry reuses answerScaleGeometry so the mark and the bands never disagree.
 *
 * MOS stays two named bars upstream (V3Drawing). This is the scale that shows
 * where that ratio sits versus seller ≤4 / balanced 4–6 / buyer ≥6.
 */

import { useId, useMemo, useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/motion/combobox'
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
    format: { unit: ' mo', decimals: 1 },
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
  const overlayable = useMemo(
    () => cities.filter((c) => c.mos != null && c.mos > 0 && c.mosLabel && c.verdictLabel),
    [cities],
  )

  const [open, setOpen] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState<string | undefined>(undefined)

  const selected = useMemo(
    () => (selectedSlug ? overlayable.find((c) => c.slug === selectedSlug) ?? null : null),
    [overlayable, selectedSlug],
  )

  const geometry = useMemo(() => {
    const context =
      selected?.mos != null && selected.mosLabel
        ? { at: clampMos(selected.mos), label: selected.name }
        : undefined
    return answerScaleGeometry(scaleFor(regionMos, context))
  }, [regionMos, selected])

  if (!geometry || !Number.isFinite(regionMos) || regionMos <= 0) return null

  const activeBand = geometry.bands.find((b) => b.active)?.label ?? regionVerdict
  const idleRead =
    selected && selected.mosLabel && selected.verdictLabel
      ? `${selected.name} at ${selected.mosLabel} mo (${selected.verdictLabel}) · ${regionLabel} at ${regionMosLabel}`
      : `${regionVerdict} at ${regionMosLabel} months · ${activeBand}`

  return (
    <figure
      id={id}
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
          <p className="v3-mos-compare__label" id={`${uid}-combo-label`}>
            Overlay a city against the region
          </p>
          <Combobox
            value={selectedSlug ?? ''}
            onValueChange={setSelectedSlug}
            open={open}
            onOpenChange={setOpen}
            className="v3-mos-compare__combo-root"
          >
            <ComboboxTrigger>
              <ComboboxInput
                aria-label="Overlay a city against the region"
                aria-labelledby={`${uid}-combo-label`}
                placeholder={selected ? selected.name : 'Search a city with a published reading…'}
              />
            </ComboboxTrigger>
            {selected ? (
              <button
                type="button"
                className="v3-mos-compare__clear"
                onClick={() => {
                  setSelectedSlug(undefined)
                  setOpen(false)
                }}
              >
                Clear
              </button>
            ) : null}
            <ComboboxContent align="start">
              <ComboboxList ariaLabel="Cities with months of supply">
                {overlayable.map((city) => (
                  <ComboboxItem
                    key={city.slug}
                    value={city.slug}
                    textValue={city.name}
                    keywords={[city.name, city.mosLabel ?? '', city.verdictLabel ?? '']}
                  >
                    <span className="v3-mos-compare__option-name">{city.name}</span>
                    <span className="v3-mos-compare__option-meta">
                      {city.mosLabel} mo · {city.verdictLabel}
                      {city.activeLabel ? ` · ${city.activeLabel}` : ''}
                    </span>
                  </ComboboxItem>
                ))}
                <ComboboxEmpty>
                  No published reading matches that name.
                </ComboboxEmpty>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      ) : null}

      <span className="sr-only">{source}</span>
    </figure>
  )
}
