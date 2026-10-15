import { describe, expect, it } from 'vitest'
import {
  filterMessageThreads,
  isAutomationOrUnnamedAlert,
  threadMatchesQuery,
} from './messages-thread-filter'

describe('messages thread filter', () => {
  it('hides unnamed listing-alert automation', () => {
    expect(
      isAutomationOrUnnamedAlert({
        name: 'Unknown contact',
        lastKindLabel: 'Email sent',
        snippet: 'New listing alert for Bend homes',
      }),
    ).toBe(true)
    expect(
      isAutomationOrUnnamedAlert({
        name: 'Elize',
        lastKindLabel: 'Text received',
        snippet: 'Can you call me',
      }),
    ).toBe(false)
  })

  it('matches thread search on name or snippet', () => {
    const row = { name: 'Elize Hart', lastKindLabel: 'Text received', snippet: 'Looking at Tetherow' }
    expect(threadMatchesQuery(row, 'tetherow')).toBe(true)
    expect(threadMatchesQuery(row, 'elize')).toBe(true)
    expect(threadMatchesQuery(row, 'pronghorn')).toBe(false)
  })

  it('groups automation off the default list until showAutomation', () => {
    const rows = [
      { name: 'Unknown contact', lastKindLabel: 'Email sent', snippet: 'listing alert' },
      { name: 'Sam', lastKindLabel: 'Text received', snippet: 'Hi' },
    ]
    expect(filterMessageThreads(rows)).toHaveLength(1)
    expect(filterMessageThreads(rows, { showAutomation: true })).toHaveLength(2)
    expect(filterMessageThreads(rows, { q: 'sam' })[0]?.name).toBe('Sam')
  })
})
