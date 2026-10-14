/**
 * Curated "no master HOA" answers for community pages (SEO & AEO Desk, Matt OK
 * pending, 2026-10-09).
 *
 * WHY THIS EXISTS. publishPlaceHoa prefers the measured median of detached
 * listings that reported dues (getPlaceCharacter, PLACE_CONTENT_RULES R2). In a
 * place with no community-wide association, the only listings that report dues
 * are homes inside a sub-association, so the page answered "Does NorthWest
 * Crossing have an HOA?" with a $1,620 a year median and headlined "$1,620 HOA
 * a year from homes here". NorthWest Crossing has no neighborhood-wide HOA or
 * dues: the NorthWest Crossing Architectural Review Committee states it is not
 * a homeowners' association and enforces the master CC&Rs (Deschutes County
 * document 2001-63854). Townhome and condo groups inside it (The Commons at
 * Northwest Crossing HOA, Northwest Crossing Condominium Association, Ironhorse
 * HOA on the Oregon Secretary of State registry) carry their own dues.
 *
 * The generic logic can mislabel any place where only sub-associations charge
 * dues. Until it can tell a master association from a sub-association, a place
 * whose own records say there is no master HOA is listed here, and the page:
 *  - answers the HOA question with the curated copy (FAQ and FAQPage JSON-LD),
 *  - drops the measured dues figure from the glance and the Living in row,
 *  - prints the curated answer in the Living in row instead.
 * The housing-stock block (V3PlaceCharacter) still reports what listings said.
 */
import type { PlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import type { CommunityFaqItem } from './community-figures'

export type CuratedNoMasterHoa = {
  question: string
  answer: string
  source: string
}

const NO_MASTER_HOA: Readonly<Record<string, CuratedNoMasterHoa>> = {
  'northwest-crossing': {
    question: 'Does NorthWest Crossing have an HOA?',
    answer:
      'No. NorthWest Crossing has no neighborhood-wide HOA or dues. A design committee enforces the recorded covenants and can fine for violations. Some townhome and condo groups inside the neighborhood have their own associations with monthly dues, so check the listing.',
    source:
      "NorthWest Crossing Architectural Review Committee (northwestcrossing.com); Master Declaration of CC&Rs, Deschutes County document 2001-63854; Oregon Secretary of State business registry",
  },
}

export function curatedNoMasterHoa(slug: string | null | undefined): CuratedNoMasterHoa | null {
  if (!slug) return null
  return NO_MASTER_HOA[slug.trim().toLowerCase()] ?? null
}

/** The curated HOA question as an authored FAQ row (replaces the generated one). */
export function noMasterHoaFaq(slug: string | null | undefined): CommunityFaqItem[] {
  const curated = curatedNoMasterHoa(slug)
  return curated ? [{ question: curated.question, answer: curated.answer, source: curated.source }] : []
}

/**
 * The character read with its dues median removed, for the HOA figure
 * consumers only (glance, Living in row, HOA resolution). Other places pass
 * through unchanged.
 */
export function hoaCharacterFor(
  slug: string | null | undefined,
  character: PlaceCharacter | null,
): PlaceCharacter | null {
  if (!character || !curatedNoMasterHoa(slug)) return character
  return { ...character, dues: null }
}
