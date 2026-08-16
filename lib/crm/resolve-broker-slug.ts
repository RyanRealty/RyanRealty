/**
 * Own-book slug resolution — table first, hardcoded map last.
 *
 * P7 / MASTER-SPEC D17: a new broker must map without a deploy. The
 * `brokers.crm_slug` row (by admin_roles.broker_id, then by email) is the
 * source of truth. CRM_BROKER_BY_EMAIL is only a fallback for the three
 * seeded mailboxes if the table is unread.
 *
 * Pure — the DAL (`lib/data/brokers/resolveCrmSlug.ts`) fetches, this
 * decides. Never invent a slug.
 */

import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'

export function hardcodedSlugForEmail(email: string | null | undefined): string | null {
  const key = (email ?? '').trim().toLowerCase()
  if (!key) return null
  return CRM_BROKER_BY_EMAIL[key] ?? null
}

/**
 * Pick the CRM slug for a signed-in admin.
 *
 * Order: row from brokers.id (admin_roles.broker_id) → row from brokers.email
 * → hardcoded mailbox map → null (unmapped; scopeBroker fail-closes).
 */
export function pickCrmSlug(input: {
  email: string | null | undefined
  slugFromBrokerId: string | null | undefined
  slugFromEmailRow: string | null | undefined
}): string | null {
  const fromId = (input.slugFromBrokerId ?? '').trim()
  if (fromId) return fromId
  const fromEmail = (input.slugFromEmailRow ?? '').trim()
  if (fromEmail) return fromEmail
  return hardcodedSlugForEmail(input.email)
}
