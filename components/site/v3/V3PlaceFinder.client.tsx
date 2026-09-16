'use client'

/**
 * V3PlaceFinder — the index's finder: V3TypeCombobox over an index's own rows.
 *
 * THE CATALOG OBJECT FOR THE PLACE CLASS (site queue SITE-116 round 3). The
 * community class's builder card names `beui:combobox`
 * (https://beui.dev/components/motion/combobox) among its catalog jobs, and
 * the round-2 evaluator returned `demoMatch: false` with that id as the
 * `replaceWith`: no control on the page performed a combobox's demo — a
 * trigger you click, a list that springs open, rows you filter by typing and
 * pick with the keyboard. This is that control, on the one place it is
 * useful on a place page: the index of the places inside the place. Tetherow
 * has twenty-two recorded neighborhoods; a reader who knows the one they
 * want types three letters and is there.
 *
 * ONE COMBOBOX HOUSE PRIMITIVE, NOT TWO. The cities lane (SITE-92 round 4)
 * grew the barrel V3TypeCombobox — the installed beUI combobox
 * (`components/motion/combobox`) painted with the house tokens, and the file
 * the catalog names as `beui-combobox`'s house. This finder composes THAT,
 * with `value: null` so the field opens on its placeholder rather than on a
 * plat nobody chose, and a pick that is a door: every option's key is its
 * page's href, so selecting one navigates there. The paint, the spring, the
 * typeahead, the roving focus and the `role="option"` rows are all
 * V3TypeCombobox's; nothing is re-implemented here.
 *
 * The index's own anchors stay in the served HTML for the crawler and the
 * no-JS reader; this control is the fast path over them. It never invents an
 * item: the caller passes the rows the index prints, with the count each row
 * carries. Empty items renders nothing.
 */
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import { V3TypeCombobox } from './V3TypeCombobox.client'
import './tokens.css'
import './V3PlaceFinder.css'

export type V3PlaceFinderItem = {
  /** Where the place's page is. The item's value, and the door a pick opens. */
  href: string
  /** The published name. The row's text and its accessible name. */
  name: string
  /** One quiet clause beside the name: "21 for sale". Already formatted. */
  detail?: string | null
}

export type V3PlaceFinderProps = {
  /** The control's DOM id. The capture spec clicks `#<id> .v3-place-finder__input`. */
  id: string
  /** The field's accessible name: "Find a Tetherow neighborhood". */
  label: string
  /** Shown inside the field before the visitor types. Defaults to the label. */
  placeholder?: string
  items: readonly V3PlaceFinderItem[]
  /** What the list says when nothing matches. */
  emptyMessage?: string
  className?: string
}

export function V3PlaceFinder({
  id,
  label,
  placeholder,
  items,
  emptyMessage = 'No place by that name here.',
  className,
}: V3PlaceFinderProps) {
  const router = useRouter()
  const rows = items.filter((item) => item && item.href?.trim() && item.name?.trim())
  const go = useCallback(
    (href: string) => {
      if (href) router.push(href)
    },
    [router],
  )
  // A finder needs something to find between: V3TypeCombobox itself renders
  // nothing under two options, and so does this.
  if (rows.length < 2) return null

  return (
    <div id={id} className={cn(V3_ROOT_CLASS, 'v3-place-finder', className)}>
      <V3TypeCombobox
        label={label}
        placeholder={placeholder ?? label}
        options={rows.map((item) => ({ key: item.href, label: item.name, count: item.detail?.trim() || null }))}
        value={null}
        onChange={go}
        inputClassName="v3-place-finder__input"
        emptyMessage={emptyMessage}
        className="v3-place-finder__box"
      />
    </div>
  )
}
