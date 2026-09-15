'use client'

/**
 * house-sheet as All filters: one step, the shadcn checkbox object.
 * Price lives once on the dock DualTickRange — repeating it here failed.
 * Eyebrow is Filters so the sheet does not read as a clipped Save control.
 */
import { useEffect, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'

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

const TYPE_CHECKS = [
  { key: 'A', label: 'House' },
  { key: 'B', label: 'Condo' },
  { key: 'C', label: 'Multi-family' },
  { key: 'D', label: 'Land' },
] as const

const FLAG_FIELDS = [
  { key: 'hasPool', label: 'Pool' },
  { key: 'hasWaterfront', label: 'Waterfront' },
  { key: 'hasView', label: 'View' },
  { key: 'hasFireplace', label: 'Fireplace' },
  { key: 'hasGolfCourse', label: 'Golf' },
] as const

type FlagKey = (typeof FLAG_FIELDS)[number]['key']
type TypeKey = (typeof TYPE_CHECKS)[number]['key']

export function SearchFiltersSheet({
  open,
  onOpenChange,
  onApply,
  propertyType,
  hasPool,
  hasView,
  hasWaterfront,
  hasFireplace,
  hasGolfCourse,
}: SearchFiltersSheetProps) {
  const [draftTypes, setDraftTypes] = useState<Record<TypeKey, boolean>>({
    A: propertyType === 'A' || !propertyType,
    B: propertyType === 'B',
    C: propertyType === 'C',
    D: propertyType === 'D',
  })
  const [draftFlags, setDraftFlags] = useState<Record<FlagKey, boolean>>({
    hasPool: hasPool === '1',
    hasView: hasView === '1',
    hasWaterfront: hasWaterfront === '1',
    hasFireplace: hasFireplace === '1',
    hasGolfCourse: hasGolfCourse === '1',
  })
  useEffect(() => {
    setDraftTypes({
      A: propertyType === 'A' || !propertyType,
      B: propertyType === 'B',
      C: propertyType === 'C',
      D: propertyType === 'D',
    })
  }, [propertyType])
  useEffect(() => {
    setDraftFlags({
      hasPool: hasPool === '1',
      hasView: hasView === '1',
      hasWaterfront: hasWaterfront === '1',
      hasFireplace: hasFireplace === '1',
      hasGolfCourse: hasGolfCourse === '1',
    })
  }, [hasPool, hasView, hasWaterfront, hasFireplace, hasGolfCourse])

  const steps: readonly V3SheetStep[] = [
    {
      id: 'type',
      label: 'What kind of home?',
      children: ['House, condo, land, and the flags that belong on this search.'],
      blocks: [
        {
          kind: 'drawing',
          label: 'Home type',
          node: (
            <div className="grid gap-3">
              {TYPE_CHECKS.map((row) => {
                const id = `srch-type-${row.key}`
                return (
                  <div key={row.key} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={draftTypes[row.key]}
                      onCheckedChange={(next) => {
                        setDraftTypes((prev) => ({ ...prev, [row.key]: next === true }))
                      }}
                    />
                    <Label htmlFor={id}>{row.label}</Label>
                  </div>
                )
              })}
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
      advanceLabel: 'See homes',
    },
  ]

  return (
    <V3Sheet
      heading="All filters"
      eyebrow="Filters"
      surface="drawer"
      open={open}
      onOpenChange={onOpenChange}
      showProgress={false}
      showEcho
      steps={steps}
      onAdvance={(event: V3SheetAdvance) => {
        if (event.toStepId != null) return
        const selected = TYPE_CHECKS.filter((row) => draftTypes[row.key]).map((row) => row.key)
        const flags: Record<string, string | undefined> = {}
        for (const flag of FLAG_FIELDS) {
          flags[flag.key] = draftFlags[flag.key] ? '1' : undefined
        }
        onApply({
          propertyType: selected.length === 1 ? selected[0] : undefined,
          ...flags,
        })
        onOpenChange(false)
      }}
    />
  )
}
