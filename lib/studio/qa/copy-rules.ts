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

/** A street address in any case (video_gate ADDRESS): "123 Main Street", "SOLD AT 123 MAIN ST". */
export const ADDRESS =
  /\b\d{2,6}\s+(?:[nsew]\.?\s+)?(?:(?!(?:minutes?|mins?|miles?|hours?|hrs?|days?|weeks?|months?|years?|seconds?|homes?|houses?|listings?|percent|feet|foot|acres?|the|a|an|of|and|to|in|on|for|with|by|at|or|is|are|was|were|this|that|our|your|their|my|its|more|less|new|down|up)\b)[a-z][a-z'-]*\s+){1,3}(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|ct|court|blvd|boulevard|pl|place|loop|cir|circle|pkwy|hwy|trl|trail|ter)\b\.?/i

/**
 * A person's name in any case (video_gate NAMEISH): "Mr Smith", "MRS JONES SOLD",
 * "the Smiths sold", and a first-name pair, "Sarah and Tom just closed".
 */
export const NAMEISH =
  /\b(?:mr|mrs|ms|dr)\.?\s+(?!(?:and|the|a|an|of|to|in|on|for|by)\b)[a-z][a-z'-]+|\bthe\s+(?!(?:homes|houses|listings|condos|townhomes|properties|sales|comps|buyers|sellers|owners|homeowners|neighbors|agents|brokers|lots|units|cabins|prices|rates|numbers|deals|offers|families|folks|locals|investors|renters|tenants|landlords|builders|keys|doors|others|twins)\b)[a-z][a-z'-]*s\b(?=\s+(?:family|sold|bought|closed|purchased))|\b(?!(?:you|we|they|i|he|she|it|my|your|our|their|his|her|its|the|a|an|this|that|these|those|both|all|some|many|most|buyers|sellers|owners|homes|houses|listings|condos|prices|rates|sales|agents|brokers|bend|redmond|sisters|sunriver|prineville|madras|tumalo|terrebonne|culver|powell|la|pine|crooked|river|ranch|oregon|spring|summer|fall|winter|me|him|us|them)\b)[a-z][a-z'-]+\s+(?:and|&)\s+(?!(?:you|we|they|i|he|she|it|my|your|our|their|his|her|its|the|a|an|this|that|these|those|both|all|some|many|most|buyers|sellers|owners|homes|houses|listings|condos|prices|rates|sales|agents|brokers|bend|redmond|sisters|sunriver|prineville|madras|tumalo|terrebonne|culver|powell|la|pine|crooked|river|ranch|oregon|spring|summer|fall|winter|me|him|us|them)\b)[a-z][a-z'-]+\s+(?:just\s+)?(?:closed|bought|sold|purchased|listed|moved)\b/i

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
  text = text.normalize('NFKC').replace(/[‘’]/g, "'")
  const low = text.toLowerCase()
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
