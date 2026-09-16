/**
 * Route-local constants for /about.
 *
 * Split out of page.tsx so the page stays under the file-size floor. Nothing
 * here fetches or formats.
 *
 * THE FIRM STORY LIVES ON THE FOLD (Matt 2026-09-14). One plain sentence:
 * boutique brokerage in Central Oregon that helps clients buy and sell.
 * That lock is ABOUT_FIRM_STORY. Not a staccato three-liner. "How it started"
 * stays origin — it does not restate the fold. Firm OREA sits on AboutOffice.
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
 * NO BROKER NAME IS TYPED IN THIS FILE. Brokers belong on /team. The FAQ
 * answers "Who are the brokers?" with a door, not a roster. Held by
 * components/site/__tests__/about-faces.test.ts — do not spell a broker's
 * name in a comment either.
 */

/** Firm license number as published on the pre-v3 about page. */
export const FIRM_LICENSE_NUMBER = '201253677'
/**
 * Firm license as published on the pre-v3 about page (OREA 201253677). Print
 * the NUMBER next to a label that already says OREA: AboutOffice rendered
 * "Firm OREA OREA 201253677" for two days (a separate evaluator called it a
 * broken template concatenation, 2026-09-16).
 */
export const FIRM_LICENSE = `OREA ${FIRM_LICENSE_NUMBER}`

/** Matt 2026-09-14 lock. One plain purpose line — not How it started, not Team. */
export const ABOUT_FIRM_STORY =
  'Ryan Realty is a boutique brokerage in Central Oregon that helps clients buy and sell their properties.'

/**
 * Tip Ready evidence quotes copied from About TSX / CSS / page / contact.
 * The gate requires each string to stay in this file and in the live source.
 * A lone boolean is refuse. Do not invent paraphrases.
 */
export const ABOUT_LOCK_QUOTES = {
  '1': 'Ryan Realty is a boutique brokerage in Central Oregon that helps clients buy and sell their properties.',
  '2': 'The brokers are on /team. The person you talk to first is the person who works with you through closing.',
  '3': 'Hero (office exterior + purpose), V3Proof as first proof, closings,',
  '4': 'Call | Text | Email | Schedule. Live hours stay V3OnDuty above this.',
  '5': "street: '115 NW Oregon Ave #2'",
  '6': '5. AboutOffice — 115 NW Oregon Ave #2 + firm OREA. Brokers on /team only. * 6. AboutInquiry GET to /contact.',
  '7': '/about first viewport — Redfin structure. Navy and cream only.',
  '8': 'Firm closings as the shadcn carousel + Card demo (SITE-90).',
} as const

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

export const ABOUT_FAQ_ITEMS = [
  {
    question: 'Who are the brokers?',
    answer:
      'The brokers are on /team. The person you talk to first is the person who works with you through closing.',
  },
  {
    // The sentence the origin prose already carries — "the broker you first
    // speak to is the broker who works your purchase or sale through to close.
    // No hand-off." — is not repeated here. What is left is the part that
    // section does not say: what the hand-off would have been to.
    question: 'Will I work with the same broker from start to finish?',
    answer: 'Yes. The broker you meet first is the broker who works with you through closing. We are a small team of local experts, and we stay with you.',
  },
  {
    question: 'Do you cover Tumalo?',
    answer:
      'Yes. Tumalo is unincorporated and the MLS counts it as part of Bend, so you will find Tumalo homes under Bend on this site. We know the area well and help buyers and sellers there all the time.',
  },
  {
    question: 'How do I get a home valuation?',
    answer:
      'Use Value my home. A broker prepares a comparative market analysis from recent sales near you and sends a price range within 24 hours, with the comps that support it. It is free, and there is no listing agreement.',
  },
] as const
