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
 * with scope: https://www.googleapis.com/auth/calendar.readonly
 */

import { google } from 'googleapis'

export type GcalEvent = {
  id: string
  title: string
  start: string
  end: string | null
  allDay: boolean
  htmlLink: string | null
}

function getServiceAccountAuth(impersonateEmail: string) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Google service account credentials not configured')

  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
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
