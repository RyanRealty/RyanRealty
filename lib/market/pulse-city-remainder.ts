/**
 * When a page prints a region SFR pulse total and a city inventory table,
 * the table must describe the same inventory or name what it omitted.
 *
 * Fleet finding 5439b87e (2026-08-16): /housing-market printed 1,841 homes
 * for sale (region pulse) next to seven city rows that summed to 1,026.
 * The footnote only said Tumalo had no active SFR. Omitted pulse cities
 * (Madras, Powell Butte, Black Butte Ranch, Culver, Metolius, Camp Sherman)
 * were unnamed. A further remainder is the methodology gap: region counts
 * by MLS city (`is_central_oregon_city`), city rows clip to the TIGER
 * incorporated-place polygon when one exists.
 *
 * reachability: homepage town doors, housing-market hub, central-oregon
 * region report, annual review
 */

export type PulseCityCount = {
  label: string
  /** Null when the overlay withheld the count. Unknown is not zero. */
  active: number | null
  slug?: string
}

export type PulseCityRemainder = {
  omitted: { label: string; active: number; slug: string }[]
  displayedSum: number
  allCitySum: number
  remainder: number | null
  facts: string[]
}

export function pulseCityHrefSlug(geoSlug: string): string {
  return geoSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

export function namePulseCityRemainder(input: {
  regionActive: number | null | undefined
  displayedLabels: readonly string[]
  allCities: readonly PulseCityCount[]
}): PulseCityRemainder {
  const displayed = new Set(input.displayedLabels.map((label) => label.trim()).filter(Boolean))
  const counted = input.allCities.filter(
    (city): city is PulseCityCount & { active: number } => city.active != null,
  )
  const displayedSum = counted
    .filter((city) => displayed.has(city.label))
    .reduce((sum, city) => sum + city.active, 0)
  const allCitySum = counted.reduce((sum, city) => sum + city.active, 0)
  const omitted = counted
    .filter((city) => !displayed.has(city.label) && city.active > 0)
    .map((city) => ({
      label: city.label,
      active: city.active,
      slug: city.slug?.trim() || pulseCityHrefSlug(city.label),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const facts: string[] = []
  if (omitted.length > 0) {
    facts.push(
      `Also in the region pulse and not in the table: ${omitted
        .map((city) => `${city.label} ${formatCount(city.active)}`)
        .join(', ')}`,
    )
  }

  const region = input.regionActive
  const remainder =
    region != null && region > 0 && input.allCities.length > 0 ? region - allCitySum : null
  if (remainder != null && remainder > 0) {
    facts.push(`${formatCount(remainder)} more in the region pulse sit outside a city-boundary row`)
    facts.push(
      'Region counts by MLS city. City rows use the incorporated-place boundary when one exists',
    )
  }

  return { omitted, displayedSum, allCitySum, remainder, facts }
}

/** Visitor-facing remainder lines for a town/city door list next to a region pulse. */
export function formatPulseCityRemainderPublic(named: PulseCityRemainder): string[] {
  const lines: string[] = []
  if (named.omitted.length > 0) {
    lines.push(
      `Also in the regional count: ${named.omitted
        .map((city) => `${city.label} ${formatCount(city.active)} active`)
        .join(', ')}.`,
    )
  }
  if (named.remainder != null && named.remainder > 0) {
    lines.push(
      `${formatCount(named.remainder)} more homes sit outside these town rows. Region counts by MLS city. Town rows use the city boundary when one exists.`,
    )
  }
  return lines
}
