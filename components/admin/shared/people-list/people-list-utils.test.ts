import { describe, it, expect } from 'vitest'
import {
  ordinal, fmtFubDate, fmtSidebarCount, fmtPhoneDotted,
  PEOPLE_COLUMNS, DEFAULT_PEOPLE_COLUMNS, columnStorageKey, parseStoredColumns,
  activityIconKind,
} from './people-list-utils'

describe('ordinal', () => {
  it('handles 1st/2nd/3rd/4th', () => {
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(2)).toBe('2nd')
    expect(ordinal(3)).toBe('3rd')
    expect(ordinal(4)).toBe('4th')
  })
  it('handles the 11th–13th exception', () => {
    expect(ordinal(11)).toBe('11th')
    expect(ordinal(12)).toBe('12th')
    expect(ordinal(13)).toBe('13th')
    expect(ordinal(21)).toBe('21st')
    expect(ordinal(23)).toBe('23rd')
  })
})

describe('fmtFubDate (§6 FUB date convention)', () => {
  const now = new Date('2026-07-01T12:00:00Z')
  it("formats older dates as `Nov 13th '25`", () => {
    expect(fmtFubDate('2025-11-13T10:00:00Z', now)).toBe("Nov 13th '25")
  })
  it('formats recent dates relative', () => {
    expect(fmtFubDate('2026-06-25T12:00:00Z', now)).toBe('6 days ago')
    expect(fmtFubDate('2026-06-30T11:00:00Z', now)).toBe('1 day ago')
    expect(fmtFubDate('2026-07-01T08:00:00Z', now)).toBe('today')
  })
  it('handles null/invalid', () => {
    expect(fmtFubDate(null, now)).toBe('')
    expect(fmtFubDate('garbage', now)).toBe('')
  })
})

describe('fmtSidebarCount (§3.2 badge rules)', () => {
  it('abbreviates ≥ 1000 as NK', () => {
    expect(fmtSidebarCount(17123)).toBe('17K')
    expect(fmtSidebarCount(1000)).toBe('1K')
    expect(fmtSidebarCount(3049)).toBe('3K')
    expect(fmtSidebarCount(7499)).toBe('7K')
  })
  it('renders 1–999 as the integer', () => {
    expect(fmtSidebarCount(696)).toBe('696')
    expect(fmtSidebarCount(1)).toBe('1')
  })
  it('renders no badge at 0 / null', () => {
    expect(fmtSidebarCount(0)).toBeNull()
    expect(fmtSidebarCount(null)).toBeNull()
  })
})

describe('fmtPhoneDotted', () => {
  it('formats a 10-digit number dotted', () => {
    expect(fmtPhoneDotted('+15412136706')).toBe('541.213.6706')
  })
  it('passes through non-10-digit input', () => {
    expect(fmtPhoneDotted('123')).toBe('123')
  })
})

describe('column catalog (§8)', () => {
  it('default set is the §6 seven post-Name columns', () => {
    expect(DEFAULT_PEOPLE_COLUMNS).toEqual([
      'leadScore', 'agent', 'lastVisit', 'phone', 'email', 'lastActivity', 'tags',
    ])
  })
  it('every default key exists in the catalog', () => {
    const keys = new Set(PEOPLE_COLUMNS.map((c) => c.key))
    for (const k of DEFAULT_PEOPLE_COLUMNS) expect(keys.has(k)).toBe(true)
  })
  it('storage key is per-list', () => {
    expect(columnStorageKey(null)).toBe('crm.people.columns.all')
    expect(columnStorageKey(42)).toBe('crm.people.columns.42')
  })
  it('parseStoredColumns filters unknown keys and rejects junk', () => {
    expect(parseStoredColumns('["agent","nope","tags"]')).toEqual(['agent', 'tags'])
    expect(parseStoredColumns('{"x":1}')).toBeNull()
    expect(parseStoredColumns('not json')).toBeNull()
    expect(parseStoredColumns(null)).toBeNull()
  })
})

describe('activityIconKind (§13 icon mapping)', () => {
  it('maps website views to the flame/view icon', () => {
    expect(activityIconKind('property_view')).toBe('view')
  })
  it('maps inquiries to the house icon', () => {
    expect(activityIconKind('inquiry')).toBe('inquiry')
  })
  it('maps inbound comms + calls + lead_created', () => {
    expect(activityIconKind('sms_in')).toBe('message')
    expect(activityIconKind('call')).toBe('call')
    expect(activityIconKind('lead_created')).toBe('lead')
    expect(activityIconKind('stage_change')).toBe('other')
  })
})
