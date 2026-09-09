/**
 * THE LISTING TIER'S HONESTY BLOCK — the view half (SITE-33, Matt 2026-09-08).
 *
 * The ruling and the predicate live in `lib/data/listings/service-area.ts`.
 * This module is the words, and only the words, so the block can be unit-tested
 * against a Medford row and a Bend row without rendering React.
 *
 * IT IS THE CITY TIER'S CLAIM, ONE LEVEL DOWN. /oregon/[city] has said
 * "Outside our home market · We don't work in <city>" since W12; a Rogue River
 * house on this site said nothing at all. The sentences below are that page's
 * sentences (app/oregon/[city]/page.tsx), narrowed from "these listings" to
 * "this home", because two tiers that disagree about the same market is the
 * defect, not two tiers that repeat themselves.
 *
 * WHY THIS IS A QUIET BLOCK AND NOT AN INSTRUMENT. It carries no figure. It is
 * a disclosure — one of the shapes PUBLIC_UI.md §3 names for Quiet — and it
 * ends in the door that does the work: the city's referral page, where the
 * broker introduction is captured. Adding an active-listing count here would
 * put a market figure on a primitive whose contract refuses one, and would need
 * a §0 trace on a section whose job is to make a claim about US, not about the
 * market.
 *
 * VOICE.md: plain, first person plural, no hedging, no apology. It says what is
 * true (this is not our market), what is still useful (the feed is live), and
 * what we will do about it (introduce a broker we would use ourselves).
 */
import type { OutOfAreaListingPolicy } from '@/lib/data/listings/service-area'

export type ListingOutOfAreaNotice = {
  /** Section id — deep-linkable, and the section_view key. */
  id: 'out-of-area'
  /** The uppercase context line. The city tier's exact eyebrow. */
  eyebrow: string
  /** The visible title, and the region's accessible name. */
  heading: string
  /** The claim. One string is one paragraph. */
  paragraphs: readonly string[]
  /** The door: this city's referral page. */
  doorLabel: string
  doorHref: string
}

/**
 * Build the notice for an out-of-area listing, or `null` when the home is in
 * the Central Oregon service area and the page has nothing to disclose.
 *
 * `referralResolves` is whether the city's /oregon page will actually render —
 * that route 404s a slug with no live snapshot row, and a door to a 404 is
 * worse than no door. When it does not resolve the block still renders and
 * sends the reader to /contact, which is where the referral ends up either way.
 */
export function buildListingOutOfAreaNotice(
  policy: OutOfAreaListingPolicy | null,
  referralResolves: boolean,
): ListingOutOfAreaNotice | null {
  if (!policy) return null
  const { cityName, referralHref } = policy
  return {
    id: 'out-of-area',
    eyebrow: 'Outside our home market',
    heading: `We don't work in ${cityName}`,
    // TWO paragraphs, not three. TASTE.md bans a section whose primary content
    // is more than two paragraphs of prose with no figure — and this block has
    // no figure by design (see the header). Looked at 1440 and 375 on the
    // Medford subject, 2026-09-09: three paragraphs read as an essay above the
    // facts; two read as a statement.
    paragraphs: [
      `Ryan Realty works Central Oregon. Our brokers live in Bend and cover the towns around it, from Redmond and Sisters to Sunriver and La Pine. ${cityName} is outside that area. Our MLS feed is statewide, so this home and its price are live and current — what we cannot tell you is which street in ${cityName} is the one to buy on.`,
      `A broker who works ${cityName} every day will know it better than we do. Tell us what you need and we will introduce you to one we would use ourselves. No cost, no obligation.`,
    ],
    doorLabel: referralResolves
      ? `${cityName} homes and a broker introduction`
      : 'Ask us for a broker introduction',
    doorHref: referralResolves ? referralHref : '/contact',
  }
}
