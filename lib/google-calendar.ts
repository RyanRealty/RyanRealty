/**
 * Google Calendar helpers using service account + domain-wide delegation.
 * The service account impersonates each broker's Google Workspace email,
 * so no per-broker OAuth consent flow is needed.
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *
 * DWD must be configured in Google Admin Console for the service account
 * Read: calendar.readonly (granted on the Workspace DWD).
 * Write: calendar (not yet on DWD as of 2026-08-23 — upsert fails open).
 */

import { google } from 'googleapis'

const READ_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const WRITE_SCOPE = 'https://www.googleapis.com/auth/calendar'

export type GcalEvent = {
  id: string
  title: string
  start: string
  end: string | null
  allDay: boolean
  htmlLink: string | null
}

function getServiceAccountAuth(impersonateEmail: string, write = false) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Google service account credentials not configured')

  return new google.auth.JWT({
    email,
    key,
    scopes: [write ? WRITE_SCOPE : READ_SCOPE],
    subject: impersonateEmail,
  })
}

export async function getGcalEvents(
  brokerEmail: string,
  daysAhead = 14,
): Promise<{ connected: boolean; events: GcalEvent[] }> {
  if (!brokerEmail) return { connected: false, events: [] }

  try {
    const auth = getServiceAccountAuth(brokerEmail)
    const calendar = google.calendar({ version: 'v3', auth })

    const timeMin = new Date().toISOString()
    const timeMax = new Date(Date.now() + daysAhead * 86_400_000).toISOString()

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    })

    const items = res.data.items ?? []
    const events: GcalEvent[] = items.map((item) => {
      const allDay = !!(item.start?.date && !item.start?.dateTime)
      return {
        id: item.id ?? '',
        title: item.summary ?? 'Untitled',
        start: allDay ? (item.start?.date ?? '') : (item.start?.dateTime ?? ''),
        end: allDay ? (item.end?.date ?? null) : (item.end?.dateTime ?? null),
        allDay,
        htmlLink: item.htmlLink ?? null,
      }
    })

    return { connected: true, events }
  } catch (err) {
    // If DWD isn't set up yet or broker isn't on the domain, return gracefully
    console.error(`GCal DWD error for ${brokerEmail}:`, err instanceof Error ? err.message : err)
    return { connected: false, events: [] }
  }
}

/**
 * Busy intervals from a broker's Google Calendar, for PUBLIC availability.
 *
 * Deliberately NOT getGcalEvents. That one swallows every failure into
 * `{ connected: false, events: [] }`, which is fine for a dashboard widget that
 * just hides a panel — but catastrophic here: a transient API error would read
 * as "this broker has nothing on" and publish their whole week as bookable.
 * So this variant separates the two states the caller must treat differently:
 *
 *   - credentials absent      -> { configured: false }. Deterministic, not a
 *                                failure. The caller falls back to CRM-only.
 *   - the API call fails      -> THROWS. The caller must fail closed.
 *
 * ALL-DAY EVENTS ARE SKIPPED, same as on the CRM side. The CRM writes its
 * transaction milestones INTO this calendar as all-day events
 * (upsertAllDayGcalEvent — "Contract accepted · …"), so counting them would
 * re-import through the Google door the exact bug that showed 4 bookable days
 * out of 15. Consequence worth knowing: an all-day "Vacation" block does NOT
 * hold time. Use a timed event to block a day.
 */
export async function getGcalBusyIntervals(
  brokerEmail: string,
  fromIso: string,
  toIso: string,
): Promise<{ configured: boolean; intervals: Array<{ startMs: number; endMs: number }> }> {
  if (!brokerEmail) return { configured: false, intervals: [] }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return { configured: false, intervals: [] }
  }

  const auth = getServiceAccountAuth(brokerEmail)
  const calendar = google.calendar({ version: 'v3', auth })

  // No try/catch: a throw here is the point. bookingAvailability turns it into
  // a closed calendar rather than an open one.
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: fromIso,
    timeMax: toIso,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  })

  const intervals: Array<{ startMs: number; endMs: number }> = []
  for (const item of res.data.items ?? []) {
    // A cancelled event is not busy time.
    if (item.status === 'cancelled') continue
    // The broker declining an invite means they are NOT in that meeting.
    const declined = (item.attendees ?? []).some(
      (a) => a.self && a.responseStatus === 'declined',
    )
    if (declined) continue
    // transparency:'transparent' is Google's own "show me as free".
    if (item.transparency === 'transparent') continue

    const startIso = item.start?.dateTime
    const endIso = item.end?.dateTime
    if (!startIso || !endIso) continue // all-day (date, not dateTime) — see above

    const startMs = Date.parse(startIso)
    const endMs = Date.parse(endIso)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    intervals.push({ startMs, endMs })
  }
  return { configured: true, intervals }
}

/**
 * Idempotent all-day event. Private extended property vaultKey is the stable id.
 * Returns the Google event id, or null when DWD write is not granted.
 */
export async function upsertAllDayGcalEvent(input: {
  brokerEmail: string
  vaultKey: string
  title: string
  date: string
  description?: string
  existingEventId?: string | null
}): Promise<string | null> {
  if (!input.brokerEmail || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return null
  const end = new Date(`${input.date}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  const endDate = end.toISOString().slice(0, 10)
  const body = {
    summary: input.title,
    description: input.description ?? '',
    start: { date: input.date },
    end: { date: endDate },
    extendedProperties: { private: { vaultKey: input.vaultKey } },
  }
  try {
    const auth = getServiceAccountAuth(input.brokerEmail, true)
    const calendar = google.calendar({ version: 'v3', auth })
    if (input.existingEventId) {
      const patched = await calendar.events.patch({
        calendarId: 'primary',
        eventId: input.existingEventId,
        requestBody: body,
      })
      return patched.data.id ?? input.existingEventId
    }
    const listed = await calendar.events.list({
      calendarId: 'primary',
      privateExtendedProperty: [`vaultKey=${input.vaultKey}`],
      maxResults: 1,
    })
    const found = listed.data.items?.[0]?.id
    if (found) {
      await calendar.events.patch({ calendarId: 'primary', eventId: found, requestBody: body })
      return found
    }
    const created = await calendar.events.insert({ calendarId: 'primary', requestBody: body })
    return created.data.id ?? null
  } catch (err) {
    console.warn('[gcal upsert]', input.brokerEmail, err instanceof Error ? err.message : err)
    return null
  }
}
