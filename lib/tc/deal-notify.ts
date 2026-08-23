/**
 * Internal deal-broker notices (sign-off queue). Fail-open. Not a client send.
 */
import 'server-only'

export async function notifyDealMailbox(input: {
  to: string | null | undefined
  subject: string
  bodyText: string
}): Promise<void> {
  const to = (input.to ?? '').trim()
  if (!to.includes('@')) return
  try {
    const { sendCrmEmail } = await import('@/lib/crm/gmail')
    const sent = await sendCrmEmail({
      fromMailbox: 'matt@ryan-realty.com',
      to,
      subject: input.subject,
      bodyText: input.bodyText,
      withSignature: false,
    })
    if (!sent.ok) console.warn('[deal-notify]', sent.error)
  } catch (err) {
    console.warn('[deal-notify]', err)
  }
}
