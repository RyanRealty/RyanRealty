import { describe, expect, it } from 'vitest'
import { mergeCmaClientFields } from './crm-attach-fields'

const person = {
  name: 'zztest KickoffProbe',
  primaryEmail: 'probe@example.com',
  primaryPhone: '+15005550006',
}

describe('mergeCmaClientFields', () => {
  it('kickoff attach keeps an existing client name', () => {
    const merged = mergeCmaClientFields({
      replace: false,
      row: { client_name: 'Original Client', client_email: 'orig@example.com', client_phone: '+15415550100' },
      person,
    })
    expect(merged.clientName).toBe('Original Client')
    expect(merged.clientEmail).toBe('orig@example.com')
    expect(merged.clientPhone).toBe('+15415550100')
  })

  it('kickoff attach fills blanks from the person', () => {
    const merged = mergeCmaClientFields({
      replace: false,
      row: { client_name: null, client_email: null, client_phone: null },
      person,
    })
    expect(merged.clientName).toBe('zztest KickoffProbe')
    expect(merged.clientEmail).toBe('probe@example.com')
    expect(merged.clientPhone).toBe('+15005550006')
  })

  it('review picker replace copies the chosen person over existing client fields', () => {
    const merged = mergeCmaClientFields({
      replace: true,
      row: { client_name: 'Original Client', client_email: 'orig@example.com', client_phone: '+15415550100' },
      person,
    })
    expect(merged.clientName).toBe('zztest KickoffProbe')
    expect(merged.clientEmail).toBe('probe@example.com')
    expect(merged.clientPhone).toBe('+15005550006')
  })
})
