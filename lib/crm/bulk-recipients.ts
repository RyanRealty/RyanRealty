/**
 * Shapes + limits for the Batch Email recipient panel.
 *
 * These live in lib/ rather than beside the server action because
 * app/actions/crm-bulk.ts carries `'use server'`, and a 'use server' module may
 * export nothing but async functions — a plain `export const` there compiles
 * under tsc and vitest and then fails the Next build with "Only async functions
 * are allowed to be exported in a 'use server' file".
 */

/**
 * How many recipients the dialog will list one by one. Past this the cohort is
 * shown as a count plus a sample and cannot be hand-edited — a partial sample
 * must never silently become the send.
 *
 * 500, not 200 (Matt 2026-08-25). The real bulk sends here are a newsletter, a
 * neighborhood segment, and an expired-listing blast of 300-400 — that last one
 * is core business, and at a 200 cap it would have been the one send you could
 * not review or trim by hand. The cap exists to stop someone editing a
 * 200-row slice of an 18,000-person cohort, not to block the sends actually
 * being made.
 */
export const BULK_RECIPIENT_PREVIEW_CAP = 500

export type BulkRecipient = {
  id: number
  name: string
  email: string
  /** Carries an email-suppressing tag: the worker will skip them, so say so up front. */
  suppressed: boolean
}

export type BulkRecipientPreview =
  | { ok: true; total: number; capped: boolean; people: BulkRecipient[] }
  | { ok: false; error: string }
