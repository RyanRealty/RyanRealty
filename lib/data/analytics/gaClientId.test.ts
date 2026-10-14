import { describe, expect, it } from 'vitest'
import { GA_CLIENT_ID_CUSTOM_KEY, gaClientIdFromCustom, parseGaClientId } from './gaClientId'

describe('parseGaClientId — only a real _ga cookie is usable', () => {
  it('accepts the digits.digits shape the web SDK stores', () => {
    expect(parseGaClientId('1234567890.1700000000')).toBe('1234567890.1700000000')
    expect(parseGaClientId('  1.2  ')).toBe('1.2')
  })

  it('rejects a uuid fireGa4Event would mint when the cookie is missing', () => {
    expect(parseGaClientId('6b1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f')).toBeNull()
    expect(parseGaClientId('')).toBeNull()
    expect(parseGaClientId(null)).toBeNull()
    expect(parseGaClientId(undefined)).toBeNull()
    expect(parseGaClientId('GA1.1.123.456')).toBeNull()
  })
})

describe('gaClientIdFromCustom — how lead attribution stores it', () => {
  it('reads gaClientId, the key fireLeadGenerated persists', () => {
    expect(gaClientIdFromCustom({ [GA_CLIENT_ID_CUSTOM_KEY]: '123.456' })).toBe('123.456')
  })

  it('accepts the older snake aliases if a bag already has them', () => {
    expect(gaClientIdFromCustom({ ga_client_id: '9.8' })).toBe('9.8')
    expect(gaClientIdFromCustom({ client_id: '7.6' })).toBe('7.6')
  })

  it('returns null when the contact has no usable id', () => {
    expect(gaClientIdFromCustom({})).toBeNull()
    expect(gaClientIdFromCustom({ [GA_CLIENT_ID_CUSTOM_KEY]: 'not-a-ga-id' })).toBeNull()
    expect(gaClientIdFromCustom(null)).toBeNull()
  })
})
