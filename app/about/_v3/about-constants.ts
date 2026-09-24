/**
 * Route-local constants for /about.
 *
 * Split out of page.tsx so the page stays under the file-size floor. Nothing
 * here fetches or formats.
 *
 * THE FIRM STORY LIVES ON THE FOLD (Matt 2026-09-14, restated SITE-163).
 * Faces open the page at display scale. One plain sentence: boutique
 * brokerage in Central Oregon that helps clients buy and sell.
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
 * NO BROKER NAME IS TYPED IN THIS FILE, AND THE FAQ STILL NAMES THEM.
 * Until 2026-09-23 the FAQ answered "Who are the brokers?" with a door, "The
 * brokers are on /team", under the 2026-09-14 lock. The visibility audit of
 * 2026-09-22 (AEO-5, VOICE-5) found that answer in the FAQPage JSON-LD every
 * answer engine reads: a question about who the brokers are, answered with a
 * URL path and no names. Matt 2026-09-23: "Don't assume any rules from the
 * past that might keep us from hitting our goals are permanent." So the
 * answer now names each broker and role, and the names come FROM THE LIVE
 * ROSTER (public.brokers through loadAboutProof, the same faces the fold
 * shows), never typed here. Still no license numbers in the answer (those sit
 * on the faces and /team) and still no roster section: deep bios stay on
 * /team. Held by components/site/__tests__/about-faces.test.ts and
 * scripts/lib/about-lock.mjs beat 2. Do not spell a broker's name in a
 * comment either.
 */

import { BRAND, CONTACT } from '@/lib/brand/contact'
import { LISTING_TERMS } from '@/app/sell/_v3/sell-constants'

/** Firm license as published on the pre-v3 about page (OREA 201253677). */
export const FIRM_LICENSE = 'OREA 201253677'

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
  '2': 'Faces open the page at display scale. Deep bios stay on /team.',
  '3': 'V3Proof reviews as words plus dated local closings as a carousel',
  '4': 'Call | Text | Email | Schedule. Live hours stay V3OnDuty above this.',
  '5': "street: '115 NW Oregon Ave #2'",
  '6': '5. AboutOffice — 115 NW Oregon Ave #2 + firm OREA. Brokers on /team only. * 6. AboutInquiry GET to /contact.',
  '7': '/about first viewport — faces at display scale. Navy and cream only.',
  '8': 'shadcn Avatar image, fallback, and badge at display scale.',
  '9': 'Below the proof: What Ryan Realty does, the differentiators, Key facts in one <dl>, and the same business day reply.',
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

export const ABOUT_BROKERS_QUESTION = 'Who are the brokers?'

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** 3 -> "three"; past nine, the numeral. */
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n)
}

/** "Owner & Principal Broker" -> "owner and principal broker". */
export function roleWords(title: string): string {
  return title.trim().replace(/\s*&\s*/g, ' and ').toLowerCase()
}

/**
 * The answer to "Who are the brokers?", built from the roster the page
 * already loaded (display name + title from public.brokers). With no roster
 * it names no one and says where they are, rather than inventing a line.
 */
export function aboutBrokersAnswer(people: ReadonlyArray<{ name: string; title: string }>): string {
  const named = people.filter((p) => p.name.trim())
  if (named.length === 0) {
    return 'Every Ryan Realty broker is on the team page, with their Oregon license and the homes they have closed.'
  }
  const parts = named.map((p) => (p.title.trim() ? `${p.name.trim()}, ${roleWords(p.title)}` : p.name.trim()))
  const list =
    parts.length === 1
      ? parts[0]
      : parts.length === 2
        ? `${parts[0]}; and ${parts[1]}`
        : `${parts.slice(0, -1).join('; ')}; and ${parts[parts.length - 1]}`
  const count = countWord(named.length)
  const noun = named.length === 1 ? 'broker' : 'brokers'
  return `Ryan Realty has ${count} licensed ${noun}: ${list}. Each one's license, recorded closings, and direct line are on the team page.`
}

/**
 * The FAQ as the page renders it and as FAQPage emits it: one array, two
 * sinks, so the JSON-LD can never say something the visible questions do not.
 *
 * Matt 2026-09-23 (About-page AEO playbook): the four questions of 2026-09-02
 * grew to eight, each answered in two or three sentences, because the
 * questions people ask an answer engine about a brokerage are what it costs,
 * how fast it answers, where it is, and whether it is licensed. The live
 * inputs are the roster (brokers) and the published booking hours (office);
 * a live value that did not load drops its sentence, never guesses it.
 */
export function aboutFaqItems(
  people: ReadonlyArray<{ name: string; title: string }>,
  live: { hours?: string | null } = {},
): Array<{ question: string; answer: string }> {
  const [sameBroker, tumalo, valuation] = ABOUT_FAQ_ITEMS
  const hours = live.hours?.trim()
  return [
    { question: ABOUT_BROKERS_QUESTION, answer: aboutBrokersAnswer(people) },
    {
      question: 'How much does Ryan Realty charge to sell a home?',
      answer: `${LISTING_TERMS.fee} ${LISTING_TERMS.covers} ${LISTING_TERMS.buyerAgent}.`,
    },
    { question: valuation.question, answer: valuation.answer },
    { question: sameBroker.question, answer: sameBroker.answer },
    {
      // Matt 2026-09-23: "same business day" is his commitment, stated as his.
      question: 'How quickly will Ryan Realty get back to me?',
      answer: `The same business day. Call or text ${CONTACT.phoneDirect}, email ${CONTACT.email.primary}, or book a time online, and you will hear from a licensed broker, not a call center.`,
    },
    {
      question: 'Where is the Ryan Realty office?',
      answer: `The office is at ${BRAND.address.street} in downtown ${BRAND.address.city}, ${BRAND.address.regionFull} ${BRAND.address.postalCode}.${
        hours ? ` Office hours are ${hours}.` : ''
      }`,
    },
    {
      question: 'Is Ryan Realty licensed in Oregon?',
      answer: `Yes. ${BRAND.legalName} holds Oregon Real Estate Agency firm license ${FIRM_LICENSE.replace(/^OREA\s+/, '')}, and every broker is licensed in Oregon. Each broker's license number is on their team page.`,
    },
    { question: tumalo.question, answer: tumalo.answer },
  ]
}

export const ABOUT_FAQ_ITEMS = [
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
