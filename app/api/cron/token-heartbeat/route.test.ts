/**
 * /api/cron/token-heartbeat: every platform state, the per-day alert dedupe,
 * removed platforms (Matt 2026-10-14), and "never logs a token". DB, env and
 * platform libs are mocked; the alert path is the REAL queueBrokerHealthAlert
 * over an in-memory crm_broker_alerts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Row = Record<string, unknown>

const db = {
  tables: {} as Record<string, Row | null>,
  readErrors: new Set<string>(),
  /** Every table the route selected from, in order. */
  reads: [] as string[],
  syncLogs: [] as Row[][],
  syncLogError: null as string | null,
}

/** Minimal supabase-js shape the route uses. select() projects the named columns, like PostgREST. */
function fakeClient() {
  return {
    from(table: string) {
      if (table === 'sync_logs') {
        return {
          insert: async (rows: Row[]) => {
            if (db.syncLogError) return { error: { message: db.syncLogError } }
            db.syncLogs.push(rows)
            return { error: null }
          },
        }
      }
      return {
        select(cols: string) {
          db.reads.push(table)
          const names = cols.split(',').map((c) => c.trim())
          return {
            eq: () => ({
              maybeSingle: async () => {
                if (db.readErrors.has(table)) return { data: null, error: { message: `could not reach ${table}` } }
                const row = db.tables[table]
                if (!row) return { data: null, error: null }
                return { data: Object.fromEntries(names.map((n) => [n, row[n] ?? null])), error: null }
              },
            }),
          }
        },
        update(patch: Row) {
          return {
            eq: async () => {
              db.tables[table] = { ...(db.tables[table] ?? {}), ...patch }
              return { error: null }
            },
          }
        },
      }
    },
  }
}

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => fakeClient() }))

// In-memory crm_broker_alerts for the real queueBrokerHealthAlert dedupe.
const alerts: Array<{ body: string; toPhone: string; createdAt: number }> = []
vi.mock('@/lib/data/crm/healthAlertQueue', () => ({
  recentHealthAlertExists: async (marker: string, sinceIso: string) =>
    alerts.some((a) => a.body.startsWith(marker) && a.createdAt >= Date.parse(sinceIso)),
  insertHealthAlert: async (p: { toPhone: string; body: string }) => {
    alerts.push({ ...p, createdAt: Date.now() })
  },
}))

const getters = {
  youtube: vi.fn(),
  x: vi.fn(),
  gbp: vi.fn(),
  pinterest: vi.fn(),
  nextdoor: vi.fn(),
  tiktokRefresh: vi.fn(),
  // Removed platforms: wired so a call would be visible, and asserted never called.
  linkedin: vi.fn(),
  threads: vi.fn(),
}
vi.mock('@/lib/youtube', () => ({ getYouTubeAccessToken: (...a: unknown[]) => getters.youtube(...a) }))
vi.mock('@/lib/x', () => ({ getXAccessToken: (...a: unknown[]) => getters.x(...a) }))
vi.mock('@/lib/google-business-profile', () => ({
  getOrRefreshGoogleBusinessProfileAccessToken: (...a: unknown[]) => getters.gbp(...a),
}))
vi.mock('@/lib/pinterest', () => ({ getPinterestAccessToken: (...a: unknown[]) => getters.pinterest(...a) }))
vi.mock('@/lib/nextdoor', () => ({ getNextdoorAccessToken: (...a: unknown[]) => getters.nextdoor(...a) }))
vi.mock('@/lib/tiktok', () => ({ refreshAccessToken: (...a: unknown[]) => getters.tiktokRefresh(...a) }))
vi.mock('@/lib/linkedin', () => ({ getLinkedInAccessToken: (...a: unknown[]) => getters.linkedin(...a) }))
vi.mock('@/lib/threads', () => ({ getThreadsAccessToken: (...a: unknown[]) => getters.threads(...a) }))

const fetchMock = vi.fn()

const ENV_GROUPS: Record<string, string[]> = {
  linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_REDIRECT_URI'],
  youtube: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REDIRECT_URI'],
  x: ['X_CLIENT_ID', 'X_CLIENT_SECRET', 'X_REDIRECT_URI'],
  gbp: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_BUSINESS_PROFILE_REDIRECT_URI'],
  gbpAlt: ['GOOGLE_BUSINESS_PROFILE_CLIENT_ID', 'GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET'],
  tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI'],
  threads: ['THREADS_CLIENT_ID', 'THREADS_CLIENT_SECRET', 'THREADS_REDIRECT_URI'],
  pinterest: ['PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET', 'PINTEREST_REDIRECT_URI'],
  nextdoor: ['NEXTDOOR_CLIENT_ID', 'NEXTDOOR_CLIENT_SECRET', 'NEXTDOOR_REDIRECT_URI'],
  meta: ['META_PAGE_ACCESS_TOKEN', 'META_PAGE_TOKEN'],
}

/** Every known env name is stubbed: present ones get a value, the rest are blank. */
function setEnv(present: string[]) {
  for (const [group, names] of Object.entries(ENV_GROUPS)) {
    for (const name of names) vi.stubEnv(name, present.includes(group) ? `${name.toLowerCase()}-value` : '')
  }
  if (present.includes('meta')) vi.stubEnv('META_PAGE_ACCESS_TOKEN', 'EAAG-SECRET-meta-page-token')
}

const NOW = '2026-10-14T12:00:05.000Z'
const HOUR = 3600_000
const DAY = 24 * HOUR
const at = (ms: number) => new Date(Date.parse(NOW) + ms).toISOString()

/** A getter that refreshes: moves expires_at forward like the real lib, returns an access token. */
function refreshes(table: string, ms: number, token: string) {
  return async () => {
    db.tables[table] = { ...(db.tables[table] ?? {}), expires_at: new Date(Date.now() + ms).toISOString() }
    return token
  }
}

/**
 * Production as read 2026-10-14 (presence + expiry only): LinkedIn's dead row
 * and the Threads client env are still there, but both platforms are removed.
 */
function todaysData() {
  setEnv(['linkedin', 'youtube', 'x', 'gbp', 'tiktok', 'threads', 'meta'])
  db.tables = {
    linkedin_auth: { access_token: 'li-SECRET-access', refresh_token: null, expires_at: '2026-07-09T02:26:37.528Z' },
    x_auth: { access_token: 'x-SECRET-access-old', refresh_token: 'x-SECRET-refresh', expires_at: '2026-10-13T14:00:50.389Z' },
    youtube_auth: { access_token: 'yt-SECRET-access-old', refresh_token: 'yt-SECRET-refresh', expires_at: '2026-10-13T13:00:49.211Z' },
    google_business_profile_auth: { access_token: 'gbp-SECRET-access-old', refresh_token: 'gbp-SECRET-refresh', expires_at: '2026-10-13T13:00:49.312Z' },
    tiktok_auth: { access_token: 'tt-SECRET-access-old', refresh_token: 'tt-SECRET-refresh', expires_at: '2026-10-14T12:00:50.326Z' },
    threads_auth: null,
    pinterest_auth: null,
    nextdoor_auth: null,
  }
  getters.x.mockImplementation(refreshes('x_auth', 2 * HOUR, 'x-SECRET-access-new'))
  getters.youtube.mockImplementation(refreshes('youtube_auth', HOUR, 'yt-SECRET-access-new'))
  getters.gbp.mockImplementation(refreshes('google_business_profile_auth', HOUR, 'gbp-SECRET-access-new'))
  getters.tiktokRefresh.mockResolvedValue({
    access_token: 'tt-SECRET-access-new',
    refresh_token: 'tt-SECRET-refresh-new',
    expires_in: 86400,
    open_id: 'o',
    scope: 's',
    token_type: 'Bearer',
  })
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: '1234567890' }), { status: 200 }))
}

/** Every remaining platform connected and alive (Nextdoor stays off: partner-gated). */
function healthyData() {
  todaysData()
  setEnv(['linkedin', 'youtube', 'x', 'gbp', 'tiktok', 'threads', 'pinterest', 'meta'])
  db.tables.pinterest_auth = { refresh_token: 'pin-SECRET-refresh', expires_at: at(20 * DAY) }
  getters.pinterest.mockResolvedValue('pin-SECRET-access')
}

const req = (qs = '', auth: string | null = 'Bearer test-secret') =>
  new NextRequest(`https://ryan-realty.com/api/cron/token-heartbeat${qs}`, {
    headers: auth ? { authorization: auth } : {},
  })

type Body = {
  ok: boolean
  anyFailed: boolean
  summary: { ok: number; failure: number; warning: number; off: number; failures: string[]; warnings: string[] }
  results: Array<{ platform: string; state: string; severity: string; message: string; alertQueued?: boolean }>
  removed: Array<{ platform: string; reason: string }>
}

async function run(qs = ''): Promise<{ status: number; body: Body }> {
  const { GET } = await import('./route')
  const res = await GET(req(qs))
  return { status: res.status, body: (await res.json()) as Body }
}

const byPlatform = (body: Body, p: string) => body.results.find((r) => r.platform === p)
const markers = () => alerts.map((a) => a.body.split(' ')[0])

describe('/api/cron/token-heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW))
    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.stubEnv('TWILIO_FORWARD_MATT', '+15415550100')
    vi.stubGlobal('fetch', fetchMock)
    db.readErrors = new Set()
    db.reads = []
    db.syncLogs = []
    db.syncLogError = null
    alerts.length = 0
    for (const g of Object.values(getters)) g.mockReset()
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('refuses a request without the cron secret and does no work', async () => {
    todaysData()
    const { GET } = await import('./route')
    const res = await GET(req('', null))
    expect(res.status).toBe(401)
    expect(getters.x).not.toHaveBeenCalled()
    expect(db.syncLogs).toHaveLength(0)
  })

  it("today's data: no texts, Pinterest a warning only, Nextdoor off, everything else ok", async () => {
    todaysData()
    const { status, body } = await run()

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.anyFailed).toBe(false)
    expect(byPlatform(body, 'pinterest')).toMatchObject({
      state: 'not_configured',
      severity: 'warning',
      message:
        'Pinterest is not configured (PINTEREST_CLIENT_ID, PINTEREST_CLIENT_SECRET, PINTEREST_REDIRECT_URI unset): set the client env, then connect at /api/pinterest/authorize',
    })
    expect(byPlatform(body, 'nextdoor')).toMatchObject({ state: 'not_configured', severity: 'off' })
    for (const p of ['meta', 'youtube', 'x', 'google_business_profile', 'tiktok']) {
      expect(byPlatform(body, p)).toMatchObject({ state: 'ok', severity: 'ok' })
    }
    expect(body.summary).toMatchObject({ ok: 5, failure: 0, warning: 1, off: 1 })
    expect(alerts).toHaveLength(0)

    // Refresh still happens for everything that has a refresh path.
    expect(getters.x).toHaveBeenCalledTimes(1)
    expect(getters.youtube).toHaveBeenCalledTimes(1)
    expect(getters.gbp).toHaveBeenCalledTimes(1)
    expect(getters.tiktokRefresh).toHaveBeenCalledTimes(1)
    expect(db.tables.tiktok_auth?.refresh_token).toBe('tt-SECRET-refresh-new')

    // sync_logs: one row per remaining platform plus a 200 run row.
    const rows = db.syncLogs[0]
    expect(rows).toHaveLength(8)
    const row = (ep: string) => rows.find((r) => r.endpoint === ep)
    expect(row('token_heartbeat')).toMatchObject({ response_status: 200, error_message: null, alert_sent: false, records_returned: 7 })
    expect(row('token_heartbeat:pinterest')).toMatchObject({ response_status: 204, alert_sent: false })
    expect(row('token_heartbeat:nextdoor')).toMatchObject({ response_status: 204 })
    expect(row('token_heartbeat:youtube')).toMatchObject({ response_status: 200, error_message: null })
  })

  it('removed platforms (LinkedIn, Threads) are never read, refreshed, logged or alerted, even with a dead token row', async () => {
    healthyData()
    // A dead LinkedIn row with a refresh token, and a dead Threads row: both would fail if checked.
    db.tables.linkedin_auth = { access_token: 'li-SECRET-access', refresh_token: 'li-SECRET-refresh', expires_at: '2026-07-09T02:26:37.528Z' }
    db.tables.threads_auth = { access_token: 'th-SECRET-access', expires_at: '2026-08-01T00:00:00.000Z' }
    const { status, body } = await run()

    expect(status).toBe(200)
    expect(alerts).toHaveLength(0)
    expect(getters.linkedin).not.toHaveBeenCalled()
    expect(getters.threads).not.toHaveBeenCalled()
    expect(db.reads).not.toContain('linkedin_auth')
    expect(db.reads).not.toContain('threads_auth')
    expect(body.results.map((r) => r.platform)).not.toContain('linkedin')
    expect(body.results.map((r) => r.platform)).not.toContain('threads')
    const endpoints = db.syncLogs[0].map((r) => r.endpoint)
    expect(endpoints).not.toContain('token_heartbeat:linkedin')
    expect(endpoints).not.toContain('token_heartbeat:threads')
    expect(JSON.stringify(db.syncLogs)).not.toMatch(/LinkedIn|Threads/)
    // Listed in the response only so a reader knows they are gone on purpose.
    expect(body.removed).toEqual([
      { platform: 'linkedin', reason: 'Matt 2026-10-14: "Just remove LinkedIn and Threads."' },
      { platform: 'threads', reason: 'Matt 2026-10-14: "Just remove LinkedIn and Threads."' },
    ])
  })

  it('dedupes alerts on platform + state + date: a re-run the same day is quiet, the next day pages again', async () => {
    healthyData()
    db.tables.pinterest_auth = null // configured, never connected: a door target, so a failure
    getters.x.mockRejectedValue(new Error('X token refresh failed: 400 Bad Request'))
    const first = await run()
    expect(first.status).toBe(500)
    expect(markers().sort()).toEqual([
      '[crm-health:token-heartbeat:pinterest:not_connected:2026-10-14]',
      '[crm-health:token-heartbeat:x:expired:2026-10-14]',
    ])

    vi.setSystemTime(new Date('2026-10-14T18:30:00.000Z'))
    const again = await run()
    expect(again.status).toBe(500) // still failing, still a red cron
    expect(alerts).toHaveLength(2) // but no second text
    expect(byPlatform(again.body, 'x')?.alertQueued).toBe(false)

    vi.setSystemTime(new Date('2026-10-15T12:00:05.000Z'))
    await run()
    expect(alerts).toHaveLength(4)
    expect(markers().slice(2).sort()).toEqual([
      '[crm-health:token-heartbeat:pinterest:not_connected:2026-10-15]',
      '[crm-health:token-heartbeat:x:expired:2026-10-15]',
    ])
  })

  it('a new state for the same platform on the same day is its own alert', async () => {
    healthyData()
    db.tables.pinterest_auth = { refresh_token: null, expires_at: at(2 * HOUR) }
    const first = await run()
    expect(byPlatform(first.body, 'pinterest')).toMatchObject({
      state: 'expiring',
      alertQueued: true,
      message:
        'Pinterest token expires 2026-10-14 (under 1 day left) with no refresh token: reconnect at /api/pinterest/authorize',
    })

    vi.setSystemTime(new Date(Date.parse(NOW) + 3 * HOUR))
    const second = await run()
    expect(byPlatform(second.body, 'pinterest')).toMatchObject({ state: 'expired', alertQueued: true })
    expect(markers()).toEqual([
      '[crm-health:token-heartbeat:pinterest:expiring:2026-10-14]',
      '[crm-health:token-heartbeat:pinterest:expired:2026-10-14]',
    ])
  })

  it('ok: every platform alive is a 200 with no alerts and a 200 run row', async () => {
    healthyData()
    const { status, body } = await run()
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.summary).toMatchObject({ ok: 6, failure: 0, warning: 0, off: 1 })
    expect(alerts).toHaveLength(0)
    const runRow = db.syncLogs[0].find((r) => r.endpoint === 'token_heartbeat')
    expect(runRow).toMatchObject({ response_status: 200, error_message: null, alert_sent: false })
  })

  it('expiring: a no-refresh token under 14 days is a failure that names the date', async () => {
    healthyData()
    db.tables.pinterest_auth = { refresh_token: null, expires_at: at(6 * DAY) }
    const { status, body } = await run()
    expect(status).toBe(500)
    expect(byPlatform(body, 'pinterest')).toMatchObject({
      state: 'expiring',
      severity: 'failure',
      message: 'Pinterest token expires 2026-10-20 (6 days left) with no refresh token: reconnect at /api/pinterest/authorize',
    })
  })

  it('expired: a token past expiry with no refresh token names the date and the fix', async () => {
    healthyData()
    db.tables.pinterest_auth = { refresh_token: null, expires_at: '2026-07-09T02:26:37.528Z' }
    const { status, body } = await run()
    expect(status).toBe(500)
    expect(byPlatform(body, 'pinterest')).toMatchObject({
      state: 'expired',
      severity: 'failure',
      message: 'Pinterest token expired 2026-07-09 with no refresh token: reconnect at /api/pinterest/authorize',
      alertQueued: true,
    })
    expect(getters.pinterest).not.toHaveBeenCalled() // nothing can renew it
  })

  it('expired: a refresh that fails on a dead token is a failure, not "auto-refresh"', async () => {
    healthyData()
    getters.x.mockRejectedValue(new Error('X token refresh failed: 400 Bad Request'))
    const { status, body } = await run()
    expect(status).toBe(500)
    expect(byPlatform(body, 'x')).toMatchObject({
      state: 'expired',
      severity: 'failure',
      message:
        'X token expired 2026-10-13 and the refresh failed (X token refresh failed: 400 Bad Request): reconnect at /api/x/authorize',
    })
  })

  it('not_connected: a configured publish-door target with no token row fails', async () => {
    healthyData()
    db.tables.pinterest_auth = null
    const { status, body } = await run()
    expect(status).toBe(500)
    expect(byPlatform(body, 'pinterest')).toMatchObject({
      state: 'not_connected',
      severity: 'failure',
      message: 'Pinterest is not connected (no pinterest_auth row): connect at /api/pinterest/authorize',
    })
  })

  it('not_configured: a missing client env is a warning, and does not fail the run on its own', async () => {
    healthyData()
    setEnv(['youtube', 'x', 'gbp', 'tiktok', 'meta'])
    db.tables.pinterest_auth = null
    const { status, body } = await run()
    expect(status).toBe(200)
    expect(byPlatform(body, 'pinterest')).toMatchObject({ state: 'not_configured', severity: 'warning' })
    expect(body.summary.warnings[0]).toContain('PINTEREST_CLIENT_ID')
    expect(alerts).toHaveLength(0)
  })

  it('error: an unreadable token table is a failure', async () => {
    healthyData()
    db.readErrors.add('youtube_auth')
    const { status, body } = await run()
    expect(status).toBe(500)
    expect(byPlatform(body, 'youtube')).toMatchObject({ state: 'error', severity: 'failure' })
    expect(byPlatform(body, 'youtube')?.message).toContain('could not read youtube_auth')
  })

  it('meta: Graph 190 is expired', async () => {
    healthyData()
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Error validating access token', code: 190 } }), { status: 400 }),
    )
    const { body } = await run()
    expect(byPlatform(body, 'meta')).toMatchObject({ state: 'expired', severity: 'failure' })
  })

  it('notify=0 runs and reports the failure without texting', async () => {
    healthyData()
    db.tables.pinterest_auth = null
    const { status } = await run('?notify=0')
    expect(status).toBe(500)
    expect(alerts).toHaveLength(0)
    expect(db.syncLogs).toHaveLength(1)
  })

  it('a heartbeat that cannot write sync_logs fails the cron', async () => {
    healthyData()
    db.syncLogError = 'permission denied for table sync_logs'
    const { status, body } = await run()
    expect(status).toBe(500)
    expect(body.ok).toBe(false)
  })

  it('never logs, returns, stores or texts a token value', async () => {
    healthyData()
    // Errors that echo secrets, the way a careless upstream message would.
    getters.x.mockRejectedValue(
      new Error('X token refresh failed for x-SECRET-refresh: 400 (Authorization: Bearer x-SECRET-access-old)'),
    )
    getters.youtube.mockRejectedValue(new Error('POST /token?refresh_token=yt-SECRET-refresh&client_secret=abc123456 400'))
    getters.pinterest.mockRejectedValue(new Error('Pinterest refresh failed; stored pin-SECRET-refresh rejected'))
    db.tables.pinterest_auth = { refresh_token: 'pin-SECRET-refresh', expires_at: at(-HOUR) }
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ error: { message: 'Malformed access token EAAG-SECRET-meta-page-token', code: 190 } }),
          { status: 400 },
        ),
    )
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    )

    const { body } = await run()

    const printed = spies.flatMap((s) => s.mock.calls.map((c) => c.map((x) => String(x)).join(' ')))
    const surfaces = [JSON.stringify(body), JSON.stringify(db.syncLogs), JSON.stringify(alerts), ...printed].join('\n')
    expect(printed.length).toBeGreaterThan(0)
    expect(alerts.length).toBeGreaterThan(0)
    // Every token value this test planted (env names like *_CLIENT_SECRET may appear; values never).
    const planted = [
      ...Object.values(db.tables).flatMap((row) =>
        row ? [row.access_token, row.refresh_token].filter((v): v is string => typeof v === 'string') : [],
      ),
      'x-SECRET-refresh',
      'x-SECRET-access-old',
      'yt-SECRET-refresh',
      'pin-SECRET-refresh',
      'tt-SECRET-access-new',
      'tt-SECRET-refresh',
      'tt-SECRET-refresh-new',
      'gbp-SECRET-access-new',
      'EAAG-SECRET-meta-page-token',
      'abc123456',
    ]
    for (const value of planted) expect(surfaces).not.toContain(value)
    expect(surfaces).not.toMatch(/[a-z]+-SECRET-[a-z-]+/)
    // It still says what broke.
    expect(byPlatform(body, 'x')?.message).toContain('the refresh failed (X token refresh failed for [redacted]')
    expect(byPlatform(body, 'meta')).toMatchObject({ state: 'expired' })
  })
})
