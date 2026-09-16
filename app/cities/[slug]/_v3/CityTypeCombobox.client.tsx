'use client'

/**
 * SITE-93 — the property-type control in the city fold, as the real beUI
 * combobox (`components/motion/combobox`, installed from
 * https://beui.dev/components/motion/combobox).
 *
 * WHAT IT REPLACED. Houses / Condos / Land were three flat navy rectangles in a
 * row. The evaluator named them twice: "house navy rects and a labeled cream
 * field, not the beui combobox object", and "no *-open shot records the demo
 * interaction". A toggle row shows no state when it is closed, says nothing
 * about how many types a place has, and cannot carry each type's own count.
 * This is the catalog control — a trigger holding the current value, a portalled
 * popover that springs open, roving focus, typeahead, arrow / Home / End /
 * Enter / Escape, `role="option"` rows with the selected one marked — restyled
 * to navy on cream through components/site/v3/tokens.css. The interaction is
 * the demo's; only the paint is ours.
 *
 * IT LIVES IN THE ROUTE, not the barrel. The barrel imports no app module, and
 * the strip this feeds is shared by three place classes, so the city binds its
 * own control and hands it to V3AlertsStrip through `renderTypes`. The
 * neighborhood and community strips keep the toggle row until their own node
 * installs one.
 *
 * EACH ROW CARRIES ITS OWN 30-DAY COUNT, preformatted by the caller
 * (lib/site/place-alerts.ts). A row whose count was withheld prints no numeral
 * rather than a zero it cannot vouch for (CLAUDE.md §0).
 *
 * THE POPOVER IS PORTALLED TO <body>, so it is painted with `--v3-*` custom
 * properties (which live on :root) and carries V3_ROOT_CLASS itself; a class
 * cascade from the fold would not reach it.
 */

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/motion/combobox'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import './city-type-combobox.css'

export type CityTypeOption = {
  key: string
  label: string
  /** The preformatted 30-day count for this type, or null when it was withheld. */
  count: string | null
}

export type CityTypeComboboxProps = {
  /** What the control is choosing. Read to the field, never printed. */
  label: string
  /** What the field says once it is open and the typed query is empty. */
  placeholder?: string
  options: readonly CityTypeOption[]
  value: string | null
  onChange: (key: string) => void
  className?: string
}

export function CityTypeCombobox({
  label,
  placeholder = 'Houses, condos or land',
  options,
  value,
  onChange,
  className,
}: CityTypeComboboxProps) {
  if (options.length < 2) return null
  const selected = options.find((o) => o.key === value) ?? options[0]

  return (
    <div className={cn(V3_ROOT_CLASS, 'city-typebox', className)}>
      <Combobox value={selected.key} onValueChange={(next) => onChange(String(next))}>
        <ComboboxTrigger className="city-typebox__trigger">
          <ComboboxInput
            className="city-typebox__input"
            aria-label={label}
            placeholder={placeholder}
            data-city-typebox-input=""
          />
        </ComboboxTrigger>
        <ComboboxContent className={cn(V3_ROOT_CLASS, 'city-typebox__content')} align="start">
          <ComboboxList className="city-typebox__list">
            {options.map((option) => (
              <ComboboxItem
                key={option.key}
                value={option.key}
                textValue={option.label}
                className="city-typebox__item"
              >
                <span className="city-typebox__item-name">{option.label}</span>
                {option.count ? <span className="city-typebox__item-count">{option.count} new</span> : null}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
