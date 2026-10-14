/**
 * The GA4 `user_id` of a known CRM contact: ONE definition for the browser and
 * the server (data/analytics/decisions.json "crm-contacts-tagged-in-ga4").
 *
 * The browser gets it from /api/identity/me (AnalyticsIdentityBridge sets it with
 * gtag('set')); the server sends it on Measurement Protocol events for the same
 * person (the page-view mirror in /api/visitors/track, generate_lead,
 * person_identified). Both must produce the same string or GA4 counts one person
 * as two users.
 *
 * A SHA-256 of the crm_people.id, never a name, email or phone (Google forbids
 * personal information in GA4). Only for a visitor at the analytics tier or
 * above (docs/TRACKING_POLICY.md tier table): an essential-tier visit reaches
 * GA4 under an anonymous client id and nothing else, so it never carries one.
 */
import { createHash } from 'node:crypto'
import type { TrackingConsentLevel } from '@/lib/identity/consent'

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/** `crm-<sha256(id)>` for a valid crm_people.id, else null. */
export function ga4UserIdForPerson(personId: number | null | undefined): string | null {
  return typeof personId === 'number' && Number.isSafeInteger(personId) && personId > 0
    ? `crm-${sha256(String(personId))}`
    : null
}

/** `em-<sha256(email)>` for a signed-in visitor with no CRM contact yet. */
export function ga4UserIdForEmail(normalizedEmail: string): string {
  return `em-${sha256(normalizedEmail)}`
}

/** May a GA4 hit for this visit carry a user_id? Only at the analytics tier or above. */
export function ga4UserIdAllowedAt(level: TrackingConsentLevel | null | undefined): boolean {
  return level === 'analytics' || level === 'all'
}
