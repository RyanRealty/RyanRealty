import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildEmailIntentNote, emailIntentDedupeKey } from '@/lib/crm/email-intent-note'
import { REPLY_INTENT_LABELS, type ReplyClassification } from '@/lib/crm/reply-intent'
import { parseSuggestedReply } from '@/components/admin/crm/composer-preload'

/**
 * W5.3 — inbound EMAIL replies from prospecting pipelines must get the same
 * reply-intent enrichment the Twilio inbound-SMS webhook already does: a
 * classified timeline note carrying a suggested reply on a ?reply= deep link.
 * The load-bearing difference from the SMS note is the CHANNEL — the link must
 * open the EMAIL composer (replyChannel=email), not SMS. These tests bite on the
 * real note output, so flipping the channel or dropping the link goes red.
 */

const INTEL: ReplyClassification = {
  intent: 'question',
  confidence: 0.82,
  recommendedReply: 'Happy to answer that. When works for a quick call?',
  source: 'model',
  model: 'claude-haiku-4-5-20251001',
}

describe('buildEmailIntentNote emits an EMAIL-channel suggested-reply note', () => {
  const note = buildEmailIntentNote({ personId: 4321, messageKey: 'rfc:abc123', subject: 'Question about my listing', intel: INTEL })
  const payload = note.payload as Record<string, unknown>
  const link = String(payload.replyLink)

  it('is a system note on the gmail source keyed for idempotency', () => {
    expect(note.kind).toBe('system')
    expect(note.source).toBe('gmail')
    expect(note.dedupe_key).toBe('gmail-intent:rfc:abc123:p4321')
    expect(note.person_id).toBe(4321)
  })

  it('titles + bodies the note from the classification', () => {
    expect(note.title).toBe(`Email reply classified: ${REPLY_INTENT_LABELS.question}`)
    expect(note.body).toBe('Suggested reply: Happy to answer that. When works for a quick call?')
    expect(payload.channel).toBe('email')
    expect(payload.recommendedReply).toBe(INTEL.recommendedReply)
  })

  it('the deep link opens the EMAIL composer (replyChannel=email) pre-filled', () => {
    // The whole point of W5.3: email replies route to the email composer, not SMS.
    expect(link).toContain('replyChannel=email')
    expect(link).toContain('/admin/people/4321')
    expect(link.endsWith('#comms')).toBe(true)
    // Round-trip through the CONSUMER (composer-preload parser): what the broker's
    // composer actually receives must be the email-channel reply with subject.
    const parsed = parseSuggestedReply(new URL(link).search)
    expect(parsed).toEqual({
      channel: 'email',
      body: INTEL.recommendedReply,
      subject: 'Re: Question about my listing',
    })
  })
})

describe('buildEmailIntentNote edge cases', () => {
  it('collapses an existing Re: prefix instead of stacking Re: Re:', () => {
    const note = buildEmailIntentNote({ personId: 7, messageKey: 'k', subject: 'Re: hello', intel: INTEL })
    const link = String((note.payload as Record<string, unknown>).replyLink)
    expect(parseSuggestedReply(new URL(link).search)?.subject).toBe('Re: hello')
  })

  it('with no recommended reply, the link is a plain #comms link and body is null', () => {
    const bare: ReplyClassification = { intent: 'later', confidence: 0.5, recommendedReply: '', source: 'deterministic' }
    const note = buildEmailIntentNote({ personId: 9, messageKey: 'k2', subject: null, intel: bare })
    const link = String((note.payload as Record<string, unknown>).replyLink)
    expect(link).toBe('https://ryan-realty.com/admin/people/9#comms')
    expect(note.body).toBeNull()
  })

  it('dedupe key is stable per (message, person)', () => {
    expect(emailIntentDedupeKey('rfc:x', 12)).toBe('gmail-intent:rfc:x:p12')
  })
})

/**
 * Wiring guard — the pure builder above is worthless if syncMailboxWindow never
 * calls it. Assert the gmail-sync path actually collects inbound emails and runs
 * the classifier + note builder, so deleting the hookup fails CI.
 */
describe('lib/crm/gmail.ts wires the email reply-intent pass into the sync', () => {
  const src = readFileSync(resolve('lib/crm/gmail.ts'), 'utf8')
  it('collects inbound emails and classifies them after the sync loop', () => {
    expect(src).toContain("import { classifyInboundReply } from '@/lib/crm/reply-intent'")
    expect(src).toContain("import { prospectOutreachContext } from '@/lib/crm/prospect-context'")
    expect(src).toContain("import { buildEmailIntentNote, emailIntentDedupeKey } from '@/lib/crm/email-intent-note'")
    // dir==='in' rows are collected for the pass
    expect(src).toMatch(/inboundForIntent\.push\(\{ personId, messageKey, body, subject \}\)/)
    // and the pass runs on the success path
    expect(src).toMatch(/await classifyInboundEmailReplies\(sb, inboundForIntent\)/)
    // only prospects get classified (mirrors the SMS scope)
    expect(src).toContain('prospectOutreachContext(sb, pid)')
    expect(src).toContain('buildEmailIntentNote(')
  })
})
