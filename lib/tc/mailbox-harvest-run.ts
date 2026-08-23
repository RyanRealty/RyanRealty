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
    out.push({
      from: get('From'),
      to: get('To'),
      cc: get('Cc'),
      subject: get('Subject'),
      snippet: m.data.snippet ?? '',
    })
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

/** Fill other-side agent, escrow #, and inbound offers from broker mail about this address. */
export async function harvestDealMailboxFacts(input: {
  dealId: string
  address: string
  brokerName: string | null
}): Promise<{
  otherAgent: { name: string; email: string } | null
  escrowNumber: string | null
  lender: { name: string; email: string } | null
  offers: ReturnType<typeof import('./mailbox-harvest').harvestOffersFromMail>
  pdfs: Array<{ filename: string; bytes: Buffer }>
}> {
  const { harvestOtherSideAgent, harvestEscrowNumber, harvestOffersFromMail, harvestLender, gmailQueryForAddress } =
    await import('./mailbox-harvest')
  const tokens = addressTokens(input.address)
  const q = gmailQueryForAddress(tokens)
  const headers: MailHeader[] = []
  if (q) {
    for (const box of mailboxesForDeal(input.brokerName)) {
      try {
        headers.push(...(await headersForQuery(box, q)))
      } catch (err) {
        console.warn('[mailbox-harvest facts]', box, err)
      }
    }
  }
  const pdfs = await fetchOfferPdfs(mailboxesForDeal(input.brokerName), q)
  return {
    otherAgent: harvestOtherSideAgent(headers),
    escrowNumber: harvestEscrowNumber(headers),
    lender: harvestLender(headers),
    offers: harvestOffersFromMail(headers),
    pdfs,
  }
}

async function fetchOfferPdfs(
  boxes: string[],
  streetQuery: string,
): Promise<Array<{ filename: string; bytes: Buffer }>> {
  if (!streetQuery) return []
  const out: Array<{ filename: string; bytes: Buffer }> = []
  const q = `${streetQuery} (offer OR "offer to purchase") has:attachment filename:pdf`
  for (const box of boxes) {
    const gmail = getGmailFor(box, ['https://www.googleapis.com/auth/gmail.readonly'])
    if (!gmail) continue
    try {
      const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 5 })
      for (const m of list.data.messages ?? []) {
        const full = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' })
        const parts: Array<{ filename: string; attachmentId: string }> = []
        const walk = (p?: { filename?: string | null; mimeType?: string | null; body?: { attachmentId?: string | null }; parts?: unknown[] }) => {
          if (!p) return
          const name = p.filename || ''
          const mime = (p.mimeType || '').toLowerCase()
          const id = p.body?.attachmentId
          if (id && (mime.includes('pdf') || name.toLowerCase().endsWith('.pdf'))) {
            parts.push({ filename: name || 'offer.pdf', attachmentId: id })
          }
          for (const child of (p.parts ?? []) as typeof p[]) walk(child)
        }
        walk(full.data.payload)
        for (const part of parts.slice(0, 2)) {
          const att = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: m.id!,
            id: part.attachmentId,
          })
          if (!att.data.data) continue
          out.push({ filename: part.filename, bytes: Buffer.from(att.data.data, 'base64url') })
          if (out.length >= 4) return out
        }
      }
    } catch (err) {
      console.warn('[mailbox-harvest pdf]', box, err)
    }
  }
  return out
}
