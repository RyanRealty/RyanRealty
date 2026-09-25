import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Every Calendar call in this file must carry a deadline: the service-account
 * JWT gets GOOGLE_AUTH_TIMEOUT_MS (google-auth-library gives the token POST
 * none of its own, the same gap lib/gmail-draft.ts had), and every
 * google.calendar() client gets CALENDAR_REQUEST_TIMEOUT_MS so a stalled call
 * fails fast instead of hanging the caller (a public booking page render with
 * no maxDuration override, or the tc-deal-calendar cron's per-deal loop).
 */

const h = vi.hoisted(() => ({
  jwtCtor: vi.fn(),
  calendarCtor: vi.fn(),
  list: vi.fn(),
  patch: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: class {
        constructor(opts: unknown) {
          h.jwtCtor(opts)
        }
      },
    },
    calendar: (opts: unknown) => {
      h.calendarCtor(opts)
      return { events: { list: h.list, patch: h.patch, insert: h.insert } }
    },
  },
}))

import { GOOGLE_AUTH_TIMEOUT_MS } from '@/lib/google-deadline'
import {
  getGcalEvents,
  getGcalBusyIntervals,
  upsertAllDayGcalEvent,
  CALENDAR_REQUEST_TIMEOUT_MS,
} from './google-calendar'

beforeEach(() => {
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL', 'viewer@ryanrealty.iam.gserviceaccount.com')
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'test-key')
  h.list.mockResolvedValue({ data: { items: [] } })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('Calendar auth deadline', () => {
  it('gives the service-account JWT a transporter timeout', async () => {
    await getGcalEvents('matt@ryan-realty.com')

    expect(h.jwtCtor).toHaveBeenCalledWith(
      expect.objectContaining({ transporterOptions: { timeout: GOOGLE_AUTH_TIMEOUT_MS } }),
    )
  })
})

describe('Calendar per-request deadline', () => {
  it('getGcalEvents passes it to the calendar client', async () => {
    await getGcalEvents('matt@ryan-realty.com')
    expect(h.calendarCtor).toHaveBeenCalledWith(expect.objectContaining({ timeout: CALENDAR_REQUEST_TIMEOUT_MS }))
  })

  it('getGcalBusyIntervals passes it to the calendar client', async () => {
    await getGcalBusyIntervals('matt@ryan-realty.com', '2026-09-25T00:00:00Z', '2026-10-01T00:00:00Z')
    expect(h.calendarCtor).toHaveBeenCalledWith(expect.objectContaining({ timeout: CALENDAR_REQUEST_TIMEOUT_MS }))
  })

  it('upsertAllDayGcalEvent passes it to the calendar client', async () => {
    h.insert.mockResolvedValue({ data: { id: 'gcal-1' } })
    await upsertAllDayGcalEvent({
      brokerEmail: 'matt@ryan-realty.com',
      vaultKey: 'tc:deal-1:contract_accepted:2026-10-01:matt',
      title: 'Contract accepted',
      date: '2026-10-01',
    })
    expect(h.calendarCtor).toHaveBeenCalledWith(expect.objectContaining({ timeout: CALENDAR_REQUEST_TIMEOUT_MS }))
  })
})
