import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

/** Fixed clock so cadence math is deterministic (11 days past the real
 *  production last_notified_at of the fixture row → a weekly alert is due). */
const NOW = new Date('2026-08-05T15:00:00.000Z')
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(NOW)
afterAll(() => vi.useRealTimers())

/**
 * ADVERSARIAL audit of runListingAlerts (app/actions/saved-search-alerts.ts,
 * shipped deed9e4b). Only the DAL / network boundary is mocked — detection,
 * delivery planning, recipient fan-out and the send path are the REAL modules.
 */

// ── boundary mocks ───────────────────────────────────────────────────────────

const sendEmail = vi.fn(async () => ({ id: 'msg_1', error: undefined as string | undefined }))
vi.mock('@/lib/resend', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...(a as [])) }))

const markListingAlertNotified = vi.fn(async () => ({ ok: true as boolean, error: undefined as string | undefined }))
const claimListingAlertSend = vi.fn(async () => ({ ok: true as boolean, error: undefined as string | undefined }))
const restoreListingAlertCursor = vi.fn(async () => ({ ok: true as boolean, error: undefined as string | undefined }))
const getActiveListingAlertsDue = vi.fn(async () => [] as unknown[])
const updateListingAlertRecipients = vi.fn(async () => ({ ok: true }))
const getListingAlertById = vi.fn(async () => null as unknown)
vi.mock('@/lib/data/leads/listingAlerts', () => ({
  getActiveListingAlertsDue: (...a: unknown[]) => getActiveListingAlertsDue(...(a as [])),
  getListingAlertById: (...a: unknown[]) => getListingAlertById(...(a as [])),
  markListingAlertNotified: (...a: unknown[]) => markListingAlertNotified(...(a as [])),
  claimListingAlertSend: (...a: unknown[]) => claimListingAlertSend(...(a as [])),
  restoreListingAlertCursor: (...a: unknown[]) => restoreListingAlertCursor(...(a as [])),
  updateListingAlertRecipients: (...a: unknown[]) => updateListingAlertRecipients(...(a as [])),
}))

const enqueueAlertQueueItems = vi.fn(async () => ({ ok: true, queued: 0, error: undefined as string | undefined }))
const getAlertQueueItemsByIds = vi.fn(async () => [] as unknown[])
const markAlertQueueDecision = vi.fn(async () => ({ ok: true, ids: [] as string[], error: undefined as string | undefined }))
vi.mock('@/lib/data/leads/listingAlertQueue', () => ({
  enqueueAlertQueueItems: (...a: unknown[]) => enqueueAlertQueueItems(...(a as [])),
  getAlertQueueItemsByIds: (...a: unknown[]) => getAlertQueueItemsByIds(...(a as [])),
  markAlertQueueDecision: (...a: unknown[]) => markAlertQueueDecision(...(a as [])),
}))

const getCachedSearchListings = vi.fn(async () => ({ listings: [] as unknown[], totalCount: 0, cacheKey: 'k' }))
vi.mock('@/app/actions/search-cache', () => ({
  getCachedSearchListings: (...a: unknown[]) => getCachedSearchListings(...(a as [])),
}))

const getListingEventStatesByKeys = vi.fn(async () => new Map())
vi.mock('@/lib/data/listings/getListingEventStates', () => ({
  getListingEventStatesByKeys: (...a: unknown[]) => getListingEventStatesByKeys(...(a as [])),
}))

vi.mock('@/lib/data', () => ({ getAreasByIds: vi.fn(async () => []) }))

const isHardStopped = vi.fn(async (_personId?: number) => false)
vi.mock('@/lib/canonical-lead-tagger', () => ({ isHardStopped: (...a: unknown[]) => isHardStopped(...(a as [])) }))

const isSuppressedByEmail = vi.fn(async (_email?: string, _channel?: string) => ({
  suppressed: false,
  reasons: [] as string[],
}))
vi.mock('@/lib/crm/suppressions', () => ({
  isSuppressedByEmail: (...a: unknown[]) => isSuppressedByEmail(...(a as [])),
}))

vi.mock('@/lib/crm/email-events', () => ({ recordEmailEvent: vi.fn(async () => undefined) }))
vi.mock('@/lib/crm/attributed-links', () => ({ attributeOutbound: (html: string) => html }))

const resolvePersonForTracking = vi.fn(async (_args?: { crmPersonId?: number | null; email?: string }) => ({
  personId: 13168 as number | null,
  fubPersonId: null as number | null,
  assignedBroker: 'matt' as string | null,
  resolvedBy: 'id' as string,
}))
vi.mock('@/lib/data/crm/resolvePersonForTracking', () => ({
  resolvePersonForTracking: (...a: unknown[]) => resolvePersonForTracking(...(a as [])),
  linkAlertRowToPerson: vi.fn(async () => ({ ok: true })),
}))

const getCrmAccess = vi.fn(async () => null as { email: string } | null)
vi.mock('@/app/actions/crm', () => ({ getCrmAccess: (...a: unknown[]) => getCrmAccess(...(a as [])) }))

// Supabase service client: only used for profiles + hidden_listings here.
const profilePrefs: { value: unknown } = { value: null }
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self
      chain.eq = self
      chain.maybeSingle = async () =>
        table === 'profiles'
          ? { data: { notification_preferences: profilePrefs.value }, error: null }
          : { data: null, error: null }
      chain.then = undefined
      // hidden_listings does `.select().eq()` and awaits the builder
      ;(chain as { [k: string]: unknown }).__await = null
      return new Proxy(chain, {
        get(t, p) {
          if (p === 'then') {
            return (res: (v: unknown) => void) => res({ data: [], error: null })
          }
          return (t as Record<string | symbol, unknown>)[p]
        },
      })
    },
  }),
}))

import { runListingAlerts, approveAlertQueueItems } from '@/app/actions/saved-search-alerts'

// ── fixtures ────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>

/** The real production row shape (read from public.listing_alerts 2026-07-30). */
function prodRow(over: Row = {}): Row {
  return {
    id: 'fe4eb749-f0bb-4530-b417-f27c4285b3cc',
    email: 'marketing@ryan-realty.com',
    user_id: null,
    crm_person_id: 57840,
    fub_person_id: null,
    name: 'Bend $500K-$900K',
    filters: { beds: 3, city: 'Bend', maxPrice: 900000, minPrice: 500000 },
    filters_hash: 'h',
    notification_frequency: 'weekly',
    is_active: true,
    origin: 'user',
    assigned_by: null,
    source: 'idx-registration',
    unsubscribe_token: 'tok-primary',
    last_notified_at: '2026-07-25T04:01:04.977Z',
    notified_listing_keys: ['220215761', '220216002', '220216110'],
    events: {
      new: true, sold: false, open_house: false,
      price_change: true, status_change: true, back_on_market: false,
    },
    schedule_days: null,
    preview_mode: false,
    recipients: null,
    created_at: '2026-07-18T04:00:28.424Z',
    updated_at: '2026-07-25T04:01:04.977Z',
    ...over,
  }
}

function tile(listNumber: string, over: Row = {}): Row {
  return {
    ListingKey: `LK-${listNumber}`,
    ListNumber: listNumber,
    StandardStatus: 'Active',
    ListPrice: 750000,
    StreetNumber: '123',
    StreetName: 'NW Elm St',
    City: 'Bend',
    State: 'OR',
    PostalCode: '97703',
    SubdivisionName: 'West Hills',
    PhotoURL: 'https://example.com/p.jpg',
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    TotalLivingAreaSqFt: 1800,
    OnMarketDate: '2026-07-31T00:00:00Z',
    ModificationTimestamp: '2026-07-31T00:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  profilePrefs.value = null
  sendEmail.mockResolvedValue({ id: 'msg_1', error: undefined })
  markListingAlertNotified.mockResolvedValue({ ok: true, error: undefined })
  isHardStopped.mockResolvedValue(false)
  isSuppressedByEmail.mockResolvedValue({ suppressed: false, reasons: [] })
  getListingEventStatesByKeys.mockResolvedValue(new Map())
  enqueueAlertQueueItems.mockResolvedValue({ ok: true, queued: 0, error: undefined })
  getCrmAccess.mockResolvedValue(null)
  getAlertQueueItemsByIds.mockResolvedValue([])
  markAlertQueueDecision.mockResolvedValue({ ok: true, ids: [], error: undefined })
  getListingAlertById.mockResolvedValue(null)
  resolvePersonForTracking.mockResolvedValue({
    personId: 13168, fubPersonId: null, assignedBroker: 'matt', resolvedBy: 'id',
  })
})

// ── H1: first run after deploy against the real legacy state ────────────────

describe('H1 MASS-BLAST on the first typed run', () => {
  it('sends NOTHING when every current match is already in the legacy key list', async () => {
    getActiveListingAlertsDue.mockResolvedValue([prodRow()])
    getCachedSearchListings.mockResolvedValue({
      listings: ['220215761', '220216002', '220216110'].map((k) => tile(k)),
      totalCount: 3,
      cacheKey: 'k',
    })
    const res = await runListingAlerts()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(res.sent).toBe(0)
    expect(res.skipped).toBe(1)
  })

  it('emails ONE listing when exactly one key is genuinely new', async () => {
    getActiveListingAlertsDue.mockResolvedValue([prodRow()])
    getCachedSearchListings.mockResolvedValue({
      listings: ['220215761', '220216002', '220216110', '220299999'].map((k) => tile(k)),
      totalCount: 4,
      cacheKey: 'k',
    })
    const res = await runListingAlerts()
    expect(res.sent).toBe(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const html = (sendEmail.mock.calls[0] as unknown as [{ html: string }])[0].html
    expect(html).toContain('220299999')
    expect(html).not.toContain('220215761')
  })

  it('a row with the DEFAULT empty [] state + an old cursor does NOT blast history', async () => {
    getActiveListingAlertsDue.mockResolvedValue([
      prodRow({ notified_listing_keys: [] }),
    ])
    getCachedSearchListings.mockResolvedValue({
      // Every match was on market long before the cursor.
      listings: ['A1', 'A2', 'A3'].map((k) =>
        tile(k, { OnMarketDate: '2026-06-01T00:00:00Z', ModificationTimestamp: '2026-06-01T00:00:00Z' }),
      ),
      totalCount: 3,
      cacheKey: 'k',
    })
    const res = await runListingAlerts()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(res.sent).toBe(0)
  })

  it('a never-notified row DOES send its whole first window (intended first-send)', async () => {
    getActiveListingAlertsDue.mockResolvedValue([
      prodRow({ notified_listing_keys: [], last_notified_at: null }),
    ])
    getCachedSearchListings.mockResolvedValue({
      listings: ['A1', 'A2', 'A3'].map((k) => tile(k)),
      totalCount: 3,
      cacheKey: 'k',
    })
    const res = await runListingAlerts()
    expect(res.sent).toBe(1)
  })
})

// ── H2: double-send ─────────────────────────────────────────────────────────

describe('H2 DOUBLE-SEND', () => {
  it('does NOT send when the pre-send claim fails (no duplicate window)', async () => {
    const row = prodRow()
    getActiveListingAlertsDue.mockResolvedValue([row])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    claimListingAlertSend.mockResolvedValue({ ok: false, error: 'timeout' })

    const run1 = await runListingAlerts()
    expect(run1.sent).toBe(0)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(run1.errors[0]?.error).toBe('timeout')
  })

  it('restores the cursor when every Resend call fails after a successful claim', async () => {
    const row = prodRow()
    getActiveListingAlertsDue.mockResolvedValue([row])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    claimListingAlertSend.mockResolvedValue({ ok: true, error: undefined })
    sendEmail.mockResolvedValue({ id: undefined, error: 'resend down' })

    const res = await runListingAlerts()
    expect(res.sent).toBe(0)
    expect(claimListingAlertSend).toHaveBeenCalled()
    expect(restoreListingAlertCursor).toHaveBeenCalledWith(
      row.id,
      row.last_notified_at,
      row.notified_listing_keys,
    )
  })

  it('claims nextState BEFORE send so a successful delivery cannot re-blast', async () => {
    getActiveListingAlertsDue.mockResolvedValue([prodRow()])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    await runListingAlerts()
    expect(claimListingAlertSend).toHaveBeenCalled()
    const state = (claimListingAlertSend.mock.calls[0] as unknown as [string, string | null, string, Array<{ key: string }>])[3]
    expect(state.map((e) => e.key)).toContain('220299999')
    // Claim happens before Resend — order is load-bearing for at-most-once.
    const claimOrder = claimListingAlertSend.mock.invocationCallOrder[0]
    const sendOrder = sendEmail.mock.invocationCallOrder[0]
    expect(claimOrder).toBeLessThan(sendOrder)
  })

  it('the preview/approve path does not double-count: the cursor advances at QUEUE time', async () => {
    getActiveListingAlertsDue.mockResolvedValue([prodRow({ preview_mode: true })])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    const res = await runListingAlerts()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(res.queued).toBe(1)
    const state = (markListingAlertNotified.mock.calls[0] as unknown as [string, string, Array<{ key: string }>])[2]
    expect(state.map((e) => e.key)).toContain('220299999')
  })
})

// ── H3: silent silence ──────────────────────────────────────────────────────

describe('H3 SILENT SILENCE', () => {
  it('a preview-mode queue write failure leaves the alert stuck forever', async () => {
    // Real production behavior: enqueueAlertQueueItems always fails because
    // uq_listing_alert_queue_pending is a PARTIAL unique index and PostgREST
    // emits ON CONFLICT (cols) with no predicate → Postgres 42P10.
    enqueueAlertQueueItems.mockResolvedValue({ ok: false, queued: 0, error: 'persist_failed' })
    getActiveListingAlertsDue.mockResolvedValue([prodRow({ preview_mode: true })])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })

    const res = await runListingAlerts()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(res.queued).toBe(0)
    expect(res.errors[0]?.error).toBe('persist_failed')
    // Nothing queued, nothing sent, AND the cursor never advanced — the row is
    // permanently stuck at the head of the most-overdue queue.
    expect(markListingAlertNotified).not.toHaveBeenCalled()
  })

  it('a TRANSIENT compliance stop does NOT absorb the events (recovers next run)', async () => {
    getActiveListingAlertsDue.mockResolvedValue([prodRow()])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    // Run 1: the suppression table blips → isSuppressedByEmail fails CLOSED.
    isSuppressedByEmail.mockResolvedValue({ suppressed: true, reasons: ['suppression-check-failed: timeout'] })

    const run1 = await runListingAlerts()
    expect(sendEmail).not.toHaveBeenCalled()
    // FIXED 2026-07-30: a compliance stop advances the cursor ONLY. The notified
    // state must NOT be persisted, because a fail-closed suppression read is no
    // evidence the subscriber ever saw these listings.
    const persisted = (markListingAlertNotified.mock.calls[0] as unknown as [string, string, Array<{ key: string }> | undefined])[2]
    expect(persisted).toBeUndefined()
    expect(run1.skipped).toBe(1)

    // Run 2: compliance is healthy again, same listing still matching.
    vi.clearAllMocks()
    getActiveListingAlertsDue.mockResolvedValue([
      prodRow({ notified_listing_keys: persisted ?? [] }),
    ])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    isSuppressedByEmail.mockResolvedValue({ suppressed: false, reasons: [] })
    isHardStopped.mockResolvedValue(false)
    getListingEventStatesByKeys.mockResolvedValue(new Map())
    resolvePersonForTracking.mockResolvedValue({
      personId: 13168, fubPersonId: null, assignedBroker: 'matt', resolvedBy: 'id',
    })
    const run2 = await runListingAlerts()
    // The listing survives the blip and is delivered once compliance recovers.
    expect(sendEmail).toHaveBeenCalled()
    expect(run2.sent).toBe(1)
  })

  it('a per-recipient compliance THROW fails closed WITHOUT absorbing the events', async () => {
    getActiveListingAlertsDue.mockResolvedValue([prodRow()])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    // Transient failure inside resolveRecipientsWithCompliance's per-recipient
    // try/catch → {hardStopped:true, suppressed:true} for the only recipient.
    isHardStopped.mockRejectedValue(new Error('crm_people unreachable'))

    const res = await runListingAlerts()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(res.skipped).toBe(1)
    const persisted = (markListingAlertNotified.mock.calls[0] as unknown as [string, string, Array<{ key: string }> | undefined])[2]
    // FIXED 2026-07-30: fail-closed keeps the send from happening, but the
    // notified state is left untouched so the event fires once compliance
    // recovers instead of being absorbed forever.
    expect(persisted).toBeUndefined()
  })

  it('by contrast, a PRIMARY-identity throw aborts the row without absorbing (retried)', async () => {
    getActiveListingAlertsDue.mockResolvedValue([prodRow()])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    resolvePersonForTracking.mockRejectedValue(new Error('crm_people unreachable'))

    const res = await runListingAlerts()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(markListingAlertNotified).not.toHaveBeenCalled()
    expect(res.errors[0]?.error).toBe('crm_people unreachable')
  })

  it('areaIds that resolve to nothing skip + advance instead of widening', async () => {
    getActiveListingAlertsDue.mockResolvedValue([
      prodRow({ filters: { city: 'Bend', areaIds: ['deleted-area'] } }),
    ])
    const res = await runListingAlerts()
    expect(getCachedSearchListings).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(res.skipped).toBe(1)
  })

  it('a row with NO areaIds is unaffected by the areaIds guard', async () => {
    getActiveListingAlertsDue.mockResolvedValue([prodRow()])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    const res = await runListingAlerts()
    expect(res.sent).toBe(1)
  })
})

// ── H4: compliance ──────────────────────────────────────────────────────────

describe('H4 COMPLIANCE BYPASS', () => {
  const household = () =>
    prodRow({
      recipients: [
        { email: 'Jim@Example.com', name: 'Jim', unsubscribe_token: 'tok-jim' },
        { email: 'lisa@example.com', name: 'Lisa', unsubscribe_token: 'tok-lisa' },
      ],
    })

  it('drops ONLY the hard-stopped household recipient', async () => {
    getActiveListingAlertsDue.mockResolvedValue([household()])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    resolvePersonForTracking.mockImplementation(async (args) => ({
      personId: args?.email === 'jim@example.com' ? 999 : 13168,
      fubPersonId: null,
      assignedBroker: 'matt',
      resolvedBy: 'email',
    }))
    isHardStopped.mockImplementation(async (id) => id === 999)

    const res = await runListingAlerts()
    const to = sendEmail.mock.calls.map((c) => (c as unknown as [{ to: string }])[0].to)
    expect(to.sort()).toEqual(['lisa@example.com', 'marketing@ryan-realty.com'])
    expect(to).not.toContain('jim@example.com')
    expect(res.sent).toBe(2)
  })

  it('drops a suppressed recipient and still emails the rest', async () => {
    getActiveListingAlertsDue.mockResolvedValue([household()])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    isSuppressedByEmail.mockImplementation(async (email) => ({
      suppressed: email === 'lisa@example.com',
      reasons: [] as string[],
    }))
    await runListingAlerts()
    const to = sendEmail.mock.calls.map((c) => (c as unknown as [{ to: string }])[0].to)
    expect(to).not.toContain('lisa@example.com')
    expect(to).toContain('jim@example.com')
  })

  it('a suppression landing BETWEEN resolve and send still blocks (chokepoint re-check)', async () => {
    getActiveListingAlertsDue.mockResolvedValue([household()])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    let call = 0
    isSuppressedByEmail.mockImplementation(async (email) => {
      call += 1
      // First 3 calls = the resolve pass (clean). Later calls = the chokepoint.
      return { suppressed: call > 3 && email === 'jim@example.com', reasons: [] as string[] }
    })
    await runListingAlerts()
    const to = sendEmail.mock.calls.map((c) => (c as unknown as [{ to: string }])[0].to)
    expect(to).not.toContain('jim@example.com')
  })

  it('every recipient gets their OWN unsubscribe token in the email body', async () => {
    getActiveListingAlertsDue.mockResolvedValue([household()])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    await runListingAlerts()
    const byTo = new Map(
      sendEmail.mock.calls.map((c) => {
        const arg = (c as unknown as [{ to: string; html: string; headers: Record<string, string> }])[0]
        return [arg.to, arg]
      }),
    )
    expect(byTo.get('marketing@ryan-realty.com')!.html).toContain('token=tok-primary')
    expect(byTo.get('jim@example.com')!.html).toContain('token=tok-jim')
    expect(byTo.get('jim@example.com')!.html).not.toContain('token=tok-primary')
    expect(byTo.get('jim@example.com')!.headers['List-Unsubscribe']).toContain('tok-jim')
  })

  it('a household recipient with NO token gets one minted AND persisted before the send', async () => {
    getActiveListingAlertsDue.mockResolvedValue([
      prodRow({ recipients: [{ email: 'jim@example.com', name: 'Jim' }] }),
    ])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    await runListingAlerts()
    expect(updateListingAlertRecipients).toHaveBeenCalledTimes(1)
    const persisted = (updateListingAlertRecipients.mock.calls[0] as unknown as [string, Array<{ unsubscribe_token: string }>])[1]
    const token = persisted[0].unsubscribe_token
    expect(token).toMatch(/^[0-9a-f-]{36}$/)
    const jim = sendEmail.mock.calls
      .map((c) => (c as unknown as [{ to: string; html: string }])[0])
      .find((a) => a.to === 'jim@example.com')!
    expect(jim.html).toContain(`token=${token}`)
  })

  it('household recipients get NO /account manage link (only the primary does)', async () => {
    getActiveListingAlertsDue.mockResolvedValue([
      prodRow({ user_id: '2fae7c0f-dcdb-4264-b324-5f77777efc4d', recipients: [{ email: 'jim@example.com', unsubscribe_token: 'tok-jim' }] }),
    ])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    await runListingAlerts()
    const args = sendEmail.mock.calls.map((c) => (c as unknown as [{ to: string; html: string }])[0])
    const jim = args.find((a) => a.to === 'jim@example.com')!
    const primary = args.find((a) => a.to === 'marketing@ryan-realty.com')!
    expect(primary.html).toContain('/account/saved-searches')
    expect(jim.html).not.toContain('/account/saved-searches')
  })
})

// ── H6: crash ───────────────────────────────────────────────────────────────

describe('H6 CRASH', () => {
  it('a throw on one row never kills the run for the others', async () => {
    getActiveListingAlertsDue.mockResolvedValue([
      prodRow({ id: 'row-boom' }),
      prodRow({ id: 'row-ok', email: 'ok@example.com' }),
    ])
    let call = 0
    getCachedSearchListings.mockImplementation(async () => {
      call += 1
      if (call === 1) throw new Error('search cache exploded')
      return { listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' }
    })
    const res = await runListingAlerts()
    expect(res.errors.some((e) => e.searchId === 'row-boom')).toBe(true)
    expect(res.sent).toBe(1)
  })

  it('survives every degenerate column shape that can exist in prod today', async () => {
    getActiveListingAlertsDue.mockResolvedValue([
      // Pre-migration read: events / schedule_days / preview_mode / recipients undefined.
      prodRow({ id: 'r1', events: undefined, schedule_days: undefined, preview_mode: undefined, recipients: undefined }),
      // Nulls everywhere.
      prodRow({ id: 'r2', email: 'r2@example.com', events: null, recipients: null, notified_listing_keys: null, name: null, filters_hash: null }),
      // Garbage jsonb.
      prodRow({ id: 'r3', email: 'r3@example.com', events: 'nope', recipients: 'nope', notified_listing_keys: 'nope', schedule_days: 'nope' }),
      // recipients holding junk entries.
      prodRow({ id: 'r4', email: 'r4@example.com', recipients: [null, 3, {}, { email: '' }, { email: 'no-at-sign' }] }),
    ])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    const res = await runListingAlerts()
    expect(res.errors).toEqual([])
    expect(res.scanned).toBe(4)
    // Only the 4 valid primaries receive; the junk recipient entries are dropped.
    const to = sendEmail.mock.calls.map((c) => (c as unknown as [{ to: string }])[0].to)
    expect(to.sort()).toEqual([
      'marketing@ryan-realty.com', 'r2@example.com', 'r3@example.com', 'r4@example.com',
    ])
  })

  it('a listing missing from getListingEventStates still classifies correctly', async () => {
    getActiveListingAlertsDue.mockResolvedValue([prodRow()])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    getListingEventStatesByKeys.mockResolvedValue(new Map())
    const res = await runListingAlerts()
    expect(res.errors).toEqual([])
    expect(res.sent).toBe(1)
  })

  it('dryRun writes nothing and sends nothing', async () => {
    getActiveListingAlertsDue.mockResolvedValue([prodRow()])
    getCachedSearchListings.mockResolvedValue({ listings: [tile('220299999')], totalCount: 1, cacheKey: 'k' })
    const res = await runListingAlerts({ dryRun: true })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(markListingAlertNotified).not.toHaveBeenCalled()
    expect(updateListingAlertRecipients).not.toHaveBeenCalled()
    expect(enqueueAlertQueueItems).not.toHaveBeenCalled()
    expect(res.sent).toBe(1)
  })
})

// ── H4b: the preview-queue release path ─────────────────────────────────────

describe('H4 approveAlertQueueItems (broker release)', () => {
  const queued = (over: Row = {}) => ({
    id: 'q1',
    alert_id: 'fe4eb749-f0bb-4530-b417-f27c4285b3cc',
    listing_key: '220299999',
    event_type: 'new',
    event_payload: {
      event: { type: 'new', listingKey: '220299999' },
      card: {
        address: '123 NW Elm St',
        city: 'Bend',
        price: 750000,
        beds: 3,
        baths: 2,
        sqft: 1800,
        photoUrl: 'https://example.com/p.jpg',
        detailUrl: 'https://ryan-realty.com/listing/x',
        status: 'Active',
      },
    },
    status: 'approved',
    created_at: null,
    decided_at: null,
    decided_by: null,
    ...over,
  })

  it('refuses without CRM access and never touches the queue', async () => {
    getCrmAccess.mockResolvedValue(null)
    const res = await approveAlertQueueItems(['q1'])
    expect(res.ok).toBe(false)
    expect(res.error).toBe('Unauthorized')
    expect(markAlertQueueDecision).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('re-runs compliance at release time — a stop that landed while queued blocks', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com' })
    markAlertQueueDecision.mockResolvedValue({ ok: true, ids: ['q1'], error: undefined })
    getAlertQueueItemsByIds.mockResolvedValue([queued()])
    getListingAlertById.mockResolvedValue(prodRow())
    isSuppressedByEmail.mockResolvedValue({ suppressed: true, reasons: ['unsubscribed'] })

    const res = await approveAlertQueueItems(['q1'])
    expect(sendEmail).not.toHaveBeenCalled()
    expect(res.sent).toBe(0)
    expect(res.error).toContain('compliance-stopped')
  })

  it('refuses to release for a deactivated alert', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com' })
    markAlertQueueDecision.mockResolvedValue({ ok: true, ids: ['q1'], error: undefined })
    getAlertQueueItemsByIds.mockResolvedValue([queued()])
    getListingAlertById.mockResolvedValue(prodRow({ is_active: false }))

    const res = await approveAlertQueueItems(['q1'])
    expect(sendEmail).not.toHaveBeenCalled()
    expect(res.error).toContain('missing or inactive')
  })

  it('sends on the clean path and stamps the items sent', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com' })
    markAlertQueueDecision.mockResolvedValue({ ok: true, ids: ['q1'], error: undefined })
    getAlertQueueItemsByIds.mockResolvedValue([queued()])
    getListingAlertById.mockResolvedValue(prodRow())

    const res = await approveAlertQueueItems(['q1'])
    expect(res.sent).toBe(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const last = markAlertQueueDecision.mock.calls.at(-1) as unknown as [string[], string, string, string]
    expect(last[1]).toBe('sent')
  })

  it('LEAK: a Resend failure strands the items in `approved` — unrecoverable', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com' })
    markAlertQueueDecision.mockResolvedValue({ ok: true, ids: ['q1'], error: undefined })
    getAlertQueueItemsByIds.mockResolvedValue([queued()])
    getListingAlertById.mockResolvedValue(prodRow())
    sendEmail.mockResolvedValue({ id: undefined as unknown as string, error: 'resend 500' })

    const res = await approveAlertQueueItems(['q1'])
    expect(res.sent).toBe(0)
    // Never stamped 'sent' — the row sits in `approved` forever. Re-approving
    // is a no-op because markAlertQueueDecision only moves rows FROM 'pending',
    // and the pending approval queue only lists status='pending'.
    const stamps = markAlertQueueDecision.mock.calls.map((c) => (c as unknown as [string[], string])[1])
    expect(stamps).not.toContain('sent')
  })

  it('the alert cursor is NOT re-stamped on release (already advanced at queue time)', async () => {
    getCrmAccess.mockResolvedValue({ email: 'matt@ryan-realty.com' })
    markAlertQueueDecision.mockResolvedValue({ ok: true, ids: ['q1'], error: undefined })
    getAlertQueueItemsByIds.mockResolvedValue([queued()])
    getListingAlertById.mockResolvedValue(prodRow())
    await approveAlertQueueItems(['q1'])
    expect(markListingAlertNotified).not.toHaveBeenCalled()
  })
})
