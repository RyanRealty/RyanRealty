/**
 * PlaceCharacter — how old the homes are, and what listings reported about the
 * HOA. Shared by every place grain: subdivision, community and neighborhood.
 *
 * One component because the honesty requirements are identical at every grain,
 * and a second copy is a second place for the qualifiers to drift.
 *
 * PLACE_CONTENT_RULES R1, R2 and R3 shape every sentence here
 * (docs/plans/MARKET_TRUTH/PLACE_CONTENT_RULES.md):
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
 * figure.
 *
 * ONE PROPERTY TYPE. Every figure in this section describes the single sub-type
 * the DAL selected, and that type is named in each sentence. R2 requires it for
 * dues; R4 requires it on any place that is not overwhelmingly detached; doing
 * it uniformly means no reader has to work out which figures were scoped.
 *
 * §0: nothing is computed here. Every number arrives measured.
 */

import type { PlaceCharacter as PlaceCharacterData } from '@/lib/data/places/getPlaceCharacter'

interface Props {
  placeName: string
  character: PlaceCharacterData | null
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** "2023-08-26" reads as "August 2023". The day the window opened is noise. */
function monthYear(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (!m) return ''
  const month = MONTHS[Number(m[2]) - 1]
  return month ? `${month} ${m[1]}` : m[1]
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

function count(n: number): string {
  return n.toLocaleString('en-US')
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
  const homes = `${count(yearBuilt.sample)} ${yearBuilt.sample === 1 ? 'home' : 'homes'} with a recorded build year`
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
  const since = monthYear(presence.windowFrom)
  const listings = presence.reported === 1 ? 'listing' : 'listings'
  const verb = presence.yes === 1 ? 'does' : 'do'
  const opener = since
    ? `Since ${since}, ${count(presence.reported)} ${label} ${listings} here reported whether the home has an HOA`
    : `${count(presence.reported)} ${label} ${listings} here reported whether the home has an HOA`
  return `${opener}. ${count(presence.yes)} of them ${verb}.`
}

/** R2's median, inside one property type, with the type and window named. */
export function duesSentence(
  subType: string,
  dues: { medianMonthly: number; reported: number; windowFrom: string },
): string {
  const label = listingLabel(subType)
  const since = monthYear(dues.windowFrom)
  const listings = dues.reported === 1 ? 'listing' : 'listings'
  const opener = since
    ? `${count(dues.reported)} ${label} ${listings} here reported a dues figure since ${since}`
    : `${count(dues.reported)} ${label} ${listings} here reported a dues figure`
  return `${opener}. The median is $${count(dues.medianMonthly)} a month.`
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

export function PlaceCharacter({ placeName, character }: Props) {
  if (!character) return null

  const { yearBuilt, dues, hoaPresence, subType, noun } = character
  const heading = placeCharacterHeading(placeName, character)

  return (
    <section className="section" id="character" aria-label={heading}>
      <div className="wrap">
        <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
          <span className="sec-index">
            {placeName} {'·'} Housing stock
          </span>
          <h2 className="sec-title display">{heading}</h2>
        </div>

        {yearBuilt ? (
          <p style={{ margin: '0 0 1rem', fontSize: '1.05rem', maxWidth: '44rem' }}>
            {yearBuiltSentence(placeName, noun, yearBuilt)}
          </p>
        ) : null}

        {hoaPresence ? (
          <p style={{ margin: '0 0 1rem', fontSize: '1.05rem', maxWidth: '44rem' }}>
            {hoaPresenceSentence(subType, hoaPresence)}
          </p>
        ) : null}

        {dues ? (
          <p style={{ margin: '0 0 1rem', fontSize: '1.05rem', maxWidth: '44rem' }}>
            {duesSentence(subType, dues)}
          </p>
        ) : null}

        <p style={{ fontSize: '.8rem', color: 'var(--navy-70)', margin: 0, maxWidth: '44rem' }}>
          Every figure here describes {noun} only, measured from listings in the regional MLS.
          {hoaPresence || dues
            ? ' Listings that reported nothing about an HOA are not counted either way. Confirm dues and governing documents through the association before relying on them.'
            : ''}
        </p>
      </div>
    </section>
  )
}
