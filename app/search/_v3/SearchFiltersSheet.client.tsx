'use client'

/**
 * house-sheet as All filters. Bare V3Sheet drawer — one working surface
 * with price, type, and flags together. Not a custom right-rail wizard.
 */
import { useEffect, useMemo, useState } from 'react'
import { RangeSlider } from '@/components/motion/range-slider'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import {
  formatPriceRange,
  formatPriceStop,
  rangeToUrl,
  snapToStops,
  urlToRange,
  V3_PRICE_STOPS,
} from '@/components/site/v3/V3Range.logic'

export type SearchFiltersSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (updates: Record<string, string | undefined>) => void
  minPrice?: string
  maxPrice?: string
  beds?: string
  propertyType?: string
  hasPool?: string
  hasView?: string
  hasWaterfront?: string
  hasFireplace?: string
  hasGolfCourse?: string
}

const TYPE_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'A', label: 'Houses' },
  { value: 'B', label: 'Condos and townhomes' },
  { value: 'C', label: 'Multi-family' },
  { value: 'D', label: 'Land' },
] as const

function flagValue(on: string | undefined): string {
  return on === '1' ? 'On' : 'Any'
}

function stopIndex(value: number): number {
  const snapped = snapToStops(value, V3_PRICE_STOPS)
  const exact = V3_PRICE_STOPS.indexOf(snapped as (typeof V3_PRICE_STOPS)[number])
  if (exact >= 0) return exact
  let best = 0
  for (let i = 1; i < V3_PRICE_STOPS.length; i++) {
    const stop = V3_PRICE_STOPS[i] ?? 0
    const bestStop = V3_PRICE_STOPS[best] ?? 0
    if (Math.abs(stop - value) < Math.abs(bestStop - value)) best = i
  }
  return best
}

export function SearchFiltersSheet({
  open,
  onOpenChange,
  onApply,
  minPrice,
  maxPrice,
  beds,
  propertyType,
  hasPool,
  hasView,
  hasWaterfront,
  hasFireplace,
  hasGolfCourse,
}: SearchFiltersSheetProps) {
  const urlPrice = useMemo(
    () => urlToRange(minPrice, maxPrice, V3_PRICE_STOPS),
    [minPrice, maxPrice],
  )
  const [draftPrice, setDraftPrice] = useState(urlPrice)
  useEffect(() => {
    setDraftPrice(urlPrice)
  }, [urlPrice])

  const lastIdx = Math.max(0, V3_PRICE_STOPS.length - 1)
  const hiIdx = stopIndex(draftPrice.high)
  const first = V3_PRICE_STOPS[0] ?? 0
  const last = V3_PRICE_STOPS[lastIdx] ?? first
  const lo = Math.min(Math.max(draftPrice.low, first), last)
  const hi = V3_PRICE_STOPS[hiIdx] ?? last

  const steps: readonly V3SheetStep[] = [
    {
      id: 'filters',
      label: 'What should this search include?',
      children: ['Price, type, and flags.'],
      blocks: [
        {
          kind: 'drawing',
          label: formatPriceRange(lo, hi, V3_PRICE_STOPS),
          node: (
            <RangeSlider
              value={hiIdx}
              min={0}
              max={lastIdx}
              step={1}
              showTicks
              aria-label="Maximum ask"
              formatValueText={(i) => formatPriceStop(V3_PRICE_STOPS[i] ?? hi, V3_PRICE_STOPS)}
              onValueChange={(i) => {
                const next = V3_PRICE_STOPS[i] ?? hi
                setDraftPrice({ low: lo, high: next })
              }}
            />
          ),
        },
        {
          kind: 'facts',
          label: 'Flags',
          items: [
            { label: 'Bedrooms', value: beds ? `${beds}+` : 'Any' },
            { label: 'Pool', value: flagValue(hasPool) },
            { label: 'Waterfront', value: flagValue(hasWaterfront) },
            { label: 'View', value: flagValue(hasView) },
            { label: 'Fireplace', value: flagValue(hasFireplace) },
            { label: 'Golf', value: flagValue(hasGolfCourse) },
          ],
        },
      ],
      field: {
        kind: 'select',
        name: 'propertyType',
        label: 'Home type',
        options: TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      },
      advanceLabel: 'See homes',
    },
  ]

  return (
    <V3Sheet
      heading="All filters"
      eyebrow="This search"
      surface="drawer"
      open={open}
      onOpenChange={onOpenChange}
      showProgress={false}
      showEcho={false}
      defaultAnswers={{
        propertyType: propertyType || 'any',
      }}
      steps={steps}
      onAdvance={(event: V3SheetAdvance) => {
        if (event.toStepId != null) return
        const next = rangeToUrl(draftPrice.low, draftPrice.high, V3_PRICE_STOPS)
        onApply({
          minPrice: next.min,
          maxPrice: next.max,
          propertyType:
            event.answers.propertyType && event.answers.propertyType !== 'any'
              ? event.answers.propertyType
              : undefined,
        })
        onOpenChange(false)
      }}
    />
  )
}
