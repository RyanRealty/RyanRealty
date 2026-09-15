'use client'

/**
 * house-sheet as All filters. Progressive V3Sheet + catalog RangeSlider.
 * Not the registry min/max dump (demoMatch false).
 */
import { useEffect, useMemo, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { rangeToUrl, urlToRange, V3_PRICE_STOPS } from '@/components/site/v3/V3Range.logic'
import { SearchPriceRail } from './SearchPriceRail.client'

export type SearchFiltersSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (updates: Record<string, string | undefined>) => void
  minPrice?: string
  maxPrice?: string
  beds?: string
  propertyType?: string
}

const BED_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
] as const

const TYPE_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'A', label: 'Houses' },
  { value: 'B', label: 'Condos and townhomes' },
  { value: 'C', label: 'Multi-family' },
  { value: 'D', label: 'Land' },
] as const

export function SearchFiltersSheet({
  open,
  onOpenChange,
  onApply,
  minPrice,
  maxPrice,
  beds,
  propertyType,
}: SearchFiltersSheetProps) {
  const urlPrice = useMemo(
    () => urlToRange(minPrice, maxPrice, V3_PRICE_STOPS),
    [minPrice, maxPrice],
  )
  const [draftPrice, setDraftPrice] = useState(urlPrice)
  useEffect(() => {
    setDraftPrice(urlPrice)
  }, [urlPrice])

  const steps: readonly V3SheetStep[] = [
    {
      id: 'beds',
      label: 'How many bedrooms?',
      field: {
        kind: 'choice',
        name: 'beds',
        label: 'Bedrooms',
        options: BED_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      },
      advanceLabel: 'Next',
    },
    {
      id: 'type',
      label: 'What kind of home?',
      field: {
        kind: 'choice',
        name: 'propertyType',
        label: 'Home type',
        options: TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      },
      advanceLabel: 'See homes',
    },
  ]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close all filters"
        className="absolute inset-0 bg-foreground/40"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-label="All filters"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-background"
      >
        <div className="border-b border-border px-4 py-3">
          <SearchPriceRail
            low={draftPrice.low}
            high={draftPrice.high}
            onChange={(low, high) => setDraftPrice({ low, high })}
            onCommit={(low, high) => setDraftPrice({ low, high })}
          />
        </div>
        <V3Sheet
          heading="All filters"
          eyebrow="This search"
          defaultAnswers={{
            beds: beds || 'any',
            propertyType: propertyType || 'any',
          }}
          steps={steps}
          onAdvance={(event: V3SheetAdvance) => {
            if (event.toStepId != null) return
            const next = rangeToUrl(draftPrice.low, draftPrice.high, V3_PRICE_STOPS)
            onApply({
              minPrice: next.min,
              maxPrice: next.max,
              beds: event.answers.beds && event.answers.beds !== 'any' ? event.answers.beds : undefined,
              propertyType:
                event.answers.propertyType && event.answers.propertyType !== 'any'
                  ? event.answers.propertyType
                  : undefined,
            })
            onOpenChange(false)
          }}
        />
      </div>
    </div>
  )
}
