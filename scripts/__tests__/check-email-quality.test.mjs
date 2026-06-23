import { describe, it, expect } from 'vitest'
import { sendsAutomatedEmail, flagsMissingPreflight } from '../check-email-quality.mjs'

describe('check-email-quality pure helpers (9.E.4)', () => {
  it('detects an automated-email send', () => {
    expect(sendsAutomatedEmail('await sendEmail({ to, subject })')).toBe(true)
    expect(sendsAutomatedEmail('await sendBatchEmails(batch)')).toBe(true)
    expect(sendsAutomatedEmail('void sendCrmEmail({ fromMailbox })')).toBe(true)
  })

  it('ignores source that does not send (must be a call, not a bare mention)', () => {
    expect(sendsAutomatedEmail('const x = renderEmail()')).toBe(false)
    expect(sendsAutomatedEmail('the word sendEmail without a call')).toBe(false)
    expect(sendsAutomatedEmail('import { sendEmail } from "@/lib/resend"')).toBe(false)
  })

  it('flags a sender that skips the preflight', () => {
    expect(flagsMissingPreflight('await sendEmail({ to, subject, html })')).toBe(true)
  })

  it('passes a sender that routes through prepareDeliverableEmail', () => {
    const src = `
      const prepared = prepareDeliverableEmail({ subject, html, personId })
      await sendEmail({ to, subject: prepared.subject, html: prepared.html, text: prepared.text, headers: prepared.headers })
    `
    expect(flagsMissingPreflight(src)).toBe(false)
  })
})
