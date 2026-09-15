'use client'

/**
 * house-sheet as All filters: one question per step (PUBLIC_UI Pattern 5).
 * First step is the dual-thumb ask. Echo + progress stay on — a dump of
 * type + flags + price on one cream panel is not the house sheet.
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

function order(a: number, b: number): { low: number; high: number } {
  return a <= b ? { low: a, high: b } : { low: b, high: a }
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
  const pair = order(
    Math.min(Math.max(draftPrice.low, first), last),
    Math.min(Math.max(draftPrice.high, first), last),
  )
  const loIdx = stopIndex(pair.low)
  const hiIdx = stopIndex(pair.high)

  const steps: readonly V3SheetStep[] = [
    {
      id: 'ask',
      label: 'What ask should this search include?',
      children: [beds ? `${beds}+ bedrooms already on this search.` : 'Min ask and Max ask on one track.'],
      blocks: [
        {
          kind: 'drawing',
          label: formatPriceRange(pair.low, pair.high, V3_PRICE_STOPS),
          node: (
            <RangeSlider
              values={[loIdx, hiIdx]}
              min={0}
              max={lastIdx}
              step={1}
              showTicks
              aria-label="Minimum ask"
              maxAriaLabel="Maximum ask"
              formatValueText={(i) => formatPriceStop(V3_PRICE_STOPS[i] ?? pair.low, V3_PRICE_STOPS)}
              onValuesChange={([nextLo, nextHi]) => {
                setDraftPrice(
                  order(V3_PRICE_STOPS[nextLo] ?? pair.low, V3_PRICE_STOPS[nextHi] ?? pair.high),
                )
              }}
            />
          ),
        },
      ],
      advanceLabel: 'Next',
    },
    {
      id: 'type',
      label: 'What kind of home?',
      field: {
        kind: 'select',
        name: 'propertyType',
        label: 'Home type',
        options: TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      },
      blocks: [
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
      showProgress
      showEcho
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
