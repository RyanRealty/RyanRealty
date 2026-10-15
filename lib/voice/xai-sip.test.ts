import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyXaiWebhook } from './xai-sip'

const raw = Buffer.from('test-secret-bytes').toString('base64')
const secret = `whsec_${raw}`
const sign = (id: string, ts: string, body: string) =>
  'v1,' + createHmac('sha256', Buffer.from(raw, 'base64')).update(`${id}.${ts}.${body}`).digest('base64')

describe('verifyXaiWebhook', () => {
  const now = 1_800_000_000
  const ts = String(now)
  it('accepts a valid signature', () => {
    expect(verifyXaiWebhook(secret, { id: 'evt_1', timestamp: ts, signature: sign('evt_1', ts, '{}') }, '{}', now)).toBe(true)
  })
  it('rejects a tampered body', () => {
    expect(verifyXaiWebhook(secret, { id: 'evt_1', timestamp: ts, signature: sign('evt_1', ts, '{}') }, '{"x":1}', now)).toBe(false)
  })
  it('rejects stale timestamps and missing secret', () => {
    expect(verifyXaiWebhook(secret, { id: 'evt_1', timestamp: ts, signature: sign('evt_1', ts, '{}') }, '{}', now + 1000)).toBe(false)
    expect(verifyXaiWebhook('', { id: 'evt_1', timestamp: ts, signature: sign('evt_1', ts, '{}') }, '{}', now)).toBe(false)
  })
})
