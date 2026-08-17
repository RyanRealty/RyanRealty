import { namePulseCityRemainder, pulseCityHrefSlug } from '@/lib/market/pulse-city-remainder'

export type CityIndexPulseRow = {
  geo_slug: string
  geo_label: string
  active_count: number
}

export function cityIndexRemainder(input: {
  regionActive: number | null | undefined
  displayedLabels: readonly string[]
  citySnapshots: readonly CityIndexPulseRow[]
}) {
  return namePulseCityRemainder({
    regionActive: input.regionActive,
    displayedLabels: input.displayedLabels,
    allCities: input.citySnapshots.map((row) => ({
      label: row.geo_label,
      active: row.active_count,
      slug: pulseCityHrefSlug(row.geo_slug || row.geo_label),
    })),
  })
}
