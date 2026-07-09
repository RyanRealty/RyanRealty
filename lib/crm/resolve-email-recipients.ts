import 'server-only'

/**
 * Server side of composer recipients: parse the posted To/Cc/Bcc JSON fields
 * (lib/crm/email-recipients validators), fall back to the contact's primary
 * email on an empty To, and run the suppression sweep across EVERY recipient
 * address that maps to a CRM contact — a suppressed spouse on Cc blocks the
 * whole send, with the address named (compliance fail-closed).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseRecipientFields } from '@/lib/crm/email-recipients'
import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'
import { isSuppressed } from '@/lib/crm/suppressions'

export type ResolvedEmailRecipients = {
  toList: string[]
  ccList: string[]
  bccList: string[]
  /** OTHER CRM contacts among the recipients — they get timeline rows too. */
  extraPersonIds: number[]
}

export async function resolveEmailRecipients(params: {
  sb: SupabaseClient
  personId: number
  primaryEmail: string | undefined
  fields: { to: string; cc: string; bcc: string }
}): Promise<{ ok: true; recipients: ResolvedEmailRecipients } | { ok: false; error: string }> {
  const parsed = parseRecipientFields(params.fields)
  if (!parsed.ok) return parsed
  const { cc: ccList, bcc: bccList } = parsed.recipients
  let { to: toList, all } = parsed.recipients
  if (toList.length === 0) {
    if (!params.primaryEmail) return { ok: false, error: 'No email address on file' }
    toList = [params.primaryEmail.toLowerCase()]
    all = [...new Set([...toList, ...ccList, ...bccList])]
  }

  const extraPersonIds = new Set<number>()
  for (const addr of all) {
    const pids = await personIdsByEmailCi(params.sb, addr)
    for (const pid of pids) {
      if (pid === params.personId) continue
      const gate = await isSuppressed(pid, 'email')
      if (gate.suppressed) {
        return { ok: false, error: `Blocked by suppression on ${addr} (${gate.reasons.join(', ')})` }
      }
      extraPersonIds.add(pid)
    }
  }
  return { ok: true, recipients: { toList, ccList, bccList, extraPersonIds: [...extraPersonIds] } }
}
