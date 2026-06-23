import { describe, it, expect } from 'vitest'
import { mirrorHealthStatus } from './mirror-health'

// Phase 0.5: the CRM_MIRROR_ENABLED kill switch can silently stop every
// FUB -> crm_* write. mirrorHealthStatus turns that silent state into a
// queryable, alarmable status (consumed by lib/crm/mirror.ts's loud warn and
// the future /admin/crm/health board). The semantics must match mirror.ts's
// mirrorEnabled(): disabled ONLY when CRM_MIRROR_ENABLED is exactly 'false'.
describe('mirrorHealthStatus (CRM mirror kill-switch alarm)', () => {
  it("alarms when CRM_MIRROR_ENABLED is 'false'", () => {
    const status = mirrorHealthStatus({ CRM_MIRROR_ENABLED: 'false' })
    expect(status.enabled).toBe(false)
    expect(status.level).toBe('alarm')
    expect(status.message).toContain('CRM_MIRROR_ENABLED=false')
    expect(status.message).toContain('NOT mirrored')
  })

  it('is ok when CRM_MIRROR_ENABLED is unset', () => {
    const status = mirrorHealthStatus({})
    expect(status.enabled).toBe(true)
    expect(status.level).toBe('ok')
  })

  it("is ok when CRM_MIRROR_ENABLED is 'true'", () => {
    const status = mirrorHealthStatus({ CRM_MIRROR_ENABLED: 'true' })
    expect(status.enabled).toBe(true)
    expect(status.level).toBe('ok')
  })

  it('treats any non-false string as enabled (only the exact string false disables)', () => {
    for (const value of ['1', '', 'FALSE', 'False', 'off', 'no', '0']) {
      const status = mirrorHealthStatus({ CRM_MIRROR_ENABLED: value })
      expect(status.enabled).toBe(true)
      expect(status.level).toBe('ok')
    }
  })

  it('is pure — reading does not mutate the input env bag', () => {
    const env = { CRM_MIRROR_ENABLED: 'false' }
    mirrorHealthStatus(env)
    expect(env).toEqual({ CRM_MIRROR_ENABLED: 'false' })
  })
})
