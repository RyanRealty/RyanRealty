/**
 * Route-local constants for /about.
 *
 * Split out of page.tsx so the page stays under the file-size floor. Nothing
 * here fetches or formats. The mission sentence is the D11 exception: it is
 * the only public line that may name authentic / exceptional, and the words
 * are locked. Do not paraphrase it. It ships in the closing Quiet, never in
 * How it started and never on the first screen.
 */

/** D11 About mission. Exact words. Who is talking: We. Nowhere else on the site. */
export const ABOUT_MISSION =
  'We are a boutique real estate brokerage in Bend, Oregon, committed to building community through authentic relationships and exceptional customer service.'

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

export const ABOUT_FAQ_ITEMS = [
  {
    question: 'Who are the brokers?',
    answer:
      'Matt Ryan (Principal Broker, OR #201206613), Paul Stevenson, and Rebecca Ryser Peterson.',
  },
  {
    question: 'When did Ryan Realty start?',
    answer: 'Matt Ryan opened Ryan Realty in June 2023, based in Bend, Oregon.',
  },
  {
    question: 'Will I work with the same broker from start to finish?',
    answer:
      'Yes. The broker you first talk to is the broker who works your purchase or sale through to close. There is no hand-off to a junior agent or a transaction desk.',
  },
  {
    question: 'What areas do you cover?',
    answer:
      'Bend, Redmond, Sisters, Sunriver, La Pine, Terrebonne, and Prineville, plus the surrounding resort communities including Tetherow, Pronghorn, Eagle Crest, and Brasada Ranch. Tumalo, unincorporated and not a separate MLS city, is served as part of the Bend market.',
  },
  {
    question: 'How do I get a home valuation?',
    answer:
      'Use Value my home. A broker prepares a comparative market analysis from recent comparable sales and gives you a price range, with the comps that support it.',
  },
] as const
