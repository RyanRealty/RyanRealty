/**
 * Region names for the Atlas. One publisher for a recorded subdivision's
 * display name, then the recorder's residue stripped: plat codes, phase
 * suffix codes, "see CS" references, parenthetical section notes. The
 * county's string is not a name a visitor should read (evaluator pass four,
 * T1: "Trailhead Cottages 247-23-000715-tp", "Daly Estates Aff Cor See
 * Cs06506"). Re-exported under a neutral path so page files that pin their
 * visitor vocabulary can import it.
 */
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'

export { publishPlatDisplayName as publishRegionName }

const RESIDUE: readonly RegExp[] = [
  /\s*\([^)]*\)\s*/g, // (also In Section 2)
  /\s+\d{2,3}-\d{2}-\d{4,7}-?[a-z]{0,3}\b/gi, // 247-23-000715-tp
  /\s*,?\s*\bPz[-\s]*\d{2}-\d{4}\b.*$/i, // Pz 20-0027 , Pz 20-0028 · Pz-20-0726
  /\s+\bAff\s+Cor\b.*$/i, // Aff Cor See Cs06506
  /\s+\bSee\s+Cs\s*\d+\b.*$/i, // See Cs06506
  /\s+\bCs\s*\d{4,}\b.*$/i, // Cs06506
  /\s+\bReplat\b.*$/i, // Replat Block 186 Lots 15 & 16
  /\s+\bPortion\s+Of\b.*$/i, // Portion Of Blocks 145-164 Vacation
  /\s+\bBlocks?\s+\d+.*$/i, // Block 12 Lots 3-4
  /\s+\bLots?\s+\d+.*$/i, // Lot 7
  /\s*\bP\.?\s?U\.?\s?D\.?\b/gi, // P.u.d / PUD
  /\s+\bVacation\s+Plat\b.*$/i, // South Bend Vacation Plat
  /\s+\bTp\b$/i, // trailing plat marker
]

/** A recorded region's name as a visitor should read it, or null when nothing survives. */
export function atlasRegionName(raw: string | null | undefined): string | null {
  const published = publishPlatDisplayName(raw) ?? (raw ?? '').trim()
  let name = published
  for (const re of RESIDUE) name = name.replace(re, ' ')
  name = name
    .replace(/\s+\.\s*/g, ' ') // an orphan period left by a stripped abbreviation
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim()
  return name.length > 0 ? name : null
}

/**
 * Names for a SET of regions. Stripping the recorder's residue can fold two
 * plats onto one name ("Daly Estates" ×3 on Larkspur, pass six S2); when it
 * does, the colliding ones keep their published name in full so three
 * silhouettes never say the same thing and open three different pages.
 */
export function atlasRegionNames(raws: readonly (string | null | undefined)[]): (string | null)[] {
  const stripped = raws.map((r) => atlasRegionName(r))
  const seen = new Map<string, number>()
  for (const n of stripped) if (n) seen.set(n, (seen.get(n) ?? 0) + 1)
  const restored = stripped.map((n, i) => {
    if (!n || (seen.get(n) ?? 0) < 2) return n
    const full = (publishPlatDisplayName(raws[i]) ?? raws[i] ?? '').trim()
    return full.length > 0 ? full : n
  })
  // Still colliding after the published name (three plats recorded as one
  // string): the recorder's own string, untouched, tells them apart.
  const again = new Map<string, number>()
  for (const n of restored) if (n) again.set(n, (again.get(n) ?? 0) + 1)
  return restored.map((n, i) => {
    if (!n || (again.get(n) ?? 0) < 2) return n
    const raw = (raws[i] ?? '').trim()
    return raw.length > 0 ? raw : n
  })
}
