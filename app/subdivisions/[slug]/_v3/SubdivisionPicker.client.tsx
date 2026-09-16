'use client'

/**
 * SITE-112 — the subdivision page's binding of the barrel's beUI combobox
 * (components/site/v3/V3TypeCombobox.client.tsx, which wraps the installed
 * `components/motion/combobox` from https://beui.dev/components/motion/combobox).
 *
 * THE JOB. A subdivision page is one of thousands, and the reader who lands on
 * Ridge at Eagle Crest is usually deciding between it and the plats around it.
 * The page already knows them: `getIndexableSubdivisions()` is read for the
 * robots policy, and it carries each one's slug, name and lifetime closed
 * count. This is that list as the catalog control — a trigger holding the
 * subdivision you are on, a portalled popover that springs open, typeahead,
 * roving focus and a checked row — so a neighbour is one keystroke away
 * instead of a scroll to a footer.
 *
 * IT IS NOT THE PAGE'S CRAWLABLE INDEX. A `role="option"` row is not a link, so
 * the SAME siblings also ship as real anchors in the V3PlaceIndex section below
 * the fold; the control is the fast path, the index is the door a crawler
 * follows. Neither invents a row the other does not have.
 *
 * THE FILTER IS THE PLACE PICKER'S. The catalog default is a subsequence
 * match, which over forty subdivision names answers almost anything typed. A
 * place list is a known set of proper names, so this matches a typed prefix of
 * the NAME or of any word inside it — "eagle" finds Ridge at Eagle Crest,
 * "ridge" finds it too, and nothing else drifts in.
 */

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import type { ComboboxFilter } from '@/components/motion/combobox'
import { V3TypeCombobox, type V3TypeOption } from '@/components/site/v3/V3TypeCombobox.client'

/** Prefix match on the place name or on any word inside it. See the header. */
const byPlaceWordPrefix: ComboboxFilter = (value, query, keywords) => {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  return [value, ...keywords].some((hay) =>
    String(hay)
      .toLocaleLowerCase()
      .split(/[^a-z0-9]+/i)
      .some((word) => word.startsWith(needle)),
  )
}

export type SubdivisionPickerOption = V3TypeOption & {
  /** Where this subdivision's own page lives. */
  href: string
}

export type SubdivisionPickerProps = {
  /** What the control is choosing. Read to the field, never printed. */
  label: string
  options: readonly SubdivisionPickerOption[]
  /** The subdivision this page is, so the open list marks where you are. */
  value: string
  className?: string
}

export function SubdivisionPicker({ label, options, value, className }: SubdivisionPickerProps) {
  const router = useRouter()
  const onChange = useCallback(
    (key: string) => {
      const next = options.find((option) => option.key === key)
      if (!next || next.key === value) return
      router.push(next.href)
    },
    [options, router, value],
  )

  return (
    <V3TypeCombobox
      label={label}
      placeholder="Type a subdivision"
      countSuffix="sales"
      options={options.map((option) => ({ key: option.key, label: option.label, count: option.count }))}
      value={value}
      onChange={onChange}
      filter={byPlaceWordPrefix}
      className={className}
    />
  )
}
