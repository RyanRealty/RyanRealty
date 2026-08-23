import 'server-only'
import { getGmailFor, CRM_MAILBOXES } from '@/lib/crm/gmail'
import { brokerEmailFromFileName } from './deal-scope'
import { addressTokens } from './file-comms'
import { gmailQueryForParty, harvestPartyEmail, parseMailboxHeader, type MailHeader } from './mailbox-harvest'

async function headersForQuery(mailbox: string, query: string): Promise<MailHeader[]> {
  const gmail = getGmailFor(mailbox, ['https://www.googleapis.com/auth/gmail.readonly'])
  if (!gmail) return []
  const list = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 15 })
  const ids = (list.data.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id))
  const out: MailHeader[] = []
  for (const id of ids) {
    const m = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'metadata',
      metadataHeaders: ['From', 'To', 'Cc', 'Subject'],
    })
    const headers = m.data.payload?.headers ?? []
    const get = (n: string) => headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? ''
    out.push({ from: get('From'), to: get('To'), cc: get('Cc'), subject: get('Subject') })
  }
  return out
}

function mailboxesForDeal(brokerName: string | null): string[] {
  const dealBox = brokerEmailFromFileName(brokerName)
  const set = new Set(CRM_MAILBOXES.map((m) => m.email))
  const out: string[] = []
  if (dealBox && set.has(dealBox)) out.push(dealBox)
  if (!out.includes('matt@ryan-realty.com')) out.push('matt@ryan-realty.com')
  return out
}

/** Search the listing broker (and Matt) for a unique personal email for this party. */
export async function findPartyEmailInMailboxes(input: {
  partyName: string
  address: string
  brokerName: string | null
}): Promise<string | null> {
  const tokens = addressTokens(input.address)
  const q = gmailQueryForParty(input.partyName, tokens)
  const headers: MailHeader[] = []
  for (const box of mailboxesForDeal(input.brokerName)) {
    try {
      headers.push(...(await headersForQuery(box, q)))
    } catch (err) {
      console.warn('[mailbox-harvest]', box, err)
    }
  }
  return harvestPartyEmail(input.partyName, headers)
}

export { parseMailboxHeader }
