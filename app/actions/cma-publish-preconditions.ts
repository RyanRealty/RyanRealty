/**
 * Everything that stops a CMA from going on a listing page, in one list.
 *
 * NOT a `'use server'` module on purpose. Both the admin review page (which
 * renders the reasons) and the publish action (which enforces them) import this
 * one function, so the button the broker sees and the check the server runs can
 * never drift apart.
 *
 * Composition:
 *   publishBlockers()  — the public guard's own rules, stated in words
 *                        (lib/data/cma/getPublishedCma.ts). Source of truth.
 *   + one admin-side precondition: a document with no listing attached has no
 *     page to appear on, so publishing it would silently do nothing.
 *
 * This list may only ever be STRICTER than `isPublishable`, never looser.
 */

import { publishBlockers, publishConcerns, type CmaPublishConcern } from '@/lib/data/cma/getPublishedCma'

export const CMA_PUBLISH_NO_LISTING_REASON =
  'No listing is attached to this document, so there is no page for it to appear on.'

export function cmaPublishRefusals(row: Record<string, unknown> | null | undefined): string[] {
  const reasons = publishBlockers(row).map((b) => b.reason)
  if (row && !String(row.subject_listing_key ?? '').trim()) {
    reasons.push(CMA_PUBLISH_NO_LISTING_REASON)
  }
  return reasons
}

/**
 * What the broker reads before clicking publish, when nothing refuses.
 *
 * The other half of the severity-aware gate: a `critical` audit finding lands
 * in `cmaPublishRefusals` above and the button never appears, while `major` and
 * `minor` findings land here and the button does. Same module, so a surface
 * that renders one has the other in hand.
 */
export function cmaPublishConcerns(row: Record<string, unknown> | null | undefined): CmaPublishConcern[] {
  return publishConcerns(row)
}
