'use client'

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { PulseEventType } from '@/app/actions/pulse-feed'

type Props = {
  cities: string[]
  selectedCities: string[]
  onCitiesChange: (next: string[]) => void
  eventTypes: { value: PulseEventType | 'all'; label: string }[]
  selectedEventTypes: PulseEventType[]
  onEventTypesChange: (next: PulseEventType[]) => void
}

export default function PulseFilters({
  cities,
  selectedCities,
  onCitiesChange,
  eventTypes,
  selectedEventTypes,
  onEventTypesChange,
}: Props) {
  const allCitiesActive = selectedCities.length === 0
  const allEventsActive = selectedEventTypes.length === 0

  const toggleCity = useCallback(
    (city: string) => {
      if (selectedCities.includes(city)) {
        onCitiesChange(selectedCities.filter((c) => c !== city))
      } else {
        onCitiesChange([...selectedCities, city])
      }
    },
    [onCitiesChange, selectedCities]
  )

  const toggleEvent = useCallback(
    (value: PulseEventType | 'all') => {
      if (value === 'all') {
        onEventTypesChange([])
        return
      }
      if (selectedEventTypes.includes(value)) {
        onEventTypesChange(selectedEventTypes.filter((v) => v !== value))
      } else {
        onEventTypesChange([...selectedEventTypes, value])
      }
    },
    [onEventTypesChange, selectedEventTypes]
  )

  return (
    <div className="space-y-2.5">
      <ChipRow label="Cities">
        <Chip active={allCitiesActive} onClick={() => onCitiesChange([])}>
          All cities
        </Chip>
        {cities.map((city) => (
          <Chip
            key={city}
            active={!allCitiesActive && selectedCities.includes(city)}
            onClick={() => toggleCity(city)}
          >
            {city}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow label="Events">
        {eventTypes.map((evt) => {
          const isAll = evt.value === 'all'
          const active = isAll ? allEventsActive : selectedEventTypes.includes(evt.value as PulseEventType)
          return (
            <Chip key={evt.value} active={active} onClick={() => toggleEvent(evt.value)}>
              {evt.label}
            </Chip>
          )
        })}
      </ChipRow>
    </div>
  )
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs uppercase tracking-[0.14em] text-muted-foreground sm:inline-block">
        {label}
      </span>
      <div className="-mx-1 flex flex-1 items-center gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
        {children}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-card text-foreground hover:bg-secondary'
      )}
    >
      {children}
    </button>
  )
}
