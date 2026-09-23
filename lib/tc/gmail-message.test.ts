import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { bulkSignals, extractBody, messageKeyFor, parseAddressList, pdfParts, threadKeyFor } from './gmail-message'

const h = (pairs: Record<string, string>) => Object.entries(pairs).map(([name, value]) => ({ name, value }))

describe('parseAddressList', () => {
  it('reads names and addresses, commas inside quotes included', () => {
    expect(parseAddressList('"Argyle, Jeanette" <transactions@BridgetownFiles.com>, matt@ryan-realty.com')).toEqual([
      { name: 'Argyle, Jeanette', email: 'transactions@bridgetownfiles.com' },
      { name: '', email: 'matt@ryan-realty.com' },
    ])
    expect(parseAddressList('undisclosed-recipients:;')).toEqual([])
  })
})

describe('message and thread keys', () => {
  it('matches the CRM sync key so both paths dedupe one message', () => {
    const id = '<CAB123@mail.gmail.com>'
    expect(messageKeyFor(id, 'g1')).toBe(`rfc:${createHash('sha1').update(id).digest('hex').slice(0, 24)}`)
    expect(messageKeyFor(null, 'g1')).toBe('gmail:g1')
  })

  it('keys a whole conversation by its first message across mailboxes', () => {
    const root = '<root@x>'
    const reply = threadKeyFor(h({ 'Message-ID': '<b@x>', References: `${root} <a@x>`, 'In-Reply-To': '<a@x>' }), 'T1')
    const first = threadKeyFor(h({ 'Message-ID': root }), 'T9')
    expect(reply).toBe(first)
    expect(threadKeyFor(h({}), 'T7')).toBe('gthr:T7')
  })
})

describe('bulkSignals', () => {
  it('flags list mail and robots, and tells auto-replies apart', () => {
    expect(bulkSignals(h({ 'List-Unsubscribe': '<mailto:x>' }))).toEqual({ bulk: true, autoReply: false })
    expect(bulkSignals(h({ Precedence: 'bulk' })).bulk).toBe(true)
    expect(bulkSignals(h({ 'Auto-Submitted': 'auto-replied' }))).toEqual({ bulk: false, autoReply: true })
    expect(bulkSignals(h({ 'Auto-Submitted': 'auto-generated' })).bulk).toBe(true)
    expect(bulkSignals(h({ 'Auto-Submitted': 'no' })).bulk).toBe(false)
  })
})

describe('bodies and attachments', () => {
  const b64 = (s: string) => Buffer.from(s).toString('base64url')
  it('prefers text/plain and strips HTML only when there is none', () => {
    expect(extractBody({ mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: b64('Plain') } }, { mimeType: 'text/html', body: { data: b64('<b>Html</b>') } }] })).toBe('Plain')
    expect(extractBody({ mimeType: 'text/html', body: { data: b64('<p>Offer&nbsp;attached</p>') } })).toBe('Offer attached')
  })

  it('finds every PDF part', () => {
    const parts = pdfParts({
      mimeType: 'multipart/mixed',
      parts: [
        { mimeType: 'text/plain', body: { data: b64('x') } },
        { mimeType: 'application/pdf', filename: 'Offer.pdf', body: { attachmentId: 'A1', size: 1000 } },
        { mimeType: 'application/octet-stream', filename: 'SCO1.PDF', body: { attachmentId: 'A2', size: 10 } },
        { mimeType: 'image/png', filename: 'logo.png', body: { attachmentId: 'A3', size: 10 } },
      ],
    })
    expect(parts.map((p) => p.filename)).toEqual(['Offer.pdf', 'SCO1.PDF'])
  })
})
