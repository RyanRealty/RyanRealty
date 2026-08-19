/**
 * One Instrument, one updated stamp — or none.
 *
 * A V3Instrument that prints figures from two clocks (ALL-TYPE closed mart vs
 * live SFR pulse) must not wear a single "updated" date. The source line names
 * each dataset. A mixed stamp makes the live months-of-supply figure look as
 * old as the mart composition row.
 *
 * Founding case: /housing-market composition + MOS block stamped Aug 10 while
 * the city table / SFR pulse stamped Aug 16 (fleet d0c34f643bdd02efa55823aa94c5b590).
 */

export function publishInstrumentStamp(
  clocks: ReadonlyArray<string | null | undefined>,
): string | null {
  const unique = [
    ...new Set(
      clocks
        .map((c) => (typeof c === 'string' ? c.trim() : ''))
        .filter((c) => c.length > 0),
    ),
  ]
  if (unique.length !== 1) return null
  return unique[0] ?? null
}
