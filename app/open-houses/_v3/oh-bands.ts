import type { OpenHouseFieldItem } from './oh-field-items'

export type OpenHouseWhenBandKey = 'weekend' | 'later'

export type OpenHouseWhenBand = {
  key: OpenHouseWhenBandKey
  label: string
  items: OpenHouseFieldItem[]
}

/**
 * This-weekend first, then the rest of the window. Empty bands are omitted
 * so a week with no Saturday/Sunday opens does not offer a door into nothing.
 */
export function openHouseWhenBands(
  items: readonly OpenHouseFieldItem[],
): OpenHouseWhenBand[] {
  const weekend = items.filter((item) => item.weekend)
  const later = items.filter((item) => !item.weekend)
  const bands: OpenHouseWhenBand[] = []
  if (weekend.length > 0) {
    bands.push({ key: 'weekend', label: 'This weekend', items: weekend })
  }
  if (later.length > 0) {
    bands.push({ key: 'later', label: 'Later this week', items: later })
  }
  return bands
}
