'use client'

/**
 * PortalFilterChips — one alert's filters, rendered with the SAME labels the
 * consumer all-filters sheet prints.
 *
 * This is a client component for exactly one reason: activeRegistryFilters
 * lives in components/search/AllFiltersSheet.tsx, which carries 'use client'.
 * Importing it into a server component would hand back a client reference the
 * server cannot call, so the chip row renders on the client instead. The
 * helper is IMPORTED, never forked, so a new registry field shows up in the
 * broker's mirror the day it ships on the consumer sheet.
 *
 * READ-ONLY: props in, badges out. No state, no handlers, no remove control.
 * RegistryFilterChip is deliberately NOT used here because it carries a remove
 * button, and nothing on this surface may change the client's data.
 */

import { activeRegistryFilters } from '@/components/search/AllFiltersSheet'
import { Badge } from '@/components/ui/badge'
import type { PortalChip } from '@/lib/data/crm/getClientPortalView'

export function PortalFilterChips({
  registryParams,
  otherChips,
}: {
  /** The alert's filters as a URL-param map (getClientPortalView). */
  registryParams: Record<string, string>
  /** Filters the registry does not model, already humanized server-side. */
  otherChips: PortalChip[]
}) {
  const params = new URLSearchParams(registryParams)
  const registryChips = activeRegistryFilters(params)

  if (registryChips.length === 0 && otherChips.length === 0) {
    return <p className="text-sm text-muted-foreground">No filters. This alert matches every home.</p>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {otherChips.map((chip) => (
        <Badge
          key={`${chip.label}-${chip.detail ?? ''}`}
          variant="secondary"
          className="rounded-full font-medium tabular-nums"
        >
          {chip.detail ? `${chip.label}: ${chip.detail}` : chip.label}
        </Badge>
      ))}
      {registryChips.map((chip) => (
        <Badge key={chip.key} variant="outline" className="rounded-full font-medium tabular-nums">
          {chip.label}
        </Badge>
      ))}
    </div>
  )
}
