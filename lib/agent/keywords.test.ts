import { describe, it, expect } from 'vitest'
import { parseKeyword } from './keywords'

describe('parseKeyword', () => {
  it('matches bare keywords case-insensitively', () => {
    expect(parseKeyword('STATUS')).toEqual({ keyword: 'STATUS' })
    expect(parseKeyword('status')).toEqual({ keyword: 'STATUS' })
    expect(parseKeyword('Reset')).toEqual({ keyword: 'RESET' })
    expect(parseKeyword('help')).toEqual({ keyword: 'HELP' })
    expect(parseKeyword('Pause')).toEqual({ keyword: 'PAUSE' })
  })

  it('trims surrounding whitespace', () => {
    expect(parseKeyword('  STATUS  ')).toEqual({ keyword: 'STATUS' })
    expect(parseKeyword('\tHELP\n')).toEqual({ keyword: 'HELP' })
  })

  it('allows trailing punctuation', () => {
    expect(parseKeyword('STATUS.')).toEqual({ keyword: 'STATUS' })
    expect(parseKeyword('Reset!')).toEqual({ keyword: 'RESET' })
    expect(parseKeyword('help?')).toEqual({ keyword: 'HELP' })
  })

  it('matches bare APPROVE / HOLD with no handle', () => {
    expect(parseKeyword('APPROVE')).toEqual({ keyword: 'APPROVE' })
    expect(parseKeyword('approve')).toEqual({ keyword: 'APPROVE' })
    expect(parseKeyword('Hold')).toEqual({ keyword: 'HOLD' })
  })

  it('matches APPROVE / HOLD with a job handle', () => {
    expect(parseKeyword('APPROVE 2')).toEqual({ keyword: 'APPROVE', handle: 2 })
    expect(parseKeyword('approve 2')).toEqual({ keyword: 'APPROVE', handle: 2 })
    expect(parseKeyword('HOLD 3')).toEqual({ keyword: 'HOLD', handle: 3 })
  })

  it('allows trailing punctuation after a handle', () => {
    expect(parseKeyword('Approve 2!')).toEqual({ keyword: 'APPROVE', handle: 2 })
    expect(parseKeyword('hold 12.')).toEqual({ keyword: 'HOLD', handle: 12 })
  })

  it('returns null for a keyword embedded in a longer sentence', () => {
    expect(parseKeyword('please approve this one')).toBeNull()
    expect(parseKeyword('ok approve')).toBeNull()
    expect(parseKeyword('can you give me a status update')).toBeNull()
  })

  it('returns null when a keyword and number are jammed together with no space', () => {
    expect(parseKeyword('APPROVE2')).toBeNull()
    expect(parseKeyword('HOLD12')).toBeNull()
  })

  it('returns null for STATUS/RESET/HELP/PAUSE followed by a number (they never carry a handle)', () => {
    expect(parseKeyword('status 2')).toBeNull()
    expect(parseKeyword('reset 1')).toBeNull()
    expect(parseKeyword('pause 3')).toBeNull()
  })

  it('returns null for empty or non-keyword text', () => {
    expect(parseKeyword('')).toBeNull()
    expect(parseKeyword('   ')).toBeNull()
    expect(parseKeyword('ok thanks')).toBeNull()
    expect(parseKeyword('what is redmond inventory like')).toBeNull()
  })

  it('rejects a handle number outside the 1-4 digit window', () => {
    expect(parseKeyword('APPROVE 123456')).toBeNull()
  })
})
