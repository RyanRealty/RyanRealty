/**
 * Pure address parsing for the one-click-CMA-from-contact flow (Stream 2).
 *
 * Splits a contact's freeform single-line owned-home address (resolved from
 * fub_person_geo.formatted_address / source_address) into the parts
 * createCmaDelivery wants: parsedStreet / parsedCity / parsedState /
 * parsedPostalCode. Dependency-free + side-effect-free so it is unit-testable
 * in isolation (no Supabase, no Next, no I/O) — vitest only scans lib/**.
 *
 * The action layer (app/actions/contact-cma.ts) imports this; it never re-parses
 * inline.
 */

export type ParsedContactAddress = {
  rawAddress: string
  parsedStreet: string | null
  parsedCity: string | null
  parsedState: string | null
  parsedPostalCode: string | null
}

/**
 * Handles the common geocoder shapes:
 *   "123 NW Bond St, Bend, OR 97701"
 *   "123 NW Bond St, Bend, OR 97701, USA"
 *   "123 NW Bond St, Bend OR 97701"      (two segments)
 *   "123 NW Bond St Bend OR 97701"       (no commas — best-effort tail parse)
 *
 * The street portion preserves its original casing (createCmaDelivery's matcher
 * lowercases internally). City/state/zip are pulled from the comma segments; a
 * trailing "USA" / "United States" country segment is dropped. Returns null
 * fields rather than guessing when a part is absent — the action surfaces a
 * clean error when it cannot read a city.
 */
export function parseContactAddress(raw: string | null | undefined): ParsedContactAddress | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null

  // Drop a trailing country token so it never lands in the state/zip slot.
  let parts = trimmed
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length > 1) {
    const last = parts[parts.length - 1]!.toLowerCase()
    if (last === 'usa' || last === 'us' || last === 'united states') {
      parts = parts.slice(0, -1)
    }
  }

  const parsedStreet = parts[0] || null

  let parsedCity: string | null = null
  let parsedState: string | null = null
  let parsedPostalCode: string | null = null

  const zipFrom = (s: string): string | null => {
    const m = s.match(/\b(\d{5})(?:-\d{4})?\b/)
    return m ? m[1]! : null
  }
  const stateFrom = (s: string): string | null => {
    const m = s.match(/\b([A-Za-z]{2})\b/)
    return m ? m[1]!.toUpperCase() : null
  }

  if (parts.length >= 3) {
    // "<street>, <city>, <state zip>"
    parsedCity = parts[1] || null
    const tail = parts[2] ?? ''
    parsedState = stateFrom(tail)
    parsedPostalCode = zipFrom(tail)
  } else if (parts.length === 2) {
    // "<street>, <city state zip>" — split the second segment.
    const seg = parts[1] ?? ''
    parsedPostalCode = zipFrom(seg)
    parsedState = stateFrom(seg.replace(/\b\d{5}(?:-\d{4})?\b/, '').trim())
    const cityRemainder = seg
      .replace(/\b\d{5}(?:-\d{4})?\b/, '')
      .replace(/\b[A-Za-z]{2}\b\s*$/, '')
      .trim()
    parsedCity = cityRemainder || null
  } else {
    // Single segment, no commas — no reliable city split. Leave city null and
    // let the action surface a clean error.
    parsedPostalCode = zipFrom(trimmed)
    parsedState = null
    parsedCity = null
  }

  return {
    rawAddress: trimmed,
    parsedStreet,
    parsedCity,
    parsedState,
    parsedPostalCode,
  }
}
