/**
 * PLACE SECTION — how old the homes are and what listings reported about the
 * HOA, as PATTERN 6: QUIET.
 *
 * WHY QUIET (design_system/public/PUBLIC_UI.md section 3, locked 2026-08-11):
 * "hairline-separated supporting content (FAQ, proof, definitions, legal,
 * related links). Near-zero visual weight." Every fact in this section is a
 * DEFINITION of the local housing stock, and PLACE_CONTENT_RULES R1, R2 and R3
 * (docs/plans/MARKET_TRUTH/PLACE_CONTENT_RULES.md) forbid publishing any of
 * them as a bare figure: a build-year range must arrive with its sample, a dues
 * median with its property type and window, HOA presence with its denominator.
 *
 * That rule is what decides the pattern. Instrument is "the answer, big" — one
 * verdict with supporting figures under it — and a V3Figure is a value and a
 * label, which is exactly the shape R1 says is not honest here. Lifting "1986
 * to 2017" into a figure and "Build years" into its label would strip the 4,461
 * homes that make the range a fact. So these stay sentences, and a section of
 * hairline-separated supporting sentences with a closing caveat and no ask is
 * Quiet. The section carries no figure column, no chart, and no primary action,
 * which is the rest of Quiet's definition satisfied.
 *
 * Shared by every place grain: subdivision, community and neighborhood. One
 * component because the honesty requirements are identical at every grain, and
 * a second copy is a second place for the qualifiers to drift.
 *
 *   R1  The build-year range is the 10th to 90th percentile, so the sentence
 *       says "eight in ten" rather than implying the whole stock. The sample
 *       is on the face of it every time, because a range with no denominator
 *       is not a fact.
 *   R2  The dues median names its property type and its window.
 *   R3  HOA presence is a count of what listings reported, with its own
 *       denominator, and the closing note says plainly that listings which
 *       reported nothing are not counted either way. Nothing here ever says a
 *       place has no HOA.
 *
 * ABSENCE IS THE POINT. getPlaceCharacter returns null when a place has nothing
 * publishable, and each of the three facts is independently withheld, so a plat
 * with a solid build-year range and thin dues coverage prints the range and
 * says nothing about dues. No empty section, no zero, no hedge in place of a
 * figure. V3Quiet drops an item with no body for the same reason.
 *
 * ONE PROPERTY TYPE. Every figure in this section describes the single sub-type
 * the DAL selected, and that type is named in each sentence. R2 requires it for
 * dues; R4 requires it on any place that is not overwhelmingly detached; doing
 * it uniformly means no reader has to work out which figures were scoped.
 *
 * WHY IT MOVED HERE. It used to live at components/site/PlaceCharacter.tsx on
 * `section`/`wrap`/`sec-head`/`sec-title`, none of which has an unscoped
 * definition in this repo: `.sec-title` exists only under `the deleted KB root class` and under
 * `.listing-detail`, and the other three only under `the deleted KB root class`. A component
 * documented as shared by three grains rendered styled only while every caller
 * sat inside `mainthe deleted KB root class`. V3Quiet mounts V3_ROOT_CLASS on its own outermost
 * element, so the section now carries its own token scope.
 *
 * Section 0: nothing is computed here. Every number arrives measured, and every
 * number is grouped through lib/format.
 */
import { formatCount } from '@/lib/format/count'
import { formatMonthYear } from '@/lib/format/date'
import type { PlaceCharacter as PlaceCharacterData } from '@/lib/data/places/getPlaceCharacter'
import { V3Quiet, type V3QuietItem } from './V3Quiet'

interface Props {
  placeName: string
  character: PlaceCharacterData | null
}

/**
 * How the type reads in front of the word "listings": "detached listings",
 * "condo listings". The noun form ("detached homes") is what the DAL carries;
 * this is the adjectival one, and an unmapped sub-type falls back to its own
 * label rather than guessing.
 */
const LISTING_LABEL: Record<string, string> = {
  'Single Family Residence': 'detached',
  Condominium: 'condo',
  Townhouse: 'townhome',
  'Manufactured On Land': 'manufactured-home',
  'In Park': 'in-park manufactured-home',
  Duplex: 'duplex',
  Triplex: 'triplex',
  Quadruplex: 'fourplex',
  'Multi Family': 'multi-family',
  'Tenancy in Common': 'tenancy-in-common',
  'Stock Cooperative': 'co-op',
  'Residential Leased Land': 'leased-land',
}

function listingLabel(subType: string): string {
  return LISTING_LABEL[subType] ?? subType.toLowerCase()
}

/**
 * R1's sentence. "Eight in ten" is exactly what a 10th-to-90th-percentile range
 * means, and it states the shape of the claim without a second sentence
 * explaining the first. When both percentiles land on one year the range
 * collapses and the sentence says so.
 */
export function yearBuiltSentence(
  placeName: string,
  noun: string,
  yearBuilt: { p10: number; p90: number; sample: number },
): string {
  const homes = `${formatCount(yearBuilt.sample)} ${yearBuilt.sample === 1 ? 'home' : 'homes'} with a recorded build year`
  if (yearBuilt.p10 === yearBuilt.p90) {
    return `Eight in ten ${noun} in ${placeName} were built in ${yearBuilt.p10}, based on ${homes}.`
  }
  return `Eight in ten ${noun} in ${placeName} were built between ${yearBuilt.p10} and ${yearBuilt.p90}, based on ${homes}.`
}

/** R3's counted form, with its own denominator and its own window. */
export function hoaPresenceSentence(
  subType: string,
  presence: { yes: number; reported: number; windowFrom: string },
): string {
  const label = listingLabel(subType)
  const since = formatMonthYear(presence.windowFrom)
  const listings = presence.reported === 1 ? 'listing' : 'listings'
  const verb = presence.yes === 1 ? 'does' : 'do'
  const opener = since
    ? `Since ${since}, ${formatCount(presence.reported)} ${label} ${listings} here reported whether the home has an HOA`
    : `${formatCount(presence.reported)} ${label} ${listings} here reported whether the home has an HOA`
  return `${opener}. ${formatCount(presence.yes)} of them ${verb}.`
}

/** R2's median, inside one property type, with the type and window named. */
export function duesSentence(
  subType: string,
  dues: { medianMonthly: number; reported: number; windowFrom: string },
): string {
  const label = listingLabel(subType)
  const since = formatMonthYear(dues.windowFrom)
  const listings = dues.reported === 1 ? 'listing' : 'listings'
  const opener = since
    ? `${formatCount(dues.reported)} ${label} ${listings} here reported a dues figure since ${since}`
    : `${formatCount(dues.reported)} ${label} ${listings} here reported a dues figure`
  return `${opener}. The median is $${formatCount(dues.medianMonthly)} a month.`
}

export function placeCharacterHeading(
  placeName: string,
  character: PlaceCharacterData,
): string {
  const hasHoa = Boolean(character.dues || character.hoaPresence)
  if (character.yearBuilt && hasHoa) return `Build years and HOA in ${placeName}`
  if (character.yearBuilt) return `Build years in ${placeName}`
  return `HOA in ${placeName}`
}

export function V3PlaceCharacter({ placeName, character }: Props) {
  if (!character) return null

  const { yearBuilt, dues, hoaPresence, subType, noun } = character
  const heading = placeCharacterHeading(placeName, character)

  const items: V3QuietItem[] = []
  if (yearBuilt) {
    items.push({ kind: 'prose', id: 'character-build-years', body: yearBuiltSentence(placeName, noun, yearBuilt) })
  }
  if (hoaPresence) {
    items.push({ kind: 'prose', id: 'character-hoa', body: hoaPresenceSentence(subType, hoaPresence) })
  }
  if (dues) {
    items.push({ kind: 'prose', id: 'character-dues', body: duesSentence(subType, dues) })
  }

  return (
    <V3Quiet
      id="character"
      eyebrow={`${placeName} · Housing stock`}
      heading={heading}
      items={items}
      note={
        `Every figure here describes ${noun} only, measured from listings in the regional MLS.` +
        (hoaPresence || dues
          ? ' Listings that reported nothing about an HOA are not counted either way. Confirm dues and governing documents through the association before relying on them.'
          : '')
      }
    />
  )
}
