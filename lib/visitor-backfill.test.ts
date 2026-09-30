import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeVisitorDb } from '@/test/fake-visitor-db'

const store = createFakeVisitorDb()
// A database from before migration 20260923120000 (the automation flag) refuses to
// select those columns; the identification must still go through.
let legacySchema = false
// Any other failure of a write the stitch makes (a timeout, a lock, a constraint):
// the browser back-stitch update, or the identity-map upsert.
let stitchError: string | null = null
let mapError: string | null = null
const failing = (message: string) =>
  ({
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve({ data: null, error: { message } })),
  }) as never
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const real = store.client.from(table)
      if (mapError && table === 'visitor_identity_map') real.upsert = () => failing(mapError!)
      if (stitchError && table === 'visitor_sessions') real.or = () => failing(stitchError!)
      if (!legacySchema || table !== 'visitor_sessions') return real
      // ...and refuses a filter that names them
      real.or = () =>
        ({
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolve({ data: null, error: { message: 'column visitor_sessions.is_automated does not exist' } })),
        }) as unknown as typeof real
      const select = real.select.bind(real)
      real.select = (columns?: string) => {
        if (columns?.includes('is_automated')) {
          const failing = {
            eq: () => failing,
            limit: () => failing,
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve(resolve({ data: null, error: { message: 'column visitor_sessions.is_automated does not exist' } })),
          }
          return failing as unknown as typeof real
        }
        return select(columns)
      }
      return real
    },
  }),
}))
vi.mock('@/lib/data/leads/listingAlerts', () => ({ stampListingAlertsCrmPerson: vi.fn() }))

import {
  backfillSessionToFub,
  buildIdentityMapPatch,
  isAutomatedSession,
  sessionIsAutomation,
  stitchBrowserToPerson,
  stitchFormSubmitIdentity,
} from './visitor-backfill'
import { IDENTIFIABLE_SESSION_FILTER, PROVISIONAL_AUTOMATION_REASONS, sessionBlocksIdentification } from '@/lib/analytics/automation'
import { postgrestOrFilter } from '@/test/fake-visitor-db'

describe('buildIdentityMapPatch', () => {
  it('writes crm_person_id in lockstep with fub_person_id so the packet can see the stitch', () => {
    const row = buildIdentityMapPatch({
      rrVid: 'vid-1',
      personId: 13168,
      email: 'Matt@Ryan-Realty.com',
      source: 'form_submit',
      identifiedAt: '2026-08-16T00:00:00.000Z',
    })
    expect(row.rr_vid).toBe('vid-1')
    expect(row.fub_person_id).toBe(13168)
    expect(row.crm_person_id).toBe(13168)
    expect(row.email).toBe('matt@ryan-realty.com')
    expect(row.identify_source).toBe('form_submit')
    expect(row.identified_at).toBe('2026-08-16T00:00:00.000Z')
  })

  it('omits person columns when the visitor is email-only (sign-in before CRM row)', () => {
    const row = buildIdentityMapPatch({
      rrVid: 'vid-2',
      email: 'new@example.com',
      userId: 'auth-uuid',
      source: 'auth_session',
      identifiedAt: '2026-08-16T00:00:00.000Z',
    })
    expect(row.crm_person_id).toBeUndefined()
    expect(row.fub_person_id).toBeUndefined()
    expect(row.email).toBe('new@example.com')
    expect(row.user_id).toBe('auth-uuid')
  })
})

describe('sessionIsAutomation', () => {
  it.each(['declared-crawler', 'tool', 'headless', 'webdriver', 'empty-ua'])('%s is automation that is never identified', (reason) => {
    expect(sessionIsAutomation({ is_automated: true, automation_reason: reason })).toBe(true)
  })

  it('the provisional contact-deep-link shape never blocks identification, and neither does an unflagged session', () => {
    expect(sessionIsAutomation({ is_automated: true, automation_reason: 'contact-deep-link' })).toBe(false)
    expect(sessionIsAutomation({ is_automated: false, automation_reason: null })).toBe(false)
    expect(sessionIsAutomation({})).toBe(false)
    expect(sessionIsAutomation(null)).toBe(false)
    expect(sessionIsAutomation(undefined)).toBe(false)
  })

  it('a flag with no reason is still automation', () => {
    expect(sessionIsAutomation({ is_automated: true })).toBe(true)
  })

  it('is the ONE rule, and the back-stitch filter is the same rule: they agree on every row (review of 2026-09-30)', () => {
    // The filter used to be written out by hand beside the function, free to drift
    // from it. Both now come from one definition (lib/analytics/automation.ts); this
    // runs the filter the database is sent over the same rows the function reads.
    const flags = [true, false, null, undefined]
    const reasons = [...PROVISIONAL_AUTOMATION_REASONS, 'declared-crawler', 'tool', 'headless', 'webdriver', 'empty-ua', null, undefined, '']
    const rows = flags.flatMap((is_automated) => reasons.map((automation_reason) => ({ is_automated, automation_reason })))
    const selects = postgrestOrFilter(IDENTIFIABLE_SESSION_FILTER)
    for (const row of rows) {
      expect(selects(row as Record<string, unknown>), JSON.stringify(row)).toBe(!sessionIsAutomation(row))
      expect(sessionBlocksIdentification(row)).toBe(sessionIsAutomation(row))
    }
    // not vacuous: both answers occur
    expect(rows.some((r) => sessionIsAutomation(r))).toBe(true)
    expect(rows.some((r) => !sessionIsAutomation(r))).toBe(true)
  })
})

describe('automation is never identified, stamped or stitched (docs/TRACKING_POLICY.md, identity loop rule 5)', () => {
  const VID = 'vid-A'
  const PERSON = 64115

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
    legacySchema = false
    store.reset()
    store.db.visitor_sessions.push(
      // the session the identify call names
      { session_id: 's-person', rr_vid: VID, crm_person_id: null, identified_at: null },
      // another anonymous session on the same browser
      { session_id: 's-earlier', rr_vid: VID, crm_person_id: null, identified_at: null },
      { session_id: 's-bot', rr_vid: 'vid-bot', crm_person_id: null, identified_at: null, is_automated: true, automation_reason: 'declared-crawler' },
      { session_id: 's-bot-earlier', rr_vid: 'vid-bot', crm_person_id: null, identified_at: null, is_automated: true, automation_reason: 'declared-crawler' },
      { session_id: 's-deep', rr_vid: 'vid-deep', crm_person_id: null, identified_at: null, is_automated: true, automation_reason: 'contact-deep-link' },
    )
    store.db.visitor_events.push(
      { id: 1, session_id: 's-person', pushed_to_fub_at: null },
      { id: 2, session_id: 's-bot', pushed_to_fub_at: null },
    )
  })

  const sessionRow = (id: string) => store.session(id)!

  it('a person: stamps the session, maps the browser, back-stitches it, marks its events', async () => {
    const res = await backfillSessionToFub({ sessionId: 's-person', fubPersonId: PERSON, identifiedVia: 'tracked_link:email' })
    expect(res).toMatchObject({ ok: true, sessionFound: true, alreadyIdentified: false, eventsBackfilled: 1 })
    expect(res.automated).toBeUndefined()
    expect(sessionRow('s-person')).toMatchObject({ crm_person_id: PERSON, identified_via: 'tracked_link:email' })
    expect(sessionRow('s-earlier')).toMatchObject({ crm_person_id: PERSON })
    expect(store.db.visitor_identity_map).toEqual([expect.objectContaining({ rr_vid: VID, crm_person_id: PERSON })])
    expect(store.db.visitor_events.find((e) => e.id === 1)!.pushed_to_fub_at).toBeTruthy()
  })

  it('a flagged crawler: no person on the session, no identity-map row, no back-stitch, events untouched', async () => {
    const res = await backfillSessionToFub({ sessionId: 's-bot', fubPersonId: PERSON, identifiedVia: 'tracked_link:email' })
    expect(res).toEqual({ ok: true, sessionFound: true, alreadyIdentified: false, eventsBackfilled: 0, errors: [], automated: true })
    expect(sessionRow('s-bot').crm_person_id).toBeNull()
    expect(sessionRow('s-bot').identified_at).toBeNull()
    expect(sessionRow('s-bot-earlier').crm_person_id).toBeNull()
    expect(store.db.visitor_identity_map).toEqual([])
    expect(store.db.visitor_events.find((e) => e.id === 2)!.pushed_to_fub_at).toBeNull()
  })

  it('the provisional contact-deep-link class is identified like a person (a person who reads on clears it)', async () => {
    const res = await backfillSessionToFub({ sessionId: 's-deep', fubPersonId: PERSON, identifiedVia: 'form_submit' })
    expect(res.automated).toBeUndefined()
    expect(sessionRow('s-deep')).toMatchObject({ crm_person_id: PERSON })
    expect(store.db.visitor_identity_map).toHaveLength(1)
  })

  it('a session that does not exist yet is not a failure, and not automation', async () => {
    const res = await backfillSessionToFub({ sessionId: 's-missing', fubPersonId: PERSON, identifiedVia: 'tracked_link:email' })
    expect(res).toMatchObject({ ok: true, sessionFound: false })
    expect(res.automated).toBeUndefined()
  })

  it('a form submitted from a flagged session does not put that browser in the identity map or identify its sessions', async () => {
    const botSession = '22222222-3333-4444-8555-666666666666'
    store.db.visitor_sessions.push(
      { session_id: botSession, rr_vid: 'vid-bot-form', crm_person_id: null, identified_at: null, is_automated: true, automation_reason: 'headless' },
      { session_id: 's-bot-form-earlier', rr_vid: 'vid-bot-form', crm_person_id: null, identified_at: null, is_automated: true, automation_reason: 'headless' },
    )
    await stitchFormSubmitIdentity({ personId: PERSON, email: 'lead@example.com', rrVid: 'vid-bot-form', sessionId: botSession })
    expect(store.session(botSession)!.crm_person_id).toBeNull()
    expect(store.session('s-bot-form-earlier')!.crm_person_id).toBeNull()
    expect(store.db.visitor_identity_map).toEqual([])
  })

  it('a form submitted from a person still stitches the session and the browser', async () => {
    const personSession = '33333333-4444-4555-8666-777777777777'
    store.db.visitor_sessions.push({ session_id: personSession, rr_vid: 'vid-human', crm_person_id: null, identified_at: null })
    await stitchFormSubmitIdentity({ personId: PERSON, email: 'lead@example.com', rrVid: 'vid-human', sessionId: personSession })
    expect(store.session(personSession)).toMatchObject({ crm_person_id: PERSON, identified_via: 'form_submit' })
    expect(store.db.visitor_identity_map).toEqual([expect.objectContaining({ rr_vid: 'vid-human', crm_person_id: PERSON })])
  })

  it('a form submitted with no session id (the tracker never ran) stitches the browser as it always did', async () => {
    await stitchFormSubmitIdentity({ personId: PERSON, email: 'lead@example.com', rrVid: 'vid-none', sessionId: null })
    expect(store.db.visitor_identity_map).toEqual([expect.objectContaining({ rr_vid: 'vid-none', crm_person_id: PERSON })])
  })

  it('still identifies a person on a database that predates the automation flag', async () => {
    legacySchema = true
    const res = await backfillSessionToFub({ sessionId: 's-person', fubPersonId: PERSON, identifiedVia: 'tracked_link:email' })
    expect(res.ok).toBe(true)
    expect(res.automated).toBeUndefined()
    expect(sessionRow('s-person')).toMatchObject({ crm_person_id: PERSON })
  })

  describe('the browser back-stitch leaves automation sessions on the same rr_vid unidentified (review of 2026-09-30)', () => {
    // stitchVisitorIdentity marks every anonymous session on the browser identified.
    // It used to take the flagged ones with them: a crawler or scripted browser that
    // had used this browser id was recorded as the contact.
    beforeEach(() => {
      store.db.visitor_sessions.push(
        { session_id: 'm-person', rr_vid: 'vid-mixed', crm_person_id: null, identified_at: null, is_automated: false, automation_reason: null },
        { session_id: 'm-earlier', rr_vid: 'vid-mixed', crm_person_id: null, identified_at: null, is_automated: false, automation_reason: null },
        { session_id: 'm-crawler', rr_vid: 'vid-mixed', crm_person_id: null, identified_at: null, is_automated: true, automation_reason: 'declared-crawler' },
        { session_id: 'm-webdriver', rr_vid: 'vid-mixed', crm_person_id: null, identified_at: null, is_automated: true, automation_reason: 'webdriver' },
        { session_id: 'm-deep', rr_vid: 'vid-mixed', crm_person_id: null, identified_at: null, is_automated: true, automation_reason: 'contact-deep-link' },
      )
    })

    it('a person identified on the browser: their sessions and the provisional shape are stitched, flagged automation is not', async () => {
      await stitchBrowserToPerson({ rrVid: 'vid-mixed', personId: PERSON, sessionId: 'm-person', source: 'tracked_link:email' })
      expect(store.session('m-person')).toMatchObject({ crm_person_id: PERSON, identified_via: 'tracked_link:email' })
      expect(store.session('m-earlier')).toMatchObject({ crm_person_id: PERSON })
      expect(store.session('m-deep')).toMatchObject({ crm_person_id: PERSON })
      expect(store.session('m-crawler')).toMatchObject({ crm_person_id: null, identified_at: null })
      expect(store.session('m-webdriver')).toMatchObject({ crm_person_id: null, identified_at: null })
      // the browser itself is still mapped to the person (a person identified on it)
      expect(store.db.visitor_identity_map).toEqual([expect.objectContaining({ rr_vid: 'vid-mixed', crm_person_id: PERSON })])
    })

    it('the same through the backfill a tracked link or a form runs', async () => {
      const res = await backfillSessionToFub({ sessionId: 'm-person', fubPersonId: PERSON, identifiedVia: 'form_submit' })
      expect(res.automated).toBeUndefined()
      expect(store.session('m-earlier')).toMatchObject({ crm_person_id: PERSON })
      expect(store.session('m-crawler')!.identified_at).toBeNull()
      expect(store.session('m-webdriver')!.identified_at).toBeNull()
    })

    it('a back-stitch that fails for any other reason is logged, not skipped in silence (review of 2026-09-30)', async () => {
      stitchError = 'canceling statement due to statement timeout'
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      try {
        await stitchBrowserToPerson({ rrVid: 'vid-mixed', personId: PERSON, sessionId: 'm-person', source: 'tracked_link:email' })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('back-stitch'), expect.stringContaining('statement timeout'))
        // and it is not retried without the filter: that would identify the automation it leaves out
        expect(store.session('m-crawler')!.identified_at).toBeNull()
      } finally {
        stitchError = null
        warn.mockRestore()
      }
    })

    it('an identity-map write that fails is logged too', async () => {
      mapError = 'deadlock detected'
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      try {
        await stitchBrowserToPerson({ rrVid: 'vid-mixed', personId: PERSON, sessionId: 'm-person', source: 'tracked_link:email' })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('identity map'), expect.stringContaining('deadlock'))
      } finally {
        mapError = null
        warn.mockRestore()
      }
    })

    it('on a database that predates the automation flag (no flagged session can exist) it stitches as before', async () => {
      legacySchema = true
      await stitchBrowserToPerson({ rrVid: 'vid-mixed', personId: PERSON, sessionId: 'm-person', source: 'tracked_link:email' })
      expect(store.session('m-person')).toMatchObject({ crm_person_id: PERSON })
      expect(store.session('m-earlier')).toMatchObject({ crm_person_id: PERSON })
    })
  })

  describe('isAutomatedSession (the identify actions ask this before they cookie or stitch a browser)', () => {
    it('is true for a session the track route flagged, whatever the class of automation', async () => {
      expect(await isAutomatedSession('s-bot')).toBe(true)
      store.db.visitor_sessions.push({ session_id: 's-webdriver', rr_vid: 'vid-wd', is_automated: true, automation_reason: 'webdriver' })
      expect(await isAutomatedSession('s-webdriver')).toBe(true)
    })

    it('is false for a person, for the provisional contact-deep-link shape, and for a session that is not there yet', async () => {
      expect(await isAutomatedSession('s-person')).toBe(false)
      expect(await isAutomatedSession('s-deep')).toBe(false)
      expect(await isAutomatedSession('s-missing')).toBe(false)
    })

    it('is false, not an error, on a database that predates the automation flag or has no service client', async () => {
      // (The legacy read retries without the flag columns and finds a session that has none.)
      legacySchema = true
      expect(await isAutomatedSession('s-person')).toBe(false)
      legacySchema = false
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      try {
        expect(await isAutomatedSession('s-bot')).toBe(false)
      } finally {
        process.env.SUPABASE_SERVICE_ROLE_KEY = key
      }
    })
  })
})
