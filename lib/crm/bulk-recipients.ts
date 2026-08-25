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
 * shown as a count plus a sample and cannot be hand-edited — a 200-row sample
 * must never silently become the send.
 */
export const BULK_RECIPIENT_PREVIEW_CAP = 200

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
