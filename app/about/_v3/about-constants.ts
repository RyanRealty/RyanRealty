/**
 * Route-local constants for /about.
 *
 * Split out of page.tsx so the page stays under the file-size floor. Nothing
 * here fetches or formats.
 *
 * THE D11 MISSION SENTENCE IS OFF THIS PAGE (2026-09-02). VOICE.md grants it
 * and grants nothing else — "This sentence MAY appear on About" — so no gate
 * required it; check-brand-voice.mjs only carves it out of the self-praise
 * scan, and the carve-out survives whether or not the page uses it. What it
 * opened the closing section with was "We are a boutique real estate brokerage
 * in Bend, Oregon", which is the positioning Matt killed on 2026-06-10 ("is
 * that going to position us, our intent is to grow"), and which
 * scripts/brand-voice-vocabulary.cjs bans by pattern (boutique|small + org)
 * everywhere the About carve-out does not reach. The record below it states
 * the firm without the gloss: founded, firm license, principal broker license,
 * each traceable to the Oregon Real Estate Agency.
 *
 * THE FAQ IS FOUR QUESTIONS, NOT SIX (2026-09-02). The set is what /about can
 * answer that /about has not already said. "When did Ryan Realty start?" went:
 * the origin prose, the Instrument headline, and the founded figure printed
 * June 2023 three times before the FAQ printed it a fourth. The service-area
 * answer's city list went the same way — the Atlas above it names every city,
 * resort community, and Bend neighborhood with a recorded boundary as a door,
 * and names more of them than the sentence did; the one fact the map cannot
 * state, that Tumalo is not a separate MLS city, is now its own question.
 * MetadataBlock emits this array as FAQPage, so a question cut here is a
 * question cut from the structured data too — which is the point: the page and
 * its JSON-LD answer the same four things.
 *
 * NO BROKER NAME IS TYPED IN THIS FILE (2026-09-02). The roster answer below
 * is built from lib/brand/contact.ts, because the hand-typed one had drifted:
 * the faces row renders `BROKERS.rebecca.nameShort` while this file's FAQ
 * answer carried `BROKERS.rebecca.name`, so /about published two spellings of
 * one broker as if they were two people. Display is `nameShort` on every
 * surface; the licensed name is a fact about the license and appears once,
 * attached to it. Held by components/site/__tests__/about-faces.test.ts, which
 * reads this file as text — do not spell a broker's name in a comment either.
 */

import { BROKERS, type BrokerKey } from '@/lib/brand/contact'

/** Firm license as published on the pre-v3 about page (OREA 201253677). */
export const FIRM_LICENSE = 'OREA 201253677'

/**
 * Service-area cities that earn a Ledger row, in row order. Presentation, not
 * a geo registry. Prineville added 2026-08-27: market_metric carries live,
 * publishable active_count + median_list_active rows for geo_slug=prineville
 * under the same definition_id='mt-v1' segment='detached' the other six rows
 * read (confirmed by row-level audit query, not an aggregate) — the prior
 * six-city list was an omission, not a data gap. Tumalo is NOT here: it is a
 * PERMANENT_ZERO_MLS_CITY_LABELS entry (lib/data/analytics/rebuildAnalyticsMarts.ts),
 * unincorporated and not a distinct MLS city, so it can never earn a row —
 * see the FAQ answer below for how that is stated instead of implied.
 */
export const ABOUT_CITY_LABELS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Terrebonne',
  'Prineville',
] as const

export const ABOUT_CITY_SLUG: Record<(typeof ABOUT_CITY_LABELS)[number], string> = {
  Bend: 'bend',
  Redmond: 'redmond',
  Sisters: 'sisters',
  Sunriver: 'sunriver',
  'La Pine': 'la-pine',
  Terrebonne: 'terrebonne',
  Prineville: 'prineville',
}

/**
 * Roster order, matching the faces above it: TEAM_RANK (matt 0, rebecca 1,
 * paul 2) in app/team/_v3/team-constants.ts. One page, one order.
 */
const ABOUT_ROSTER: readonly BrokerKey[] = ['matt', 'rebecca', 'paul']

/**
 * One broker, one line: the name a visitor sees, the title, the Oregon license
 * that name holds. When the license is issued to a longer legal name the line
 * says so where it belongs — on the license — rather than the page printing a
 * second name somewhere else. Every value reads from BROKERS, the single
 * source for every rendered broker name, title, and license number; the
 * numbers match the Oregon Real Estate Agency licensee records.
 */
function rosterLine(key: BrokerKey): string {
  const b = BROKERS[key]
  const licensedAs = b.name === b.nameShort ? '' : `, licensed as ${b.name}`
  return `${b.nameShort}, ${b.titleShort}, OR #${b.license}${licensedAs}`
}

/** "Name, Title, OR #license." per broker, in page order. */
export const ABOUT_BROKER_ROSTER = `${ABOUT_ROSTER.map(rosterLine).join('. ')}.`

export const ABOUT_FAQ_ITEMS = [
  {
    question: 'Who are the brokers?',
    answer: ABOUT_BROKER_ROSTER,
  },
  {
    // The sentence the origin prose already carries — "the broker you first
    // speak to is the broker who works your purchase or sale through to close.
    // No hand-off." — is not repeated here. What is left is the part that
    // section does not say: what the hand-off would have been to.
    question: 'Will I work with the same broker from start to finish?',
    answer: 'Yes. No hand-off to a junior agent or a transaction desk.',
  },
  {
    question: 'Do you cover Tumalo?',
    answer:
      'Tumalo is unincorporated and not a separate MLS city. It is served as part of the Bend market.',
  },
  {
    question: 'How do I get a home valuation?',
    answer:
      'Use Value my home. A broker prepares a comparative market analysis from recent comparable sales and gives you a price range, with the comps that support it.',
  },
] as const
