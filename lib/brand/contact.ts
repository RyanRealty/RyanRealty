/**
 * Canonical Ryan Realty brokerage + broker facts — the single source of truth.
 *
 * Every render surface, page metadata, email/PDF body, and JSON-LD block that
 * names a phone number, license, broker, social profile, founding date, or the
 * brokerage NAP imports from HERE. Before this module those facts were copied
 * literal-by-literal into ~30 files, so a phone or license change meant a
 * repo-wide find-and-replace that was certain to leave a stale copy. Locked by
 * gate G38 (scripts/check-broker-facts.mjs): the canonical phone + social
 * literals may not reappear in app/ or components/ render code outside here.
 *
 * This file is PURE DATA — no imports, no DB, no env — so it is safe in both
 * server and client components.
 *
 * §0 provenance (verified 2026-06-05):
 *   - Broker roster (name/title/email/phone/license) mirrors lib/data/brokers/
 *     getBrokers.ts FALLBACK_BROKERS, which mirrors public.brokers (OREA-
 *     authoritative, verified 2026-06-02).
 *   - Brand NAP, founding date, org telephone, and the 8 social URLs are copied
 *     verbatim from components/JsonLd.tsx (the live Organization entity) so the
 *     rendered markup stays byte-identical after migration.
 */

export const BRAND = {
  name: 'Ryan Realty',
  legalName: 'Ryan Realty LLC',
  domain: 'ryan-realty.com',
  url: 'https://ryan-realty.com',
  /** ISO date used by JSON-LD foundingDate. */
  founded: '2023-06-21',
  /** Ryan Realty LLC itself dates from 2014; the Bend office opened June 2023 (Matt 2026-09-07). */
  llcSince: '2014',
  /** Prose form for body copy ("opened in June 2023"). */
  foundedLabel: 'June 2023',
  /** NAP. The live Organization JSON-LD carries locality + region only (no
   *  street); keep both region forms — 'OR' for schema, 'Oregon' for prose. */
  address: {
    street: '115 NW Oregon Ave #2',
    city: 'Bend',
    region: 'OR',
    regionFull: 'Oregon',
    postalCode: '97703',
    country: 'US',
  },
  /** Physical mailing address for CAN-SPAM email footers (Matt, 2026-06-07). */
  mailingAddress: '115 NW Oregon Ave #2, Bend, OR 97703',
  /** Bare handle for prose mentions. Profile URLs live in `social`. */
  socialHandle: '@ryanrealtybend',
  /** Locked 2026-05-13 (CLAUDE.md). Insertion order matches the live
   *  JSON-LD sameAs array — do not reorder. */
  social: {
    instagram: 'https://www.instagram.com/ryanrealtybend',
    facebook: 'https://www.facebook.com/ryanrealtybend',
    /** Channel-id URL of the Ryan Realty channel that holds the library (91
     *  videos, 10 subscribers on 2026-09-07). Matt chose it as THE channel that
     *  day and is moving the @ryanrealtybend handle onto it; the id URL is right
     *  before and after the move, the handle URL pointed at a 7-video duplicate. */
    youtube: 'https://www.youtube.com/channel/UCpxIXnNVeG25oeDjfE3b4lw',
    tiktok: 'https://www.tiktok.com/@ryanrealtybend',
    x: 'https://x.com/ryanrealtybend',
    /** Real claimed slug (verified live 2026-06-10) — /company/ryanrealtybend 404s. */
    linkedin: 'https://www.linkedin.com/company/ryan-realty-llc-bend-oregon',
    /** Matt's pick 2026-09-07: /ryanrealty is the account he uses (the
     *  /ryanrealtybend duplicate is being closed). GBP url_pinterest matches. */
    pinterest: 'https://www.pinterest.com/ryanrealty',
    threads: 'https://www.threads.net/@ryanrealtybend',
    /** Google Business Profile — canonical Maps URL (cid form, stable).
     *  Resolved via Places API 2026-07-29: placeId ChIJfVsN4o3IuFQR7KJXpmn9L5k.
     *  Closes the entity loop for the brand SERP (westside backlog #3). */
    googleBusinessProfile: 'https://maps.google.com/?cid=11038319841912529644',
  },
  /**
   * Other spellings of this entity that other sites use (schema.org
   * alternateName). AEO-6 / COMP-8 (visibility audit 2026-09-22): the brand
   * query "ryan realty bend" returns our LinkedIn, Zillow, Facebook and Yelp
   * profiles ABOVE the site, under these names. `name` stays exactly
   * 'Ryan Realty' (the local-seo NAP canon: no keyword suffix, ever); these
   * only tell an engine the other spellings are the same business.
   *   'Ryan Realty Bend'              Zillow screen name + Facebook page name
   *   'Ryan Realty LLC (Bend Oregon)' LinkedIn company name
   */
  alternateNames: ['Ryan Realty Bend', 'Ryan Realty LLC (Bend Oregon)'],
  /**
   * Third-party directory profiles of the brokerage, for JSON-LD sameAs only
   * (not the footer's social icons, which read `social`). AEO-6 / COMP-8.
   * Each verified before it was added (2026-09-23):
   *   zillow  curl (Chrome UA) 200 three times on 2026-09-23, title "Matthew
   *           Ryan - Real Estate Agent in Bend, OR - Reviews | Zillow",
   *           screenName "Ryan Realty Bend", businessName "Ryan Realty LLC",
   *           phone (541) 703-3095, links ryan-realty.com. It is Matt's agent
   *           profile under the brokerage screen name, so it is also on his
   *           person node (BROKER_SAME_AS). Zillow's bot wall sometimes answers
   *           403; that is the wall, not a dead profile.
   *   yelp    DataDome answers every bot fetch with 403 (a made-up slug gets
   *           the same 403), so curl cannot separate live from dead here. The
   *           search index lists this exact URL as "RYAN REALTY - Updated
   *           August 2026 ... 115 NW Oregon Ave, Bend, Oregon - Real Estate
   *           Agents" (2026-09-23), and docs/audits/PROFILE_CONSISTENCY_2026-08-03.md
   *           verified the claimed listing live in a browser (name, address,
   *           website match). That listing still shows 541.213.6706, the
   *           private forward target (AEO-7): a profile edit for Matt, not code.
   * Realtor.com is NOT here: no profile URL for the brokerage or a broker
   * could be found (search index has none, public.brokers.realtor_id is null,
   * realtor.com answers bots with 429). Add it when Matt supplies the URL.
   */
  directoryProfiles: {
    zillow: 'https://www.zillow.com/profile/Ryan%20Realty%20Bend',
    yelp: 'https://www.yelp.com/biz/ryan-realty-bend',
  },
} as const

/** Direct "leave a review" URL for the GBP listing — use in review-request
 *  emails/SMS (one tap to the review box, no searching). */
export const GBP_REVIEW_URL =
  'https://search.google.com/local/writereview?placeid=ChIJfVsN4o3IuFQR7KJXpmn9L5k'

/** Ordered social-profile URL list for JSON-LD `sameAs` (byte-identical to the
 *  prior hardcoded SAME_AS array). */
export const SOCIAL_PROFILES: string[] = Object.values(BRAND.social)

/** Organization JSON-LD sameAs: the social profiles, then the directory
 *  profiles (AEO-6 / COMP-8). Social order is unchanged. */
export const ENTITY_SAME_AS: string[] = [...SOCIAL_PROFILES, ...Object.values(BRAND.directoryProfiles)]

/**
 * Per-broker sameAs for the RealEstateAgent person nodes, keyed by the
 * public.brokers slug. Only profiles that were verified to be THIS person:
 *   matthew-ryan  Zillow agent profile (see BRAND.directoryProfiles.zillow), and the
 *                 LinkedIn profile that Zillow page itself links to as his
 *                 (linkedin.com/in/mattmryan; LinkedIn answers bots with 999,
 *                 the search index titles it "Matthew Ryan - Ryan Realty LLC
 *                 (Bend Oregon) | LinkedIn").
 * Paul and Rebecca have no verified third-party profile yet (public.brokers
 * zillow_id / realtor_id / yelp_id / social_* are null for both, 2026-09-23).
 */
export const BROKER_SAME_AS: Readonly<Record<string, readonly string[]>> = {
  'matthew-ryan': [BRAND.directoryProfiles.zillow, 'https://www.linkedin.com/in/mattmryan'],
}

export const CONTACT = {
  /** Brokerage brand line. As of the Twilio cutover (2026-06-24) this is the
   *  ported 541.703.3095 line, now living in Twilio: every inbound call/text is
   *  recorded, logged to the CRM timeline, and routed to the right broker. Used
   *  by the site footer + Organization JSON-LD telephone. Matt's old direct line
   *  (541.213.6706) is now a private forward target only, off the public site. */
  phoneDirect: '541.703.3095',
  phoneDirectTel: '+15417033095',
  /** Lead-capture line — same Twilio brand line. Use on lead-capture CTAs. */
  phoneFub: '541.703.3095',
  phoneFubDisplay: '541-703-3095',
  phoneFubTel: '+15417033095',
  email: {
    primary: 'matt@ryan-realty.com',
  },
} as const

export type BrokerKey = 'matt' | 'paul' | 'rebecca'

/**
 * Broker identity facts — the single source for getBrokers.ts FALLBACK_BROKERS
 * and every rendered broker name/title/license.
 *
 * `name` is the full legal name (used in JSON-LD + formal contexts).
 * `nameShort` is the everyday display form — several surfaces render
 * "Rebecca Peterson", NOT the full "Rebecca Ryser Peterson"; use `nameShort`
 * there so the visible name never changes.
 *
 * `phone` is each broker's PUBLIC Twilio business line (cutover 2026-06-24):
 * inbound is recorded, logged to the CRM timeline, and forwarded to that
 * broker's private cell (brokers.forward_to_cell — never shown publicly). This
 * is the fallback roster; the live values are public.brokers.twilio_number.
 * Matt's line is the ported primary business number 541.703.3095 (2026-07-02
 * fix — the temp 541.224.5025 is retained in Twilio as the legacy/spare line,
 * see lib/crm/twilio.ts MARKETING_NUMBER). Paul's line is 541.502.3436 (the
 * cutover doc's "501" was a typo — Twilio owns +15415023436).
 */
export const BROKERS = {
  matt: {
    slug: 'matthew-ryan',
    name: 'Matt Ryan',
    nameShort: 'Matt Ryan',
    title: 'Owner & Principal Broker',
    titleShort: 'Principal Broker',
    email: 'matt@ryan-realty.com',
    phone: '541.703.3095',
    license: '201206613',
    isPrincipal: true,
  },
  paul: {
    slug: 'paul-stevenson',
    name: 'Paul Stevenson',
    nameShort: 'Paul Stevenson',
    title: 'Broker',
    titleShort: 'Broker',
    email: 'paul@ryan-realty.com',
    phone: '541.502.3436',
    license: '201259123',
    isPrincipal: false,
  },
  rebecca: {
    slug: 'rebecca-peterson',
    name: 'Rebecca Ryser Peterson',
    nameShort: 'Rebecca Peterson',
    title: 'Broker',
    titleShort: 'Broker',
    email: 'rebeccapeterson@ryan-realty.com',
    phone: '541.250.3380',
    license: '201254727',
    isPrincipal: false,
  },
} as const
