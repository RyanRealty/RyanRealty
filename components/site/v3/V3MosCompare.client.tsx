'use client'

/**
 * Two named months-of-supply bars (house-mos) plus the installed
 * beui-combobox (`components/motion/combobox`) to swap the second bar.
 *
 * SITE-92 rematch: inventory counts and the seller/balanced/buyer gauge
 * are not MoS. The overlay IS ComboboxTrigger + ComboboxList, restyled
 * navy on cream. House paint only.
 */

import { useId, useMemo, useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/motion/combobox'
import { cn } from '@/lib/utils'
import { V3MosBars } from './V3MosBars'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3MosCompare.css'

export const V3_MOS_COMPARE_MAX = 12

export type V3MosCompareCity = {
  slug: string
  name: string
  mos: number | null
  mosLabel: string | null
  verdictLabel: string | null
  activeLabel: string | null
}

export type V3MosCompareProps = {
  regionLabel: string
  regionMos: number
  regionMosLabel: string
  regionVerdict: string
  cities: readonly V3MosCompareCity[]
  source: string
  asOf?: string | null
  id?: string
  className?: string
}

function cityGroups(cities: readonly V3MosCompareCity[]) {
  const early = cities.filter((c) => c.name.localeCompare('N') < 0)
  const late = cities.filter((c) => c.name.localeCompare('N') >= 0)
  return [
    { key: 'a-m', label: 'A–M', cities: early },
    { key: 'n-z', label: 'N–Z', cities: late },
  ].filter((g) => g.cities.length > 0)
}

export function V3MosCompare({
  regionLabel,
  regionMos,
  regionMosLabel,
  regionVerdict,
  cities,
  source,
  asOf,
  id = 'cities-mos-compare',
  className,
}: V3MosCompareProps) {
  const uid = useId()
  const overlayable = useMemo(
    () => cities.filter((c) => c.mos != null && c.mos > 0 && c.mosLabel && c.verdictLabel),
    [cities],
  )

  const defaultSlug =
    overlayable.find((c) => c.slug === 'bend')?.slug ?? overlayable[0]?.slug ?? ''

  const [open, setOpen] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState<string>(defaultSlug)

  const selected = useMemo(
    () => overlayable.find((c) => c.slug === selectedSlug) ?? overlayable[0] ?? null,
    [overlayable, selectedSlug],
  )

  if (!Number.isFinite(regionMos) || regionMos <= 0 || !selected?.mos || !selected.mosLabel) {
    return null
  }

  const groups = cityGroups(overlayable)

  return (
    <div id={id} className={cn(V3_ROOT_CLASS, 'v3-mos-compare', className)}>
      <V3MosBars
        id={`${id}-bars`}
        caption={`${regionLabel} and ${selected.name} months of supply`}
        plainLabel="Months of supply"
        homesName={regionLabel}
        homesLabel={`${regionMosLabel} mo`}
        homesValue={regionMos}
        salesName={selected.name}
        salesLabel={`${selected.mosLabel} mo`}
        salesValue={selected.mos}
        source={source}
        asOf={asOf}
        tooltip={{
          homes: `${regionLabel} ${regionMosLabel} months`,
          sales: `${selected.name} ${selected.mosLabel} months`,
          source,
        }}
        tipLine={`${regionLabel} ${regionMosLabel} months (${regionVerdict}) · ${selected.name} ${selected.mosLabel} months (${selected.verdictLabel}). Overlay a city to swap the second bar.`}
      />

      <div className="v3-mos-compare__combo">
        <p className="v3-mos-compare__label" id={`${uid}-combo-label`}>
          Overlay a city against the region
        </p>
        <Combobox
          value={selectedSlug}
          onValueChange={setSelectedSlug}
          open={open}
          onOpenChange={setOpen}
          className="v3-mos-compare__combo-root"
        >
          <ComboboxTrigger>
            <ComboboxInput
              aria-label="Overlay a city against the region"
              aria-labelledby={`${uid}-combo-label`}
              placeholder={selected.name}
            />
          </ComboboxTrigger>
          <ComboboxContent align="start" side="top">
            <ComboboxList ariaLabel="Cities with months of supply">
              {groups.map((group) => (
                <ComboboxGroup key={group.key}>
                  <ComboboxLabel>{group.label}</ComboboxLabel>
                  {group.cities.map((city) => (
                    <ComboboxItem
                      key={city.slug}
                      value={city.slug}
                      textValue={city.name}
                      keywords={[city.name, city.mosLabel ?? '', city.verdictLabel ?? '']}
                    >
                      <span className="v3-mos-compare__option">
                        <span className="v3-mos-compare__mark" aria-hidden="true" />
                        <span>
                          <span className="v3-mos-compare__option-name">{city.name}</span>
                          <span className="v3-mos-compare__option-meta">
                            {city.mosLabel} mo · {city.verdictLabel}
                          </span>
                        </span>
                      </span>
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
              ))}
              <ComboboxEmpty>No published reading matches that name.</ComboboxEmpty>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
  )
}
