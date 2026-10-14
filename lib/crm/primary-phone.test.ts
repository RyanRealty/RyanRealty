import { describe, expect, it } from 'vitest'
import { primaryPhoneValue } from './primary-phone'

describe('primaryPhoneValue', () => {
  it('takes the phone marked primary, in either encoding', () => {
    expect(primaryPhoneValue([{ value: '5415550001' }, { value: '2125550002', isPrimary: true }])).toBe('2125550002')
    expect(primaryPhoneValue([{ value: '5415550001', isPrimary: 0 }, { value: '2125550002', isPrimary: 1 }])).toBe('2125550002')
  })

  it('falls back to the first listed, skipping empty and malformed entries', () => {
    expect(primaryPhoneValue([{ value: '' }, null, { nope: 1 }, { value: '5415550001' }, { value: '2125550002' }])).toBe('5415550001')
    expect(primaryPhoneValue([])).toBeNull()
    expect(primaryPhoneValue(null)).toBeNull()
    expect(primaryPhoneValue('5415550001')).toBeNull()
  })
})
