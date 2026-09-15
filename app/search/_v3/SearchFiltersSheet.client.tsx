'use client'

/**
 * house-sheet as All filters. Bare V3Sheet drawer with dual tick-stop
 * RangeSliders and shadcn Checkbox flags — not a thin cream Any-list.
 */
import { useEffect, useMemo, useState } from 'react'
import { RangeSlider } from '@/components/motion/range-slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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

const FLAG_FIELDS = [
  { key: 'hasPool', label: 'Pool' },
  { key: 'hasWaterfront', label: 'Waterfront' },
  { key: 'hasView', label: 'View' },
  { key: 'hasFireplace', label: 'Fireplace' },
  { key: 'hasGolfCourse', label: 'Golf' },
] as const

type FlagKey = (typeof FLAG_FIELDS)[number]['key']

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
  const [draftFlags, setDraftFlags] = useState<Record<FlagKey, boolean>>({
    hasPool: hasPool === '1',
    hasView: hasView === '1',
    hasWaterfront: hasWaterfront === '1',
    hasFireplace: hasFireplace === '1',
    hasGolfCourse: hasGolfCourse === '1',
  })
  useEffect(() => {
    setDraftPrice(urlPrice)
  }, [urlPrice])
  useEffect(() => {
    setDraftFlags({
      hasPool: hasPool === '1',
      hasView: hasView === '1',
      hasWaterfront: hasWaterfront === '1',
      hasFireplace: hasFireplace === '1',
      hasGolfCourse: hasGolfCourse === '1',
    })
  }, [hasPool, hasView, hasWaterfront, hasFireplace, hasGolfCourse])

  const lastIdx = Math.max(0, V3_PRICE_STOPS.length - 1)
  const first = V3_PRICE_STOPS[0] ?? 0
  const last = V3_PRICE_STOPS[lastIdx] ?? first
  const lo = Math.min(Math.max(draftPrice.low, first), last)
  const hi = Math.min(Math.max(draftPrice.high, first), last)
  const loIdx = stopIndex(lo)
  const hiIdx = stopIndex(hi)

  const steps: readonly V3SheetStep[] = [
    {
      id: 'filters',
      label: 'What should this search include?',
      children: [beds ? `${beds}+ bedrooms already on this search.` : 'Price, type, and flags.'],
      blocks: [
        {
          kind: 'drawing',
          label: formatPriceRange(lo, hi, V3_PRICE_STOPS),
          node: (
            <div className="grid gap-2">
              <RangeSlider
                value={loIdx}
                min={0}
                max={lastIdx}
                step={1}
                showTicks
                aria-label="Minimum ask"
                formatValueText={(i) => formatPriceStop(V3_PRICE_STOPS[i] ?? lo, V3_PRICE_STOPS)}
                onValueChange={(i) => {
                  const next = V3_PRICE_STOPS[i] ?? lo
                  setDraftPrice({ low: Math.min(next, hi), high: Math.max(next, hi) })
                }}
              />
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
                  setDraftPrice({ low: Math.min(lo, next), high: Math.max(lo, next) })
                }}
              />
            </div>
          ),
        },
        {
          kind: 'drawing',
          label: 'Flags',
          node: (
            <div className="grid gap-3">
              {FLAG_FIELDS.map((flag) => {
                const id = `srch-flag-${flag.key}`
                return (
                  <div key={flag.key} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={draftFlags[flag.key]}
                      onCheckedChange={(next) => {
                        setDraftFlags((prev) => ({ ...prev, [flag.key]: next === true }))
                      }}
                    />
                    <Label htmlFor={id}>{flag.label}</Label>
                  </div>
                )
              })}
            </div>
          ),
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
        const flags: Record<string, string | undefined> = {}
        for (const flag of FLAG_FIELDS) {
          flags[flag.key] = draftFlags[flag.key] ? '1' : undefined
        }
        onApply({
          minPrice: next.min,
          maxPrice: next.max,
          propertyType:
            event.answers.propertyType && event.answers.propertyType !== 'any'
              ? event.answers.propertyType
              : undefined,
          ...flags,
        })
        onOpenChange(false)
      }}
    />
  )
}
