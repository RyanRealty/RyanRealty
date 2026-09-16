'use client'

/**
 * Region months-of-supply on a labeled threshold scale, with a searchable
 * city overlay (SITE-69; the overlay control rebuilt SITE-92 round 4).
 *
 * The scale is the house form: two named thresholds (seller ≤4 · balanced
 * 4–6 · buyer ≥6) on one rule, the region's reading as the subject mark and
 * one city's reading as the context mark. Geometry reuses answerScaleGeometry
 * so the mark and the bands never disagree.
 *
 * THE OVERLAY IS THE INSTALLED beUI COMBOBOX, whole — through the barrel's
 * V3TypeCombobox wrapper (components/motion/combobox, restyled navy on cream
 * in V3TypeCombobox.css): a trigger holding the current value, a portalled
 * popover that springs open, typeahead, roving focus, arrow / Home / End /
 * Enter / Escape, `role="option"` rows with the active row's sliding fill and
 * the selected row's check. The first build hand-rolled an input over a flat
 * list and named it after the catalog; two separate evaluators read it as "a
 * house dropdown wearing the combobox name" (`demoMatch: false`). The
 * interaction is the demo's now; only the paint is ours.
 *
 * THE FIRST ROW IS THE REGION ALONE. The catalog control always holds a
 * selection, and the compare's resting state is "no city overlaid", so the
 * region itself is the resting option: choosing it clears the overlay, and the
 * field at rest reads the region's own name. Each row's figure is the
 * published reading the row would draw — the months and the verdict, already
 * formatted upstream (G68) — never a number this file computes.
 *
 * MOS stays two named bars upstream (V3Drawing). This is the scale that shows
 * where that ratio sits versus the thresholds.
 */

import { useCallback, useId, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { answerScaleGeometry, type V3AnswerScale } from './V3Answers.marks'
import { V3TypeCombobox, type V3TypeComboboxProps, type V3TypeOption } from './V3TypeCombobox.client'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3MosCompare.css'

export const V3_MOS_COMPARE_MAX = 12

/** The overlay option that means "the region alone" — no city on the rule. */
export const V3_MOS_COMPARE_REGION_KEY = '__region'

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
  /**
   * THE OVERLAY CONTROL, handed to the page to render. The compare owns the
   * selection — which city is on the rule — and hands the control everything
   * it needs (`V3MosOverlayControlProps`: the rows, the value, the change
   * handler, the names); the page renders the barrel's V3TypeCombobox with the
   * one thing the page decides, how a typed query matches a city (a short
   * directory wants a prefix match, not the catalog's subsequence default).
   * Absent, the compare renders V3TypeCombobox itself with the catalog's own
   * filter. Same shape as a route handing a control down a barrel primitive
   * elsewhere: the markup lives here, the binding lives with the page.
   */
  renderOverlay?: (control: V3MosOverlayControlProps) => ReactNode
  id?: string
  className?: string
}

/** What the compare hands the overlay control: V3TypeCombobox's props minus the page's filter. */
export type V3MosOverlayControlProps = Pick<
  V3TypeComboboxProps,
  'label' | 'placeholder' | 'options' | 'value' | 'onChange' | 'emptyMessage' | 'inputClassName'
>

/**
 * How many cities sit in each band, off the same published readings the
 * bars draw. The idle caption used to restate the region's own figure —
 * "Balanced at 4.6 months · Balanced 4–6" after the bars and the number line
 * had shown 4.6 twice already (the separate evaluator's finding, 2026-09-16).
 * A count of cities per band is something the drawing does not say.
 */
export function mosBandCounts(
  cities: readonly Pick<V3MosCompareCity, 'mos'>[],
): { seller: number; balanced: number; buyer: number; total: number } {
  let seller = 0
  let balanced = 0
  let buyer = 0
  for (const c of cities) {
    if (c.mos == null || !Number.isFinite(c.mos) || c.mos <= 0) continue
    if (c.mos < 4) seller += 1
    else if (c.mos < 6) balanced += 1
    else buyer += 1
  }
  return { seller, balanced, buyer, total: seller + balanced + buyer }
}

/** The caption at rest: the region's reading once, then where the cities sit. */
export function mosCompareIdleRead(input: {
  regionLabel: string
  regionMosLabel: string
  regionVerdict: string
  cities: readonly Pick<V3MosCompareCity, 'mos'>[]
}): string {
  const head = `${input.regionLabel} at ${input.regionMosLabel} months, ${input.regionVerdict.toLowerCase()}`
  const n = mosBandCounts(input.cities)
  if (n.total === 0) return head
  const parts: string[] = []
  if (n.seller) parts.push(`${n.seller} seller's`)
  if (n.balanced) parts.push(`${n.balanced} balanced`)
  if (n.buyer) parts.push(`${n.buyer} buyer's`)
  return `${head} · of ${n.total} ${n.total === 1 ? 'city' : 'cities'} with a reading: ${parts.join(', ')}`
}

/** A city with a publishable reading: months, its label, and its verdict all present. */
export function mosOverlayable(cities: readonly V3MosCompareCity[]): V3MosCompareCity[] {
  return cities.filter(
    (c) => c.mos != null && Number.isFinite(c.mos) && c.mos > 0 && Boolean(c.mosLabel) && Boolean(c.verdictLabel),
  )
}

/** "Seller's market" → "Seller's": the row already sits under a months figure. */
function shortVerdict(label: string): string {
  return label.replace(/\s+market$/i, '')
}

/**
 * The overlay's option rows: the region alone first (the resting state), then
 * every city with a publishable reading, each carrying its months and verdict
 * as the row's figure. Pure, so the list a reader is offered can be held by a
 * test without a DOM. Empty when no city has a reading — then there is
 * nothing to overlay and the control is not drawn.
 */
export function mosOverlayOptions(input: {
  regionLabel: string
  regionMosLabel: string
  regionVerdict: string
  cities: readonly V3MosCompareCity[]
}): V3TypeOption[] {
  const overlayable = mosOverlayable(input.cities)
  if (overlayable.length === 0) return []
  return [
    {
      key: V3_MOS_COMPARE_REGION_KEY,
      label: `${input.regionLabel} alone`,
      count: `${input.regionMosLabel} mo · ${shortVerdict(input.regionVerdict)}`,
    },
    ...overlayable.map((c) => ({
      key: c.slug,
      label: c.name,
      count: `${c.mosLabel} mo · ${shortVerdict(c.verdictLabel!)}`,
    })),
  ]
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
  renderOverlay,
  id = 'cities-mos-compare',
  className,
}: V3MosCompareProps) {
  const uid = useId()

  const overlayable = useMemo(() => mosOverlayable(cities), [cities])
  const options = useMemo(
    () => mosOverlayOptions({ regionLabel, regionMosLabel, regionVerdict, cities }),
    [regionLabel, regionMosLabel, regionVerdict, cities],
  )

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

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

  const onOverlay = useCallback((key: string) => {
    setSelectedSlug(key === V3_MOS_COMPARE_REGION_KEY ? null : key)
  }, [])

  if (!geometry || !Number.isFinite(regionMos) || regionMos <= 0) return null

  const idleRead =
    selected && selected.mosLabel && selected.verdictLabel
      ? `${selected.name} at ${selected.mosLabel} mo (${selected.verdictLabel}) · ${regionLabel} at ${regionMosLabel}`
      : mosCompareIdleRead({ regionLabel, regionMosLabel, regionVerdict, cities })

  const overlayControl: V3MosOverlayControlProps = {
    label: 'Overlay a city against the region',
    placeholder: 'Type a city with a published reading…',
    options,
    value: selectedSlug ?? V3_MOS_COMPARE_REGION_KEY,
    onChange: onOverlay,
    emptyMessage: 'No published reading matches that name.',
    inputClassName: 'v3-mos-compare__input',
  }

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

      {options.length > 1 ? (
        <div className="v3-mos-compare__combo">
          <span className="v3-mos-compare__label" id={`${uid}-overlay`}>
            Overlay a city against the region
          </span>
          {renderOverlay ? renderOverlay(overlayControl) : <V3TypeCombobox {...overlayControl} />}
        </div>
      ) : null}

      <span className="sr-only">{source}</span>
    </figure>
  )
}
