import { describe, expect, it } from 'vitest'
import { emailSendBlocked } from './email-send-ready'

describe('emailSendBlocked', () => {
  it('blocks an empty subject or an empty body', () => {
    expect(emailSendBlocked({ subject: '', body: '' })).toBe(true)
    expect(emailSendBlocked({ subject: 'Hi', body: '' })).toBe(true)
    expect(emailSendBlocked({ subject: '', body: 'Hello' })).toBe(true)
    expect(emailSendBlocked({ subject: '  ', body: '  ' })).toBe(true)
  })

  it('allows a send when both fields have text', () => {
    expect(emailSendBlocked({ subject: 'Hi', body: 'Hello' })).toBe(false)
  })

  it('blocks while a file is uploading or the host gated send', () => {
    expect(emailSendBlocked({ subject: 'Hi', body: 'Hello', uploading: true })).toBe(true)
    expect(emailSendBlocked({ subject: 'Hi', body: 'Hello', sendDisabled: true })).toBe(true)
  })
})
