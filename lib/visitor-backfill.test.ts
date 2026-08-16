import { describe, expect, it } from 'vitest'
import { buildIdentityMapPatch } from './visitor-backfill'

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
