'use client'

/**
 * V3PlaceFinder — the installed beUI combobox over an index's own rows.
 *
 * THE CATALOG OBJECT FOR THE PLACE CLASS (site queue SITE-116 round 3). The
 * community class's builder card names `beui:combobox`
 * (https://beui.dev/components/motion/combobox) among its catalog jobs, and
 * the round-2 evaluator returned `demoMatch: false` with that id as the
 * `replaceWith`: no control on the page performed a combobox's demo — a
 * trigger you click, a list that morphs open, rows you filter by typing and
 * pick with the keyboard. This is that control, on the one place it is
 * useful on a place page: the index of the places inside the place. Tetherow
 * has twenty-two recorded neighborhoods; a reader who knows the one they
 * want types three letters and is there.
 *
 * THE INSTALLED SOURCE IS THE CONTROL. `components/motion/combobox` is the
 * catalog file (`npx shadcn add @beui/combobox`); this wrapper composes its
 * parts — Combobox, ComboboxTrigger, ComboboxInput, ComboboxContent,
 * ComboboxList, ComboboxItem, ComboboxEmpty — and paints them with the house
 * tokens in V3PlaceFinder.css: navy edge, cream surface, radius 0, Geist,
 * 44px rows. The interaction is the catalog's: pointer-down or focus opens,
 * typing filters, arrows move, Enter selects, Escape closes, the active row
 * carries the shared-layout highlight. Nothing is re-implemented.
 *
 * A PICK IS A DOOR. Every item's value is its page's href, so selecting one
 * navigates there. The index's own anchors stay in the served HTML for the
 * crawler and the no-JS reader; this control is the fast path over them.
 *
 * WHAT IT WILL NOT DO. It never invents an item: the caller passes the rows
 * the index prints, with the same count each row carries. Empty items renders
 * nothing.
 */
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/motion/combobox'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
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
  /** The control's DOM id; the input carries `${id}-input`. */
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
  if (rows.length === 0) return null

  return (
    <div id={id} className={cn(V3_ROOT_CLASS, 'v3-place-finder', className)}>
      <Combobox onValueChange={go} className="v3-place-finder__box">
        <ComboboxTrigger className="v3-place-finder__trigger">
          <ComboboxInput
            aria-label={label}
            placeholder={placeholder ?? label}
            className="v3-place-finder__input"
            wrapperClassName="v3-place-finder__field"
          />
        </ComboboxTrigger>
        <ComboboxContent className="v3-place-finder__panel" sideOffset={4}>
          <ComboboxList ariaLabel={label} className="v3-place-finder__list">
            {rows.map((item) => (
              <ComboboxItem
                key={item.href}
                value={item.href}
                textValue={item.name}
                keywords={item.detail ? [item.detail] : []}
                className="v3-place-finder__option"
              >
                <span className="v3-place-finder__name">{item.name}</span>
                {item.detail ? <span className="v3-place-finder__detail">{item.detail}</span> : null}
              </ComboboxItem>
            ))}
            <ComboboxEmpty className="v3-place-finder__empty">{emptyMessage}</ComboboxEmpty>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
