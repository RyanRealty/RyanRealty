import { afterEach, describe, expect, it } from 'vitest'
import { activeBrokerSlugs, brokerByEmail, brokerByFileName, brokerDisplayName, isActiveBrokerSlug, setBrokerDirectory } from './directory'
import { dealVisibleToBroker, fileNameFromBrokerSlug, brokerEmailFromFileName } from '@/lib/tc/deal-scope'

afterEach(() => setBrokerDirectory(null))

const TABLE = [
  { slug: 'matt', fileName: 'Matt Ryan', email: 'matt@ryan-realty.com', active: true },
  { slug: 'rebecca', fileName: 'Rebecca Ryser Peterson', email: 'rebeccapeterson@ryan-realty.com', active: true },
  { slug: 'paul', fileName: 'Paul Stevenson', email: 'paul@ryan-realty.com', active: true },
  { slug: 'jane', fileName: 'Jane Doe', email: 'jane.doe@ryan-realty.com', active: true },
]

describe('broker directory', () => {
  it('answers for the three founders before anything is loaded', () => {
    expect(activeBrokerSlugs()).toEqual(['matt', 'rebecca', 'paul'])
    expect(isActiveBrokerSlug('jane')).toBe(false)
    expect(dealVisibleToBroker({ role: 'broker', brokerSlug: 'jane', dealBrokerName: 'Jane Doe' })).toBe(false)
  })

  it('knows a broker added from Google once the table is loaded', () => {
    setBrokerDirectory(TABLE)
    expect(isActiveBrokerSlug('jane')).toBe(true)
    expect(brokerByEmail('Jane.Doe@ryan-realty.com')?.slug).toBe('jane')
    expect(fileNameFromBrokerSlug('jane')).toBe('Jane Doe')
    expect(brokerEmailFromFileName('Jane Doe')).toBe('jane.doe@ryan-realty.com')
    expect(dealVisibleToBroker({ role: 'broker', brokerSlug: 'jane', dealBrokerName: 'Jane Doe' })).toBe(true)
    expect(dealVisibleToBroker({ role: 'broker', brokerSlug: 'jane', dealBrokerName: 'Matt Ryan' })).toBe(false)
    expect(activeBrokerSlugs()).toEqual(['matt', 'rebecca', 'paul', 'jane'])
    expect(brokerDisplayName('jane')).toBe('Jane Doe')
  })

  it("keeps the founders' file names, so Rebecca still sees her files", () => {
    setBrokerDirectory(TABLE)
    expect(fileNameFromBrokerSlug('rebecca')).toBe('Rebecca Peterson')
    expect(brokerByFileName('Rebecca Peterson')?.slug).toBe('rebecca')
    expect(dealVisibleToBroker({ role: 'broker', brokerSlug: 'rebecca', dealBrokerName: 'Rebecca Peterson' })).toBe(true)
  })

  it('shuts out a broker who left: no files, no mailbox, not assignable', () => {
    setBrokerDirectory(TABLE.map((b) => (b.slug === 'paul' ? { ...b, active: false } : b)))
    expect(isActiveBrokerSlug('paul')).toBe(false)
    expect(fileNameFromBrokerSlug('paul')).toBeNull()
    expect(dealVisibleToBroker({ role: 'broker', brokerSlug: 'paul', dealBrokerName: 'Paul Stevenson' })).toBe(false)
    expect(activeBrokerSlugs()).not.toContain('paul')
  })
})
