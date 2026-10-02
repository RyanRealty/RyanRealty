import { describe, expect, it } from 'vitest'
import { HUMAN_TOUCH_KINDS, isHumanTouch } from './response-clock'
import { gmailTimelineKind, sentByUs } from './gmail-timeline-kind'

describe('sentByUs', () => {
  it('is our mail when the mailbox holds it as SENT or its From is ours', () => {
    expect(sentByUs({ labelIds: ['SENT'], from: ['matt@some-alias.com'] })).toBe(true)
    expect(sentByUs({ labelIds: ['INBOX'], from: ['paul@ryan-realty.com'] })).toBe(true)
    expect(sentByUs({ labelIds: ['INBOX'], from: ['matt.lists.homes@gmail.com'] })).toBe(true)
  })

  it('is not ours when someone else sent it', () => {
    expect(sentByUs({ labelIds: ['INBOX', 'UNREAD'], from: ['officer@westerntitle.com'] })).toBe(false)
    expect(sentByUs({ labelIds: null, from: [] })).toBe(false)
  })
})

describe('gmailTimelineKind', () => {
  it('is email_in when the person sent it, whoever else is on it', () => {
    expect(gmailTimelineKind({ personIsSender: true, sentByUs: false })).toBe('email_in')
  })

  it('is email_out only when one of our brokers sent it', () => {
    expect(gmailTimelineKind({ personIsSender: false, sentByUs: true })).toBe('email_out')
  })

  it('is email_cc when someone else sent it and the person was copied', () => {
    expect(gmailTimelineKind({ personIsSender: false, sentByUs: false })).toBe('email_cc')
  })

  it('never counts a copied-on email as a broker touching the lead', () => {
    expect((HUMAN_TOUCH_KINDS as readonly string[]).includes('email_cc')).toBe(false)
    expect(isHumanTouch({ kind: 'email_cc', source: 'gmail', broker: 'matt', payload: {} })).toBe(false)
    expect(isHumanTouch({ kind: 'email_out', source: 'gmail', broker: 'matt', payload: {} })).toBe(true)
  })
})
