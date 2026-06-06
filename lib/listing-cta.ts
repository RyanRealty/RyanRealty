/**
 * Agent contact number (FollowUp Boss tracking).
 * Display this on the site so calls are attributed to the website.
 * Format for tel: is E.164; display as 541-703-3095.
 *
 * Re-exported from the canonical brand module (lib/brand/contact.ts) so the
 * number lives in exactly one place. Export names are preserved for the
 * existing import sites (LP forms, CTA cards).
 */
import { CONTACT } from '@/lib/brand/contact'

export const AGENT_PHONE_DISPLAY = CONTACT.phoneFubDisplay
export const AGENT_PHONE_TEL = CONTACT.phoneFubTel
