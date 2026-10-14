import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  alertBody,
  alertKey,
  checkFailed,
  classifyMeta,
  classifyToken,
  DISABLED_PLATFORMS,
  disabledReason,
  fixLink,
  isRemovedPlatform,
  missingEnv,
  PLATFORM_SPECS,
  redactSecrets,
  REMOVED_PLATFORMS,
  responseStatusFor,
  specFor,
  toSyncLogRows,
  type HeartbeatPlatform,
  type TokenObservation,
} from './token-heartbeat'
import { isPublishDoorPlatform, PUBLISH_DOOR_PLATFORMS, REMOVED_PLATFORMS_MESSAGE } from './publish-door'

const NOW = Date.parse('2026-10-14T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

// Fix links are built on the site origin; blank env means the canonical origin.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

function obs(over: Partial<TokenObservation> = {}): TokenObservation {
  return { envMissing: [], row: null, readError: null, refreshError: null, refreshed: false, ...over }
}

describe('token heartbeat state model', () => {
  it('ok: a refreshed token with a refresh path', () => {
    const r = classifyToken(
      specFor('youtube'),
      obs({ row: { expiresAt: '2026-10-14T13:00:00.000Z', hasRefreshToken: true }, refreshed: true }),
      NOW,
    )
    expect(r).toMatchObject({ state: 'ok', severity: 'ok', refreshed: true })
    expect(r.message).toBe('YouTube token refreshed, valid until 2026-10-14T13:00:00.000Z')
  })

  it('ok: no refresh token but 14+ days left, and the message says when to reconnect', () => {
    const r = classifyToken(
      specFor('pinterest'),
      obs({ row: { expiresAt: new Date(NOW + 30 * DAY).toISOString(), hasRefreshToken: false } }),
      NOW,
    )
    expect(r).toMatchObject({ state: 'ok', severity: 'ok' })
    expect(r.message).toContain('no refresh token: reconnect before then at https://ryan-realty.com/api/pinterest/authorize')
  })

  it('expiring: under 14 days and no refresh path is a failure', () => {
    const r = classifyToken(
      specFor('pinterest'),
      obs({ row: { expiresAt: new Date(NOW + 6 * DAY + 3600_000).toISOString(), hasRefreshToken: false } }),
      NOW,
    )
    expect(r).toMatchObject({ state: 'expiring', severity: 'failure' })
    expect(r.message).toBe(
      'Pinterest token expires 2026-10-20 (6 days left) with no refresh token: reconnect at https://ryan-realty.com/api/pinterest/authorize',
    )
  })

  it('expiring: a refresh path whose refresh failed while the token still has minutes left', () => {
    const r = classifyToken(
      specFor('x'),
      obs({
        row: { expiresAt: new Date(NOW + 20 * 60_000).toISOString(), hasRefreshToken: true },
        refreshError: 'X token refresh failed: 400 Bad Request',
      }),
      NOW,
    )
    expect(r).toMatchObject({ state: 'expiring', severity: 'failure' })
    expect(r.message).toBe(
      'X token expires 2026-10-14 (under 1 day left) and the refresh failed (X token refresh failed: 400 Bad Request): reconnect at https://ryan-realty.com/api/x/authorize',
    )
  })

  it('expired: no refresh token names the date and the fix', () => {
    const r = classifyToken(
      specFor('pinterest'),
      obs({ row: { expiresAt: '2026-07-09T02:26:37.528Z', hasRefreshToken: false } }),
      NOW,
    )
    expect(r).toMatchObject({ state: 'expired', severity: 'failure', hasRefreshToken: false })
    expect(r.message).toBe(
      'Pinterest token expired 2026-07-09 with no refresh token: reconnect at https://ryan-realty.com/api/pinterest/authorize',
    )
  })

  it('expired: a stored refresh token that no longer works is not "auto-refresh"', () => {
    const r = classifyToken(
      specFor('x'),
      obs({
        row: { expiresAt: '2026-08-29T14:00:00.000Z', hasRefreshToken: true },
        refreshError: 'X token refresh failed: 400 Bad Request',
      }),
      NOW,
    )
    expect(r).toMatchObject({ state: 'expired', severity: 'failure' })
    expect(r.message).toBe(
      'X token expired 2026-08-29 and the refresh failed (X token refresh failed: 400 Bad Request): reconnect at https://ryan-realty.com/api/x/authorize',
    )
  })

  it('expired: a token that cannot refresh because its client env is gone', () => {
    const r = classifyToken(
      specFor('pinterest'),
      obs({
        envMissing: ['PINTEREST_CLIENT_ID'],
        row: { expiresAt: '2026-10-01T00:00:00.000Z', hasRefreshToken: true },
      }),
      NOW,
    )
    expect(r.state).toBe('expired')
    expect(r.message).toContain('cannot refresh (PINTEREST_CLIENT_ID unset)')
  })

  it('not_connected: client env present, no row, on a publish-door target is a failure', () => {
    const r = classifyToken(specFor('pinterest'), obs(), NOW)
    expect(r).toMatchObject({ state: 'not_connected', severity: 'failure' })
    expect(r.message).toBe('Pinterest is not connected (no pinterest_auth row): connect at https://ryan-realty.com/api/pinterest/authorize')
  })

  it('not_configured: no client env is a warning, naming the missing env (names only)', () => {
    const spec = specFor('pinterest')
    const env = missingEnv(spec, {})
    const r = classifyToken(spec, obs({ envMissing: env }), NOW)
    expect(r).toMatchObject({ state: 'not_configured', severity: 'warning' })
    expect(r.message).toBe(
      'Pinterest is not configured (PINTEREST_CLIENT_ID, PINTEREST_CLIENT_SECRET, PINTEREST_REDIRECT_URI unset): set the client env, then connect at https://ryan-realty.com/api/pinterest/authorize',
    )
  })

  it('not_configured on a DISABLED platform is off, with its reason (Nextdoor is partner-gated)', () => {
    const spec = specFor('nextdoor')
    const r = classifyToken(spec, obs({ envMissing: missingEnv(spec, {}) }), NOW)
    expect(r).toMatchObject({ state: 'not_configured', severity: 'off' })
    expect(r.message).toMatch(/^Nextdoor is off on purpose \(not configured\): the Nextdoor posting API is partner-gated/)
    // and a never-connected disabled platform is off too, not a door failure
    expect(classifyToken(spec, obs(), NOW)).toMatchObject({ state: 'not_connected', severity: 'off' })
  })

  it('a disabled platform whose connected token dies still fails', () => {
    const r = classifyToken(
      specFor('nextdoor'),
      obs({ row: { expiresAt: '2026-10-01T00:00:00.000Z', hasRefreshToken: false } }),
      NOW,
    )
    expect(r).toMatchObject({ state: 'expired', severity: 'failure' })
  })

  it('error: an unreadable row, an unreadable expiry, or a check that threw', () => {
    expect(classifyToken(specFor('youtube'), obs({ readError: 'connection refused' }), NOW)).toMatchObject({
      state: 'error',
      severity: 'failure',
    })
    expect(
      classifyToken(specFor('youtube'), obs({ row: { expiresAt: null, hasRefreshToken: true } }), NOW),
    ).toMatchObject({ state: 'error', severity: 'failure' })
    expect(checkFailed(specFor('meta'), 'boom')).toMatchObject({ state: 'error', severity: 'failure' })
  })

  it('meta: a missing token is not_connected (a failure: it IS the Instagram and Facebook connection), 190 is expired, anything else is error', () => {
    const missing = classifyMeta({ tokenPresent: false })
    expect(missing).toMatchObject({ state: 'not_connected', severity: 'failure' })
    expect(missing.message).toBe(
      'Meta is not connected (META_PAGE_ACCESS_TOKEN and META_PAGE_TOKEN unset), so Instagram and Facebook cannot post: set a Page token in META_PAGE_ACCESS_TOKEN',
    )
    expect(classifyMeta({ tokenPresent: true, ok: true, pageId: '42' })).toMatchObject({ state: 'ok' })
    expect(
      classifyMeta({ tokenPresent: true, ok: false, code: 190, detail: 'Session has expired' }),
    ).toMatchObject({ state: 'expired', severity: 'failure' })
    expect(classifyMeta({ tokenPresent: true, ok: false, code: 2, detail: 'temporary' })).toMatchObject({
      state: 'error',
      severity: 'failure',
    })
  })
})

describe('removed platforms (Matt 2026-10-14)', () => {
  it('LinkedIn and Threads are REMOVED_PLATFORMS, each with Matt\'s ruling as the reason', () => {
    expect(REMOVED_PLATFORMS.map((r) => r.platform)).toEqual(['linkedin', 'threads'])
    for (const r of REMOVED_PLATFORMS) expect(r.reason).toContain('Matt 2026-10-14')
    expect(isRemovedPlatform('linkedin')).toBe(true)
    expect(isRemovedPlatform('threads')).toBe(true)
    expect(isRemovedPlatform('x')).toBe(false)
    expect(REMOVED_PLATFORMS_MESSAGE).toBe('LinkedIn and Threads were removed as platforms (Matt 2026-10-14)')
  })

  it('the heartbeat holds no spec for a removed platform, so it can never check, refresh or alert one', () => {
    const platforms = PLATFORM_SPECS.map((s) => s.platform as string)
    expect(platforms).not.toContain('linkedin')
    expect(platforms).not.toContain('threads')
    expect(PLATFORM_SPECS.some((s) => s.table === 'linkedin_auth' || s.table === 'threads_auth')).toBe(false)
    expect(() => specFor('linkedin' as HeartbeatPlatform)).toThrow()
  })

  it('the publish door no longer lists them', () => {
    expect(PUBLISH_DOOR_PLATFORMS).not.toContain('linkedin' as never)
    expect(PUBLISH_DOOR_PLATFORMS).not.toContain('threads' as never)
    expect(isPublishDoorPlatform('linkedin')).toBe(false)
    expect(isPublishDoorPlatform('threads')).toBe(false)
  })

  it('a removed platform is not also "disabled" (disabled platforms still alert on a dead token)', () => {
    const disabled = DISABLED_PLATFORMS.map((d) => d.platform as string)
    for (const r of REMOVED_PLATFORMS) expect(disabled).not.toContain(r.platform)
  })
})

describe('config', () => {
  it('every disabled platform has a reason, and Nextdoor is listed', () => {
    expect(DISABLED_PLATFORMS.every((d) => d.reason.trim().length > 20)).toBe(true)
    expect(disabledReason('nextdoor')).toContain('partner-gated')
    expect(disabledReason('pinterest')).toBeNull()
  })

  it('every publish-door target is powered by exactly one heartbeat platform', () => {
    const covered = PLATFORM_SPECS.flatMap((s) => s.doorTargets).sort()
    expect(covered).toEqual([...PUBLISH_DOOR_PLATFORMS].sort())
  })

  it('missingEnv treats an any-of group as satisfied by either name and ignores blanks', () => {
    const spec = specFor('google_business_profile')
    expect(
      missingEnv(spec, {
        GOOGLE_OAUTH_CLIENT_ID: 'id',
        GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
        GOOGLE_BUSINESS_PROFILE_REDIRECT_URI: '  ',
      }),
    ).toEqual(['GOOGLE_BUSINESS_PROFILE_REDIRECT_URI'])
  })
})

describe('redaction, alerts, sync_logs', () => {
  it('redacts known values and token-shaped params and headers', () => {
    const out = redactSecrets(
      'failed with sekret-refresh-123 at ?access_token=abc.def&x=1, header Bearer ya29.tokenvalue, Basic dXNlcjpwYXNz',
      ['sekret-refresh-123'],
    )
    expect(out).not.toContain('sekret-refresh-123')
    expect(out).not.toContain('abc.def')
    expect(out).not.toContain('ya29.tokenvalue')
    expect(out).not.toContain('dXNlcjpwYXNz')
    expect(out).toContain('access_token=[redacted]')
  })

  it('the fix in a message is a full, tappable https URL on the site origin', () => {
    expect(fixLink(specFor('x'))).toBe('https://ryan-realty.com/api/x/authorize')
    // Meta's fix is an env name, not a link.
    expect(fixLink(specFor('meta'))).toBe('META_PAGE_ACCESS_TOKEN')
    const r = classifyToken(specFor('pinterest'), obs(), NOW)
    expect(alertBody(r)).toBe(
      'Token heartbeat: Pinterest is not connected (no pinterest_auth row): connect at https://ryan-realty.com/api/pinterest/authorize',
    )
  })

  it('dedupe key is platform + state + UTC date', () => {
    expect(alertKey('pinterest', 'expired', '2026-10-14')).toBe('token-heartbeat:pinterest:expired:2026-10-14')
  })

  it('failures write 500 rows and a 500 run row that names them; warnings and off stay 204', () => {
    expect(responseStatusFor('ok')).toBe(200)
    expect(responseStatusFor('failure')).toBe(500)
    expect(responseStatusFor('warning')).toBe(204)
    expect(responseStatusFor('off')).toBe(204)
    const expired = classifyToken(
      specFor('pinterest'),
      obs({ row: { expiresAt: '2026-07-09T02:26:37.528Z', hasRefreshToken: false } }),
      NOW,
    )
    const rows = toSyncLogRows([{ ...expired, alertQueued: true }], 'cycle-1', 'test', 10)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      endpoint: 'token_heartbeat:pinterest',
      response_status: 500,
      alert_sent: true,
      error_message: `[expired] ${expired.message}`,
    })
    expect(rows[1]).toMatchObject({ endpoint: 'token_heartbeat', response_status: 500, records_returned: 1 })
    expect(rows[1].error_message).toContain('Pinterest token expired 2026-07-09')
  })
})
