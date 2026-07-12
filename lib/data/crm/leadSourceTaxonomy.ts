/**
 * Lead-source taxonomy — the ONE place that classifies a `crm_people.source`
 * string into a channel, and decides whether it represents a genuine inbound
 * marketing lead or an outreach list we built ourselves.
 *
 * Why this exists
 * ───────────────
 * The CRM `source` column carries two naming schemes:
 *   - Legacy Title-Case labels imported from the retired FUB account
 *     ("Website", "Realtor.com", "Inbound Call", "Farm", "Import", "Sphere").
 *   - New kebab/snake labels written by the live native pipelines
 *     ("contact-form", "buyer-lp", "seller-lp", "home-valuation",
 *      "meta-lead-form", "expired-lp", "inbound-call").
 *
 * A marketing dashboard that counts every crm_people row as a "lead" is wrong:
 * the account holds ~14.5k Farm + ~5.7k Import + ~1.3k Sphere rows (prospecting
 * lists WE assembled) against a few dozen genuine inbound leads. This module is
 * the discriminator so every surface (analytics, reports, visitors) counts the
 * same way.
 *
 * Pure + synchronous — no DB, no I/O. Unit-tested in leadSourceTaxonomy.test.ts.
 */

export type LeadChannel =
  | 'web' // site forms, LPs, organic web, search click-through
  | 'portal' // Realtor.com, Zillow, other listing portals
  | 'phone' // inbound / sign / cold calls, inbound text
  | 'social' // paid + organic social, Meta lead forms
  | 'referral' // word of mouth, referrals, open house, sphere-of-influence contact
  | 'prospecting' // lists we built for outreach: farm, expired, fsbo
  | 'import' // bulk CRM imports / legacy FUB migration rows
  | 'manual' // manually keyed by a broker
  | 'unknown' // null / unrecognized

export type LeadSourceClass = {
  channel: LeadChannel
  /** A human contacted us (or a portal delivered a real inquiry). Counts as a marketing lead. */
  attributable: boolean
  /** A list we assembled for outbound outreach (farm/expired/fsbo/import). Never a marketing lead. */
  outreachList: boolean
}

/**
 * Channels that represent genuine inbound / direct leads — the numerator for
 * every "leads" metric on a marketing dashboard.
 */
export const ATTRIBUTABLE_CHANNELS: ReadonlySet<LeadChannel> = new Set<LeadChannel>([
  'web',
  'portal',
  'phone',
  'social',
  'referral',
])

/** Channels that are outreach lists we built, not inbound leads. */
export const OUTREACH_CHANNELS: ReadonlySet<LeadChannel> = new Set<LeadChannel>([
  'prospecting',
  'import',
])

/**
 * Keyword → channel rules, evaluated in order. Each rule matches a normalized
 * source (lowercased, non-alphanumerics collapsed to single spaces). First hit
 * wins, so put the more specific rules first (e.g. "sign call" before "call").
 */
const RULES: ReadonlyArray<{ channel: LeadChannel; test: (s: string) => boolean }> = [
  // Portals — a portal source (realtor.com/zillow) always wins.
  { channel: 'portal', test: (s) => /realtor com|realtorcom|\bzillow\b|trulia|homes com|redfin/.test(s) },
  // Social — Meta lead forms + paid/organic social. Before the web-form rule so
  // "meta-lead-form" classifies as social, not web.
  { channel: 'social', test: (s) => /facebook|instagram|\bmeta\b|\bfb\b|\big\b|tiktok|linkedin|youtube|social/.test(s) },
  // Inbound web forms / landing pages / tools. Runs BEFORE prospecting so an
  // "expired-lp" / "fsbo-lp" FORM submission (a homeowner who filled out our
  // landing page — a real inbound lead) is not mistaken for the "Expired
  // Listing" / "FSBO" prospecting LISTS we build ourselves (matched below).
  {
    channel: 'web',
    test: (s) =>
      /\blp\b|lp form|landing|contact form|home valuation|valuation|\bcma\b|rental calculator|exit intent|signup|sign up|newsletter|listing alert|saved search/.test(
        s,
      ),
  },
  // Prospecting lists — WE built these for outreach (bare labels: "Farm",
  // "Expired Listing", "expired-listing-cron", "FSBO"). Any "-lp" form variant
  // was already claimed by the web rule above.
  { channel: 'prospecting', test: (s) => /\bfarm\b|assessor/.test(s) },
  { channel: 'prospecting', test: (s) => /\bexpired\b/.test(s) },
  { channel: 'prospecting', test: (s) => /\bfsbo\b|for sale by owner/.test(s) },
  // Bulk imports / legacy FUB migration / sphere-of-influence lists. "Sphere"
  // is a bulk contact list we assembled (past clients, friends), NOT per-lead
  // inbound — so it is non-attributable like Farm/Import, not a "referral".
  { channel: 'import', test: (s) => /\bimport\b|migration|follow up boss|followupboss|\bfub\b|\bsphere\b/.test(s) },
  // Phone / text.
  { channel: 'phone', test: (s) => /\bsign call\b/.test(s) },
  { channel: 'phone', test: (s) => /\bcall\b|\bphone\b|inbound text|\bsms\b|\btext\b/.test(s) },
  // Referral / in-person — a genuine individual referral IS an inbound lead.
  { channel: 'referral', test: (s) => /word of mouth|referr|open house|past client|repeat client/.test(s) },
  // Manual entry.
  { channel: 'manual', test: (s) => /manual/.test(s) },
  // Web — remaining site / organic / search sources (website, ryan-realty.com,
  // Google). Kept LAST of the "real" buckets so specific channels win first.
  {
    channel: 'web',
    test: (s) => /website|web site|ryan realty|\bgoogle\b|\borganic\b|\bsearch\b/.test(s),
  },
]

/** Normalize a raw source string for keyword matching. */
export function normalizeSource(source: string | null | undefined): string {
  return (source ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Classify a raw `crm_people.source` value. Never throws; unknown/empty → the
 * `unknown` channel (not attributable, not an outreach list — surfaced honestly
 * as "other/unspecified" rather than silently counted as a lead).
 */
export function classifyLeadSource(source: string | null | undefined): LeadSourceClass {
  const norm = normalizeSource(source)
  if (!norm) {
    return { channel: 'unknown', attributable: false, outreachList: false }
  }
  for (const rule of RULES) {
    if (rule.test(norm)) {
      return {
        channel: rule.channel,
        attributable: ATTRIBUTABLE_CHANNELS.has(rule.channel),
        outreachList: OUTREACH_CHANNELS.has(rule.channel),
      }
    }
  }
  return { channel: 'unknown', attributable: false, outreachList: false }
}

/** True when a source represents a genuine inbound / direct marketing lead. */
export function isAttributableLead(source: string | null | undefined): boolean {
  return classifyLeadSource(source).attributable
}

/** Human-readable label for a channel, for dashboard axes / legends. */
export const CHANNEL_LABEL: Record<LeadChannel, string> = {
  web: 'Website & landing pages',
  portal: 'Listing portals',
  phone: 'Phone & text',
  social: 'Social',
  referral: 'Referral & sphere',
  prospecting: 'Prospecting lists',
  import: 'Bulk import',
  manual: 'Manual entry',
  unknown: 'Other / unspecified',
}
