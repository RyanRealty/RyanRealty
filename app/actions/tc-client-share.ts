'use server'

/**
 * Which transaction documents a client sees on their own file page.
 * Signed envelopes the client was party to show without this flag; anything
 * else a broker shares by hand, one document at a time (tc_documents.client_visible,
 * migration 20260923180000_tc_mail_index.sql).
 */
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { getDocumentDealScope } from '@/lib/data/tc/mail-reads'

type Result = { ok: true } | { ok: false; error: string }

/** Flip a document visible (or not) on the client's own file page. */
export async function setDocumentClientVisible(documentId: string, visible: boolean): Promise<Result> {
  const auth = await checkAdminAction('transactions.edit')
  if (!auth.ok) return { ok: false, error: auth.error }

  const doc = await getDocumentDealScope(documentId)
  if (!doc) return { ok: false, error: 'Document not found' }
  if (
    !dealVisibleToBroker({
      role: auth.ctx.role,
      brokerSlug: auth.ctx.brokerSlug,
      dealBrokerName: doc.brokerName,
    })
  ) {
    return { ok: false, error: 'Deal not found.' }
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('tc_documents').update({ client_visible: visible }).eq('id', documentId)
  if (error) return { ok: false, error: error.message }

  await supabase.from('tc_events').insert({
    deal_id: doc.dealId,
    cycle_id: doc.cycleId,
    document_id: doc.id,
    actor: auth.ctx.email,
    action: visible ? 'document_shared_with_client' : 'document_unshared_with_client',
    detail: { name: doc.name, document_id: doc.id },
  })

  revalidatePath(`/admin/deals/${doc.propertyKey}`)
  return { ok: true }
}
