/**
 * The ONE place a recipient's live signing link is minted or re-used. Every
 * caller that needs to email/hand a recipient their /sign/<token> link (first
 * send, manual reminder, the automatic reminder cron, the next-signing-group
 * invite, the client portal) goes through this instead of calling
 * generateSigningToken() + an update() directly — otherwise each of those
 * mints a NEW token and overwrites tc_envelope_recipients.auth_token_hash,
 * silently killing every link already emailed to that recipient.
 *
 * G1: raw read/write on tc_envelope_recipients lives here, not at the call
 * sites (lib/tc/ is a DAL-boundary-exempt domain-logic prefix, but this keeps
 * the token table's access in one auditable spot regardless).
 */
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateSigningToken, hashSigningToken } from '@/lib/tc/signing'
import { openSigningToken, sealSigningToken } from '@/lib/tc/signing-token-vault'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers pass service or request-scoped clients typed differently at each site
type Sb = SupabaseClient<any, any, any>

export type SigningLinkRecipientRow = {
  id: string
  auth_token_hash?: string | null
  auth_token_enc?: string | null
}

export type SigningLinkResult = { token: string; reused: boolean }

/**
 * Reuse the recipient's currently-stored token when it is still live (its
 * encrypted copy decrypts AND its sha256 still matches the stored hash —
 * both must hold, since a completed/declined/voided recipient has its hash
 * cleared even if a stale enc value were ever left behind). Otherwise mint a
 * fresh token, store both its hash and its encrypted copy, and return it.
 */
export async function mintOrReuseSigningLink(
  supabase: Sb,
  recipient: SigningLinkRecipientRow,
): Promise<SigningLinkResult> {
  const opened = openSigningToken(recipient.auth_token_enc)
  if (opened && recipient.auth_token_hash && hashSigningToken(opened) === recipient.auth_token_hash) {
    return { token: opened, reused: true }
  }
  const { token, hash } = generateSigningToken()
  const enc = sealSigningToken(token)
  const { error } = await supabase
    .from('tc_envelope_recipients')
    .update({ auth_token_hash: hash, auth_token_enc: enc })
    .eq('id', recipient.id)
  if (error) throw new Error(`mintOrReuseSigningLink: ${error.message}`)
  return { token, reused: false }
}
