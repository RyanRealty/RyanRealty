'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import ActivityFeedCard from '@/components/activity/ActivityFeedCard'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import type { ActivityFeedItem } from '@/app/actions/activity-feed'

export type ActivityFeedCity = { city: string; count?: number }

export type ActivityFeedSectionProps = {
  /** Initial feed items (e.g. for default cities). */
  initialItems: ActivityFeedItem[]
  /** Cities selected by default (e.g. ACTIVITY_FEED_DEFAULT_CITIES). */
  defaultCities: string[]
  /** All cities available for the dropdown (e.g. from getBrowseCities). */
  allCities: ActivityFeedCity[]
  /** Section heading. */
  heading?: string
  /** Optional "View all" link. */
  viewAllHref?: string
  viewAllLabel?: string
  /** Max items to fetch when cities change. */
  limit?: number
  className?: string
}

/** Union of default cities and allCities for the selector list, default first then rest alphabetically. */
function cityOptions(defaultCities: string[], allCities: ActivityFeedCity[]): string[] {
  const defaultSet = new Set(defaultCities.map((c) => c.trim()).filter(Boolean))
  const rest = allCities
    .map((c) => c.city.trim())
    .filter((c) => c && !defaultSet.has(c))
    .sort((a, b) => a.localeCompare(b))
  return [...defaultCities.filter((c) => c.trim()), ...rest]
}

export default function ActivityFeedSection({
  initialItems,
  defaultCities,
  allCities,
  heading = 'Latest activity',
  viewAllHref,
  viewAllLabel = 'View all',
  limit = 12,
  className,
}: ActivityFeedSectionProps) {
  const [selectedCities, setSelectedCities] = useState<string[]>(() => defaultCities)
  const [items, setItems] = useState<ActivityFeedItem[]>(initialItems)
  const [loading, setLoading] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const options = useMemo(() => cityOptions(defaultCities, allCities), [defaultCities, allCities])

  const toggleCity = useCallback(
    (city: string) => {
      const next = selectedCities.includes(city)
        ? selectedCities.filter((c) => c !== city)
        : [...selectedCities, city]
      setSelectedCities(next)
      if (next.length === 0) return
      setLoading(true)
      getActivityFeedWithFallbackMulti({ cities: next, limit })
        .then(setItems)
        .finally(() => setLoading(false))
    },
    [selectedCities, limit]
  )

  const selectAllDefault = useCallback(() => {
    setSelectedCities(defaultCities)
    setLoading(true)
    getActivityFeedWithFallbackMulti({ cities: defaultCities, limit })
      .then(setItems)
      .finally(() => setLoading(false))
  }, [defaultCities, limit])

  return (
    <section
      className={cn('w-full bg-card px-4 py-12 sm:px-6 sm:py-16', className)}
      aria-labelledby="activity-feed-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="activity-feed-heading" className="text-2xl font-bold tracking-tight text-foreground">
            {heading}
          </h2>
          <div className="flex items-center gap-2">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" aria-haspopup="listbox" aria-expanded={popoverOpen}>
                  Cities ({selectedCities.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="max-h-64 overflow-y-auto">
                  <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Show activity in:</p>
                  {options.map((city) => (
                    <label
                      key={city}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={selectedCities.includes(city)}
                        onCheckedChange={() => toggleCity(city)}
                        aria-label={`Include ${city}`}
                      />
                      <span className="truncate">{city}</span>
                    </label>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => { selectAllDefault(); setPopoverOpen(false) }}>
                  Reset to default cities
                </Button>
              </PopoverContent>
            </Popover>
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {viewAllLabel} →
              </Link>
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          New listings, price drops, and status changes. Select cities above to filter.
        </p>
        <div className="mt-6 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Updating…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity in selected cities yet. Try selecting more cities above.</p>
          ) : (
            <div
              className="flex gap-6 min-w-max snap-x snap-mandatory"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className="shrink-0 snap-start w-[85vw] min-w-[260px] max-w-[320px] sm:w-[50vw] sm:min-w-[280px] sm:max-w-[360px] lg:w-[33.333vw] lg:min-w-[300px] lg:max-w-[420px]"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <ActivityFeedCard item={item} priority={i < 3} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
</think>

<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
StrReplace