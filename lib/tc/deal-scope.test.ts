import { describe, expect, it } from 'vitest'
import {
  brokerEmailFromFileName,
  dealVisibleToBroker,
  fileDeadlineMatchesScope,
  fileNameFromBrokerSlug,
} from './deal-scope'

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
  it('stores the SkySlope-style file name, never the CRM slug', () => {
    expect(fileNameFromBrokerSlug('paul')).toBe('Paul Stevenson')
    expect(fileNameFromBrokerSlug('matt')).toBe('Matt Ryan')
    expect(fileNameFromBrokerSlug('nope')).toBeNull()
  })
})

describe('fileDeadlineMatchesScope', () => {
  it('shows every file clock when the principal has no agent filter', () => {
    expect(
      fileDeadlineMatchesScope({
        dealBrokerName: 'Paul Stevenson',
        assigneeEmail: 'paul@ryan-realty.com',
        brokerScope: null,
      }),
    ).toBe(true)
  })
  it('keeps Paul on Paul files and off Matt files', () => {
    expect(
      fileDeadlineMatchesScope({
        dealBrokerName: 'Paul Stevenson',
        assigneeEmail: null,
        brokerScope: 'paul',
      }),
    ).toBe(true)
    expect(
      fileDeadlineMatchesScope({
        dealBrokerName: 'Matt Ryan',
        assigneeEmail: 'matt@ryan-realty.com',
        brokerScope: 'paul',
      }),
    ).toBe(false)
  })
})
