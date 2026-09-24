'use server'

/**
 * Answering the document review list. The reader flags what it will not
 * decide alone; a person looks, fixes what needs fixing on the deal page
 * (archive, restore, checklist), or marks the flag resolved with a note.
 * The answer is a tc_events row; nothing about the document changes here.
 */
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { getDocumentDealScope } from '@/lib/data/tc/mail-reads'

type Result = { ok: true } | { ok: false; error: string }

export async function resolveDocumentReview(input: { documentId: string; note?: string }): Promise<Result> {
  const auth = await checkAdminAction('transactions.edit')
  if (!auth.ok) return { ok: false, error: auth.error ?? 'Not authorized' }
  const scope = await getDocumentDealScope(input.documentId)
  if (!scope) return { ok: false, error: 'Document not found.' }
  if (!dealVisibleToBroker({ role: auth.ctx.role, brokerSlug: auth.ctx.brokerSlug, dealBrokerName: scope.brokerName })) {
    return { ok: false, error: 'Document not found.' }
  }
  const { error } = await createServiceClient()
    .from('tc_events')
    .insert({
      deal_id: scope.dealId,
      cycle_id: scope.cycleId,
      document_id: scope.id,
      actor: auth.ctx.email,
      action: 'document_review_resolved',
      detail: { name: scope.name, note: (input.note ?? '').trim().slice(0, 500) || null },
    })
  if (error) return { ok: false, error: 'Could not record that.' }
  revalidatePath('/admin/closings/documents')
  revalidatePath(`/admin/deals/${scope.propertyKey}`)
  return { ok: true }
}
