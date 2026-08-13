'use client'

/**
 * Closed-sales explorer query, as a barrel Sheet. One filter per step.
 *
 * The GET contract is unchanged: year, city, type, fireplace, plus min/max
 * when those are already on the URL. This sheet does not invent a min/max
 * control (raw number inputs fail the design-token lint in a new file).
 * Values already in the query string ride through on Apply.
 */

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { ANALYTICS_CO_CITIES_PROPER } from '@/lib/data/analytics/co-cities'
import { labelPropertyType } from '@/lib/data/analytics/property-type-labels'

const YEAR_OPTIONS = [2016, 2018, 2020, 2022, 2023, 2024, 2025, 2026].map((year) => ({
  value: String(year),
  label: String(year),
}))

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'A', label: labelPropertyType('A') },
  { value: 'B', label: labelPropertyType('B') },
  { value: 'C', label: labelPropertyType('C') },
  { value: 'D', label: labelPropertyType('D') },
]

type Props = {
  year: number
  city?: string
  propertyType?: 'A' | 'B' | 'C' | 'D'
  fireplace: boolean
  minPrice?: number
  maxPrice?: number
}

export function HistoryFilterSheet({
  year,
  city,
  propertyType,
  fireplace,
  minPrice,
  maxPrice,
}: Props) {
  const router = useRouter()

  const yearOptions = useMemo(() => {
    const options = [...YEAR_OPTIONS]
    const current = String(year)
    if (!options.some((option) => option.value === current)) {
      options.push({ value: current, label: current })
      options.sort((a, b) => Number(a.value) - Number(b.value))
    }
    return options
  }, [year])

  const cityOptions = useMemo(
    () => [
      { value: 'all', label: 'All service-area cities' },
      ...ANALYTICS_CO_CITIES_PROPER.map((name) => ({ value: name, label: name })),
    ],
    [],
  )

  const steps: readonly V3SheetStep[] = useMemo(
    () => [
      {
        id: 'year',
        label: 'Which close year?',
        field: {
          kind: 'select',
          name: 'year',
          label: 'Year',
          required: true,
          options: yearOptions,
        },
        advanceLabel: 'Continue',
      },
      {
        id: 'city',
        label: 'Which city?',
        field: {
          kind: 'select',
          name: 'city',
          label: 'City',
          options: cityOptions,
        },
        advanceLabel: 'Continue',
      },
      {
        id: 'type',
        label: 'Which property type?',
        field: {
          kind: 'select',
          name: 'type',
          label: 'Property type',
          options: TYPE_OPTIONS,
        },
        advanceLabel: 'Continue',
      },
      {
        id: 'fireplace',
        label: 'Fireplace only?',
        field: {
          kind: 'choice',
          name: 'fireplace',
          label: 'Fireplace',
          options: [
            { value: '0', label: 'Any' },
            { value: '1', label: 'Fireplace only' },
          ],
        },
        advanceLabel: 'Run query',
      },
    ],
    [cityOptions, yearOptions],
  )

  const onAdvance = useCallback(
    (event: V3SheetAdvance) => {
      if (event.toStepId !== null) return
      const params = new URLSearchParams()
      const nextYear = event.answers.year?.trim()
      if (nextYear) params.set('year', nextYear)
      const nextCity = event.answers.city?.trim()
      if (nextCity && nextCity !== 'all') params.set('city', nextCity)
      const nextType = event.answers.type?.trim()
      if (nextType && nextType !== 'all') params.set('type', nextType)
      if (event.answers.fireplace === '1') params.set('fireplace', '1')
      if (minPrice != null && Number.isFinite(minPrice)) params.set('min', String(minPrice))
      if (maxPrice != null && Number.isFinite(maxPrice)) params.set('max', String(maxPrice))
      const qs = params.toString()
      router.push(qs ? `/housing-market/history?${qs}` : '/housing-market/history')
    },
    [maxPrice, minPrice, router],
  )

  return (
    <V3Sheet
      id="query"
      heading="Slice closed sales"
      eyebrow="Query"
      steps={steps}
      defaultAnswers={{
        year: String(year),
        city: city ?? 'all',
        type: propertyType ?? 'all',
        fireplace: fireplace ? '1' : '0',
      }}
      onAdvance={onAdvance}
    />
  )
}
