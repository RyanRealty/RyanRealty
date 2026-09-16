'use client'

/**
 * V3 TYPE COMBOBOX (SITE-93) — the barrel's wrapper for the installed beUI
 * combobox (`components/motion/combobox`, from
 * https://beui.dev/components/motion/combobox).
 *
 * WHY THE BARREL GREW ONE. The catalog job had no house primitive: the install
 * map pointed `beui-combobox` at V3MorphSearch, which is a different control
 * and does not import the combobox, so no route could name the id honestly
 * (`ci:catalog-install`). Growing the barrel is the one design system; a route
 * hand-rolling the catalog markup beside it is two.
 *
 * WHAT IT REPLACED on the place pages: three flat navy rectangles in a row. A
 * toggle row shows no state when it is closed, says nothing about how many
 * types a place has, and cannot carry each type's own count. This is the
 * catalog control whole — a trigger holding the current value, a portalled
 * popover that springs open, typeahead, roving focus, arrow / Home / End /
 * Enter / Escape, `role="option"` rows with the selected one marked — restyled
 * to navy on cream through tokens.css. The interaction is the demo's; only the
 * paint is ours.
 *
 * EACH ROW MAY CARRY A COUNT, preformatted by the caller. A row whose count
 * was withheld prints no numeral rather than a zero it cannot vouch for
 * (CLAUDE.md §0), and this file formats nothing.
 *
 * THE POPOVER IS PORTALLED TO <body>, so it is painted with `--v3-*` custom
 * properties (which live on :root) and carries V3_ROOT_CLASS itself; a class
 * cascade from the section around it would not reach it.
 */

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  type ComboboxFilter,
} from '@/components/motion/combobox'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3TypeCombobox.css'

export type V3TypeOption = {
  key: string
  label: string
  /** Preformatted count for this option, or null when it was withheld. */
  count: string | null
}

export type V3TypeComboboxProps = {
  /** What the control is choosing. Read to the field, never printed. */
  label: string
  /** What the field says once it is open and the typed query is empty. */
  placeholder?: string
  /** The word after a row's count ("new"). Omit for a bare numeral. */
  countSuffix?: string
  options: readonly V3TypeOption[]
  value: string | null
  onChange: (key: string) => void
  filter?: ComboboxFilter
  className?: string
  /**
   * A class for the typeahead input itself, beside the wrapper's `className`:
   * a route's capture spec may click the field by a name of its own
   * (`.v3-mos-compare__input` on the city index, SITE-92).
   */
  inputClassName?: string
  /**
   * What the open list says when the typed query matches no row. Absent, the
   * list simply empties, which is the catalog's own default.
   */
  emptyMessage?: string
}

export function V3TypeCombobox({
  label,
  placeholder = 'Type to filter',
  countSuffix,
  options,
  value,
  onChange,
  filter,
  className,
  inputClassName,
  emptyMessage,
}: V3TypeComboboxProps) {
  if (options.length < 2) return null
  // `null` means NOTHING IS CHOSEN YET (SITE-116 round 3): the field shows its
  // placeholder and the list opens with no row marked. A finder over twenty
  // plats must not open reading "Tetherow Phase 1" as if someone had picked
  // it. A non-null key that matches no option still falls back to the first
  // row, exactly as before, so every existing caller renders unchanged.
  const selected = value == null ? null : (options.find((o) => o.key === value) ?? options[0])

  return (
    <div className={cn(V3_ROOT_CLASS, 'city-typebox', className)}>
      <Combobox
        {...(selected ? { value: selected.key } : {})}
        onValueChange={(next) => onChange(String(next))}
        {...(filter ? { filter } : {})}
      >
        <ComboboxTrigger className="city-typebox__trigger">
          <ComboboxInput
            className={cn('city-typebox__input', inputClassName)}
            aria-label={label}
            placeholder={placeholder}
          />
        </ComboboxTrigger>
        <ComboboxContent className={cn(V3_ROOT_CLASS, 'city-typebox__content')} align="start">
          <ComboboxList className="city-typebox__list">
            {emptyMessage ? <ComboboxEmpty className="city-typebox__empty">{emptyMessage}</ComboboxEmpty> : null}
            {options.map((option) => (
              <ComboboxItem
                key={option.key}
                value={option.key}
                textValue={option.label}
                className="city-typebox__item"
              >
                <span className="city-typebox__item-name">{option.label}</span>
                {option.count ? (
                  <span className="city-typebox__item-count">
                    {option.count}
                    {countSuffix ? ` ${countSuffix}` : null}
                  </span>
                ) : null}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
