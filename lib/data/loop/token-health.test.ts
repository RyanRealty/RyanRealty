import { describe, expect, it } from 'vitest'
import {
  classifyTokenHealth,
  consecutiveHeartbeatFailures,
  HEARTBEAT_FAIL_STREAK,
} from './token-health'

const now = Date.parse('2026-09-05T12:00:00Z')

describe('classifyTokenHealth', () => {
  it('empty table is empty', () => {
    expect(
      classifyTokenHealth({
        rows: 0,
        expiresAt: null,
        refreshTokenPresent: false,
        nowMs: now,
        consecutiveHeartbeatFailures: 0,
      }),
    ).toBe('empty')
  })

  it('unexpired access is valid even with a refresh token', () => {
    expect(
      classifyTokenHealth({
        rows: 1,
        expiresAt: '2026-09-05T13:00:00Z',
        refreshTokenPresent: true,
        nowMs: now,
        consecutiveHeartbeatFailures: 0,
      }),
    ).toBe('valid')
  })

  it('past expiry with a refresh token and a healthy heartbeat is auto-refresh', () => {
    expect(
      classifyTokenHealth({
        rows: 1,
        expiresAt: '2026-09-04T13:00:00Z',
        refreshTokenPresent: true,
        nowMs: now,
        consecutiveHeartbeatFailures: 0,
      }),
    ).toBe('auto-refresh')
  })

  it('past expiry with a refresh token and a dead heartbeat streak is needs-reauth', () => {
    expect(
      classifyTokenHealth({
        rows: 1,
        expiresAt: '2026-08-28T14:00:00Z',
        refreshTokenPresent: true,
        nowMs: now,
        consecutiveHeartbeatFailures: HEARTBEAT_FAIL_STREAK,
      }),
    ).toBe('needs-reauth')
  })

  it('past expiry with no refresh token is needs-reauth', () => {
    expect(
      classifyTokenHealth({
        rows: 1,
        expiresAt: '2026-07-09T02:26:00Z',
        refreshTokenPresent: false,
        nowMs: now,
        consecutiveHeartbeatFailures: 0,
      }),
    ).toBe('needs-reauth')
  })
})

describe('consecutiveHeartbeatFailures', () => {
  it('counts from the newest row until a success', () => {
    expect(
      consecutiveHeartbeatFailures([
        { response_status: 500 },
        { response_status: 500 },
        { response_status: 500 },
        { response_status: 200 },
      ]),
    ).toBe(3)
    expect(consecutiveHeartbeatFailures([{ response_status: 200 }, { response_status: 500 }])).toBe(0)
    expect(consecutiveHeartbeatFailures([])).toBe(0)
  })
})
