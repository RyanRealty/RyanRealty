'use client'

/**
 * SITE-92 round 4 — the region index's binding of the barrel's months-of-
 * supply compare, whose city overlay is the installed beUI combobox
 * (components/site/v3/V3TypeCombobox.client.tsx wrapping
 * components/motion/combobox, https://beui.dev/components/motion/combobox).
 *
 * THE MARKUP LIVES IN THE BARREL, the binding lives here — the same shape as
 * the city route's CityTypeCombobox (SITE-93): V3MosCompare owns which city is
 * on the rule and hands this file the control's props through `renderOverlay`;
 * this file renders the barrel's V3TypeCombobox with the one thing the page
 * decides, how a typed query matches a city. The barrel imports no app module.
 *
 * THE FILTER IS THE INDEX'S. The catalog's default is a subsequence match,
 * which on fifteen city names answers "Bend" to a typed "bd" and keeps half
 * the list for any two letters; a directory picker is a short, known list, so
 * this matches a typed PREFIX of the name or of any word in it — "la" keeps
 * La Pine, "pine" keeps La Pine, "s" keeps Sisters and Sunriver — which is
 * the interaction the demo promises and the one a visitor can watch work.
 */

import type { ComboboxFilter } from '@/components/motion/combobox'
import { V3MosCompare, V3TypeCombobox, type V3MosCompareProps } from '@/components/site/v3'

/** Prefix match on the option's name or any word of it. See the header. */
const byCityPrefix: ComboboxFilter = (value, query, keywords) => {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  return [value, ...keywords].some((hay) => {
    const text = String(hay).toLocaleLowerCase()
    return text.startsWith(needle) || text.split(/\s+/).some((word) => word.startsWith(needle))
  })
}

export type CitiesMosCompareProps = Omit<V3MosCompareProps, 'renderOverlay'>

export function CitiesMosCompare(props: CitiesMosCompareProps) {
  return (
    <V3MosCompare
      {...props}
      renderOverlay={(control) => <V3TypeCombobox {...control} filter={byCityPrefix} />}
    />
  )
}
