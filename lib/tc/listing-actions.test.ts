import { describe, expect, it } from 'vitest'
import { duplicatePropertyKey, nextDuplicatePropertyKey, todayIsoDate } from './listing-actions'

describe('duplicatePropertyKey', () => {
  it('appends -copy once', () => {
    expect(duplicatePropertyKey('5663-impala')).toBe('5663-impala-copy')
    expect(duplicatePropertyKey('5663-impala-copy')).toBe('5663-impala-copy')
    expect(duplicatePropertyKey('5663-impala-copy-2')).toBe('5663-impala-copy')
  })
})

describe('nextDuplicatePropertyKey', () => {
  it('increments when -copy is taken', () => {
    expect(nextDuplicatePropertyKey(['5663-impala'], '5663-impala')).toBe('5663-impala-copy')
    expect(nextDuplicatePropertyKey(['5663-impala', '5663-impala-copy'], '5663-impala')).toBe(
      '5663-impala-copy-2',
    )
  })
})

describe('todayIsoDate', () => {
  it('is YYYY-MM-DD', () => {
    expect(todayIsoDate(new Date('2026-08-23T18:00:00Z'))).toBe('2026-08-23')
  })
})
