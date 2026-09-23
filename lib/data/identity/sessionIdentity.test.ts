/**
 * Back-stitch + identify behaviour of the identity loop (P7), against an
 * in-memory stand-in for the two tables. The fake applies the SAME filters the
 * code sends (eq / is null), so these tests prove which rows move, not just
 * which calls were made.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const db: Record<string, Row[]> = { visitor_sessions: [], visitor_identity_map: [] }

function builder(table: string) {
  let mode: 'select' | 'update' | 'insert' | 'upsert' = 'select'
  let patch: Row = {}
  let onConflict: string | null = null
  const filters: Array<(r: Row) => boolean> = []
  let returning = false
  const b = {
    select() {
      returning = mode !== 'select'
      return b
    },
    update(p: Row) {
      mode = 'update'
      patch = p
      return b
    },
    insert(p: Row) {
      mode = 'insert'
      patch = p
      return b
    },
    upsert(p: Row, opts?: { onConflict?: string }) {
      mode = 'upsert'
      patch = p
      onConflict = opts?.onConflict ?? null
      return b
    },
    eq(col: string, val: unknown) {
      filters.push((r) => r[col] === val)
      return b
    },
    is(col: string, val: null) {
      filters.push((r) => (r[col] ?? null) === val)
      return b
    },
    in(col: string, vals: unknown[]) {
      filters.push((r) => vals.includes(r[col]))
      return b
    },
    maybeSingle() {
      const hit = db[table].find((r) => filters.every((f) => f(r)))
      return Promise.resolve({ data: hit ?? null, error: null })
    },
    then(resolve: (v: { data: unknown; error: null }) => unknown) {
      if (mode === 'update') {
        const hits = db[table].filter((r) => filters.every((f) => f(r)))
        for (const r of hits) Object.assign(r, patch)
        return Promise.resolve(resolve({ data: returning ? hits : null, error: null }))
      }
      if (mode === 'insert') {
        db[table].push({ ...patch })
        return Promise.resolve(resolve({ data: null, error: null }))
      }
      if (mode === 'upsert') {
        const key = onConflict ?? 'id'
        const existing = db[table].find((r) => r[key] === patch[key])
        if (existing) Object.assign(existing, patch)
        else db[table].push({ ...patch })
        return Promise.resolve(resolve({ data: null, error: null }))
      }
      const hits = db[table].filter((r) => filters.every((f) => f(r)))
      return Promise.resolve(resolve({ data: hits, error: null }))
    },
  }
  return b
}

const fake = { from: (t: string) => builder(t) }

vi.mock('@supabase/supabase-js', () => ({ createClient: () => fake }))
vi.mock('@/lib/data/leads/listingAlerts', () => ({ stampListingAlertsCrmPerson: vi.fn() }))

import {
  clearProvisionalAutomation,
  identifySessionAndBrowser,
  insertVisitorSession,
  isMissingColumnError,
} from './sessionIdentity'
import type { SupabaseClient } from '@supabase/supabase-js'

const sb = fake as unknown as SupabaseClient
const VID = 'vid-A'

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  db.visitor_sessions = [
    // The session the tracked link landed on.
    { session_id: 's-now', rr_vid: VID, crm_person_id: null, identified_at: null },
    // Two EARLIER anonymous sessions from the same browser (localStorage was cleared).
    { session_id: 's-old-1', rr_vid: VID, crm_person_id: null, identified_at: null },
    { session_id: 's-old-2', rr_vid: VID, crm_person_id: null, identified_at: null },
    // Same browser, already identified to someone else (a shared laptop).
    { session_id: 's-other', rr_vid: VID, crm_person_id: 777, identified_at: '2026-09-01T00:00:00Z' },
    // A different browser entirely.
    { session_id: 's-stranger', rr_vid: 'vid-B', crm_person_id: null, identified_at: null },
  ]
  db.visitor_identity_map = []
})

describe('identifySessionAndBrowser — identify the visit and back-stitch the browser', () => {
  it('stamps the landing session, back-stitches every anonymous session on the same rr_vid, and maps the rr_vid', async () => {
    const res = await identifySessionAndBrowser(sb, {
      sessionId: 's-now',
      rrVid: VID,
      personId: 64115,
      via: 'tracked_link:email',
    })
    expect(res.sessionStamped).toBe(true)
    const byId = Object.fromEntries(db.visitor_sessions.map((r) => [r.session_id, r]))
    expect(byId['s-now']).toMatchObject({ crm_person_id: 64115, fub_person_id: 64115, identified_via: 'tracked_link:email' })
    expect(byId['s-old-1']).toMatchObject({ crm_person_id: 64115, identified_via: 'tracked_link:email' })
    expect(byId['s-old-2']).toMatchObject({ crm_person_id: 64115 })
    // Never moved: someone else's session, and another browser.
    expect(byId['s-other']).toMatchObject({ crm_person_id: 777 })
    expect(byId['s-stranger']).toMatchObject({ crm_person_id: null })
    // The browser is mapped, so its next session is born identified (carryover).
    expect(db.visitor_identity_map).toEqual([
      expect.objectContaining({ rr_vid: VID, crm_person_id: 64115, identify_source: 'tracked_link:email', session_id: 's-now' }),
    ])
  })

  it('never reassigns a session that already belongs to another contact', async () => {
    const res = await identifySessionAndBrowser(sb, {
      sessionId: 's-other',
      rrVid: VID,
      personId: 64115,
      via: 'tracked_link:sms',
    })
    expect(res.sessionStamped).toBe(false)
    expect(db.visitor_sessions.find((r) => r.session_id === 's-other')).toMatchObject({ crm_person_id: 777 })
  })

  it('carryover stamps the session without rewriting the map provenance', async () => {
    db.visitor_identity_map = [{ rr_vid: VID, crm_person_id: 64115, identify_source: 'form_submit' }]
    await identifySessionAndBrowser(sb, {
      sessionId: 's-now',
      rrVid: VID,
      personId: 64115,
      via: 'rr_vid_carryover',
      stitchBrowser: false,
    })
    expect(db.visitor_sessions.find((r) => r.session_id === 's-now')).toMatchObject({ crm_person_id: 64115 })
    expect(db.visitor_identity_map[0].identify_source).toBe('form_submit')
    // Other anonymous sessions are left for the original stitch to own.
    expect(db.visitor_sessions.find((r) => r.session_id === 's-old-1')).toMatchObject({ crm_person_id: null })
  })
})

describe('insertVisitorSession — safe before the automation migration', () => {
  it('recognises a missing-column error from PostgREST and from Postgres', () => {
    expect(isMissingColumnError({ code: 'PGRST204', message: "Could not find the 'is_automated' column" })).toBe(true)
    expect(isMissingColumnError({ code: '42703', message: 'column "is_automated" does not exist' })).toBe(true)
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key' })).toBe(false)
  })

  it('writes the automation class when the schema has it', async () => {
    const res = await insertVisitorSession(sb, { session_id: 's-new', rr_vid: 'vid-C' }, { is_automated: true, automation_reason: 'declared-crawler' })
    expect(res.inserted).toBe(true)
    expect(db.visitor_sessions.find((r) => r.session_id === 's-new')).toMatchObject({ is_automated: true, automation_reason: 'declared-crawler' })
  })
})

describe('clearProvisionalAutomation — a second event proves a person', () => {
  it('clears only a provisional flag and never a UA-based one', async () => {
    db.visitor_sessions.push(
      { session_id: 's-deep', rr_vid: 'vid-D', is_automated: true, automation_reason: 'contact-deep-link' },
      { session_id: 's-bot', rr_vid: 'vid-E', is_automated: true, automation_reason: 'headless' },
    )
    await clearProvisionalAutomation(sb, 's-deep', ['contact-deep-link'])
    await clearProvisionalAutomation(sb, 's-bot', ['contact-deep-link'])
    expect(db.visitor_sessions.find((r) => r.session_id === 's-deep')).toMatchObject({ is_automated: false, automation_reason: null })
    expect(db.visitor_sessions.find((r) => r.session_id === 's-bot')).toMatchObject({ is_automated: true, automation_reason: 'headless' })
  })
})
