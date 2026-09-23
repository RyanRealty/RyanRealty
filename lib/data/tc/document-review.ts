/**
 * The document review list: what the Vault document reader could not settle
 * on its own (lib/tc/doc-read). One row per document with an open
 * `document_needs_review` flag: the flag is open until a person resolves it
 * (`document_review_resolved`) or acts on the document (archive / restore).
 * Broker-facing only. Raw .from() stays here (G1).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export type DocumentReviewItem = {
  documentId: string
  documentName: string
  reasons: string[]
  flaggedAt: string
  verdictLabel: string | null
  archived: boolean
}

export type DocumentReviewGroup = {
  dealId: string
  address: string
  propertyKey: string
  stage: string
  brokerName: string | null
  items: DocumentReviewItem[]
}

type EventRow = { document_id: string | null; deal_id: string | null; action: string; actor: string; detail: { reason?: string } | null; created_at: string }

const CLOSING_ACTIONS = new Set(['document_review_resolved', 'document_archived', 'document_unarchived'])

/** Open review flags, newest deal activity first. `canSee` scopes a broker to their own deals. */
export async function listDocumentReview(canSee: (brokerName: string | null) => boolean): Promise<DocumentReviewGroup[]> {
  const sb = createServiceClient()
  const events: EventRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('tc_events')
      .select('document_id, deal_id, action, actor, detail, created_at')
      .in('action', ['document_needs_review', 'document_review_resolved', 'document_archived', 'document_unarchived'])
      .not('document_id', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) {
      console.error('[listDocumentReview]', error.message)
      return []
    }
    events.push(...((data ?? []) as EventRow[]))
    if (!data || data.length < 1000) break
  }

  // Per document: flags raised after the last person's action on it.
  const open = new Map<string, { dealId: string; reasons: string[]; flaggedAt: string }>()
  for (const e of events) {
    const id = String(e.document_id)
    const byPerson = !e.actor.startsWith('system') && e.actor !== 'vault-reader'
    if (e.action === 'document_needs_review') {
      const cur = open.get(id) ?? { dealId: String(e.deal_id), reasons: [], flaggedAt: e.created_at }
      const reason = e.detail?.reason
      if (reason && !cur.reasons.includes(reason)) cur.reasons.push(reason)
      cur.flaggedAt = e.created_at
      open.set(id, cur)
    } else if (e.action === 'document_review_resolved' || (CLOSING_ACTIONS.has(e.action) && byPerson)) {
      // A person's answer or archive/restore closes the flag; so does the
      // reader itself when its current rules no longer raise it.
      open.delete(id)
    }
  }
  if (!open.size) return []

  const ids = [...open.keys()]
  const docs = new Map<string, { name: string; archived: boolean; label: string | null }>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from('tc_documents').select('id, name, archived, classification').in('id', ids.slice(i, i + 200))
    for (const d of data ?? []) {
      const reader = (d.classification as { reader?: { label?: string } } | null)?.reader
      docs.set(String(d.id), { name: String(d.name), archived: !!d.archived, label: reader?.label ?? null })
    }
  }
  const dealIds = [...new Set([...open.values()].map((o) => o.dealId))]
  const { data: deals } = await sb.from('tc_deals').select('id, address, property_key, stage, broker_name').in('id', dealIds)

  const groups: DocumentReviewGroup[] = []
  for (const d of deals ?? []) {
    if (!canSee((d.broker_name as string | null) ?? null)) continue
    const items: DocumentReviewItem[] = []
    for (const [docId, o] of open) {
      if (o.dealId !== String(d.id)) continue
      const doc = docs.get(docId)
      if (!doc) continue
      items.push({ documentId: docId, documentName: doc.name, reasons: o.reasons, flaggedAt: o.flaggedAt, verdictLabel: doc.label, archived: doc.archived })
    }
    if (!items.length) continue
    items.sort((a, b) => a.documentName.localeCompare(b.documentName))
    groups.push({
      dealId: String(d.id),
      address: String(d.address),
      propertyKey: String(d.property_key),
      stage: String(d.stage),
      brokerName: (d.broker_name as string | null) ?? null,
      items,
    })
  }
  // Live deals first (their gaps still have a fix), then by address.
  const liveFirst = (s: string) => (s === 'closed' || s === 'dead' ? 1 : 0)
  return groups.sort((a, b) => liveFirst(a.stage) - liveFirst(b.stage) || a.address.localeCompare(b.address))
}

/** Count for a board link. */
export async function countDocumentReview(canSee: (brokerName: string | null) => boolean): Promise<number> {
  const groups = await listDocumentReview(canSee)
  return groups.reduce((n, g) => n + g.items.length, 0)
}
