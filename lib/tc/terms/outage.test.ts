import { describe, expect, it } from 'vitest'
import { isReaderOutage } from './outage'

describe('a reader outage', () => {
  it('is the account or the service, never the document', () => {
    for (const e of [
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
      '401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}',
      '429 {"type":"error","error":{"type":"rate_limit_error"}}',
      '529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
      'fetch failed',
      'grok: 503 Service Unavailable',
    ]) expect(isReaderOutage(e)).toBe(true)
  })

  it('is not a reading that went wrong on this document', () => {
    for (const e of ['no tool call in the reply', '400 {"type":"error","error":{"type":"invalid_request_error","message":"The PDF specified was not valid."}}', 'a reader returned nothing', null, undefined, ''])
      expect(isReaderOutage(e)).toBe(false)
  })
})
