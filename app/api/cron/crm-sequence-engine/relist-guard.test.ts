/**
 * The sequence engine asks the MLS before every text or email of an expired /
 * FSBO recovery enrollment (2026-09-30 review).
 *
 * The whole route runs against an in-memory database and a fake Spark; the
 * relist check itself is real (lib/crm/sequence-relist-guard.ts ->
 * verifyNotRelisted -> sparkRelistCheck). The fixture is the proven case:
 * enrollment 31, person 56921, "Expired Recovery (auto)" at step 1 (the CMA
 * link text). The owner's expired listing 20250502014809455304000000 at 20873
 * Greenmont, Bend expired 2026-07-05; the home went Active with Works Real
 * Estate on 2026-07-06 under the new key 20260706204435299456000000, and the
 * engine texted the owner on 2026-09-21.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
type Call = {
  table: string
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  cols?: string
  opts?: unknown
  payload?: Row
  filters: Array<[string, ...unknown[]]>
}

const OLD_KEY = '20250502014809455304000000'
const NEW_KEY = '20260706204435299456000000'

const db = vi.hoisted(() => ({
  calls: [] as Call[],
  enrollments: [] as Row[],
  person: null as Row | null,
  expired: [] as Row[],
  fsbo: [] as Row[],
  listings: [] as Row[],
  prospectReadError: null as { message: string } | null,
}))

const spark = vi.hoisted(() => ({
  byKey: new Map<string, Record<string, unknown>>(),
  byKeyError: null as Error | null,
  address: [] as Record<string, unknown>[],
  calls: 0,
}))

const sent = vi.hoisted(() => ({
  sendSms: vi.fn(async () => ({ ok: true as const, sid: 'SM-1' })),
  sendSmsViaMessagingService: vi.fn(async () => ({ ok: true as const, sid: 'SM-2' })),
  sendCrmEmail: vi.fn(async () => ({ ok: true as const, gmailId: 'g-1', plainBody: 'x' })),
  queueBrokerHealthAlert: vi.fn(async () => true),
}))

function respond(c: Call): { data?: unknown; error?: unknown; count?: number } {
  switch (c.table) {
    case 'crm_sequence_enrollments':
      return c.op === 'select' ? { data: db.enrollments, error: null } : { error: null }
    case 'crm_people':
      return { data: db.person, error: null }
    case 'crm_timeline':
      return c.op === 'select' ? { count: 0, error: null } : { error: null }
    case 'expired_listings':
      return db.prospectReadError ? { data: null, error: db.prospectReadError } : { data: db.expired, error: null }
    case 'fsbo_listings':
      return { data: db.fsbo, error: null }
    case 'listings':
      // The parcel anchor read (maybeSingle), then the street-number probe.
      return c.cols === 'parcel_number' ? { data: { parcel_number: null }, error: null } : { data: db.listings, error: null }
    default:
      return { data: null, error: null }
  }
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    rpc: async (name: string) => ({ data: name === 'crm_try_cron_lease' ? true : null, error: null }),
    from(table: string) {
      const call: Call = { table, op: 'select', filters: [] }
      const done = () => {
        db.calls.push(call)
        return Promise.resolve(respond(call))
      }
      const b: Record<string, unknown> = {}
      for (const m of ['eq', 'neq', 'in', 'or', 'gte', 'lte', 'like', 'ilike', 'is', 'not', 'filter', 'order', 'limit', 'range']) {
        b[m] = (...args: unknown[]) => {
          call.filters.push([m, ...args])
          return b
        }
      }
      b.select = (cols: string, opts?: unknown) => {
        if (call.op === 'select') {
          call.cols = cols
          call.opts = opts
        }
        return b
      }
      b.insert = (p: Row) => ((call.op = 'insert'), (call.payload = p), b)
      b.update = (p: Row) => ((call.op = 'update'), (call.payload = p), b)
      b.upsert = (p: Row, o?: unknown) => ((call.op = 'upsert'), (call.payload = p), (call.opts = o), b)
      b.delete = () => ((call.op = 'delete'), b)
      b.single = done
      b.maybeSingle = done
      b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => done().then(res, rej)
      return b
    },
  }),
}))

vi.mock('@/lib/spark', () => ({
  fetchSparkListingByKey: vi.fn(async (_t: string, key: string) => {
    spark.calls++
    if (spark.byKeyError) throw spark.byKeyError
    const f = spark.byKey.get(key)
    return f ? { D: { Success: true, Results: [{ StandardFields: f }] } } : null
  }),
  fetchSparkListingsPage: vi.fn(async () => {
    spark.calls++
    return {
      D: { Success: true, Results: spark.address.map((f) => ({ StandardFields: f })), Pagination: { TotalRows: spark.address.length } },
    }
  }),
}))

vi.mock('@/lib/auth/cron-auth', () => ({ requireCronAuth: () => null }))
vi.mock('@/lib/crm/gmail', () => ({ sendCrmEmail: sent.sendCrmEmail }))
vi.mock('@/lib/data/brokers/directory', () => ({
  mailboxForSlug: async () => ({ email: 'matt@ryan-realty.com', slug: 'matt' }),
}))
vi.mock('@/lib/crm/suppressions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/crm/suppressions')>()),
  isSuppressed: async () => ({ suppressed: false, reasons: [] }),
}))
vi.mock('@/lib/identity/outbound-links', () => ({ decorateOutboundText: (b: string) => b }))
vi.mock('./helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./helpers')>()),
  inSmsQuietHours: () => false,
  laHour: () => 12,
  nextSendWindow: () => new Date('2026-10-01T15:05:00Z'),
}))
vi.mock('@/lib/crm/merge-context', () => ({ buildMergeContext: async () => ({}) }))
vi.mock('@/lib/crm/twilio', () => ({
  sendSms: sent.sendSms,
  sendSmsViaMessagingService: sent.sendSmsViaMessagingService,
  brokerTwilioNumber: async () => '+15415550100',
  getA2pCampaignStatus: async () => 'VERIFIED',
}))
vi.mock('@/lib/data/crm/shortLinks', () => ({ instrumentSmsLinks: async (b: string) => b }))
vi.mock('@/lib/crm/enroll', () => ({ manualEnrollPerson: vi.fn() }))
vi.mock('@/lib/crm/sequence-outbound', () => ({ recordSequenceOutbound: vi.fn(async () => undefined) }))
vi.mock('@/lib/crm/broker-alerts', () => ({ queueBrokerHealthAlert: sent.queueBrokerHealthAlert }))
vi.mock('@/lib/data/crm/getCrmAutomationRules', () => ({
  getActiveRulesForTrigger: async (_t: string, tag: string) => [
    { actionType: 'enroll_sequence', actionValue: tag === 'intent:fsbo' ? '4' : '3', position: tag === 'intent:fsbo' ? 1 : 0 },
  ],
}))

import { GET } from './route'

const EXPIRED_RECOVERY = {
  id: 3,
  name: 'Expired Recovery (auto)',
  status: 'active',
  stop_on_reply: true,
  fub_legacy_plan_id: 71,
  steps: [
    { channel: 'sms', body: 'Hi %contact_first_name%, quick note about your home.', fallbackEmailBody: 'Hi %contact_first_name%' },
    {
      channel: 'sms',
      delayDays: 2,
      body: 'Hi %contact_first_name%, here is the value report for your home: %cma_link%',
      fallbackEmailBody: 'Hi %contact_first_name%, the report: %cma_link%',
    },
    { channel: 'task', confirm: true, taskName: 'Call the owner' },
  ],
}

function enrollment(over: Row = {}): Row {
  return {
    id: 31,
    person_id: 56921,
    sequence_id: 3,
    step_index: 1,
    created_at: '2026-07-05T17:00:00Z',
    first_touch_override: null,
    crm_sequences: EXPIRED_RECOVERY,
    ...over,
  }
}

const GREENMONT_OWNER = {
  id: 56921,
  fub_legacy_id: null,
  first_name: 'Pat',
  last_name: 'Owner',
  name: 'Pat Owner',
  stage: 'Lead',
  source: 'Expired Listing',
  lender_name: null,
  emails: [{ value: 'owner@example.com' }],
  phones: [{ value: '+15415550199', isPrimary: true }],
  addresses: [],
  tags: ['source:expired-listing-cron', 'audience:seller', 'intent:expired-listing'],
  // The CMA is built, so without the guard step 1 would text now.
  custom: { cmaSlug: 'cma-20873-greenmont', cmaLink: 'https://ryan-realty.com/cma/cma-20873-greenmont' },
  assigned_broker: 'matt',
}

const GREENMONT_EXPIRED_ROW = {
  listing_key: OLD_KEY,
  street_address: '20873 Greenmont',
  city: 'Bend',
  postal_code: '97702',
  expired_at: '2026-07-05T05:00:00Z',
  status_change_timestamp: '2026-07-05T05:00:00Z',
  detected_at: '2026-07-05T06:30:00Z',
}

function sparkListing(key: string, over: Record<string, unknown>) {
  return {
    ListingKey: key,
    StreetNumber: '20873',
    StreetName: 'Greenmont',
    UnitNumber: null,
    City: 'Bend',
    PostalCode: '97702',
    CloseDate: null,
    ...over,
  }
}

function enrollmentUpdates(): Row[] {
  return db.calls.filter((c) => c.table === 'crm_sequence_enrollments' && c.op === 'update').map((c) => c.payload!)
}

function timelineWrites(): Row[] {
  return db.calls.filter((c) => c.table === 'crm_timeline' && (c.op === 'insert' || c.op === 'upsert')).map((c) => c.payload!)
}

async function runEngine() {
  const res = await GET(new Request('http://localhost/api/cron/crm-sequence-engine'))
  return (await res.json()) as Record<string, unknown>
}

beforeEach(() => {
  process.env.SPARK_API_KEY = 'test-key'
  db.calls = []
  db.enrollments = [enrollment()]
  db.person = { ...GREENMONT_OWNER }
  db.expired = [{ ...GREENMONT_EXPIRED_ROW }]
  db.fsbo = []
  db.listings = []
  db.prospectReadError = null
  spark.byKey = new Map([[OLD_KEY, sparkListing(OLD_KEY, { StandardStatus: 'Expired', StatusChangeTimestamp: '2026-07-05T05:00:00Z' })]])
  spark.byKeyError = null
  spark.address = []
  spark.calls = 0
  for (const fn of Object.values(sent)) fn.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('the relist guard in the sequence engine', () => {
  it('the Greenmont shape (relisted under a new key at the same address) stops before step 1 and sends nothing', async () => {
    spark.address = [
      sparkListing(NEW_KEY, { StandardStatus: 'Active', StatusChangeTimestamp: '2026-07-06T21:24:39Z', OnMarketDate: '2026-07-06T21:24:39Z' }),
    ]
    const out = await runEngine()
    expect(sent.sendSms).not.toHaveBeenCalled()
    expect(sent.sendSmsViaMessagingService).not.toHaveBeenCalled()
    expect(sent.sendCrmEmail).not.toHaveBeenCalled()
    expect(enrollmentUpdates()).toEqual([expect.objectContaining({ status: 'stopped' })])
    const note = timelineWrites().find((w) => String(w.title).includes('stopped'))!
    expect(note.title).toBe('Workflow "Expired Recovery (auto)" stopped: 20873 Greenmont, Bend is Active on the MLS since 2026-07-06')
    expect(String(note.body)).toContain(NEW_KEY)
    expect(String(note.body)).toMatch(/^Nothing was sent\./)
    expect(out).toMatchObject({ relistStopped: 1, executed: 0 })
    // No step claim was taken: nothing reached a send.
    expect(db.calls.some((c) => c.table === 'crm_sequence_sends')).toBe(false)
  })

  it('also stops when only our listings table has the relist', async () => {
    db.listings = [
      {
        ListingKey: NEW_KEY,
        StreetNumber: '20873',
        StreetName: 'Greenmont',
        City: 'Bend',
        StandardStatus: 'Active',
        CloseDate: null,
        status_change_timestamp: '2026-07-06T21:24:39Z',
        parcel_number: null,
      },
    ]
    const out = await runEngine()
    expect(sent.sendSms).not.toHaveBeenCalled()
    expect(enrollmentUpdates()).toEqual([expect.objectContaining({ status: 'stopped' })])
    expect(out).toMatchObject({ relistStopped: 1 })
  })

  it('an off-market home sends', async () => {
    const out = await runEngine()
    expect(sent.sendSms).toHaveBeenCalledTimes(1)
    expect(sent.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+15415550199', body: expect.stringContaining('https://ryan-realty.com/cma/cma-20873-greenmont') }),
    )
    // Advanced to the broker-confirmed task.
    expect(enrollmentUpdates()).toEqual([expect.objectContaining({ step_index: 2, status: 'awaiting_broker_next' })])
    expect(out).toMatchObject({ executed: 1, relistStopped: 0, relistHeld: 0 })
    expect(spark.calls).toBe(2)
  })

  it('a Spark failure sends nothing and holds the step (30 minutes, not counted)', async () => {
    spark.byKeyError = new Error('Spark API error 503: Service Unavailable')
    const t0 = Date.now()
    const out = await runEngine()
    expect(sent.sendSms).not.toHaveBeenCalled()
    expect(sent.sendCrmEmail).not.toHaveBeenCalled()
    const [update] = enrollmentUpdates()
    expect(update).not.toHaveProperty('status')
    const retryIn = Date.parse(String(update!.next_run_at)) - t0
    expect(retryIn).toBeGreaterThanOrEqual(29 * 60_000)
    expect(retryIn).toBeLessThanOrEqual(31 * 60_000)
    const hold = timelineWrites().find((w) => w.dedupe_key === 'seq-relist-hold:e31:s1')!
    expect(String(hold.title)).toMatch(/held: the MLS relist check could not answer/)
    expect(out).toMatchObject({ relistHeld: 1, executed: 0 })
  })

  it('an unreadable prospect table sends nothing either', async () => {
    db.prospectReadError = { message: 'connection reset' }
    await runEngine()
    expect(sent.sendSms).not.toHaveBeenCalled()
    expect(enrollmentUpdates()[0]).toHaveProperty('next_run_at')
  })

  it('no linked expired or FSBO record: pauses with a note, never sends blind', async () => {
    db.expired = []
    const out = await runEngine()
    expect(sent.sendSms).not.toHaveBeenCalled()
    expect(enrollmentUpdates()).toEqual([expect.objectContaining({ status: 'paused' })])
    expect(timelineWrites().some((w) => String(w.title).includes('no expired or FSBO record is linked'))).toBe(true)
    expect(out).toMatchObject({ relistPaused: 1 })
  })

  it('guards the first text (step 0) and the email stand-in too', async () => {
    db.enrollments = [enrollment({ step_index: 0 })]
    spark.address = [sparkListing(NEW_KEY, { StandardStatus: 'Pending', StatusChangeTimestamp: '2026-08-01T00:00:00Z' })]
    await runEngine()
    expect(sent.sendSms).not.toHaveBeenCalled()
    expect(sent.sendCrmEmail).not.toHaveBeenCalled()
    expect(enrollmentUpdates()).toEqual([expect.objectContaining({ status: 'stopped' })])
  })

  it('leaves other workflows alone: a buyer with no expired or FSBO intent is not checked', async () => {
    db.enrollments = [
      enrollment({
        sequence_id: 2,
        step_index: 1,
        crm_sequences: {
          id: 2,
          name: 'Buyer Lead — Master Workflow',
          status: 'active',
          stop_on_reply: true,
          fub_legacy_plan_id: 70,
          steps: [{ channel: 'email', body: 'x' }, { channel: 'sms', body: 'Hi %contact_first_name%, new homes this week.' }, { channel: 'task', confirm: true }],
        },
      }),
    ]
    db.person = { ...GREENMONT_OWNER, tags: ['audience:buyer'] }
    await runEngine()
    expect(spark.calls).toBe(0)
    expect(sent.sendSms).toHaveBeenCalledTimes(1)
  })
})
