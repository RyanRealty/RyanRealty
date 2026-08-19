import { describe, expect, it } from 'vitest'
import { parsePositiveInt, parsePositiveNumber, resolveCmaClientName } from './client-link'

describe('resolveCmaClientName', () => {
  it('keeps a linked person when rebuild clears the text field', () => {
    expect(
      resolveCmaClientName({
        enteredName: '',
        storedName: null,
        linkedPersonName: 'Odessa',
      }),
    ).toBe('Odessa')
  })

  it('prefers the broker-entered name, then stored, then the person', () => {
    expect(
      resolveCmaClientName({
        enteredName: 'Odessa O.',
        storedName: 'Old',
        linkedPersonName: 'Odessa',
      }),
    ).toBe('Odessa O.')
    expect(
      resolveCmaClientName({
        enteredName: null,
        storedName: 'On file',
        linkedPersonName: 'Odessa',
      }),
    ).toBe('On file')
    expect(resolveCmaClientName({ enteredName: '  ', storedName: '  ', linkedPersonName: null })).toBeNull()
  })
})

describe('parsePositiveInt', () => {
  it('reads beds/sqft and rejects junk', () => {
    expect(parsePositiveInt('3')).toBe(3)
    expect(parsePositiveInt('1,056')).toBe(1056)
    expect(parsePositiveInt('0')).toBeNull()
    expect(parsePositiveInt('')).toBeNull()
    expect(parsePositiveNumber('1.5')).toBe(1.5)
    expect(parsePositiveNumber('baths')).toBeNull()
  })
})
