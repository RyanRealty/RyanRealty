import { describe, expect, it } from 'vitest'
import {
  APPLY_WINDOW_MS,
  parseSuggestedReply,
  replyStillApplies,
  stripSuggestedReplyParams,
} from './composer-preload'

describe('parseSuggestedReply', () => {
  it('returns null when no reply param is present', () => {
    expect(parseSuggestedReply('')).toBeNull()
    expect(parseSuggestedReply('?c=12&m=sms')).toBeNull()
    expect(parseSuggestedReply('?reply=')).toBeNull()
    expect(parseSuggestedReply('?reply=%20%20')).toBeNull()
  })

  it('defaults to the sms channel with no subject', () => {
    const r = parseSuggestedReply('?reply=Thanks%20for%20reaching%20out')
    expect(r).toEqual({ channel: 'sms', body: 'Thanks for reaching out', subject: null })
  })

  it('reads the email channel and subject when carried', () => {
    const r = parseSuggestedReply(
      '?reply=Happy%20to%20help&replyChannel=email&replySubject=Re%3A%20Tumalo%20listing',
    )
    expect(r).toEqual({ channel: 'email', body: 'Happy to help', subject: 'Re: Tumalo listing' })
  })

  it('treats an unknown replyChannel as sms', () => {
    expect(parseSuggestedReply('?reply=hi&replyChannel=carrier-pigeon')?.channel).toBe('sms')
  })

  it('caps body and subject lengths', () => {
    const long = 'a'.repeat(5000)
    const r = parseSuggestedReply(`?reply=${long}&replySubject=${long}&replyChannel=email`)
    expect(r?.body.length).toBe(2000)
    expect(r?.subject?.length).toBe(300)
  })
})

describe('stripSuggestedReplyParams', () => {
  it('removes only the reply params and keeps the rest', () => {
    const out = stripSuggestedReplyParams('?c=12&reply=hi&replyChannel=email&replySubject=yo&m=email')
    const params = new URLSearchParams(out)
    expect(params.get('c')).toBe('12')
    expect(params.get('m')).toBe('email')
    expect(params.get('reply')).toBeNull()
    expect(params.get('replyChannel')).toBeNull()
    expect(params.get('replySubject')).toBeNull()
  })

  it('returns an empty string when nothing else remains', () => {
    expect(stripSuggestedReplyParams('?reply=hi')).toBe('')
  })
})

describe('replyStillApplies', () => {
  it('is true inside the window and false after it', () => {
    expect(replyStillApplies(1000, 1000)).toBe(true)
    expect(replyStillApplies(1000, 1000 + APPLY_WINDOW_MS)).toBe(true)
    expect(replyStillApplies(1000, 1000 + APPLY_WINDOW_MS + 1)).toBe(false)
  })
})
