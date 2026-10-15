import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { GBP_REVIEW_URL } from '@/lib/brand/contact'
import { wrapPlainTextHtml } from '@/lib/crm/email-body'
import {
  REVIEW_ASK_SUBJECT,
  buildReviewAskBody,
  buildReviewAskText,
  decideReviewAsk,
  isReviewAskDraft,
  isSentReviewAsk,
  reviewAskClosingParties,
  reviewAskFirstName,
  reviewAskLedgerKey,
  reviewAskLedgerPrefix,
  reviewAskSince,
  reviewAskStreet,
  type ReviewAskConsent,
  type ReviewAskHistory,
  type ReviewAskPerson,
  type VaultClosing,
} from './review-ask'

const person = (over: Partial<ReviewAskPerson> = {}): ReviewAskPerson => ({
  id: 101,
  firstName: 'Dana',
  name: 'Dana Example',
  stage: 'Past Client',
  tags: [],
  emails: ['dana@example.com'],
  phones: ['5415550123'],
  deleted: false,
  ...over,
})
const fresh = (over: Partial<ReviewAskHistory> = {}): ReviewAskHistory => ({
  draftedAt: null,
  askedAt: null,
  pendingDraft: false,
  slotTaken: { email: false, text: false },
  ...over,
})
const open: ReviewAskConsent = { emailBlocked: false, smsBlocked: false }

describe('the drafted email', () => {
  const body = buildReviewAskBody({
    firstName: 'Dana',
    address: '3480 SW 45th Street, Redmond, OR 97756',
    signerFirstName: 'Matt',
  })

  it('is personal: first name, the street, the sender', () => {
    expect(body.startsWith('Hi Dana,\n')).toBe(true)
    expect(body).toContain('trusting us with 3480 SW 45th Street.')
    expect(body).not.toContain('Redmond, OR')
    expect(body.trim().endsWith('\nMatt')).toBe(true)
  })

  it('carries the Business Profile review link as a few linked words, never the raw address', () => {
    expect(body).toContain(`[leave us a Google review](${GBP_REVIEW_URL})`)
    const html = wrapPlainTextHtml(body)
    expect(html).toContain('>leave us a Google review</a>')
    expect(html).not.toContain(`>${GBP_REVIEW_URL}<`)
  })

  it('keeps the voice rules: no em dash, no semicolon, no exclamation', () => {
    expect(body).not.toMatch(/[—–;!]/)
  })

  it('names the broker who worked the deal when someone else sends it', () => {
    const b = buildReviewAskBody({ address: '1 Main St, Bend', signerFirstName: 'Matt', dealBrokerFirstName: 'Rebecca' })
    expect(b).toContain('trusting Rebecca and all of us at Ryan Realty with 1 Main St.')
  })

  it('falls back to "Hi," and "your home" rather than inventing either', () => {
    const b = buildReviewAskBody({})
    expect(b.startsWith('Hi,\n')).toBe(true)
    expect(b).toContain('trusting us with your home.')
    expect(buildReviewAskBody('  ')).toContain('your home')
  })

  it('the text keeps the bare link for the short-link rewrite', () => {
    const t = buildReviewAskText({ firstName: 'Dana', address: '1 Main St, Bend', signerFirstName: 'Matt' })
    expect(t).toContain(GBP_REVIEW_URL)
    expect(t.startsWith('Hi Dana, thank you again for trusting us with 1 Main St.')).toBe(true)
  })
})

describe('names and streets', () => {
  it('cleans first names and refuses placeholders and couples', () => {
    expect(reviewAskFirstName('dana', null)).toBe('Dana')
    expect(reviewAskFirstName(null, 'Sam Rivera')).toBe('Sam')
    expect(reviewAskFirstName('Unknown', null)).toBeNull()
    expect(reviewAskFirstName('Jim & Sue', null)).toBeNull()
    expect(reviewAskFirstName('J.', null)).toBeNull()
    expect(reviewAskFirstName('', '')).toBeNull()
    expect(reviewAskFirstName('José', null)).toBe('José')
    for (const entity of ['Estate of John Doe', 'Doe Family Trust', 'The Smiths', 'Jim and Sue Smith', 'Smith, Jim']) {
      expect(reviewAskFirstName(null, entity)).toBeNull()
    }
  })
  it('keeps only the street part of a file address', () => {
    expect(reviewAskStreet('909 NW Delaware Avenue, Bend, OR 97703')).toBe('909 NW Delaware Avenue')
    expect(reviewAskStreet('')).toBeNull()
  })
})

describe('recognizing an ask', () => {
  it('recognizes our draft, old and new bodies', () => {
    expect(isReviewAskDraft({ subject: REVIEW_ASK_SUBJECT, body: buildReviewAskBody('x') })).toBe(true)
    expect(isReviewAskDraft({ subject: REVIEW_ASK_SUBJECT, body: `Hi,\n\n${GBP_REVIEW_URL}\n` })).toBe(true)
    expect(isReviewAskDraft({ subject: null, body: buildReviewAskText({}) })).toBe(true)
    expect(isReviewAskDraft({ subject: 'Hi', body: buildReviewAskBody('x') })).toBe(false)
    expect(isReviewAskDraft({ subject: REVIEW_ASK_SUBJECT, body: 'thanks' })).toBe(false)
  })

  it('finds asks brokers already sent by hand, and not deal mail that mentions a review', () => {
    const sent = (title: string, kind = 'email_out') => isSentReviewAsk({ kind, title, hasReviewLink: false })
    for (const t of ['A quick review', 'Can you leave a quick review?', 'Do you have time for a review?', 'Would you feel comfortable leaving a review?']) {
      expect(sent(t)).toBe(true)
    }
    for (const t of ['Offer Review', 'For your review - counter offer language', 'Re: file review', 'Re: MLS review', 'Invoice Receipts']) {
      expect(sent(t)).toBe(false)
    }
    expect(sent('A quick review', 'email_in')).toBe(false)
    expect(sent('Re: A quick review')).toBe(true)
    expect(sent('Fwd: RE: Can you leave a quick review?')).toBe(true)
    expect(isSentReviewAsk({ kind: 'sms_out', title: 'Text sent', hasReviewLink: true })).toBe(true)
  })
})

describe('who gets one', () => {
  const decide = (p: ReviewAskPerson, h = fresh(), c = open, path: 'closing' | 'picked' = 'closing') =>
    decideReviewAsk({ person: p, history: h, consent: c, path })

  it('a real client with an email gets an email draft', () => {
    expect(decide(person())).toEqual({ stage: true, channel: 'email' })
  })

  it('never a test, deleted, trashed or internal person', () => {
    expect(decide(person({ tags: ['fleet:test'] }))).toEqual({ stage: false, reason: 'test' })
    expect(decide(person({ emails: ['qa+fleet-test@example.com'] }))).toEqual({ stage: false, reason: 'test' })
    expect(decide(person({ stage: 'Trash' }))).toEqual({ stage: false, reason: 'test' })
    expect(decide(person({ deleted: true }))).toEqual({ stage: false, reason: 'deleted' })
    expect(decide(person({ emails: ['marketing+dana@ryan-realty.com'] }))).toEqual({ stage: false, reason: 'internal' })
  })

  it('an industry contact is skipped on the automatic path but can be picked', () => {
    const agent = person({ stage: 'Real Estate Agent' })
    expect(decide(agent)).toEqual({ stage: false, reason: 'industry' })
    expect(decide(agent, fresh(), open, 'picked')).toEqual({ stage: true, channel: 'email' })
  })

  it('never twice: asked before, drafted before, or a draft already waiting', () => {
    expect(decide(person(), fresh({ askedAt: '2025-09-30T00:00:00Z' }))).toEqual({ stage: false, reason: 'already-asked' })
    expect(decide(person(), fresh({ askedAt: '2025-09-30T00:00:00Z' }), open, 'picked')).toEqual({ stage: false, reason: 'already-asked' })
    expect(decide(person(), fresh({ pendingDraft: true }), open, 'picked')).toEqual({ stage: false, reason: 'already-drafted' })
    expect(decide(person(), fresh({ draftedAt: '2026-10-01T00:00:00Z' }))).toEqual({ stage: false, reason: 'already-drafted' })
    // Matt's own pick may draft again after a discard (nothing went out).
    expect(decide(person(), fresh({ draftedAt: '2026-10-01T00:00:00Z' }), open, 'picked')).toEqual({ stage: true, channel: 'email' })
  })

  it('never over a draft a broker started', () => {
    expect(decide(person(), fresh({ slotTaken: { email: true, text: false } }))).toEqual({ stage: false, reason: 'draft-slot-taken' })
  })

  it('email by default; a text only with SMS consent and nothing blocking SMS', () => {
    const blockedEmail = { emailBlocked: true, smsBlocked: false }
    expect(decide(person(), fresh(), blockedEmail)).toEqual({ stage: false, reason: 'email-blocked' })
    const consented = person({ tags: ['sms-consent:yes'] })
    expect(decide(consented, fresh(), blockedEmail)).toEqual({ stage: true, channel: 'text' })
    // On the DNC registry / do-not-text: isSuppressed(sms) is true, and the reason says so.
    expect(decide(consented, fresh(), { emailBlocked: true, smsBlocked: true })).toEqual({ stage: false, reason: 'sms-blocked' })
    expect(decide(person({ emails: [], tags: ['sms-consent:yes'] }), fresh(), { emailBlocked: true, smsBlocked: true })).toEqual({
      stage: false,
      reason: 'sms-blocked',
    })
    expect(decide(person({ emails: [], tags: ['sms-consent:yes'] }), fresh(), { emailBlocked: true, smsBlocked: false })).toEqual({
      stage: true,
      channel: 'text',
    })
    expect(decide(person({ emails: [] }), fresh(), open)).toEqual({ stage: false, reason: 'no-email' })
    // A phone with consent still never beats a usable email.
    expect(decide(consented)).toEqual({ stage: true, channel: 'email' })
  })
})

describe('the closing path', () => {
  const closing = (over: Partial<VaultClosing>): VaultClosing => ({
    dealId: 'd1',
    address: '1 Main St, Bend, OR 97701',
    brokerName: 'Matt Ryan',
    stageDetail: 'Closed 2026-10-01',
    closeDate: '2026-10-01',
    parties: [{ personId: 1, role: 'buyer' }],
    ...over,
  })

  it('looks back a year from today', () => {
    expect(reviewAskSince('2026-10-14')).toBe('2025-10-14')
  })

  it('every buyer and seller on a real closing, once each, newest closing first', () => {
    const out = reviewAskClosingParties(
      [
        closing({ dealId: 'old', closeDate: '2026-03-01', parties: [{ personId: 1, role: 'seller' }, { personId: 2, role: 'buyer' }] }),
        closing({ dealId: 'new', closeDate: '2026-09-01', parties: [{ personId: 1, role: 'buyer' }, { personId: 3, role: 'other' }] }),
      ],
      '2026-10-14',
    )
    expect(out.map((p) => [p.closing.dealId, p.personId])).toEqual([
      ['new', 1],
      ['old', 2],
    ])
  })

  it('leaves out test files, future dates and closings older than the window', () => {
    const out = reviewAskClosingParties(
      [
        closing({ dealId: 'harness', stageDetail: 'TC TEST (alias harness): closed' }),
        closing({ dealId: 'placeholder', address: '1234 test street, test, CA, 55555' }),
        closing({ dealId: 'future', closeDate: '2026-11-01' }),
        closing({ dealId: 'stale', closeDate: '2025-10-13' }),
        closing({ dealId: 'edge', closeDate: '2025-10-14', parties: [{ personId: 9, role: 'seller' }] }),
      ],
      '2026-10-14',
    )
    expect(out.map((p) => p.closing.dealId)).toEqual(['edge'])
  })

  it('ledger keys: one per person and deal, one per person and pick day', () => {
    expect(reviewAskLedgerKey({ personId: 7, dealId: 'd1' })).toBe('review-ask:7:deal:d1')
    expect(reviewAskLedgerKey({ personId: 7, day: '2026-10-14T10:00:00Z' })).toBe('review-ask:7:picked:2026-10-14')
    expect(reviewAskLedgerKey({ personId: 7, dealId: 'd1' }).startsWith(reviewAskLedgerPrefix(7))).toBe(true)
  })
})

describe('nothing here sends', () => {
  const files = [
    'lib/crm/review-ask.ts',
    'lib/data/crm/stageReviewAskDraft.ts',
    'lib/data/tc/stageReviewAsksForRecentCloses.ts',
    'app/actions/crm-review-ask.ts',
    'app/api/cron/review-ask-on-close/route.ts',
  ]
  it.each(files)('%s calls no send path', (file) => {
    const src = readFileSync(file, 'utf8')
    expect(src).not.toMatch(
      /\b(sendGovernedEmail|sendGovernedSms|sendCrmEmail|sendCrmEmailAction|sendCrmSmsAction|sendComposeAction|sendEmail|sendSms|sendGmailMessage|approveEnrollmentAction)\s*\(/,
    )
    expect(src).not.toMatch(/from '@\/lib\/comms\//)
  })
})
