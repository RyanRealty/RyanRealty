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
  /\s*&\s*d\b/gi, // "&d" fragment left by a broken ampersand
  /\s+\bTp\b$/i, // trailing plat marker
]

/** A recorded region's name as a visitor should read it, or null when nothing survives. */
export function atlasRegionName(raw: string | null | undefined): string | null {
  const published = publishPlatDisplayName(raw) ?? (raw ?? '').trim()
  let name = published
  for (const re of RESIDUE) name = name.replace(re, ' ')
  name = name.replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '').trim()
  return name.length > 0 ? name : null
}
