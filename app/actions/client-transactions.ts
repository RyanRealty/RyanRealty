'use server'

/**
 * A client acting on their own transaction from /account/transactions.
 * Every action re-checks the signed-in identity against the file (see
 * lib/data/tc/client-transactions.ts); nothing trusts an id from the browser.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { clientDocumentUrl, getClientIdentity, getPortalSigningRecipient } from '@/lib/data/tc/client-transactions'
import { listEnvelopeSigningRoster } from '@/lib/data/tc/envelope-recipient-reads'
import { earlierSigningGroupPending, generateSigningToken } from '@/lib/tc/signing'
import { normalizeEmail } from '@/lib/tc/mail-rules'

type LinkResult = { ok: true; url: string } | { ok: false; error: string }

/**
 * Sign from the portal. The signed-in, confirmed email IS the recipient, which
 * is the same proof the emailed link relies on, so a fresh link is minted here
 * (the emailed one retires, exactly as a resend does).
 */
export async function openMySigningLink(recipientId: string): Promise<LinkResult> {
  const identity = await getClientIdentity()
  if (!identity) return { ok: false, error: 'Sign in with the email your broker has on file.' }
  const r = await getPortalSigningRecipient(recipientId)
  if (!r || normalizeEmail(r.email) !== identity.email) return { ok: false, error: 'That signature request was not found.' }
  const env = r.envelope
  if (!env || (env.status !== 'sent' && env.status !== 'partially_signed')) return { ok: false, error: 'This is no longer out for signature.' }
  if (r.completedAt) return { ok: false, error: 'You already signed this one.' }
  if (r.declinedAt || r.actionRequired !== 'NeedsToSign') return { ok: false, error: 'This one does not need your signature.' }
  const roster = await listEnvelopeSigningRoster(env.id)
  if (earlierSigningGroupPending(r.signingOrder, roster)) return { ok: false, error: 'It is not your turn yet. We will email you when it is.' }

  const sb = createServiceClient()
  const { token, hash } = generateSigningToken()
  const { error } = await sb.from('tc_envelope_recipients').update({ auth_token_hash: hash }).eq('id', recipientId)
  if (error) return { ok: false, error: 'Could not open the signing page. Try the link in your email.' }
  await sb.from('tc_events').insert({
    deal_id: env.dealId,
    cycle_id: env.cycleId,
    actor: identity.email,
    action: 'envelope_link_opened_from_portal',
    detail: { envelope: env.name, recipient_id: recipientId },
  })
  return { ok: true, url: `/sign/${token}` }
}

export async function getMyDocumentLink(dealId: string, documentId: string): Promise<LinkResult> {
  const identity = await getClientIdentity()
  if (!identity) return { ok: false, error: 'Sign in with the email your broker has on file.' }
  const url = await clientDocumentUrl(identity, dealId, documentId)
  if (!url) return { ok: false, error: 'That document is not available.' }
  return { ok: true, url }
}
