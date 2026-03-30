import { describe, it, expect } from 'vitest'
import { generateICS, type ICSEvent } from './ics'

describe('generateICS', () => {
  const baseEvent: ICSEvent = {
    title: 'Open House',
    description: 'Come visit this beautiful home',
    location: '123 Main St, Bend, OR',
    startDate: '2025-06-15',
    endDate: '2025-06-15',
  }

  it('generates valid ICS for all-day event', () => {
    const ics = generateICS(baseEvent)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('DTSTART:20250615')
    expect(ics).toContain('DTEND:20250615')
    expect(ics).toContain('SUMMARY:Open House')
  })

  it('generates timed event with start and end times', () => {
    const timedEvent: ICSEvent = {
      ...baseEvent,
      startTime: '10:00',
      endTime: '14:00',
    }
    const ics = generateICS(timedEvent)
    expect(ics).toContain('DTSTART:20250615T100000')
    expect(ics).toContain('DTEND:20250615T140000')
  })

  it('includes URL when provided', () => {
    const eventWithUrl: ICSEvent = {
      ...baseEvent,
      url: 'https://ryan-realty.com/listing/123',
    }
    const ics = generateICS(eventWithUrl)
    expect(ics).toContain('URL:https://ryan-realty.com/listing/123')
  })

  it('omits URL when not provided', () => {
    const ics = generateICS(baseEvent)
    expect(ics).not.toContain('URL:')
  })

  it('includes VALARM reminder', () => {
    const ics = generateICS(baseEvent)
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-PT1H')
    expect(ics).toContain('END:VALARM')
  })

  it('includes PRODID and VERSION', () => {
    const ics = generateICS(baseEvent)
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('PRODID:-//Ryan Realty//Open House//EN')
  })

  it('escapes special characters in text fields', () => {
    const eventWithSpecialChars: ICSEvent = {
      ...baseEvent,
      title: 'Open House, Sunriver; Community',
      description: 'A great home; priced, well',
      location: '123 Main St, Suite 4; Bend',
    }
    const ics = generateICS(eventWithSpecialChars)
    expect(ics).toContain('SUMMARY:Open House\\, Sunriver\\; Community')
    expect(ics).toContain('DESCRIPTION:A great home\\; priced\\, well')
    expect(ics).toContain('LOCATION:123 Main St\\, Suite 4\\; Bend')
  })

  it('uses CRLF line endings', () => {
    const ics = generateICS(baseEvent)
    expect(ics).toContain('\r\n')
  })

  it('handles time with seconds', () => {
    const timedEvent: ICSEvent = {
      ...baseEvent,
      startTime: '10:30:45',
      endTime: '14:00:00',
    }
    const ics = generateICS(timedEvent)
    expect(ics).toContain('DTSTART:20250615T103045')
    expect(ics).toContain('DTEND:20250615T140000')
  })
})
