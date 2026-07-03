/** CRM constants shared by pages and server actions (must NOT live in a 'use server' file). */

export const CRM_STAGES = [
  'Lead', 'Seller Prospect', 'A - Hot 1-3 Months', 'B - Warm 3-6 Months', 'C - Cold 6+ Months',
  'Renter - future buyer', 'Active Client', 'Pending', 'Past Client', 'Sphere', 'Nurture',
  'Closed', 'Archive', 'Real Estate Agent', 'Vendor', 'Trash',
  // Streamline v2 (2026-07-03): the intent-phase stage between Nurture and Active.
  'Engaged',
] as const

export const CRM_BROKERS = ['matt', 'rebecca', 'paul'] as const
export type CrmBrokerSlug = (typeof CRM_BROKERS)[number]

/** Admin sign-in email → CRM broker slug (the short slugs used in assigned_broker + broker: tags). */
export const CRM_BROKER_BY_EMAIL: Record<string, CrmBrokerSlug> = {
  'matt@ryan-realty.com': 'matt',
  'rebeccapeterson@ryan-realty.com': 'rebecca',
  'paul@ryan-realty.com': 'paul',
}

/** CRM broker slug → FUB numeric user id (verified live 2026-06-09: Matt=1, Rebecca=2, Paul=3). */
export const FUB_USER_ID_BY_BROKER: Record<CrmBrokerSlug, number> = {
  matt: 1,
  rebecca: 2,
  paul: 3,
}

export const CRM_BROKER_DISPLAY: Record<CrmBrokerSlug, string> = {
  matt: 'Matt Ryan',
  rebecca: 'Rebecca Peterson',
  paul: 'Paul Stevenson',
}
