'use client'

/**
 * SITE-93 — the city's binding of the barrel's beUI combobox
 * (components/site/v3/V3TypeCombobox.client.tsx, which wraps the installed
 * `components/motion/combobox` from https://beui.dev/components/motion/combobox).
 *
 * THE MARKUP LIVES IN THE BARREL, the binding lives here. V3AlertsStrip is
 * shared by three place classes and the barrel imports no app module, so the
 * city hands its control down through `renderTypes`; the neighborhood and
 * community strips keep the toggle row until their own node installs one.
 *
 * THE FILTER IS THE CITY'S. The catalog's default is a subsequence match, which
 * on three options answers "land" to a typed "l", "a", "n" or "d" in any order
 * and looks like nothing happened. A place picker is a short, known list, so
 * this matches a typed PREFIX of the type name — type "co" and only Condos
 * stays, which is the interaction the demo promises and the one a visitor can
 * watch work.
 */

import type { ComboboxFilter } from '@/components/motion/combobox'
import { V3TypeCombobox, type V3TypeOption } from '@/components/site/v3/V3TypeCombobox.client'

/** Prefix match on the option's own name. See the header. */
const byTypePrefix: ComboboxFilter = (value, query, keywords) => {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  return [value, ...keywords].some((hay) => String(hay).toLocaleLowerCase().startsWith(needle))
}

export type CityTypeOption = V3TypeOption

export type CityTypeComboboxProps = {
  /** What the control is choosing. Read to the field, never printed. */
  label: string
  options: readonly CityTypeOption[]
  value: string | null
  onChange: (key: string) => void
  className?: string
}

export function CityTypeCombobox({ label, options, value, onChange, className }: CityTypeComboboxProps) {
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
