/**
 * A Gmail draft is not mail. `users.messages.list` returns drafts beside sent
 * mail, under the sender's own From line, and every autosave is a new message
 * id under one Message-ID. Measured 2026-10-01: 410 drafts across the three
 * broker mailboxes; 152 had reached the Vault mail index (142 filed on 26
 * deals) and 143 CRM timeline rows said an email went out that never did.
 * docs/TC_MAIL_FILING_RULES.md "v4.2: an unsent draft is not mail".
 *
 * Every mail walk that writes a timeline row, files on a deal or harvests a
 * party or an offer lists with `withoutDrafts(q)`. The filing rules also refuse
 * a message carrying the DRAFT label (`isUnsentDraft`), for any path that
 * fetches a message by id; the one-time full-history review walk lists drafts
 * on purpose (its coverage counts every message) and records each as not a
 * deal. Pure.
 */

/** Gmail search operator that leaves drafts out of `users.messages.list`. */
export const NOT_DRAFTS = '-in:drafts'

/** The query with drafts left out (once). */
export function withoutDrafts(q: string): string {
  const query = q.trim()
  if (/(^|\s)-in:drafts?(\s|$)/i.test(query)) return query
  return query ? `${query} ${NOT_DRAFTS}` : NOT_DRAFTS
}

/** Gmail still holds the message as a draft: it was never sent. */
export function isUnsentDraft(labelIds: readonly (string | null | undefined)[] | null | undefined): boolean {
  const labels = labelIds ?? []
  return labels.includes('DRAFT') && !labels.includes('SENT')
}
