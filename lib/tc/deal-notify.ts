/**
 * Internal deal-broker notices (sign-off queue). Fail-open. Not a client send.
 */
import 'server-only'

import { sendGovernedEmail } from '@/lib/comms/sendGovernedEmail'
import { getMattMailboxPersonId } from '@/lib/data/tc/oref-packet-reads'

export async function notifyDealMailbox(input: {
  to: string | null | undefined
  subject: string
  bodyText: string
}): Promise<void> {
  const to = (input.to ?? '').trim()
  if (!to.includes('@')) return
  try {
    const personId = await getMattMailboxPersonId(to)
    if (personId == null) {
      console.warn('[deal-notify] no CRM person for', to)
      return
    }
    const sent = await sendGovernedEmail({
      personId,
      purpose: 'tc:deal-notify',
      initiator: { kind: 'system', source: 'deal-notify' },
      payload: {
        rail: 'gmail',
        to: [to],
        subject: input.subject,
        bodyText: input.bodyText,
        withSignature: false,
        primaryAddress: to,
      },
    })
    if (!sent.ok) console.warn('[deal-notify]', sent.error)
  } catch (err) {
    console.warn('[deal-notify]', err)
  }
}
