'use server'

/**
 * A lined section's text on a draft packet (Matt 2026-09-24: one text box per
 * multi-line section, and text that does not fit continues on an addendum
 * placed right after the form). lib/data/tc/continuation.ts does the work.
 */
import { revalidatePath } from 'next/cache'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { applyEnvelopeSectionText, getPacketDealBroker, type ApplySectionResult, type SectionTextInput } from '@/lib/data/tc/continuation'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'

const MAX_TEXT = 20_000

export async function applyPacketSectionText(envelopeId: string, texts: SectionTextInput[]): Promise<ApplySectionResult> {
  const gate = await checkAdminAction('transactions.edit')
  if (!gate.ok) return { ok: false, error: gate.error }
  const owner = await getPacketDealBroker(envelopeId)
  if (!owner) return { ok: false, error: 'Envelope not found' }
  if (!dealVisibleToBroker({ role: gate.ctx.role, brokerSlug: gate.ctx.brokerSlug, dealBrokerName: owner.brokerName })) {
    return { ok: false, error: 'This file is not yours to change.' }
  }
  const clean = texts
    .filter((t) => t && typeof t.documentId === 'string' && typeof t.areaKey === 'string' && typeof t.text === 'string')
    .map((t) => ({ documentId: t.documentId, areaKey: t.areaKey, text: t.text.slice(0, MAX_TEXT) }))
  const res = await applyEnvelopeSectionText(envelopeId, clean, gate.ctx.email)
  revalidatePath(`/admin/signing/${envelopeId}`)
  return res
}
