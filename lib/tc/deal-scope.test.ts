import { describe, expect, it } from 'vitest'
import { brokerEmailFromFileName, dealVisibleToBroker } from './deal-scope'

describe('dealVisibleToBroker', () => {
  it('lets the principal see every file', () => {
    expect(
      dealVisibleToBroker({ role: 'superuser', brokerSlug: 'matt', dealBrokerName: 'Paul Stevenson' }),
    ).toBe(true)
  })
  it('scopes Paul to Paul Stevenson files only', () => {
    expect(
      dealVisibleToBroker({ role: 'broker', brokerSlug: 'paul', dealBrokerName: 'Paul Stevenson' }),
    ).toBe(true)
    expect(
      dealVisibleToBroker({ role: 'broker', brokerSlug: 'paul', dealBrokerName: 'Matt Ryan' }),
    ).toBe(false)
  })
  it('fail-closes an unmapped broker', () => {
    expect(dealVisibleToBroker({ role: 'broker', brokerSlug: null, dealBrokerName: 'Matt Ryan' })).toBe(false)
  })
  it('maps file broker names to mailboxes', () => {
    expect(brokerEmailFromFileName('Paul Stevenson')).toBe('paul@ryan-realty.com')
    expect(brokerEmailFromFileName('nope')).toBeNull()
  })
})
