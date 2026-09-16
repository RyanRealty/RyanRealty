'use client'

/**
 * SITE-104 — the neighborhood's binding of the barrel's beUI combobox
 * (components/site/v3/V3TypeCombobox.client.tsx, which wraps the installed
 * `components/motion/combobox` from https://beui.dev/components/motion/combobox).
 *
 * WHAT IT REPLACED. Houses / Land were two flat navy-and-cream rectangles in a
 * row — the control the 2026-09-12 table named twice as "Cream box". A toggle
 * row shows no state when it is closed, says nothing about how many types the
 * place has, and cannot carry each type's own count. This is the catalog
 * control whole: a trigger holding the current value, a portalled popover that
 * springs open, typeahead, roving focus, arrow / Home / End / Enter / Escape,
 * `role="option"` rows with the selected one marked.
 *
 * THE MARKUP LIVES IN THE BARREL, the binding lives here. V3AlertsStrip is
 * shared by three place classes and the barrel imports no app module, so this
 * route hands its control down through `renderTypes`, the same seam the city
 * uses (app/cities/[slug]/_v3/CityTypeCombobox.client.tsx).
 *
 * THE FILTER IS THE PLACE'S. The catalog's default is a subsequence match,
 * which on two options answers "land" to a typed "l", "a", "n" or "d" in any
 * order and looks like nothing happened. A place picker is a short, known
 * list, so this matches a typed PREFIX of the type name — type "la" and only
 * Land stays, which is the interaction the demo promises and the one a visitor
 * can watch work.
 *
 * A ROW'S COUNT IS THE CALLER'S, preformatted, and a type whose 30-day count
 * was withheld prints no numeral rather than a zero it cannot vouch for
 * (CLAUDE.md §0). Land on this route is exactly that case.
 */

import type { ComboboxFilter } from '@/components/motion/combobox'
import { V3TypeCombobox, type V3TypeOption } from '@/components/site/v3/V3TypeCombobox.client'

/** Prefix match on the option's own name. See the header. */
const byTypePrefix: ComboboxFilter = (value, query, keywords) => {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  return [value, ...keywords].some((hay) => String(hay).toLocaleLowerCase().startsWith(needle))
}

export type NeighborhoodTypeOption = V3TypeOption

export type NeighborhoodTypeComboboxProps = {
  /** What the control is choosing. Read to the field, never printed. */
  label: string
  options: readonly NeighborhoodTypeOption[]
  value: string | null
  onChange: (key: string) => void
  className?: string
}

export function NeighborhoodTypeCombobox({
  label,
  options,
  value,
  onChange,
  className,
}: NeighborhoodTypeComboboxProps) {
  return (
    <V3TypeCombobox
      label={label}
      placeholder="Type to filter"
      countSuffix="new"
      options={options}
      value={value}
      onChange={onChange}
      filter={byTypePrefix}
      className={className}
    />
  )
}
