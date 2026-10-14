/**
 * lib/studio/qa/copy-rules.ts - the people-and-places scans every authored
 * word of a film goes through: fair housing, addresses, names.
 *
 * The lists are video_gate's own (.claude/skills/ryan-studio/tools/video_gate.mjs
 * and video_types.json fair_housing_flags), so the paperwork gate, the renderer
 * and video:check refuse the same words. ADDRESS and NAMEISH are copied here
 * because the gate is plain .mjs; copy-rules.test.ts imports the gate and fails
 * if either pattern drifts.
 *
 * Pure: text in, hits out.
 */

/** A street address (video_gate ADDRESS). */
export const ADDRESS =
  /\b\d{2,6}\s+(?:[NSEW]\.?\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Blvd|Boulevard|Pl|Place|Loop|Cir|Circle|Pkwy|Hwy|Trl|Trail|Ter)\b\.?/

/** A person's name (video_gate NAMEISH): "Mr Smith", "the Smiths sold". */
export const NAMEISH = /\b(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z][a-z]+|\bthe\s+[A-Z][a-z]+s\b(?=\s+(?:family|sold|bought|closed|purchased))/

export interface PeopleHit {
  what: string
}

/**
 * Fair housing flags (whole words, any case, as video_gate matches them),
 * addresses and names in one text. Audio tags such as [warm] are read as words
 * too: a tag is not a place to hide a flag.
 */
export function peopleAndPlaceHits(text: string, fairHousingFlags: readonly string[]): PeopleHit[] {
  const hits: PeopleHit[] = []
  const low = text.toLowerCase().replace(/[‘’]/g, "'")
  for (const w of fairHousingFlags) {
    const re = new RegExp(`\\b${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (re.test(low)) hits.push({ what: `fair housing flag "${w}" (describe homes and places, never people)` })
  }
  const address = text.match(ADDRESS)
  if (address) hits.push({ what: `an address "${address[0]}" (no addresses anywhere)` })
  const name = text.match(NAMEISH)
  if (name) hits.push({ what: `a person's name "${name[0]}" (no buyer or seller names)` })
  return hits
}
