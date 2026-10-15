import { describe, expect, it } from 'vitest'
import { brokerSendIdentity, SEND_DOMAIN, shellBrokerFor } from './broker-identity'

describe('brokerSendIdentity', () => {
  it('resolves the short CRM keys to a named from on the verified domain + a real reply-to', () => {
    expect(SEND_DOMAIN).toBe('ryan-realty.com')
    expect(brokerSendIdentity('matt')).toEqual({
      from: '"Matt Ryan · Ryan Realty" <matt@ryan-realty.com>',
      replyTo: 'matt@ryan-realty.com',
    })
    expect(brokerSendIdentity('paul')).toEqual({
      from: '"Paul Stevenson · Ryan Realty" <paul@ryan-realty.com>',
      replyTo: 'paul@ryan-realty.com',
    })
    expect(brokerSendIdentity('rebecca')).toEqual({
      from: '"Rebecca Peterson · Ryan Realty" <rebeccapeterson@ryan-realty.com>',
      replyTo: 'rebeccapeterson@ryan-realty.com',
    })
  })

  it('resolves a broker mailbox address (the CMA fallback only holds the email)', () => {
    expect(brokerSendIdentity('paul@ryan-realty.com')).toEqual({
      from: '"Paul Stevenson · Ryan Realty" <paul@ryan-realty.com>',
      replyTo: 'paul@ryan-realty.com',
    })
    expect(brokerSendIdentity('REBECCAPETERSON@ryan-realty.com').replyTo).toBe('rebeccapeterson@ryan-realty.com')
  })

  it('resolves the full roster slugs too', () => {
    expect(brokerSendIdentity('matthew-ryan').replyTo).toBe('matt@ryan-realty.com')
    expect(brokerSendIdentity('paul-stevenson').replyTo).toBe('paul@ryan-realty.com')
    expect(brokerSendIdentity('rebecca-peterson').replyTo).toBe('rebeccapeterson@ryan-realty.com')
  })

  it('falls back to Matt for unknown, empty, or null input (same default as the send engines)', () => {
    for (const input of [null, undefined, '', '  ', 'not-a-broker']) {
      expect(brokerSendIdentity(input).replyTo).toBe('matt@ryan-realty.com')
    }
  })

  it('the close card uses the published line for a web slug and a short slug', () => {
    const paul = shellBrokerFor('paul-stevenson')
    expect(paul.name).toBe('Paul Stevenson')
    expect(paul.email).toBe('paul@ryan-realty.com')
    expect(paul.phone).toBe('541.502.3436')
    expect(paul.isOwner).toBe(false)
    expect(shellBrokerFor('rebecca').phone).toBe('541.250.3380')
    expect(shellBrokerFor('matthew-ryan').phone).toBe('541.703.3095')
    expect(shellBrokerFor('matthew-ryan').isOwner).toBe(true)
  })

  it('never emits a noreply identity and always stays on the verified send domain', () => {
    for (const key of ['matt', 'paul', 'rebecca', 'bogus']) {
      const id = brokerSendIdentity(key)
      expect(id.from).not.toContain('noreply')
      expect(id.from).not.toContain('mail.ryan-realty.com')
      expect(id.from).toMatch(/<[a-z]+@ryan-realty\.com>$/)
      expect(id.from).toMatch(/^"[^"]+ · Ryan Realty" /)
    }
  })
})
