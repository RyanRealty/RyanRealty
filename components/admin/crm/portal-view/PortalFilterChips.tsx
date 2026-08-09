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
 *
 * Admin v2 (11F): the shadcn Badge is gone. NOT the v2 FilterChip — that
 * primitive is a button element carrying aria-pressed, and a control here is
 * exactly what the read-only invariant (lib/data/crm/clientPortalView.test.ts)
 * forbids. NOT StateWord either: .av2-state UPPERCASES, and these carry the
 * client's own filter values. So a plain span wearing the locked tokens — the
 * shadcn Badge was equally non-interactive, and its hover rules only applied
 * inside an anchor, so nothing interactive is lost.
 */

import { activeRegistryFilters } from '@/components/search/AllFiltersSheet'
import type { CSSProperties } from 'react'
import type { PortalChip } from '@/lib/data/crm/getClientPortalView'

/** Shared pill geometry; the two variants differ only in fill vs hairline. */
const CHIP_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 'var(--a-text-xs)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  border: '1px solid transparent',
}

/** Was Badge variant="secondary": a filled chip. */
const CHIP_FILLED: CSSProperties = {
  ...CHIP_BASE,
  background: 'var(--a-inset)',
  color: 'var(--a-text)',
}

/** Was Badge variant="outline": a hairline chip on the card's own background. */
const CHIP_OUTLINE: CSSProperties = {
  ...CHIP_BASE,
  borderColor: 'var(--a-border)',
  color: 'var(--a-text)',
}

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
    return (
      <p style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
        No filters. This alert matches every home.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {otherChips.map((chip) => (
        <span
          key={`${chip.label}-${chip.detail ?? ''}`}
          className="tabular-nums"
          style={CHIP_FILLED}
        >
          {chip.detail ? `${chip.label}: ${chip.detail}` : chip.label}
        </span>
      ))}
      {registryChips.map((chip) => (
        <span key={chip.key} className="tabular-nums" style={CHIP_OUTLINE}>
          {chip.label}
        </span>
      ))}
    </div>
  )
}
