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
    youtube: 'https://www.youtube.com/@ryanrealtybend',
    tiktok: 'https://www.tiktok.com/@ryanrealtybend',
    x: 'https://x.com/ryanrealtybend',
    /** Real claimed slug (verified live 2026-06-10) — /company/ryanrealtybend 404s. */
    linkedin: 'https://www.linkedin.com/company/ryan-realty-llc-bend-oregon',
    pinterest: 'https://www.pinterest.com/ryanrealtybend',
    threads: 'https://www.threads.net/@ryanrealtybend',
  },
} as const

/** Ordered social-profile URL list for JSON-LD `sameAs` (byte-identical to the
 *  prior hardcoded SAME_AS array). */
export const SOCIAL_PROFILES: string[] = Object.values(BRAND.social)

export const CONTACT = {
  /** Matt's direct brokerage line, dotted brand-voice format. Org JSON-LD
   *  telephone + site footer. Distinct from the FUB line below. */
  phoneDirect: '541.213.6706',
  phoneDirectTel: '+1-541-213-6706',
  /** FUB-tracked lead-capture line (calls attribute to the website). Use on
   *  lead-capture CTAs. Canonical home of lib/listing-cta.ts. */
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
    phone: '541.977.6841',
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
    phone: '415.308.9087',
    license: '201254727',
    isPrincipal: false,
  },
} as const
