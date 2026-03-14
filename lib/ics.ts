/**
 * Generate .ics (iCalendar) file content for open house and other events.
 * Step 17: ICS calendar file generator.
 */

export type ICSEvent = {
  title: string
  description: string
  location: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD or same as start for all-day
  startTime?: string // HH:MM or HH:MM:SS
  endTime?: string
  url?: string
}

/** Format date for ICS DTSTART/DTEND (YYYYMMDD). */
function icsDate(d: string): string {
  return d.replace(/-/g, '')
}

/** Format time for ICS (HHMMSS). */
function icsTime(t: string): string {
  const parts = t.trim().split(/[:.]/)
  const h = (parseInt(parts[0] ?? '0', 10) % 24).toString().padStart(2, '0')
  const m = (parseInt(parts[1] ?? '0', 10) % 60).toString().padStart(2, '0')
  const s = (parseInt(parts[2] ?? '0', 10) % 60).toString().padStart(2, '0')
  return `${h}${m}${s}`
}

/** Escape text for ICS (commas, semicolons, backslashes). */
function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

/**
 * Returns a valid .ics file string with optional 1-hour-before VALARM.
 */
export function generateICS(event: ICSEvent): string {
  const startDate = icsDate(event.startDate)
  const endDate = icsDate(event.endDate)
  const hasTime = Boolean(event.startTime && event.endTime)
  const dtStart = hasTime
    ? `${startDate}T${icsTime(event.startTime!)}`
    : startDate
  const dtEnd = hasTime
    ? `${endDate}T${icsTime(event.endTime!)}`
    : endDate
  const title = escapeIcsText(event.title)
  const description = escapeIcsText(event.description)
  const location = escapeIcsText(event.location)
  const url = event.url ? escapeIcsText(event.url) : ''

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ryan Realty//Open House//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
  ]
  if (url) {
    lines.push(`URL:${url}`)
  }
  // 1-hour-before reminder
  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Open House Reminder',
    'TRIGGER:-PT1H',
    'END:VALARM'
  )
  lines.push('END:VEVENT', 'END:VCALENDAR')

  return lines.join('\r\n')
}
