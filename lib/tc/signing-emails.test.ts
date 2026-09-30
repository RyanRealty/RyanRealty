import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Signing mail goes out as the broker, never as a bare noreply@ with a broker
 * Reply-To. Measured against matt@ryan-realty.com on 2026-09-30: that pairing
 * put every invite and reminder since 09-29 in Gmail spam (two test sends plus
 * a plain one-line control did the same), while the same invite from
 * "Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com> landed in the inbox
 * twice. A signer who never sees the invite never signs.
 */

const sendEmail = vi.fn<(opts: unknown) => Promise<{ id: string }>>(async () => ({ id: 'email-1' }))
vi.mock('@/lib/resend', () => ({ sendEmail: (opts: unknown) => sendEmail(opts) }))
vi.mock('@/lib/email/auto-track', () => ({ resolveTrackablePersonId: async () => null }))
// The live roster: a broker onboarded after the static registry was written.
vi.mock('@/lib/data/crm/getCrmBrokers', () => ({
  getCrmBrokers: async () => [{ slug: 'jane', name: 'Jane Doe', email: 'Jane@Ryan-Realty.com' }],
}))

const { sendSigningInvite, sendCompletionCopy } = await import('./signing-emails')

type Sent = { from?: string; replyTo?: string; to: string }
const lastSend = () => sendEmail.mock.calls.at(-1)![0] as Sent

const invite = {
  to: 'buyer@example.com',
  recipientName: 'Pat Buyer',
  envelopeName: 'Addendum to Sale Agreement 1 - 002 OREF',
  propertyAddress: '99001 Alias Test Loop, Bend, OR 97701',
  signUrl: 'https://ryan-realty.com/sign/abc',
}
const copy = {
  to: 'buyer@example.com',
  recipientName: 'Pat Buyer',
  envelopeName: 'Addendum to Sale Agreement 1 - 002 OREF',
  propertyAddress: '99001 Alias Test Loop, Bend, OR 97701',
  pdf: Buffer.from('%PDF-1.7'),
  pdfName: 'signed.pdf',
}

const MATT = { from: '"Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com>', replyTo: 'matt@ryan-realty.com' }
const PAUL = { from: '"Paul Stevenson · Ryan Realty" <paul@mail.ryan-realty.com>', replyTo: 'paul@ryan-realty.com' }

describe('signing mail sender', () => {
  beforeEach(() => sendEmail.mockClear())

  it('sends the invite as the broker who sent the envelope, replies to their inbox', async () => {
    await sendSigningInvite({ ...invite, sender: 'matt@ryan-realty.com' })
    expect(lastSend()).toMatchObject(MATT)
    await sendSigningInvite({ ...invite, sender: 'paul@ryan-realty.com' })
    expect(lastSend()).toMatchObject(PAUL)
  })

  it('sends reminders the same way', async () => {
    await sendSigningInvite({ ...invite, sender: 'paul@ryan-realty.com', reminder: true })
    expect(lastSend()).toMatchObject(PAUL)
  })

  it('reads a broker key as well as a mailbox', async () => {
    await sendSigningInvite({ ...invite, sender: 'matt' })
    expect(lastSend()).toMatchObject(MATT)
  })

  it('sends as a broker onboarded after the registry, named from the roster, replies to them', async () => {
    await sendSigningInvite({ ...invite, sender: 'jane@ryan-realty.com' })
    expect(lastSend()).toMatchObject({
      from: '"Jane Doe · Ryan Realty" <jane@mail.ryan-realty.com>',
      replyTo: 'jane@ryan-realty.com',
    })
  })

  it('sends a company mailbox the roster does not name as itself, never as Matt', async () => {
    await sendSigningInvite({ ...invite, sender: 'admin@ryan-realty.com' })
    expect(lastSend()).toMatchObject({ from: '"Ryan Realty" <admin@mail.ryan-realty.com>', replyTo: 'admin@ryan-realty.com' })
  })

  it('falls back to the brokerage only without a company sender, and never to a bare noreply', async () => {
    for (const sender of [undefined, null, '', 'someone@elsewhere.com']) {
      await sendSigningInvite({ ...invite, sender })
      const sent = lastSend()
      expect(sent.from).toBe(MATT.from)
      expect(sent.from).not.toMatch(/noreply/i)
      expect(sent.replyTo).toBe(MATT.replyTo)
    }
  })

  it('sends completed copies and the other side packet as the broker too', async () => {
    await sendCompletionCopy({ ...copy, sender: 'paul@ryan-realty.com' })
    expect(lastSend()).toMatchObject(PAUL)
    await sendCompletionCopy({ ...copy, sender: 'matt@ryan-realty.com', packet: 'our_side' })
    expect(lastSend()).toMatchObject(MATT)
    await sendCompletionCopy({ ...copy })
    expect(lastSend().from).toBe(MATT.from)
  })
})
