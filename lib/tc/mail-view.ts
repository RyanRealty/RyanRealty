/**
 * Shapes and labels for the Vault mail surfaces (deal Email section, mail queue).
 * Pure. No I/O.
 */

export const MAIL_CATEGORY_LABEL: Record<string, string> = {
  offer: 'Offer',
  counter: 'Counter',
  executed_agreement: 'Signed agreement',
  addendum: 'Addendum',
  disclosure: 'Disclosure',
  escrow_title: 'Escrow / title',
  lender: 'Lender',
  inspection: 'Inspection',
  closing: 'Closing',
  post_close: 'After closing',
  signing_notice: 'Signing',
  general: 'Email',
}

export const MAIL_METHOD_LABEL: Record<string, string> = {
  escrow: 'escrow number',
  mls: 'MLS number',
  address: 'property address',
  thread: 'same thread',
  party: 'our client',
  contact: 'deal contact',
  manual: 'filed by hand',
}

export type DealMailRow = {
  id: string
  sentAt: string
  direction: 'inbound' | 'outbound' | 'internal'
  fromEmail: string | null
  fromName: string | null
  to: string[]
  cc: string[]
  subject: string | null
  snippet: string | null
  category: string
  categoryLabel: string
  status: string
  method: string | null
  reasons: string[]
  attachments: Array<{ name: string; documentId: string | null; formName: string | null; executionState: string | null }>
  offerId: string | null
  mailboxes: string[]
  decidedBy: string
}

export type MailQueueRow = DealMailRow & {
  propertyHint: string | null
  candidates: Array<{ dealId: string; address: string; propertyKey: string; stage: string; evidence: string[] }>
}

export type MailQueueGroup = {
  /** "909 nw delaware", or null for mail that could belong to several files. */
  key: string
  label: string
  kind: 'property' | 'ambiguous'
  rows: MailQueueRow[]
  latestAt: string
}

function titleCase(s: string): string {
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Nw|Ne|Sw|Se)\b/g, (m) => m.toUpperCase())
}

/**
 * Queue rows grouped the way a person clears them: every email about one
 * property with no file sits together (one "open a file" answers them all);
 * email that could belong to several files is grouped by those files.
 */
export function groupMailQueue(rows: readonly MailQueueRow[]): MailQueueGroup[] {
  const groups = new Map<string, MailQueueGroup>()
  for (const r of rows) {
    let key: string
    let label: string
    let kind: MailQueueGroup['kind']
    if (r.status === 'unfiled_transaction' && r.propertyHint) {
      key = `p:${r.propertyHint}`
      label = titleCase(r.propertyHint)
      kind = 'property'
    } else if (r.candidates.length) {
      const ids = r.candidates.map((c) => c.dealId).sort()
      key = `a:${ids.join(',')}`
      label = r.candidates.map((c) => c.address.split(',')[0]).join(' · ')
      kind = 'ambiguous'
    } else {
      key = `m:${r.id}`
      label = r.subject?.trim() || 'Transaction email, no property named'
      kind = r.status === 'ambiguous' ? 'ambiguous' : 'property'
    }
    const g = groups.get(key) ?? { key, label, kind, rows: [], latestAt: r.sentAt }
    g.rows.push(r)
    if (r.sentAt > g.latestAt) g.latestAt = r.sentAt
    groups.set(key, g)
  }
  return [...groups.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt))
}

/** "Offer received, no reply sent" — the state an offer row shows. */
export function offerFollowUpLabel(o: {
  status: string
  source?: string | null
  repliedAt?: string | null
  presentedToSellerAt?: string | null
}): string | null {
  if (o.source !== 'mail' && o.source !== 'mailbox_harvest') return null
  const parts: string[] = []
  parts.push(o.repliedAt ? 'Replied' : 'No reply sent')
  parts.push(o.presentedToSellerAt ? 'Sent to seller' : 'Not yet sent to seller')
  return parts.join(' · ')
}
