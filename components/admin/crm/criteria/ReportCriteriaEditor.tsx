'use client'

/**
 * ReportCriteriaEditor — a reusable, broker-friendly editor for a market
 * report subscription: "Send a [monthly] market report for [Bend and
 * Tetherow]". The cadence is an inline Select; the areas bracket opens a
 * searchable multi-select over the real area registry. Below the sentence
 * controls, the live plain-English sentence restates the subscription.
 *
 * Area options are PROPS-PASSED, not self-loaded: the parent server-loads
 * them once (listAvailableMarketReportAreas() from
 * lib/data/crm/getContactReportSubscriptions in a server component, or
 * getSubscriptionEditOptionsAction from a client dialog) and hands them down.
 * That keeps this component free of data fetching and lets one options load
 * serve many editors on a page. Areas already on the subscription but missing
 * from the registry stay visible so a save never silently drops them.
 *
 * Fully controlled: every edit calls onChange with the next
 * { areas, frequency } pair. The parent owns persistence.
 */

import { useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  reportCriteriaSentence,
  resolveAreaLabels,
  summarizeAreaLabels,
  type GeoOption,
  type ReportFrequency,
} from '@/components/admin/crm/criteria/criteria-sentence'

export type ReportCriteriaEditorProps = {
  /** The subscribed area slugs (crm_report_areas keys / geo slugs). */
  areas: string[]
  frequency: ReportFrequency
  /** Valid area options, server-loaded by the parent (see file header). */
  areaOptions: readonly GeoOption[]
  /** Called with the next full criteria on every edit. */
  onChange: (next: { areas: string[]; frequency: ReportFrequency }) => void
  disabled?: boolean
  className?: string
}

const FREQUENCY_OPTIONS: ReadonlyArray<{ value: ReportFrequency; label: string }> = [
  { value: 'weekly', label: 'weekly' },
  { value: 'monthly', label: 'monthly' },
  { value: 'quarterly', label: 'quarterly' },
]

/** Layout-only sizing so inline controls clear 44 px on touch screens. */
const TOUCH_TRIGGER = 'min-h-11 sm:min-h-8'

export function ReportCriteriaEditor({
  areas,
  frequency,
  areaOptions,
  onChange,
  disabled = false,
  className,
}: ReportCriteriaEditorProps) {
  const [areasOpen, setAreasOpen] = useState(false)

  // Keep already-subscribed areas visible even when the registry no longer
  // offers them, so editing never silently drops a subscription.
  const options = useMemo(() => {
    const known = new Set(areaOptions.map((o) => o.slug))
    const extras = areas
      .filter((slug) => !known.has(slug))
      .map((slug) => ({ slug, label: slug }))
    return [...areaOptions, ...extras]
  }, [areaOptions, areas])

  const labels = resolveAreaLabels(areas, options)
  const sentence = reportCriteriaSentence(areas, frequency, options)

  function toggleArea(slug: string) {
    const next = areas.includes(slug) ? areas.filter((a) => a !== slug) : [...areas, slug]
    onChange({ areas: next, frequency })
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* The sentence */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm text-foreground">
        <span>Send a</span>

        <Select
          value={frequency}
          onValueChange={(v) => onChange({ areas, frequency: v as ReportFrequency })}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className={TOUCH_TRIGGER} aria-label="Report cadence">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span>market report for</span>

        <Popover open={areasOpen} onOpenChange={setAreasOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className={cn(TOUCH_TRIGGER, 'max-w-full')}
              aria-expanded={areasOpen}
              aria-label="Report areas"
            >
              <span className="truncate">{summarizeAreaLabels(labels)}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Search areas" />
              <CommandList>
                <CommandEmpty>No area matches that search.</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => {
                    const selected = areas.includes(option.slug)
                    return (
                      <CommandItem
                        key={option.slug}
                        value={option.label}
                        onSelect={() => toggleArea(option.slug)}
                        className="min-h-11 sm:min-h-8"
                        aria-selected={selected}
                      >
                        <HugeiconsIcon
                          icon={Tick02Icon}
                          strokeWidth={2}
                          className={cn('size-4', selected ? 'opacity-100' : 'opacity-0')}
                          aria-hidden
                        />
                        {option.label}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Live plain-English restatement */}
      <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
        <p className="text-sm text-foreground" aria-live="polite">{sentence}</p>
      </div>
    </div>
  )
}

export default ReportCriteriaEditor
