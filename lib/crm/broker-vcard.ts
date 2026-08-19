/**
 * Broker vCard for CRM compose. Public office facts only — never the
 * private forward-to cell.
 */

export function buildBrokerVcard(params: {
  name: string
  email: string | null
  phone: string | null
  org?: string
}): string {
  const name = (params.name || 'Ryan Realty').replace(/[\r\n;]/g, ' ').trim()
  const org = (params.org ?? 'Ryan Realty').replace(/[\r\n;]/g, ' ').trim()
  const email = (params.email ?? '').trim()
  const phone = (params.phone ?? '').replace(/[^\d+]/g, '')
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    `ORG:${org}`,
  ]
  if (email) lines.push(`EMAIL;TYPE=WORK:${email}`)
  if (phone) lines.push(`TEL;TYPE=WORK,VOICE:${phone}`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}
